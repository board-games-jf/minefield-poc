import type * as Party from "partykit/server";

// ── Types ──────────────────────────────────────────────────────────────────

export type Difficulty = "easy" | "medium" | "hard";

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
  | { type: "join";   name: string; difficulty?: Difficulty }
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

export function allSafeCellsRevealed(state: GameState): boolean {
  const { rows, cols } = CONFIGS[state.difficulty];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (!state.revealed[r][c] && state.grid[r][c] !== -1) return false;
  return true;
}

// ── PartyKit Server ────────────────────────────────────────────────────────

export default class GameRoom implements Party.Server {
  state: GameState | null = null;
  connectionToPlayer: Map<string, 0 | 1> = new Map();

  constructor(readonly room: Party.Room) {}

  async onStart() {
    this.state = await this.room.storage.get<GameState>("state") ?? null;
    const saved = await this.room.storage.get<Map<string, 0 | 1>>("connectionToPlayer");
    this.connectionToPlayer = saved ?? new Map();
  }

  async onConnect(conn: Party.Connection) {
    if (!this.state) return;
    this.send(conn, { type: "state", state: this.state });
  }

  async onMessage(message: string, sender: Party.Connection) {
    const msg = JSON.parse(message) as ClientMessage;
    if (msg.type === "join")   await this.handleJoin(sender, msg.name, msg.difficulty);
    if (msg.type === "reveal") await this.handleReveal(sender, msg.row, msg.col);
  }

  async onClose(conn: Party.Connection) {
    this.connectionToPlayer.delete(conn.id);
    await this.room.storage.put("connectionToPlayer", this.connectionToPlayer);
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  private async handleJoin(conn: Party.Connection, name: string, difficulty?: Difficulty) {
    // Reconnection: player already has a slot
    if (this.state) {
      const existingSlot = this.findExistingSlot(name);
      if (existingSlot !== null) {
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
      await this.persist();
      this.broadcast();
      return;
    }

    // Player 2 joins
    if (this.state.players[0] !== null && this.state.players[1] === null) {
      this.state.players[1] = { id: conn.id, name, score: 0, bombs: 0 };
      this.state.status = "playing";
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
}

GameRoom satisfies Party.Worker;
