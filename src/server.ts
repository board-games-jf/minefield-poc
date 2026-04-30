import type * as Party from "partykit/server";

// ── Types ──────────────────────────────────────────────────────────────────

export type Difficulty = "easy" | "medium" | "hard";
export type AiLevel = "easy" | "medium" | "hard";

export interface DifficultyConfig {
  rows: number;
  cols: number;
  bombs: number;
}

export const CONFIGS: Record<Difficulty, DifficultyConfig> = {
  easy:   { rows: 6,  cols: 6,  bombs: 10 },
  medium: { rows: 8,  cols: 8,  bombs: 20 },
  hard:   { rows: 10, cols: 10, bombs: 30 },
};

export type GameStatus = "waiting" | "playing" | "finished";

export interface Player {
  id: string;
  name: string;
  score: number;
  bombs: number;
}

export interface GameState {
  status: GameStatus;
  difficulty: Difficulty;
  players: [Player | null, Player | null];
  currentPlayer: 0 | 1;
  grid: number[][];        // -1 = bomb, 0-8 = neighbour count
  revealed: boolean[][];
  foundBy: (0 | 1 | null)[][];
  totalBombs: number;
}

// Client → Server
export type ClientMessage =
  | { type: "join";   name: string; difficulty?: Difficulty; ai?: { level: AiLevel } }
  | { type: "reveal"; row: number; col: number };

// Server → Client
export type ServerMessage =
  | { type: "state"; state: GameState }
  | { type: "error"; message: string };

// ── Game Logic ─────────────────────────────────────────────────────────────

export function generateGrid(rows: number, cols: number, bombs: number): number[][] {
  const grid: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));

  let placed = 0;
  while (placed < bombs) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    if (grid[r][c] !== -1) { grid[r][c] = -1; placed++; }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === -1) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc] === -1) count++;
        }
      }
      grid[r][c] = count;
    }
  }

  return grid;
}

export function floodReveal(
  grid: number[][],
  revealed: boolean[][],
  r: number,
  c: number,
  rows: number,
  cols: number
): void {
  if (r < 0 || r >= rows || c < 0 || c >= cols) return;
  if (revealed[r][c]) return;
  if (grid[r][c] === -1) return;

  revealed[r][c] = true;

  if (grid[r][c] === 0) {
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++)
        if (dr !== 0 || dc !== 0)
          floodReveal(grid, revealed, r + dr, c + dc, rows, cols);
  }
}

export function createInitialState(difficulty: Difficulty): GameState {
  const { rows, cols, bombs } = CONFIGS[difficulty];
  return {
    status: "waiting",
    difficulty,
    players: [null, null],
    currentPlayer: 0,
    grid: generateGrid(rows, cols, bombs),
    revealed: Array.from({ length: rows }, () => Array(cols).fill(false)),
    foundBy: Array.from({ length: rows }, () => Array<0 | 1 | null>(cols).fill(null)),
    totalBombs: bombs,
  };
}

export function countFoundBombs(state: GameState): number {
  return (state.players[0]?.bombs ?? 0) + (state.players[1]?.bombs ?? 0);
}

export function isScoreUncatchable(state: GameState): boolean {
  const p1 = state.players[0];
  const p2 = state.players[1];
  if (!p1 || !p2) return false;
  const remainingBombs = Math.max(0, state.totalBombs - countFoundBombs(state));
  const maxSwing = remainingBombs * 10;
  return (p1.score > p2.score + maxSwing) || (p2.score > p1.score + maxSwing);
}

export function allSafeCellsRevealed(state: GameState): boolean {
  const { rows, cols } = CONFIGS[state.difficulty];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (!state.revealed[r][c] && state.grid[r][c] !== -1) return false;
  return true;
}

// ── PartyKit Server ────────────────────────────────────────────────────────

export default class GameRoom implements Party.Server {
  // Serve static files from /public in dev/prod.
  // PartyKit only routes party URLs automatically; without this, GET / returns 404.
  static async onFetch(req: Party.Request, lobby: Party.FetchLobby) {
    const url = new URL(req.url);
    let path = url.pathname;
    if (path === "/") path = "/index.html";

    const asset = await lobby.assets.fetch(path);
    if (asset) return asset;

    return new Response("Not found", { status: 404 });
  }

  state: GameState | null = null;
  connectionToPlayer: Map<string, 0 | 1> = new Map();
  private aiTimer: ReturnType<typeof setTimeout> | null = null;
  private aiLevel: AiLevel = "medium";
  private aiFlags: boolean[][] | null = null;

  constructor(readonly room: Party.Room) {}

  async onStart() {
    this.state = await this.room.storage.get<GameState>("state") ?? null;
    const saved = await this.room.storage.get<Map<string, 0 | 1>>("connectionToPlayer");
    this.connectionToPlayer = saved ?? new Map();
    this.aiLevel = await this.room.storage.get<AiLevel>("aiLevel") ?? "medium";
    this.aiFlags = await this.room.storage.get<boolean[][]>("aiFlags") ?? null;
    if (this.state && this.state.players[1]?.id === "ai") {
      this.ensureAiFlags();
    }
  }

  async onConnect(conn: Party.Connection) {
    if (!this.state) return;
    this.send(conn, { type: "state", state: this.state });
  }

  async onMessage(message: string, sender: Party.Connection) {
    const msg = JSON.parse(message) as ClientMessage;
    if (msg.type === "join")   await this.handleJoin(sender, msg.name, msg.difficulty, msg.ai);
    if (msg.type === "reveal") await this.handleReveal(sender, msg.row, msg.col);
  }

  async onClose(conn: Party.Connection) {
    this.connectionToPlayer.delete(conn.id);
    await this.room.storage.put("connectionToPlayer", this.connectionToPlayer);
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  private async handleJoin(conn: Party.Connection, name: string, difficulty?: Difficulty, ai?: { level: AiLevel }) {
    // Reconnection: player already has a slot
    if (this.state) {
      const existingSlot = this.findExistingSlot(name);
      if (existingSlot !== null) {
        // Update the stored connection id for this player (refresh / reconnect / new device).
        const p = this.state.players[existingSlot];
        if (p) p.id = conn.id;
        this.connectionToPlayer.set(conn.id, existingSlot);
        await this.persist();
        this.send(conn, { type: "state", state: this.state });
        return;
      }
    }

    // Room full
    if (this.state?.status === "playing" || this.state?.status === "finished") {
      if (this.state.players[0] !== null && this.state.players[1] !== null) {
        this.send(conn, { type: "error", message: "room_full" });
        return;
      }
    }

    // Player 1 creates room
    if (!this.state) {
      this.state = createInitialState(difficulty ?? "easy");
      this.state.players[0] = { id: conn.id, name, score: 0, bombs: 0 };
      this.connectionToPlayer.set(conn.id, 0);
      if (ai) {
        this.aiLevel = ai.level;
        await this.room.storage.put("aiLevel", this.aiLevel);
        // Single-player: spawn an AI opponent immediately.
        this.state.players[1] = { id: "ai", name: "AI", score: 0, bombs: 0 };
        this.state.status = "playing";
        this.state.currentPlayer = (Math.random() < 0.5 ? 0 : 1);
        this.ensureAiFlags();
        await this.room.storage.put("aiFlags", this.aiFlags);
      }
      await this.persist();
      this.broadcast();
      if (ai && this.state.currentPlayer === 1) this.scheduleAiMove(this.aiLevel);
      return;
    }

    // Player 2 joins
    if (this.state.players[0] !== null && this.state.players[1] === null) {
      this.state.players[1] = { id: conn.id, name, score: 0, bombs: 0 };
      this.state.status = "playing";
      // Who starts should be random once both players are present.
      this.state.currentPlayer = (Math.random() < 0.5 ? 0 : 1);
      this.connectionToPlayer.set(conn.id, 1);
      await this.persist();
      this.broadcast();
      return;
    }

    this.send(conn, { type: "error", message: "room_full" });
  }

  private async handleReveal(conn: Party.Connection, row: number, col: number) {
    if (!this.state || this.state.status !== "playing") return;

    const playerIndex = this.connectionToPlayer.get(conn.id);
    if (playerIndex === undefined) return;
    if (playerIndex !== this.state.currentPlayer) return;

    const { rows, cols } = CONFIGS[this.state.difficulty];
    if (row < 0 || row >= rows || col < 0 || col >= cols) return;
    if (this.state.revealed[row][col]) return;

    const player = this.state.players[playerIndex]!;

    if (this.state.grid[row][col] === -1) {
      this.state.revealed[row][col] = true;
      this.state.foundBy[row][col] = playerIndex;
      player.bombs++;
      player.score += 10;
      if (isScoreUncatchable(this.state)) {
        this.state.status = "finished";
      }
      if (countFoundBombs(this.state) >= this.state.totalBombs) {
        this.state.status = "finished";
      }
    } else {
      floodReveal(this.state.grid, this.state.revealed, row, col, rows, cols);
      this.state.currentPlayer = playerIndex === 0 ? 1 : 0;
      if (allSafeCellsRevealed(this.state)) {
        this.state.status = "finished";
      }
    }

    await this.persist();
    this.broadcast();
    // If the move passed the turn to player 2 and they are AI, make them play.
    if (this.state.status === "playing" && this.state.players[1]?.id === "ai" && this.state.currentPlayer === 1) {
      this.scheduleAiMove(this.aiLevel);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private findExistingSlot(name: string): 0 | 1 | null {
    if (!this.state) return null;
    if (this.state.players[0]?.name === name) return 0;
    if (this.state.players[1]?.name === name) return 1;
    return null;
  }

  private async persist() {
    await this.room.storage.put("state", this.state);
    await this.room.storage.put("connectionToPlayer", this.connectionToPlayer);
  }

  private broadcast() {
    if (!this.state) return;
    this.room.broadcast(JSON.stringify({ type: "state", state: this.state } satisfies ServerMessage));
  }

  private send(conn: Party.Connection, msg: ServerMessage) {
    conn.send(JSON.stringify(msg));
  }

  private clearAiTimer() {
    if (this.aiTimer) clearTimeout(this.aiTimer);
    this.aiTimer = null;
  }

  private scheduleAiMove(level: AiLevel) {
    this.clearAiTimer();
    this.aiTimer = setTimeout(() => void this.aiMove(level), 350);
  }

  private async aiMove(level: AiLevel) {
    if (!this.state || this.state.status !== "playing") return;
    if (this.state.players[1]?.id !== "ai") return;
    if (this.state.currentPlayer !== 1) return;
    this.ensureAiFlags();

    const pick = pickAiCell(this.state, this.aiFlags!, level);
    if (!pick) return;

    const { row, col } = pick;
    const { rows, cols } = CONFIGS[this.state.difficulty];
    if (row < 0 || row >= rows || col < 0 || col >= cols) return;
    if (this.state.revealed[row][col]) return;

    const aiPlayer = this.state.players[1]!;

    if (this.state.grid[row][col] === -1) {
      this.state.revealed[row][col] = true;
      this.state.foundBy[row][col] = 1;
      aiPlayer.bombs++;
      aiPlayer.score += 10;
      this.aiFlags![row][col] = true;
      if (isScoreUncatchable(this.state)) {
        this.state.status = "finished";
      }
      if (countFoundBombs(this.state) >= this.state.totalBombs) {
        this.state.status = "finished";
      }
      // Bomb keeps the turn for the same player (AI), so schedule another move.
    } else {
      floodReveal(this.state.grid, this.state.revealed, row, col, rows, cols);
      this.state.currentPlayer = 0;
      if (allSafeCellsRevealed(this.state)) {
        this.state.status = "finished";
      }
    }

    await this.persist();
    await this.room.storage.put("aiFlags", this.aiFlags);
    this.broadcast();

    if (this.state.status === "playing" && this.state.currentPlayer === 1) {
      this.scheduleAiMove(level);
    }
  }

  private ensureAiFlags() {
    if (!this.state) return;
    const rows = this.state.grid.length;
    const cols = this.state.grid[0]?.length ?? 0;
    if (!this.aiFlags || this.aiFlags.length !== rows || (this.aiFlags[0]?.length ?? 0) !== cols) {
      this.aiFlags = Array.from({ length: rows }, () => Array(cols).fill(false));
    }
  }
}

GameRoom satisfies Party.Worker;

export function pickAiCell(state: GameState, aiFlags: boolean[][], level: AiLevel): { row: number; col: number } | null {
  const rows = state.grid.length;
  const cols = state.grid[0]?.length ?? 0;
  if (rows === 0 || cols === 0) return null;

  const unknown: { row: number; col: number }[] = [];
  const frontier: { row: number; col: number }[] = [];
  const frontierSet = new Set<string>();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!state.revealed[r][c]) unknown.push({ row: r, col: c });
      if (state.revealed[r][c] && state.grid[r][c] >= 0) {
        for (const n of neighbors(r, c, rows, cols)) {
          if (!state.revealed[n.row][n.col]) {
            const k = `${n.row},${n.col}`;
            if (!frontierSet.has(k)) {
              frontierSet.add(k);
              frontier.push(n);
            }
          }
        }
      }
    }
  }
  if (unknown.length === 0) return null;

  // Easy: just click random unrevealed.
  if (level === "easy") return unknown[Math.floor(Math.random() * unknown.length)];

  // Compute simple constraints from revealed numbered cells.
  const certainBombs: { row: number; col: number }[] = [];
  const certainSafes: { row: number; col: number }[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!state.revealed[r][c]) continue;
      const v = state.grid[r][c];
      if (v < 0) continue;

      const neigh = neighbors(r, c, rows, cols);
      let knownBombs = 0;
      const unknownNeigh: { row: number; col: number }[] = [];
      for (const n of neigh) {
        const isKnownBomb = (state.revealed[n.row][n.col] && state.grid[n.row][n.col] === -1) || aiFlags[n.row][n.col];
        if (isKnownBomb) knownBombs++;
        else if (!state.revealed[n.row][n.col]) unknownNeigh.push(n);
      }

      const remaining = v - knownBombs;
      if (remaining <= 0 && unknownNeigh.length) {
        // All unknown neighbors are safe.
        for (const n of unknownNeigh) certainSafes.push(n);
      } else if (remaining === unknownNeigh.length && remaining > 0) {
        // All unknown neighbors are bombs.
        for (const n of unknownNeigh) certainBombs.push(n);
      }
    }
  }

  const dedup = (cells: { row: number; col: number }[]) => {
    const out: { row: number; col: number }[] = [];
    const seen = new Set<string>();
    for (const c of cells) {
      const k = `${c.row},${c.col}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(c);
    }
    return out;
  };
  const bombs = dedup(certainBombs).filter(c => !state.revealed[c.row][c.col]);
  const safes = dedup(certainSafes).filter(c => !state.revealed[c.row][c.col]);

  // Medium: use sure deductions, otherwise pick from frontier randomly (more "human").
  if (level === "medium") {
    if (bombs.length) return bombs[Math.floor(Math.random() * bombs.length)];
    if (frontier.length) return frontier[Math.floor(Math.random() * frontier.length)];
    return unknown[Math.floor(Math.random() * unknown.length)];
  }

  // Hard: prefer sure bombs, else estimate bomb probabilities from constraints.
  if (bombs.length) return bombs[Math.floor(Math.random() * bombs.length)];
  if (safes.length && frontier.length === 0) return safes[Math.floor(Math.random() * safes.length)];

  const probs = estimateBombProbabilities(state, aiFlags);
  let best: { row: number; col: number } | null = null;
  let bestP = -1;
  const candidates = frontier.length ? frontier : unknown;
  for (const c of candidates) {
    const p = probs[c.row]?.[c.col] ?? 0;
    if (p > bestP) { bestP = p; best = c; }
  }
  return best ?? unknown[Math.floor(Math.random() * unknown.length)];
}

function neighbors(r: number, c: number, rows: number, cols: number): { row: number; col: number }[] {
  const out: { row: number; col: number }[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) out.push({ row: nr, col: nc });
    }
  }
  return out;
}

function estimateBombProbabilities(state: GameState, aiFlags: boolean[][]): number[][] {
  const rows = state.grid.length;
  const cols = state.grid[0]?.length ?? 0;
  const probs = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!state.revealed[r][c]) continue;
      const v = state.grid[r][c];
      if (v < 0) continue;

      const neigh = neighbors(r, c, rows, cols);
      let knownBombs = 0;
      const unknownNeigh: { row: number; col: number }[] = [];
      for (const n of neigh) {
        const isKnownBomb = (state.revealed[n.row][n.col] && state.grid[n.row][n.col] === -1) || aiFlags[n.row][n.col];
        if (isKnownBomb) knownBombs++;
        else if (!state.revealed[n.row][n.col]) unknownNeigh.push(n);
      }

      const remaining = Math.max(0, v - knownBombs);
      if (!unknownNeigh.length) continue;
      const p = Math.min(1, remaining / unknownNeigh.length);
      for (const n of unknownNeigh) {
        probs[n.row][n.col] = Math.max(probs[n.row][n.col], p);
      }
    }
  }

  return probs;
}
