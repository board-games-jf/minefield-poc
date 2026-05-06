import type * as Party from "partykit/server";

// ── Types ──────────────────────────────────────────────────────────────────

export type Difficulty = "easy" | "medium" | "hard";
export type AiLevel = "easy" | "medium" | "hard";
export type GameMode = "versus" | "coop" | "explosive";

const POINTS_TABLE = {
  versus: { easy: 60, medium: 110, hard: 160 },
  coop: { easy: 50, medium: 90, hard: 130 },
  explosive: { 2: 10, 3: 20, 5: 30, 10: 40 } as Record<2 | 3 | 5 | 10, number>,
} as const;

// Bonus awarded per safe cell revealed in coop mode.
const CELL_BONUS = 10;

export interface DifficultyConfig {
  rows: number;
  cols: number;
  bombs: number;
}

export const CONFIGS: Record<Difficulty, DifficultyConfig> = {
  easy: { rows: 6, cols: 6, bombs: 10 },
  medium: { rows: 8, cols: 8, bombs: 20 },
  hard: { rows: 10, cols: 10, bombs: 30 },
};

// Lower bomb density for coop mode (same grid size, fewer bombs to reduce forced guessing).
export const COOP_CONFIGS: Record<Difficulty, DifficultyConfig> = {
  easy: { rows: 6, cols: 6, bombs: 6 },
  medium: { rows: 8, cols: 8, bombs: 12 },
  hard: { rows: 10, cols: 10, bombs: 20 },
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
  mode: GameMode;
  players: [Player | null, Player | null];
  currentPlayer: 0 | 1;
  grid: number[][];
  revealed: boolean[][];
  foundBy: (0 | 1 | null)[][];
  // Coop progress: ordered owners of each newly revealed *safe* cell across the match.
  // This is server-sourced so refresh/other browsers render identically.
  safeRevealedBy?: (0 | 1)[];
  totalBombs: number;
  lastClickedCell?: { row: number; col: number; playerIndex: 0 | 1 };
  lastPlayerClicks: { row: number; col: number; playerIndex: 0 | 1 }[];
  explosiveSeries?: { target: 2 | 3 | 5 | 10; wins: [number, number]; round: number };
  explosiveCooldownUntil?: number;
  explosiveBoardId?: number;
  coopResult?: "win" | "loss";
  rematchReady?: [boolean, boolean];
  flags?: boolean[][];
}

export interface RankingEntry {
  name: string;
  points: number;
  wins: number;
}

export interface RankedEntry extends RankingEntry {
  position: number;
}

export interface RankingPayload {
  top: RankedEntry[];
  player: RankedEntry | null;
}

// Client → Server
export type ClientMessage =
  | { type: "join"; name: string; difficulty?: Difficulty; mode?: GameMode; ft?: 2 | 3 | 5 | 10; ai?: { level: AiLevel } }
  | { type: "reveal"; row: number; col: number }
  | { type: "flag"; row: number; col: number }
  | { type: "rematch" }
  | { type: "sticker"; id: string };

// Server → Client
export type ServerMessage =
  | { type: "state"; state: GameState }
  | { type: "error"; message: string }
  | { type: "sticker"; id: string; from: 0 | 1; at: number }
  | { type: "bomb-found"; playerIndex: 0 | 1 };

const RANKING_ROOM_ID = "__ranking__";
const RANKING_STORAGE_KEY = "ranking";

const AI_NAMES: Record<AiLevel, string> = {
  easy: "EireneBot",
  medium: "HeraBot",
  hard: "ÉrisBot",
};

const COOP_AI_NAME = "NêmesisBot";
const EXPLOSIVE_AI_NAME = "AtenaBot";

function isReservedPlayerName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return Object.values(AI_NAMES).some((n) => n.toLowerCase() === normalized)
    || COOP_AI_NAME.toLowerCase() === normalized
    || EXPLOSIVE_AI_NAME.toLowerCase() === normalized;
}

function normalizeRankingName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

function cloneRanking(entries: RankingEntry[]): RankingEntry[] {
  return entries.map((entry) => ({ ...entry }));
}

function sortRanking(entries: RankingEntry[]): RankingEntry[] {
  return cloneRanking(entries).sort((a, b) =>
    b.points - a.points ||
    b.wins - a.wins ||
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
}

export function applyMatchResultToRanking(entries: RankingEntry[], winners: Player[]): RankingEntry[] {
  const next = cloneRanking(entries);
  for (const winner of winners) {
    const key = normalizeRankingName(winner.name);
    const existing = next.find((entry) => normalizeRankingName(entry.name) === key);
    if (existing) {
      existing.points += winner.score;
      existing.wins += 1;
    } else {
      next.push({ name: winner.name, points: winner.score, wins: 1 });
    }
  }
  return sortRanking(next);
}

export function buildRankingPayload(entries: RankingEntry[], playerName: string | null, limit: number): RankingPayload {
  const sorted = sortRanking(entries);
  const top = sorted.slice(0, limit).map((entry, index) => ({ ...entry, position: index + 1 }));
  if (!playerName) return { top, player: null };

  const playerIndex = sorted.findIndex((entry) => normalizeRankingName(entry.name) === normalizeRankingName(playerName));
  if (playerIndex === -1) return { top, player: null };

  return {
    top,
    player: { ...sorted[playerIndex], position: playerIndex + 1 },
  };
}

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

export function floodRevealWithAttribution(
  grid: number[][],
  revealed: boolean[][],
  r: number,
  c: number,
  rows: number,
  cols: number
): { row: number; col: number }[] {
  const out: { row: number; col: number }[] = [];
  // Iterative DFS for stable order and to avoid recursion depth issues.
  const stack: { row: number; col: number }[] = [{ row: r, col: c }];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur.row < 0 || cur.row >= rows || cur.col < 0 || cur.col >= cols) continue;
    if (revealed[cur.row][cur.col]) continue;
    if (grid[cur.row][cur.col] === -1) continue;

    revealed[cur.row][cur.col] = true;
    out.push({ row: cur.row, col: cur.col });

    if (grid[cur.row][cur.col] === 0) {
      // Push neighbors in reverse order so pop() yields a consistent, roughly row-major expansion.
      for (let dr = 1; dr >= -1; dr--) {
        for (let dc = 1; dc >= -1; dc--) {
          if (dr === 0 && dc === 0) continue;
          stack.push({ row: cur.row + dr, col: cur.col + dc });
        }
      }
    }
  }
  return out;
}

export function createInitialState(difficulty: Difficulty, mode: GameMode = "versus"): GameState {
  const { rows, cols, bombs } = (mode === "coop" ? COOP_CONFIGS : CONFIGS)[difficulty];
  return {
    status: "waiting",
    difficulty,
    mode,
    players: [null, null],
    currentPlayer: 0,
    grid: generateGrid(rows, cols, bombs),
    revealed: Array.from({ length: rows }, () => Array(cols).fill(false)),
    foundBy: Array.from({ length: rows }, () => Array<0 | 1 | null>(cols).fill(null)),
    safeRevealedBy: [],
    totalBombs: bombs,
    lastPlayerClicks: [],
    rematchReady: [false, false],
  };
}

function createExplosiveSeries(target: 2 | 3 | 5 | 10): NonNullable<GameState["explosiveSeries"]> {
  return { target, wins: [0, 0], round: 1 };
}

function nextExplosiveBoardId(prev: number | undefined): number {
  const v = (prev ?? 0) | 0;
  return v + 1;
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
    try {
      const url = new URL(req.url);
      if (url.pathname === "/api/ranking") {
        const partyName = Object.keys(lobby.parties)[0];
        if (!partyName) return Response.json({ top: [], player: null } satisfies RankingPayload);
        const player = url.searchParams.get("player");
        const limit = url.searchParams.get("limit") || "10";
        return lobby.parties[partyName]
          .get(RANKING_ROOM_ID)
          .fetch(`/snapshot?limit=${encodeURIComponent(limit)}${player ? `&player=${encodeURIComponent(player)}` : ""}`);
      }

      let path = url.pathname;
      if (path === "/") path = "/index.html";

      const asset = await lobby.assets.fetch(path);
      if (asset) {
        // version.json, index.html, and i18n.js never should be cached, to ensure clients always get the latest version and the app shell.
        if (path === "/version.json" || path === "/index.html" || path === "/i18n.js") {
          const headers = new Headers(asset.headers);
          headers.set("cache-control", "no-store, no-cache, must-revalidate, max-age=0");
          return new Response(asset.body, {
            status: asset.status,
            headers: headers,
          });
        }
        return asset;
      }

      return new Response("Not found", { status: 404 });
    } catch (err) {
      // Avoid surfacing platform "internal error" pages for simple GET requests.
      console.error("onFetch error", err);
      return new Response(
        `<!doctype html><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Minefield — Error</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;padding:24px;line-height:1.4}
  .card{max-width:520px;margin:0 auto;border:1px solid #ddd;border-radius:12px;padding:18px}
  h1{font-size:18px;margin:0 0 8px}
  p{margin:0 0 14px;color:#444}
  button{padding:10px 14px;border-radius:10px;border:1px solid #bbb;background:#fff;cursor:pointer}
  button:active{transform:scale(.99)}
  code{background:#f6f6f6;padding:2px 6px;border-radius:6px}
</style>
<div class="card">
  <h1>We hit an error</h1>
  <p>Please try again in a moment. If it keeps happening, reload the page.</p>
  <button onclick="location.reload()">Reload</button>
  <p style="margin-top:12px;font-size:12px;color:#666">Code: <code>server_error</code></p>
</div>`,
        { status: 500, headers: { "content-type": "text/html; charset=utf-8" } }
      );
    }
  }

  state: GameState | null = null;
  connectionToPlayer: Map<string, 0 | 1> = new Map();
  private aiTimer: ReturnType<typeof setTimeout> | null = null;
  private explosiveCooldownTimer: ReturnType<typeof setTimeout> | null = null;
  private aiLevel: AiLevel = "medium";
  private aiFlags: boolean[][] | null = null;
  private lastStickerAt: Map<string, number> = new Map();
  private rankingRecorded = false;

  constructor(readonly room: Party.Room) { }

  async onStart() {
    this.state = await this.room.storage.get<GameState>("state") ?? null;
    const saved = await this.room.storage.get<Map<string, 0 | 1>>("connectionToPlayer");
    this.connectionToPlayer = saved ?? new Map();
    this.aiLevel = await this.room.storage.get<AiLevel>("aiLevel") ?? "medium";
    this.aiFlags = await this.room.storage.get<boolean[][]>("aiFlags") ?? null;
    this.rankingRecorded = await this.room.storage.get<boolean>("rankingRecorded") ?? false;
    if (this.state && this.state.players[1]?.id === "ai") {
      this.ensureAiFlags();
    }
    if (this.state && !this.state.lastPlayerClicks) {
      this.state.lastPlayerClicks = [];
    }
    if (this.state && !this.state.safeRevealedBy) {
      this.state.safeRevealedBy = [];
    }
    if (this.state && !this.state.rematchReady) {
      this.state.rematchReady = [false, false];
    }

    // Backward-compat migration: recompute coop per-cell scores from safeRevealedBy.
    if (this.applyCoopScoreMigration()) await this.persist();

    // Resume any pending explosive cooldown on wake.
    if (this.state?.mode === "explosive" && this.state.explosiveCooldownUntil && this.state.status === "playing") {
      const ms = Math.max(0, this.state.explosiveCooldownUntil - Date.now());
      if (ms > 0) this.explosiveCooldownTimer = setTimeout(() => void this.finishExplosiveCooldown(), ms);
      else await this.finishExplosiveCooldown();
    }
  }

  async onRequest(req: Party.Request) {
    try {
      if (this.room.id !== RANKING_ROOM_ID) {
        return new Response("Not found", { status: 404 });
      }

      const url = new URL(req.url);
      if (req.method === "GET" && url.pathname.endsWith("/snapshot")) {
        const limit = Number.parseInt(url.searchParams.get("limit") || "10", 10);
        const player = url.searchParams.get("player");
        const ranking = await this.room.storage.get<RankingEntry[]>(RANKING_STORAGE_KEY) ?? [];
        return Response.json(buildRankingPayload(ranking, player, Number.isFinite(limit) ? limit : 10));
      }

      if (req.method === "POST" && url.pathname.endsWith("/apply-match")) {
        const body = await req.json() as { winners: Player[] };
        const ranking = await this.room.storage.get<RankingEntry[]>(RANKING_STORAGE_KEY) ?? [];
        const updated = applyMatchResultToRanking(ranking, body.winners);
        await this.room.storage.put(RANKING_STORAGE_KEY, updated);
        return Response.json({ ok: true });
      }

      return new Response("Not found", { status: 404 });
    } catch (err) {
      console.error("onRequest error", err);
      return new Response("Internal error", { status: 500 });
    }
  }

  async onConnect(conn: Party.Connection) {
    if (!this.state) return;
    this.send(conn, { type: "state", state: this.state });
  }

  async onMessage(message: string, sender: Party.Connection) {
    const msg = JSON.parse(message) as ClientMessage;
    if (msg.type === "join") await this.handleJoin(sender, msg.name, msg.difficulty, msg.mode, msg.ft, msg.ai);
    if (msg.type === "reveal") await this.handleReveal(sender, msg.row, msg.col);
    if (msg.type === "flag") await this.handleFlag(sender, msg.row, msg.col);
    if (msg.type === "rematch") await this.handleRematch(sender);
    if (msg.type === "sticker") await this.handleSticker(sender, msg.id);
  }

  async onClose(conn: Party.Connection) {
    this.connectionToPlayer.delete(conn.id);
    await this.room.storage.put("connectionToPlayer", this.connectionToPlayer);
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  private async handleJoin(conn: Party.Connection, name: string, difficulty?: Difficulty, mode?: GameMode, ft?: 2 | 3 | 5 | 10, ai?: { level: AiLevel }) {
    if (isReservedPlayerName(name)) {
      this.send(conn, { type: "error", message: "name_reserved" });
      return;
    }

    // Reconnection: player already has a slot
    if (this.state) {
      const existingSlot = this.findExistingSlot(name);
      if (existingSlot !== null) {
        // Update the stored connection id for this player (refresh / reconnect / new device).
        const p = this.state.players[existingSlot];
        if (p) p.id = conn.id;
        this.connectionToPlayer.set(conn.id, existingSlot);
        const migrated = this.applyCoopScoreMigration();
        await this.persist();
        if (migrated) this.broadcast(); else this.send(conn, { type: "state", state: this.state });
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
      this.state = createInitialState(difficulty ?? "easy", mode ?? "versus");
      if (this.state.mode === "explosive") {
        const target = (ft ?? 5) as 2 | 3 | 5 | 10;
        this.state.explosiveSeries = createExplosiveSeries(target);
        this.state.explosiveBoardId = nextExplosiveBoardId(this.state.explosiveBoardId);
      }
      this.state.players[0] = { id: conn.id, name, score: 0, bombs: 0 };
      this.connectionToPlayer.set(conn.id, 0);
      if (ai) {
        // Coop and Explosive AI are always hard; in Explosive AtenaBot uses bomb-avoidance heuristic.
        this.aiLevel = (this.state.mode === "coop" || this.state.mode === "explosive") ? "hard" : ai.level;
        await this.room.storage.put("aiLevel", this.aiLevel);
        // Single-player: spawn an AI opponent immediately.
        this.state.players[1] = {
          id: "ai",
          name: this.state.mode === "coop" ? COOP_AI_NAME : this.state.mode === "explosive" ? EXPLOSIVE_AI_NAME : AI_NAMES[this.aiLevel],
          score: 0,
          bombs: 0,
        };
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
      if (this.state.mode === "explosive" && !this.state.explosiveSeries) {
        const target = (ft ?? 5) as 2 | 3 | 5 | 10;
        this.state.explosiveSeries = createExplosiveSeries(target);
      }
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
    if (this.state.mode === "explosive" && this.state.explosiveCooldownUntil && Date.now() < this.state.explosiveCooldownUntil) return;

    const playerIndex = this.connectionToPlayer.get(conn.id);
    if (playerIndex === undefined) return;
    if (playerIndex !== this.state.currentPlayer) return;

    const { rows, cols } = CONFIGS[this.state.difficulty];
    if (row < 0 || row >= rows || col < 0 || col >= cols) return;
    if (this.state.revealed[row][col]) return;

    const player = this.state.players[playerIndex]!;

    if (this.state.lastPlayerClicks.length > 0 && this.state.lastPlayerClicks[0].playerIndex !== playerIndex) {
      this.state.lastPlayerClicks = [];
    }

    this.state.lastClickedCell = { row, col, playerIndex };
    this.state.lastPlayerClicks.push({ row, col, playerIndex });

    if (this.state.grid[row][col] === -1) {
      this.state.revealed[row][col] = true;
      this.state.foundBy[row][col] = playerIndex;
      if (this.state.mode === "explosive") {
        // Explosive: the round ends immediately on a bomb. Point goes to the other player.
        const series = this.state.explosiveSeries ?? createExplosiveSeries(5);
        this.state.explosiveSeries = series;
        const winner: 0 | 1 = playerIndex === 0 ? 1 : 0;
        series.wins[winner] += 1;
        series.round += 1;

        const target = series.target;
        if (series.wins[winner] >= target) {
          // Match over: award ranking points to the series winner.
          const pts = POINTS_TABLE.explosive[target];
          const pWin = this.state.players[winner];
          const pLose = this.state.players[winner === 0 ? 1 : 0];
          if (pWin) pWin.score = pts;
          if (pLose) pLose.score = 0;
          this.state.status = "finished";
        } else {
          // Start cooldown so players can see where they lost before the next round starts.
          this.state.currentPlayer = winner;
          this.state.explosiveCooldownUntil = Date.now() + 5000;
          this.clearExplosiveCooldownTimer();
          this.explosiveCooldownTimer = setTimeout(() => void this.finishExplosiveCooldown(), 5000);
        }

        await this.finalizeMatchIfNeeded();
        await this.persist();
        this.broadcast();
        if (this.state.status === "playing" && this.state.players[1]?.id === "ai" && this.state.currentPlayer === 1) {
          this.scheduleAiMove(this.aiLevel);
        }
        return;
      }
      if (this.state.mode === "coop") {
        // Coop: hitting any bomb ends the game immediately (team loss).
        this.state.status = "finished";
        this.state.coopResult = "loss";
      } else {
        player.bombs++;
        player.score += 10;
        if (isScoreUncatchable(this.state)) {
          this.state.status = "finished";
        }
        if (countFoundBombs(this.state) >= this.state.totalBombs) {
          this.state.status = "finished";
        }
      }

      await this.finalizeMatchIfNeeded();
      await this.persist();
      this.broadcast();

      // Bomba: mantém a rodada, não limpa, não passa a vez
      if (this.state.status === "playing" && this.state.players[1]?.id === "ai" && this.state.currentPlayer === 1) {
        this.scheduleAiMove(this.aiLevel);
      }
      return; // IMPORTANTE: retorna aqui
    } else {
      const newlySafe = floodRevealWithAttribution(this.state.grid, this.state.revealed, row, col, rows, cols);
      // Clear coop flags from any newly revealed cells so slots are returned to the player.
      if (this.state.flags) {
        for (const { row: r, col: c } of newlySafe) {
          if (this.state.flags[r]?.[c]) this.state.flags[r][c] = false;
        }
      }
      // Record safe cell ownership for coop progress UI.
      if (this.state.safeRevealedBy) {
        for (let i = 0; i < newlySafe.length; i++) this.state.safeRevealedBy.push(playerIndex);
      } else {
        this.state.safeRevealedBy = Array.from({ length: newlySafe.length }, () => playerIndex);
      }
      // Accumulate per-cell bonus for coop (always track for display; ranking exclusion handled separately).
      if (this.state.mode === "coop" && newlySafe.length > 0) {
        const p = this.state.players[playerIndex];
        if (p && p.id !== "ai") p.score += newlySafe.length * CELL_BONUS;
      }
      this.state.currentPlayer = playerIndex === 0 ? 1 : 0;
      if (allSafeCellsRevealed(this.state)) {
        this.state.status = "finished";
        if (this.state.mode === "coop") {
          this.state.coopResult = "win";
          // Base prize was already seeded into score at game start; nothing extra to add here.
        }
      }
    }

    await this.finalizeMatchIfNeeded();
    await this.persist();
    this.broadcast();

    if (this.state.status === "playing" && this.state.players[1]?.id === "ai" && this.state.currentPlayer === 1) {
      this.scheduleAiMove(this.aiLevel);
    }
  }

  private async handleFlag(conn: Party.Connection, row: number, col: number) {
    if (!this.state) return;
    if (this.state.status !== "playing") return;
    if (this.state.mode !== "coop") return;

    const rows = this.state.grid.length;
    const cols = this.state.grid[0].length;
    if (row < 0 || row >= rows || col < 0 || col >= cols) return;
    if (this.state.revealed[row][col]) return;

    // Initialise flags grid on first use
    if (!this.state.flags) {
      this.state.flags = Array.from({ length: rows }, () => Array(cols).fill(false));
    }

    const isCurrentlyFlagged = this.state.flags[row][col];
    // Enforce limit: can't place more flags than total bombs
    if (!isCurrentlyFlagged) {
      const flagCount = this.state.flags.flat().filter(Boolean).length;
      if (flagCount >= this.state.totalBombs) return;
    }
    this.state.flags[row][col] = !isCurrentlyFlagged;

    await this.persist();
    this.broadcast();
  }

  private async handleSticker(conn: Party.Connection, id: string) {
    if (!this.state) return;
    if (this.state.status !== "playing" && this.state.status !== "finished") return;

    const from = this.connectionToPlayer.get(conn.id);
    if (from === undefined) return;
    if (!isValidStickerId(id)) return;

    const now = Date.now();
    const last = this.lastStickerAt.get(conn.id) ?? 0;
    // Server-side cooldown to avoid spamming.
    if (now - last < 900) return;
    this.lastStickerAt.set(conn.id, now);

    this.room.broadcast(JSON.stringify({ type: "sticker", id, from, at: now } satisfies ServerMessage));
  }

  private async finishExplosiveCooldown() {
    if (!this.state) return;
    if (this.state.mode !== "explosive") return;
    if (this.state.status !== "playing") return;
    if (!this.state.explosiveSeries) return;
    if (!this.state.explosiveCooldownUntil) return;

    this.clearExplosiveCooldownTimer();
    this.state.explosiveCooldownUntil = undefined;

    const { rows, cols, bombs } = CONFIGS[this.state.difficulty];
    this.state.grid = generateGrid(rows, cols, bombs);
    this.state.revealed = Array.from({ length: rows }, () => Array(cols).fill(false));
    this.state.foundBy = Array.from({ length: rows }, () => Array<0 | 1 | null>(cols).fill(null));
    this.state.safeRevealedBy = [];
    this.state.lastClickedCell = undefined;
    this.state.lastPlayerClicks = [];
    this.state.explosiveBoardId = nextExplosiveBoardId(this.state.explosiveBoardId);

    await this.persist();
    this.broadcast();

    if (this.state.players[1]?.id === "ai" && this.state.currentPlayer === 1) {
      this.ensureAiFlags();
      await this.room.storage.put("aiFlags", this.aiFlags);
      this.scheduleAiMove(this.aiLevel);
    }
  }

  /** Recomputes coop per-cell scores from foundBy/revealed for pre-bonus sessions.
   *  Returns true if scores were changed (caller should broadcast). */
  private applyCoopScoreMigration(): boolean {
    if (!this.state || this.state.mode !== "coop" || this.state.status !== "playing") return false;
    const isAiGame = this.state.players[0]?.id === "ai" || this.state.players[1]?.id === "ai";
    const p0 = this.state.players[0];
    const p1 = this.state.players[1];
    if (!p0 && !p1) return false;
    // Both scores must be 0 to qualify for migration (avoid double-applying).
    const s0 = p0?.score ?? 0;
    const s1 = p1?.score ?? 0;
    if (s0 !== 0 || s1 !== 0) return false;
    // Count safe revealed cells per player via foundBy grid (available since day 1).
    const counts = [0, 0];
    const rows = this.state.foundBy.length;
    const cols = this.state.foundBy[0]?.length ?? 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (this.state.revealed[r][c] && this.state.grid[r][c] !== -1) {
          const owner = this.state.foundBy[r][c];
          if (owner === 0 || owner === 1) counts[owner]++;
        }
      }
    }
    if (counts[0] === 0 && counts[1] === 0) return false;
    // Apply only to human players (base is added on the frontend).
    if (p0 && p0.id !== "ai") p0.score = counts[0] * CELL_BONUS;
    if (p1 && p1.id !== "ai") p1.score = counts[1] * CELL_BONUS;
    return true;
  }

  private resetMatchStatePreservingPlayers() {
    if (!this.state) return;

    const prev = this.state;
    const next = createInitialState(prev.difficulty, prev.mode);
    // Preserve players and AI identity.
    next.players = prev.players;
    // Reset per-match player stats.
    for (const p of next.players) {
      if (!p) continue;
      p.score = 0;
      p.bombs = 0;
    }
    // Preserve explosive target (FT) but reset series progress.
    if (prev.mode === "explosive") {
      const target = prev.explosiveSeries?.target ?? 2;
      next.explosiveSeries = { target, wins: [0, 0], round: 1 };
    }
    next.status = "playing";
    next.currentPlayer = (Math.random() < 0.5 ? 0 : 1);
    next.rematchReady = [false, false];
    this.state = next;
  }

  private async handleRematch(conn: Party.Connection) {
    if (!this.state) return;
    if (this.state.status !== "finished") return;

    const playerIndex = this.connectionToPlayer.get(conn.id);
    if (playerIndex === undefined) return;

    if (!this.state.rematchReady) this.state.rematchReady = [false, false];
    this.state.rematchReady[playerIndex] = true;

    const p1 = this.state.players[0];
    const p2 = this.state.players[1];
    const hasTwoPlayers = !!p1 && !!p2;
    const p2IsAi = p2?.id === "ai";

    // Solo + AI: rematch immediately. Two humans: wait for both.
    const shouldRestart =
      hasTwoPlayers && (p2IsAi || (this.state.rematchReady[0] && this.state.rematchReady[1]));

    if (shouldRestart) {
      this.rankingRecorded = false;
      await this.room.storage.put("rankingRecorded", this.rankingRecorded);

      this.resetMatchStatePreservingPlayers();

      // New match: reset AI flags too.
      if (this.state.players[1]?.id === "ai") {
        this.ensureAiFlags();
        await this.room.storage.put("aiFlags", this.aiFlags);
      } else {
        this.aiFlags = null;
        await this.room.storage.delete("aiFlags");
      }

      await this.persist();
      this.broadcast();

      if (this.state.players[1]?.id === "ai" && this.state.currentPlayer === 1) {
        this.scheduleAiMove(this.aiLevel);
      }
      return;
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
    await this.room.storage.put("rankingRecorded", this.rankingRecorded);
  }

  private maskStateForClient(state: GameState): GameState {
    // Never reveal bomb positions for unrevealed cells — clients only need
    // to know what is already revealed. This prevents cheating via DevTools.
    const maskedGrid = state.grid.map((row, r) =>
      row.map((cell, c) =>
        cell === -1 && !state.revealed[r][c] ? 0 : cell
      )
    );
    return { ...state, grid: maskedGrid };
  }

  private broadcast() {
    if (!this.state) return;
    const masked = this.maskStateForClient(this.state);
    this.room.broadcast(JSON.stringify({ type: "state", state: masked } satisfies ServerMessage));
  }

  private send(conn: Party.Connection, msg: ServerMessage) {
    const outMsg = msg.type === "state"
      ? { ...msg, state: this.maskStateForClient(msg.state) }
      : msg;
    conn.send(JSON.stringify(outMsg));
  }

  private clearAiTimer() {
    if (this.aiTimer) clearTimeout(this.aiTimer);
    this.aiTimer = null;
  }

  private clearExplosiveCooldownTimer() {
    if (this.explosiveCooldownTimer) clearTimeout(this.explosiveCooldownTimer);
    this.explosiveCooldownTimer = null;
  }

  private scheduleAiMove(level: AiLevel) {
    this.clearAiTimer();
    this.aiTimer = setTimeout(() => void this.aiMove(level), 350);
  }

  private async aiMove(level: AiLevel) {
    if (!this.state || this.state.status !== "playing") return;
    if (this.state.players[1]?.id !== "ai") return;
    if (this.state.currentPlayer !== 1) return;
    if (this.state.mode === "explosive" && this.state.explosiveCooldownUntil && Date.now() < this.state.explosiveCooldownUntil) return;
    this.ensureAiFlags();

    const pick = pickAiCell(this.state, this.aiFlags!, level);
    if (!pick) return;

    const { row, col } = pick;
    const { rows, cols } = CONFIGS[this.state.difficulty];
    if (row < 0 || row >= rows || col < 0 || col >= cols) return;
    if (this.state.revealed[row][col]) return;

    const aiPlayer = this.state.players[1]!;

    if (this.state.lastPlayerClicks.length > 0 && this.state.lastPlayerClicks[0].playerIndex !== 1) {
      this.state.lastPlayerClicks = [];
    }

    this.state.lastClickedCell = { row, col, playerIndex: 1 };
    this.state.lastPlayerClicks.push({ row, col, playerIndex: 1 });

    if (this.state.grid[row][col] === -1) {
      this.state.revealed[row][col] = true;
      this.state.foundBy[row][col] = 1;
      if (this.state.mode === "explosive") {
        const series = this.state.explosiveSeries ?? createExplosiveSeries(5);
        this.state.explosiveSeries = series;
        const winner: 0 | 1 = 0; // AI (player 1) hit a bomb, so human wins.
        series.wins[winner] += 1;
        series.round += 1;
        const target = series.target;
        if (series.wins[winner] >= target) {
          const pts = POINTS_TABLE.explosive[target];
          const pWin = this.state.players[winner];
          const pLose = this.state.players[1];
          if (pWin) pWin.score = pts;
          if (pLose) pLose.score = 0;
          this.state.status = "finished";
        } else {
          this.state.currentPlayer = winner;
          this.state.explosiveCooldownUntil = Date.now() + 5000;
          this.clearExplosiveCooldownTimer();
          this.explosiveCooldownTimer = setTimeout(() => void this.finishExplosiveCooldown(), 5000);
        }

        await this.finalizeMatchIfNeeded();
        await this.persist();
        if (this.aiFlags) await this.room.storage.put("aiFlags", this.aiFlags);
        this.broadcast();
        this.room.broadcast(JSON.stringify({ type: "bomb-found", playerIndex: 1 } satisfies ServerMessage));
        return;
      }
      if (this.state.mode === "coop") {
        // Coop: AI hitting a bomb ends the game immediately (team loss).
        this.state.status = "finished";
        this.state.coopResult = "loss";
      } else {
        aiPlayer.bombs++;
        aiPlayer.score += 10;
        this.aiFlags![row][col] = true;
        if (isScoreUncatchable(this.state)) {
          this.state.status = "finished";
        }
        if (countFoundBombs(this.state) >= this.state.totalBombs) {
          this.state.status = "finished";
        }
      }

      await this.finalizeMatchIfNeeded();
      await this.persist();
      await this.room.storage.put("aiFlags", this.aiFlags);
      this.broadcast();
      this.room.broadcast(JSON.stringify({ type: "bomb-found", playerIndex: 1 } satisfies ServerMessage));

      // Bomb keeps the turn, so schedule another move immediately.
      if (this.state.status === "playing" && this.state.currentPlayer === 1) {
        this.scheduleAiMove(level);
      }
      return; // Retorna aqui, não executa o resto
    } else {
      const newlySafe = floodRevealWithAttribution(this.state.grid, this.state.revealed, row, col, rows, cols);
      // Clear coop flags from any newly revealed cells so slots are returned to the player.
      if (this.state.flags) {
        for (const { row: r, col: c } of newlySafe) {
          if (this.state.flags[r]?.[c]) this.state.flags[r][c] = false;
        }
      }
      if (this.state.safeRevealedBy) {
        for (let i = 0; i < newlySafe.length; i++) this.state.safeRevealedBy.push(1);
      } else {
        this.state.safeRevealedBy = Array.from({ length: newlySafe.length }, () => 1);
      }
      this.state.currentPlayer = 0;
      if (allSafeCellsRevealed(this.state)) {
        this.state.status = "finished";
        if (this.state.mode === "coop") {
          this.state.coopResult = "win";
          // AI game — no ranking points (UI already warns about this).
        }
      }
    }

    await this.finalizeMatchIfNeeded();
    await this.persist();
    await this.room.storage.put("aiFlags", this.aiFlags);
    this.broadcast();

    if (this.state.status === "playing" && (this.state.currentPlayer as 0 | 1) === 1) {
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

  private getRankingParty() {
    return this.room.context.parties[this.room.name].get(RANKING_ROOM_ID);
  }

  private getMatchWinners(): Player[] {
    if (!this.state || this.state.status !== "finished") return [];
    const [playerOne, playerTwo] = this.state.players;
    if (!playerOne || !playerTwo) return [];
    // Coop win: both players are winners. Add base prize to cell delta for ranking.
    if (this.state.mode === "coop") {
      if (this.state.coopResult !== "win") return [];
      const isAiGame = playerOne.id === "ai" || playerTwo.id === "ai";
      if (isAiGame) return [];
      const base = POINTS_TABLE.coop[this.state.difficulty as keyof typeof POINTS_TABLE.coop] ?? 0;
      return [playerOne, playerTwo].map(p => ({ ...p, score: base + p.score }));
    }
    if (playerOne.score === playerTwo.score) return [];
    return playerOne.score > playerTwo.score ? [playerOne] : [playerTwo];
  }

  private async finalizeMatchIfNeeded() {
    if (!this.state || this.state.status !== "finished" || this.rankingRecorded) return;
    this.rankingRecorded = true;
    const winners = this.getMatchWinners();
    if (!winners.length) return;
    await this.getRankingParty().fetch("/apply-match", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        winners: winners.map((winner) => ({
          id: winner.id,
          name: winner.name,
          score: winner.score,
          bombs: winner.bombs,
        })),
      }),
    });
  }
}

GameRoom satisfies Party.Worker;

const STICKER_IDS = new Set([
  "oops",
  "nice",
  "thinking",
  "sweat",
  "boom",
  "taunt",
  "cry",
  "clap",
  "trophy",
]);

function isValidStickerId(id: string): boolean {
  return STICKER_IDS.has(id);
}

export function pickAiCell(state: GameState, aiFlags: boolean[][], level: AiLevel): { row: number; col: number } | null {
  const rows = state.grid.length;
  const cols = state.grid[0]?.length ?? 0;
  if (rows === 0 || cols === 0) return null;

  const unknown: { row: number; col: number }[] = [];
  const frontier: { row: number; col: number }[] = [];
  const frontierSet = new Set<string>();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const playerFlagged = state.flags?.[r]?.[c] ?? false;
      if (!state.revealed[r][c] && !aiFlags[r][c] && !playerFlagged) unknown.push({ row: r, col: c });
      if (state.revealed[r][c] && state.grid[r][c] >= 0) {
        for (const n of neighbors(r, c, rows, cols)) {
          const nPlayerFlagged = state.flags?.[n.row]?.[n.col] ?? false;
          if (!state.revealed[n.row][n.col] && !aiFlags[n.row][n.col] && !nPlayerFlagged) {
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
  if (unknown.length === 0) {
    // Fallback: all unrevealed cells are flagged by the player — ignore flags and pick any unrevealed cell.
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!state.revealed[r][c] && !aiFlags[r][c]) unknown.push({ row: r, col: c });
      }
    }
    if (unknown.length === 0) return null;
  }

  const avoidBombs = state.mode === "coop" || state.mode === "explosive";

  // Easy: just click random unrevealed.
  if (level === "easy") return unknown[Math.floor(Math.random() * unknown.length)];

  // Compute constraints from revealed numbered cells (what the AI "sees").
  // For coop, we also persist inferred bombs into aiFlags so it won't click them later.
  const certainBombs: { row: number; col: number }[] = [];
  const certainSafes: { row: number; col: number }[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    certainBombs.length = 0;
    certainSafes.length = 0;

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
          for (const n of unknownNeigh) certainSafes.push(n);
        } else if (remaining === unknownNeigh.length && remaining > 0) {
          for (const n of unknownNeigh) certainBombs.push(n);
        }
      }
    }

    if (avoidBombs) {
      for (const b of certainBombs) {
        if (!state.revealed[b.row][b.col] && !aiFlags[b.row][b.col]) {
          aiFlags[b.row][b.col] = true;
          changed = true;
        }
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
  const safes = dedup(certainSafes).filter(c => !state.revealed[c.row][c.col] && !aiFlags[c.row][c.col]);

  if (avoidBombs) {
    // Coop / Explosive: avoid bombs. Prefer certain safes; otherwise click the lowest-risk cell we can estimate.
    if (safes.length) return safes[Math.floor(Math.random() * safes.length)];

    const probs = estimateBombProbabilities(state, aiFlags);
    // Important: do not bias towards the frontier in coop.
    // When probabilities tie (often early game), prefer cells away from revealed numbers.
    const candidates = unknown.filter(c => !aiFlags[c.row][c.col]);
    if (candidates.length === 0) return null;

    let bestCells: { row: number; col: number }[] = [];
    let bestP = Number.POSITIVE_INFINITY;
    for (const c of candidates) {
      const p = probs[c.row]?.[c.col] ?? 0;

      // Frontier penalty: cells adjacent to revealed numbered cells are typically riskier when we have no strong info.
      let touchesNumber = false;
      for (const n of neighbors(c.row, c.col, rows, cols)) {
        if (state.revealed[n.row][n.col] && state.grid[n.row][n.col] >= 0) { touchesNumber = true; break; }
      }

      const effectiveP = touchesNumber ? Math.min(1, p + 0.15) : p;
      if (effectiveP < bestP) {
        bestP = effectiveP;
        bestCells = [c];
      } else if (effectiveP === bestP) {
        bestCells.push(c);
      }
    }
    return bestCells[Math.floor(Math.random() * bestCells.length)];
  }

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
  let bestScore = avoidBombs ? Number.POSITIVE_INFINITY : -1;
  const candidates = (frontier.length ? frontier : unknown).filter(c => !aiFlags[c.row][c.col]);
  if (candidates.length === 0) return null;

  for (const c of candidates) {
    const p = probs[c.row]?.[c.col] ?? 0;
    if (avoidBombs) {
      if (p < bestScore) { bestScore = p; best = c; }
    } else {
      if (p > bestScore) { bestScore = p; best = c; }
    }
  }

  return best ?? candidates[Math.floor(Math.random() * candidates.length)];
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
