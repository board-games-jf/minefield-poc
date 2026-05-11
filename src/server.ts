import type * as Party from "partykit/server";
import {
  generateGrid as generateCoopGrid,
  ENERGY_PRESETS,
  DEFUSE_ENERGY_PRESETS,
  generateVersusGrid,
  VERSUS_ENERGY_PRESETS,
} from "./grid-generator";

// ── Types ──────────────────────────────────────────────────────────────────

export type Difficulty = "easy" | "medium" | "hard";
export type AiLevel = "easy" | "medium" | "hard";
export type GameMode = "versus" | "coop" | "explosive" | "defuse";

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

function getModeDebugPreset(mode: "coop" | "versus" | "explosive" | "defuse") {
  const perDifficulty = {
    easy:
      mode === "coop"
        ? {
            rows: COOP_CONFIGS.easy.rows,
            cols: COOP_CONFIGS.easy.cols,
            bombs: COOP_CONFIGS.easy.bombs,
            algorithm: "epa",
            params: ENERGY_PRESETS.easy,
          }
        : mode === "versus"
          ? {
              rows: CONFIGS.easy.rows,
              cols: CONFIGS.easy.cols,
              bombs: CONFIGS.easy.bombs,
              algorithm: "weighted",
              params: VERSUS_ENERGY_PRESETS.easy,
            }
          : mode === "explosive"
            ? {
                rows: CONFIGS.easy.rows,
                cols: CONFIGS.easy.cols,
                bombs: CONFIGS.easy.bombs,
                algorithm: "epa",
                params: ENERGY_PRESETS.easy,
              }
            : {
                rows: DEFUSE_CONFIGS.easy.rows,
                cols: DEFUSE_CONFIGS.easy.cols,
                bombs: DEFUSE_CONFIGS.easy.bombs,
                algorithm: "epa",
                params: DEFUSE_ENERGY_PRESETS.easy,
              },
    medium:
      mode === "coop"
        ? {
            rows: COOP_CONFIGS.medium.rows,
            cols: COOP_CONFIGS.medium.cols,
            bombs: COOP_CONFIGS.medium.bombs,
            algorithm: "epa",
            params: ENERGY_PRESETS.medium,
          }
        : mode === "versus"
          ? {
              rows: CONFIGS.medium.rows,
              cols: CONFIGS.medium.cols,
              bombs: CONFIGS.medium.bombs,
              algorithm: "weighted",
              params: VERSUS_ENERGY_PRESETS.medium,
            }
          : mode === "explosive"
            ? {
                rows: CONFIGS.medium.rows,
                cols: CONFIGS.medium.cols,
                bombs: CONFIGS.medium.bombs,
                algorithm: "epa",
                params: ENERGY_PRESETS.medium,
              }
            : {
                rows: DEFUSE_CONFIGS.medium.rows,
                cols: DEFUSE_CONFIGS.medium.cols,
                bombs: DEFUSE_CONFIGS.medium.bombs,
                algorithm: "epa",
                params: DEFUSE_ENERGY_PRESETS.medium,
              },
    hard:
      mode === "coop"
        ? {
            rows: COOP_CONFIGS.hard.rows,
            cols: COOP_CONFIGS.hard.cols,
            bombs: COOP_CONFIGS.hard.bombs,
            algorithm: "epa",
            params: ENERGY_PRESETS.hard,
          }
        : mode === "versus"
          ? {
              rows: CONFIGS.hard.rows,
              cols: CONFIGS.hard.cols,
              bombs: CONFIGS.hard.bombs,
              algorithm: "weighted",
              params: VERSUS_ENERGY_PRESETS.hard,
            }
          : mode === "explosive"
            ? {
                rows: CONFIGS.hard.rows,
                cols: CONFIGS.hard.cols,
                bombs: CONFIGS.hard.bombs,
                algorithm: "epa",
                params: ENERGY_PRESETS.hard,
              }
            : {
                rows: DEFUSE_CONFIGS.hard.rows,
                cols: DEFUSE_CONFIGS.hard.cols,
                bombs: DEFUSE_CONFIGS.hard.bombs,
                algorithm: "epa",
                params: DEFUSE_ENERGY_PRESETS.hard,
              },
  };

  return perDifficulty;
}

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
  explosiveSeries?: {
    target: 2 | 3 | 5 | 10;
    wins: [number, number];
    round: number;
  };
  explosiveCooldownUntil?: number;
  explosiveBoardId?: number;
  coopResult?: "win" | "loss";
  rematchReady?: [boolean, boolean];
  flags?: boolean[][];
  /** Coop only: false until the first reveal triggers deferred grid generation. */
  coopGridReady?: boolean;
  /** Explosive only: false until the first reveal triggers deferred grid generation. */
  explosiveGridReady?: boolean;
}

// ── Defuse-specific types ─────────────────────────────────────────────────

export const DEFUSE_CONFIGS: Record<
  Difficulty,
  { rows: number; cols: number; bombs: number }
> = {
  easy: { rows: 12, cols: 12, bombs: 22 },
  medium: { rows: 12, cols: 12, bombs: 29 },
  hard: { rows: 12, cols: 12, bombs: 36 },
};

export interface DefuseState {
  status: "waiting" | "playing" | "finished";
  difficulty: Difficulty;
  playerName: string;
  squadName?: string;
  isMulti?: boolean;
  squadMembers?: string[];
  defuseGridReady?: boolean;
  serverNow?: number;
  elapsedMs?: number;
  rows: number;
  cols: number;
  /** -1=bomb, 0-8=safe; -2=hidden on client for unrevealed cells */
  grid: number[][];
  revealed: boolean[][];
  defused: boolean[][]; // correctly defused bombs (green 💣)
  exploded: boolean[][]; // Inspect-hit bombs     (red 💣)
  startedAt: number | null;
  totalPenalties: number; // accumulated ms
  totalBombs: number;
  bombsResolved: number; // defused + exploded
  combo: number;
  highestCombo: number;
  wrongDefuses: number;
  triggeredBombs: number;
  finalTime: number | null; // ms = realTime + totalPenalties
  voiceSlots?: [string | null, string | null]; // conn.id of active voice participants
}

export interface DefuseRankingEntry {
  name: string;
  finalTime: number; // ms
  realTime: number; // ms (pure elapsed)
  totalPenalties: number; // ms
  accuracy: number; // 0–100
  highestCombo: number;
  triggeredBombs: number; // Inspect mistakes (+30s each)
  wrongDefuses: number; // Defuse-wrong mistakes (+20s each)
  difficulty: Difficulty;
  timestamp: number;
  squadMembers?: string[]; // present for multi rooms
}

const DEFUSE_RANKING_ROOM_ID = "__defuse-ranking__";
const DEFUSE_RANKING_KEY_PREFIX = "defuse";

// ── Shared types ──────────────────────────────────────────────────────────

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
  | {
      type: "join";
      name: string;
      difficulty?: Difficulty;
      mode?: GameMode;
      ft?: 2 | 3 | 5 | 10;
      ai?: { level: AiLevel };
    }
  | { type: "reveal"; row: number; col: number }
  | { type: "flag"; row: number; col: number }
  | { type: "rematch" }
  | { type: "sticker"; id: string }
  | {
      type: "defuse-join";
      name: string;
      difficulty: Difficulty;
      squadName?: string;
      isMulti?: boolean;
    }
  | { type: "defuse-inspect"; row: number; col: number }
  | { type: "defuse-defuse"; row: number; col: number }
  | { type: "defuse-restart" }
  | { type: "defuse-play-again" }
  | { type: "defuse-sync" }
  | { type: "relay"; payload: unknown }
  | { type: "voice-join" }
  | { type: "voice-leave" };

// Server → Client
export type ServerMessage =
  | { type: "state"; state: GameState }
  | { type: "error"; message: string }
  | { type: "sticker"; id: string; from: 0 | 1; at: number }
  | { type: "bomb-found"; playerIndex: 0 | 1 }
  | { type: "defuse-state"; state: DefuseState }
  | { type: "defuse-penalty"; seconds: 20 | 30; row: number; col: number }
  | { type: "relay"; from: string; payload: unknown }
  | { type: "voice-full" };

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
  return (
    Object.values(AI_NAMES).some((n) => n.toLowerCase() === normalized) ||
    COOP_AI_NAME.toLowerCase() === normalized ||
    EXPLOSIVE_AI_NAME.toLowerCase() === normalized
  );
}

function normalizeRankingName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

function cloneRanking(entries: RankingEntry[]): RankingEntry[] {
  return entries.map((entry) => ({ ...entry }));
}

function sortRanking(entries: RankingEntry[]): RankingEntry[] {
  return cloneRanking(entries).sort(
    (a, b) =>
      b.points - a.points ||
      b.wins - a.wins ||
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

export function applyMatchResultToRanking(
  entries: RankingEntry[],
  winners: Player[],
): RankingEntry[] {
  const next = cloneRanking(entries);
  for (const winner of winners) {
    const key = normalizeRankingName(winner.name);
    const existing = next.find(
      (entry) => normalizeRankingName(entry.name) === key,
    );
    if (existing) {
      existing.points += winner.score;
      existing.wins += 1;
    } else {
      next.push({ name: winner.name, points: winner.score, wins: 1 });
    }
  }
  return sortRanking(next);
}

export function buildRankingPayload(
  entries: RankingEntry[],
  playerName: string | null,
  limit: number,
): RankingPayload {
  const sorted = sortRanking(entries);
  const top = sorted
    .slice(0, limit)
    .map((entry, index) => ({ ...entry, position: index + 1 }));
  if (!playerName) return { top, player: null };

  const playerIndex = sorted.findIndex(
    (entry) =>
      normalizeRankingName(entry.name) === normalizeRankingName(playerName),
  );
  if (playerIndex === -1) return { top, player: null };

  return {
    top,
    player: { ...sorted[playerIndex], position: playerIndex + 1 },
  };
}

// ── Defuse helpers ─────────────────────────────────────────────────────────

export function sortDefuseRanking(
  entries: DefuseRankingEntry[],
): DefuseRankingEntry[] {
  return [...entries].sort(
    (a, b) =>
      a.finalTime - b.finalTime ||
      b.highestCombo - a.highestCombo ||
      a.triggeredBombs - b.triggeredBombs ||
      a.wrongDefuses - b.wrongDefuses ||
      a.timestamp - b.timestamp,
  );
}

export interface DefuseRankingPayload {
  top: (DefuseRankingEntry & { position: number })[];
  player: (DefuseRankingEntry & { position: number }) | null;
}

export function buildDefuseRankingPayload(
  entries: DefuseRankingEntry[],
  difficulty: Difficulty,
  playerName: string | null,
  limit: number,
): DefuseRankingPayload {
  const filtered = entries.filter((e) => e.difficulty === difficulty);
  const sorted = sortDefuseRanking(filtered);
  const top = sorted.slice(0, limit).map((e, i) => ({ ...e, position: i + 1 }));
  if (!playerName) return { top, player: null };
  const idx = sorted.findIndex(
    (e) => e.name.trim().toLowerCase() === playerName.trim().toLowerCase(),
  );
  return {
    top,
    player: idx === -1 ? null : { ...sorted[idx], position: idx + 1 },
  };
}

export function createDefuseState(
  difficulty: Difficulty,
  playerName: string,
  options?: { deferGrid?: boolean },
): DefuseState {
  const { rows, cols, bombs } = DEFUSE_CONFIGS[difficulty];
  const deferGrid = options?.deferGrid === true;
  return {
    status: "waiting",
    difficulty,
    playerName,
    squadMembers: [playerName],
    defuseGridReady: deferGrid ? false : true,
    rows,
    cols,
    grid: deferGrid
      ? Array.from({ length: rows }, () => Array(cols).fill(0))
      : generateDefuseGrid(rows, cols, bombs),
    revealed: Array.from({ length: rows }, () => Array(cols).fill(false)),
    defused: Array.from({ length: rows }, () => Array(cols).fill(false)),
    exploded: Array.from({ length: rows }, () => Array(cols).fill(false)),
    startedAt: null,
    totalPenalties: 0,
    totalBombs: bombs,
    bombsResolved: 0,
    combo: 0,
    highestCombo: 0,
    wrongDefuses: 0,
    triggeredBombs: 0,
    finalTime: null,
    voiceSlots: [null, null],
  };
}

function generateDefuseGrid(
  rows: number,
  cols: number,
  bombs: number,
): number[][] {
  const grid: number[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(0),
  );
  let placed = 0;
  while (placed < bombs) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    if (grid[r][c] !== -1) {
      grid[r][c] = -1;
      placed++;
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === -1) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr,
            nc = c + dc;
          if (
            nr >= 0 &&
            nr < rows &&
            nc >= 0 &&
            nc < cols &&
            grid[nr][nc] === -1
          )
            count++;
        }
      grid[r][c] = count;
    }
  }
  return grid;
}

function maskDefuseGrid(state: DefuseState): number[][] {
  return state.grid.map((row, r) =>
    row.map((cell, c) => {
      if (state.status === "finished") return cell;
      if (state.revealed[r][c] || state.defused[r][c] || state.exploded[r][c])
        return cell;
      return -2; // hidden
    }),
  );
}

function areAllDefuseSafeCellsRevealed(state: DefuseState): boolean {
  const { rows, cols, grid, revealed } = state;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] !== -1 && !revealed[r][c]) return false;
    }
  }
  return true;
}

// ── Game Logic ─────────────────────────────────────────────────────────────

export function generateGrid(
  rows: number,
  cols: number,
  bombs: number,
): number[][] {
  const grid: number[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(0),
  );

  let placed = 0;
  while (placed < bombs) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    if (grid[r][c] !== -1) {
      grid[r][c] = -1;
      placed++;
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === -1) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr,
            nc = c + dc;
          if (
            nr >= 0 &&
            nr < rows &&
            nc >= 0 &&
            nc < cols &&
            grid[nr][nc] === -1
          )
            count++;
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
  cols: number,
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
  cols: number,
): { row: number; col: number }[] {
  const out: { row: number; col: number }[] = [];
  // Iterative DFS for stable order and to avoid recursion depth issues.
  const stack: { row: number; col: number }[] = [{ row: r, col: c }];

  while (stack.length) {
    const cur = stack.pop()!;

    if (cur.row < 0 || cur.row >= rows || cur.col < 0 || cur.col >= cols)
      continue;
    if (revealed[cur.row][cur.col]) continue;
    if (grid[cur.row][cur.col] === -1) continue;

    revealed[cur.row][cur.col] = true;
    out.push({ row: cur.row, col: cur.col });

    // Numbered cells are revealed but do not spread.
    // Only zero cells expand to neighbors.
    if (grid[cur.row][cur.col] !== 0) continue;

    // Push neighbors in reverse order so pop() yields a consistent, roughly row-major expansion.
    for (let dr = 1; dr >= -1; dr--) {
      for (let dc = 1; dc >= -1; dc--) {
        if (dr === 0 && dc === 0) continue;

        const nr = cur.row + dr;
        const nc = cur.col + dc;

        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        if (revealed[nr][nc]) continue;
        if (grid[nr][nc] === -1) continue;

        stack.push({ row: nr, col: nc });
      }
    }
  }

  return out;
}

export function createInitialState(
  difficulty: Difficulty,
  mode: GameMode = "versus",
): GameState {
  const { rows, cols, bombs } = (mode === "coop" ? COOP_CONFIGS : CONFIGS)[
    difficulty
  ];
  const isCoop = mode === "coop";
  const isExplosive = mode === "explosive";
  const readyGrid =
    mode === "versus"
      ? generateVersusGrid({
          rows,
          cols,
          bombs,
          ...VERSUS_ENERGY_PRESETS[difficulty],
        }).grid
      : generateGrid(rows, cols, bombs);

  return {
    status: "waiting",
    difficulty,
    mode,
    players: [null, null],
    currentPlayer: 0,
    // Coop: use a zero-filled placeholder; actual grid is generated on the first valid reveal.
    grid: isCoop
      ? Array.from({ length: rows }, () => Array(cols).fill(0))
      : isExplosive
        ? Array.from({ length: rows }, () => Array(cols).fill(0))
        : readyGrid,
    ...(isCoop ? { coopGridReady: false } : {}),
    ...(isExplosive ? { explosiveGridReady: false } : {}),
    revealed: Array.from({ length: rows }, () => Array(cols).fill(false)),
    foundBy: Array.from({ length: rows }, () =>
      Array<0 | 1 | null>(cols).fill(null),
    ),
    safeRevealedBy: [],
    totalBombs: bombs,
    lastPlayerClicks: [],
    rematchReady: [false, false],
  };
}

function createExplosiveSeries(
  target: 2 | 3 | 5 | 10,
): NonNullable<GameState["explosiveSeries"]> {
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
  return p1.score > p2.score + maxSwing || p2.score > p1.score + maxSwing;
}

function areAllNonBombCellsRevealed(
  state: GameState,
  dims: { rows: number; cols: number },
): boolean {
  const { rows, cols } = dims;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!state.revealed[r][c] && state.grid[r][c] !== -1) return false;
    }
  }
  return true;
}

export function areAllCoopSafeCellsRevealed(state: GameState): boolean {
  // Coop grid has not been generated yet — no safe cells can have been revealed.
  if (state.mode === "coop" && state.coopGridReady === false) return false;
  const { rows, cols } = COOP_CONFIGS[state.difficulty];
  return areAllNonBombCellsRevealed(state, { rows, cols });
}

// ── PartyKit Server ────────────────────────────────────────────────────────

export default class GameRoom implements Party.Server {
  // Serve static files from /public in dev/prod.
  // PartyKit only routes party URLs automatically; without this, GET / returns 404.
  static async onFetch(req: Party.Request, lobby: Party.FetchLobby) {
    try {
      const url = new URL(req.url);
      if (url.pathname === "/api/epa-debug-presets") {
        return Response.json({
          modes: {
            coop: getModeDebugPreset("coop"),
            versus: getModeDebugPreset("versus"),
            explosive: getModeDebugPreset("explosive"),
            defuse: getModeDebugPreset("defuse"),
          },
        });
      }

      if (req.method === "POST" && url.pathname === "/api/epa-debug-generate") {
        const body = (await req.json()) as {
          generator?: "epa" | "weighted";
          rows: number;
          cols: number;
          bombs: number;
          seed?: number;
          firstClick?: { row: number; col: number };
          safeEnergy?: number;
          dangerSources?: number;
          dangerEnergyMax?: number;
          reliefPockets?: number;
          reliefEnergyMax?: number;
          reliefWeightMultiplier?: number;
          dangerWeightMultiplier?: number;
        };

        if (body.generator === "weighted") {
          const result = generateVersusGrid({
            rows: body.rows,
            cols: body.cols,
            bombs: body.bombs,
            seed: body.seed,
            dangerSources: body.dangerSources ?? 3,
            dangerEnergyMax: body.dangerEnergyMax ?? 4,
            reliefPockets: body.reliefPockets ?? 1,
            reliefEnergyMax: body.reliefEnergyMax ?? 2,
            reliefWeightMultiplier: body.reliefWeightMultiplier ?? 0.72,
            dangerWeightMultiplier: body.dangerWeightMultiplier ?? 1.15,
          });

          return Response.json({
            ok: true,
            generator: "weighted",
            grid: result.grid,
            dangerMap: result.dangerMap,
            reliefMap: result.reliefMap,
            safeZone: Array.from(result.safeZone),
          });
        }

        const firstClick = body.firstClick ?? {
          row: Math.floor(body.rows / 2),
          col: Math.floor(body.cols / 2),
        };
        const result = generateCoopGrid({
          rows: body.rows,
          cols: body.cols,
          bombs: body.bombs,
          firstClick,
          safeEnergy: body.safeEnergy ?? 1,
          dangerSources: body.dangerSources ?? 3,
          dangerEnergyMax: body.dangerEnergyMax ?? 4,
          reliefPockets: body.reliefPockets ?? 1,
          reliefEnergyMax: body.reliefEnergyMax ?? 2,
          reliefWeightMultiplier: body.reliefWeightMultiplier ?? 0.35,
          dangerWeightMultiplier: body.dangerWeightMultiplier ?? 1.1,
          seed: body.seed,
        });

        return Response.json({
          ok: true,
          generator: "epa",
          grid: result.grid,
          dangerMap: result.dangerMap,
          reliefMap: result.reliefMap,
          safeZone: Array.from(result.safeZone),
          firstClick,
        });
      }

      if (url.pathname === "/api/ranking") {
        const partyName = Object.keys(lobby.parties)[0];
        if (!partyName)
          return Response.json({
            top: [],
            player: null,
          } satisfies RankingPayload);
        const player = url.searchParams.get("player");
        const limit = url.searchParams.get("limit") || "10";
        return lobby.parties[partyName]
          .get(RANKING_ROOM_ID)
          .fetch(
            `/snapshot?limit=${encodeURIComponent(limit)}${player ? `&player=${encodeURIComponent(player)}` : ""}`,
          );
      }

      if (url.pathname === "/api/defuse-ranking") {
        const partyName = Object.keys(lobby.parties)[0];
        if (!partyName)
          return Response.json({
            top: [],
            player: null,
          } satisfies DefuseRankingPayload);
        const player = url.searchParams.get("player");
        const difficulty = (url.searchParams.get("difficulty") ||
          "medium") as Difficulty;
        const limit = url.searchParams.get("limit") || "10";
        return lobby.parties[partyName]
          .get(DEFUSE_RANKING_ROOM_ID)
          .fetch(
            `/defuse-snapshot?difficulty=${encodeURIComponent(difficulty)}&limit=${encodeURIComponent(limit)}${player ? `&player=${encodeURIComponent(player)}` : ""}`,
          );
      }

      let path = url.pathname;
      if (path === "/") path = "/index.html";

      const asset = await lobby.assets.fetch(path);
      if (asset) {
        // version.json, index.html, and i18n.js never should be cached, to ensure clients always get the latest version and the app shell.
        if (
          path === "/version.json" ||
          path === "/index.html" ||
          path === "/i18n.js"
        ) {
          const headers = new Headers(asset.headers);
          headers.set(
            "cache-control",
            "no-store, no-cache, must-revalidate, max-age=0",
          );
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
        {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        },
      );
    }
  }

  state: GameState | null = null;
  defuseState: DefuseState | null = null;
  private defuseRankingRecorded = false;
  private defuseConnectionToName: Map<string, string> = new Map();
  connectionToPlayer: Map<string, 0 | 1> = new Map();
  private aiTimer: ReturnType<typeof setTimeout> | null = null;
  private explosiveCooldownTimer: ReturnType<typeof setTimeout> | null = null;
  private aiLevel: AiLevel = "medium";
  private aiFlags: boolean[][] | null = null;
  private lastStickerAt: Map<string, number> = new Map();
  private rankingRecorded = false;

  constructor(readonly room: Party.Room) {}

  async onStart() {
    this.defuseState =
      (await this.room.storage.get<DefuseState>("defuse-state")) ?? null;
    this.defuseRankingRecorded =
      (await this.room.storage.get<boolean>("defuse-ranking-recorded")) ??
      false;
    if (this.defuseState) return;
    this.state = (await this.room.storage.get<GameState>("state")) ?? null;
    const saved =
      await this.room.storage.get<Map<string, 0 | 1>>("connectionToPlayer");
    this.connectionToPlayer = saved ?? new Map();
    this.aiLevel =
      (await this.room.storage.get<AiLevel>("aiLevel")) ?? "medium";
    this.aiFlags =
      (await this.room.storage.get<boolean[][]>("aiFlags")) ?? null;
    this.rankingRecorded =
      (await this.room.storage.get<boolean>("rankingRecorded")) ?? false;
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
    if (
      this.state?.mode === "explosive" &&
      this.state.explosiveCooldownUntil &&
      this.state.status === "playing"
    ) {
      const ms = Math.max(0, this.state.explosiveCooldownUntil - Date.now());
      if (ms > 0)
        this.explosiveCooldownTimer = setTimeout(
          () => void this.finishExplosiveCooldown(),
          ms,
        );
      else await this.finishExplosiveCooldown();
    }
  }

  async onRequest(req: Party.Request) {
    try {
      if (
        this.room.id !== RANKING_ROOM_ID &&
        this.room.id !== DEFUSE_RANKING_ROOM_ID
      ) {
        return new Response("Not found", { status: 404 });
      }

      const url = new URL(req.url);
      if (req.method === "GET" && url.pathname.endsWith("/snapshot")) {
        const limit = Number.parseInt(
          url.searchParams.get("limit") || "10",
          10,
        );
        const player = url.searchParams.get("player");
        const ranking =
          (await this.room.storage.get<RankingEntry[]>(RANKING_STORAGE_KEY)) ??
          [];
        return Response.json(
          buildRankingPayload(
            ranking,
            player,
            Number.isFinite(limit) ? limit : 10,
          ),
        );
      }

      if (req.method === "POST" && url.pathname.endsWith("/apply-match")) {
        const body = (await req.json()) as { winners: Player[] };
        const ranking =
          (await this.room.storage.get<RankingEntry[]>(RANKING_STORAGE_KEY)) ??
          [];
        const updated = applyMatchResultToRanking(ranking, body.winners);
        await this.room.storage.put(RANKING_STORAGE_KEY, updated);
        return Response.json({ ok: true });
      }

      // Defuse ranking snapshot
      if (req.method === "GET" && url.pathname.endsWith("/defuse-snapshot")) {
        const difficulty = (url.searchParams.get("difficulty") ||
          "medium") as Difficulty;
        const limit = Number.parseInt(
          url.searchParams.get("limit") || "10",
          10,
        );
        const player = url.searchParams.get("player");
        const entries =
          (await this.room.storage.get<DefuseRankingEntry[]>(
            DEFUSE_RANKING_KEY_PREFIX,
          )) ?? [];
        return Response.json(
          buildDefuseRankingPayload(
            entries,
            difficulty,
            player,
            Number.isFinite(limit) ? limit : 10,
          ),
        );
      }

      // Apply defuse match result
      if (req.method === "POST" && url.pathname.endsWith("/apply-defuse")) {
        const entry = (await req.json()) as DefuseRankingEntry;
        const entries =
          (await this.room.storage.get<DefuseRankingEntry[]>(
            DEFUSE_RANKING_KEY_PREFIX,
          )) ?? [];
        // Keep only best result per player per difficulty (lower finalTime wins)
        const existingIdx = entries.findIndex(
          (e) =>
            e.name.toLowerCase() === entry.name.toLowerCase() &&
            e.difficulty === entry.difficulty,
        );
        if (existingIdx === -1) {
          entries.push(entry);
        } else if (entry.finalTime < entries[existingIdx].finalTime) {
          entries[existingIdx] = entry;
        }
        await this.room.storage.put(DEFUSE_RANKING_KEY_PREFIX, entries);
        return Response.json({ ok: true });
      }

      return new Response("Not found", { status: 404 });
    } catch (err) {
      console.error("onRequest error", err);
      return new Response("Internal error", { status: 500 });
    }
  }

  async onConnect(conn: Party.Connection) {
    if (this.defuseState) {
      conn.send(
        JSON.stringify({
          type: "defuse-state",
          state: this.maskedDefuseState(),
        } satisfies ServerMessage),
      );
      return;
    }
    if (!this.state) return;
    this.send(conn, { type: "state", state: this.state });
  }

  async onMessage(message: string, sender: Party.Connection) {
    const msg = JSON.parse(message) as ClientMessage;
    if (msg.type === "defuse-join") {
      await this.handleDefuseJoin(
        sender,
        msg.name,
        msg.difficulty,
        msg.squadName,
        msg.isMulti,
      );
      return;
    }
    if (msg.type === "defuse-inspect") {
      await this.handleDefuseAction(sender, msg.row, msg.col, "inspect");
      return;
    }
    if (msg.type === "defuse-defuse") {
      await this.handleDefuseAction(sender, msg.row, msg.col, "defuse");
      return;
    }
    if (msg.type === "defuse-restart") {
      await this.handleDefuseRestart(sender);
      return;
    }
    if (msg.type === "defuse-play-again") {
      await this.handleDefusePlayAgain(sender);
      return;
    }
    if (msg.type === "defuse-sync") {
      if (!this.defuseState) return;
      await this.ensureDefuseTimeout();
      sender.send(
        JSON.stringify({
          type: "defuse-state",
          state: this.maskedDefuseState(),
        } satisfies ServerMessage),
      );
      if (this.defuseState.status === "finished") {
        await this.persistDefuse();
        await this.finalizeDefuseMatch();
      }
      return;
    }
    if (msg.type === "join")
      await this.handleJoin(
        sender,
        msg.name,
        msg.difficulty,
        msg.mode,
        msg.ft,
        msg.ai,
      );
    if (msg.type === "reveal")
      await this.handleReveal(sender, msg.row, msg.col);
    if (msg.type === "flag") await this.handleFlag(sender, msg.row, msg.col);
    if (msg.type === "rematch") await this.handleRematch(sender);
    if (msg.type === "relay")
      this.handleRelay(sender, msg.payload);
    if (msg.type === "voice-join")
      await this.handleVoiceJoin(sender);
    if (msg.type === "voice-leave")
      await this.handleVoiceLeave(sender);
    if (msg.type === "sticker") await this.handleSticker(sender, msg.id);
  }

  async onClose(conn: Party.Connection) {
    this.defuseConnectionToName.delete(conn.id);
    this.connectionToPlayer.delete(conn.id);
    // Clean up voice slots if this connection was in voice
    if (this.defuseState?.voiceSlots) {
      const idx = this.defuseState.voiceSlots.indexOf(conn.id);
      if (idx !== -1) {
        this.defuseState.voiceSlots[idx] = null;
        this.broadcastDefuse();
      }
    }
    await this.room.storage.put("connectionToPlayer", this.connectionToPlayer);
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  private async handleJoin(
    conn: Party.Connection,
    name: string,
    difficulty?: Difficulty,
    mode?: GameMode,
    ft?: 2 | 3 | 5 | 10,
    ai?: { level: AiLevel },
  ) {
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
        if (migrated) this.broadcast();
        else this.send(conn, { type: "state", state: this.state });
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
        this.state.explosiveBoardId = nextExplosiveBoardId(
          this.state.explosiveBoardId,
        );
      }
      this.state.players[0] = { id: conn.id, name, score: 0, bombs: 0 };
      this.connectionToPlayer.set(conn.id, 0);
      if (ai) {
        // Coop and Explosive AI are always hard; in Explosive AtenaBot uses bomb-avoidance heuristic.
        this.aiLevel =
          this.state.mode === "coop" || this.state.mode === "explosive"
            ? "hard"
            : ai.level;
        await this.room.storage.put("aiLevel", this.aiLevel);
        // Single-player: spawn an AI opponent immediately.
        this.state.players[1] = {
          id: "ai",
          name:
            this.state.mode === "coop"
              ? COOP_AI_NAME
              : this.state.mode === "explosive"
                ? EXPLOSIVE_AI_NAME
                : AI_NAMES[this.aiLevel],
          score: 0,
          bombs: 0,
        };
        this.state.status = "playing";
        this.state.currentPlayer = Math.random() < 0.5 ? 0 : 1;
        this.ensureAiFlags();
        await this.room.storage.put("aiFlags", this.aiFlags);
      }
      await this.persist();
      this.broadcast();
      if (ai && this.state.currentPlayer === 1)
        this.scheduleAiMove(this.aiLevel);
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
      this.state.currentPlayer = Math.random() < 0.5 ? 0 : 1;
      this.connectionToPlayer.set(conn.id, 1);
      await this.persist();
      this.broadcast();
      return;
    }

    this.send(conn, { type: "error", message: "room_full" });
  }

  private async handleReveal(conn: Party.Connection, row: number, col: number) {
    if (!this.state || this.state.status !== "playing") return;
    if (
      this.state.mode === "explosive" &&
      this.state.explosiveCooldownUntil &&
      Date.now() < this.state.explosiveCooldownUntil
    )
      return;

    const playerIndex = this.connectionToPlayer.get(conn.id);
    if (playerIndex === undefined) return;
    if (playerIndex !== this.state.currentPlayer) return;

    const config =
      this.state.mode === "coop"
        ? COOP_CONFIGS[this.state.difficulty]
        : CONFIGS[this.state.difficulty];

    const { rows, cols } = config;

    if (row < 0 || row >= rows || col < 0 || col >= cols) return;

    // Coop: generate the real grid only on the first valid reveal by the current player.
    // This prevents revealing the zero-filled placeholder grid.
    if (this.state.mode === "coop" && this.state.coopGridReady === false) {
      this.ensureCoopGridReady({ row, col });
    }

    // Explosive: generate the real grid only on the first valid reveal by the current player.
    // This guarantees the first click is never a bomb and keeps distribution consistent.
    if (
      this.state.mode === "explosive" &&
      this.state.explosiveGridReady === false
    ) {
      this.ensureExplosiveGridReady({ row, col });
    }

    if (this.state.revealed[row][col]) return;

    const player = this.state.players[playerIndex]!;

    if (
      this.state.lastPlayerClicks.length > 0 &&
      this.state.lastPlayerClicks[0].playerIndex !== playerIndex
    ) {
      this.state.lastPlayerClicks = [];
    }

    this.state.lastClickedCell = { row, col, playerIndex };
    this.state.lastPlayerClicks.push({ row, col, playerIndex });

    const bombMode = this.state.mode;
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
          // Loser starts the next round (even though the other player gets the point).
          this.state.currentPlayer = playerIndex;
          this.state.explosiveCooldownUntil = Date.now() + 5000;
          this.clearExplosiveCooldownTimer();
          this.explosiveCooldownTimer = setTimeout(
            () => void this.finishExplosiveCooldown(),
            5000,
          );
        }

        await this.finalizeMatchIfNeeded();
        await this.persist();
        this.broadcast();
        if (
          this.state.status === "playing" &&
          this.state.players[1]?.id === "ai" &&
          this.state.currentPlayer === 1
        ) {
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
      if (bombMode === "coop" || bombMode === "explosive") {
        this.room.broadcast(
          JSON.stringify({
            type: "bomb-found",
            playerIndex: playerIndex as 0 | 1,
          } satisfies ServerMessage),
        );
      }

      // Bomba: mantém a rodada, não limpa, não passa a vez
      if (
        this.state.status === "playing" &&
        this.state.players[1]?.id === "ai" &&
        this.state.currentPlayer === 1
      ) {
        this.scheduleAiMove(this.aiLevel);
      }
      return; // IMPORTANTE: retorna aqui
    } else {
      const newlySafe = floodRevealWithAttribution(
        this.state.grid,
        this.state.revealed,
        row,
        col,
        rows,
        cols,
      );
      // Clear coop flags from any newly revealed cells so slots are returned to the player.
      if (this.state.flags) {
        for (const { row: r, col: c } of newlySafe) {
          if (this.state.flags[r]?.[c]) this.state.flags[r][c] = false;
        }
      }
      // Record safe cell ownership for coop progress UI.
      if (this.state.safeRevealedBy) {
        for (let i = 0; i < newlySafe.length; i++)
          this.state.safeRevealedBy.push(playerIndex);
      } else {
        this.state.safeRevealedBy = Array.from(
          { length: newlySafe.length },
          () => playerIndex,
        );
      }
      // Keep foundBy updated for safe cells too; this helps migrations/debug/UI attribution.
      for (const { row: r, col: c } of newlySafe) {
        this.state.foundBy[r][c] = playerIndex;
      }
      // Accumulate per-cell bonus for coop (always track for display; ranking exclusion handled separately).
      if (this.state.mode === "coop" && newlySafe.length > 0) {
        const p = this.state.players[playerIndex];
        if (p && p.id !== "ai") p.score += newlySafe.length * CELL_BONUS;
      }
      this.state.currentPlayer = playerIndex === 0 ? 1 : 0;
      if (
        this.state.mode === "explosive" &&
        this.state.explosiveSeries &&
        areAllNonBombCellsRevealed(this.state, { rows, cols })
      ) {
        // Explosive: if players reveal every non-bomb cell without hitting any bomb,
        // the round is a draw and both sides get a point.
        const series = this.state.explosiveSeries;
        series.wins[0] += 1;
        series.wins[1] += 1;
        series.round += 1;

        const target = series.target;
        const p1Reached = series.wins[0] >= target;
        const p2Reached = series.wins[1] >= target;

        if (p1Reached && p2Reached) {
          // Match draw: no winner points.
          const p1 = this.state.players[0];
          const p2 = this.state.players[1];
          if (p1) p1.score = 0;
          if (p2) p2.score = 0;
          this.state.status = "finished";
        } else if (p1Reached || p2Reached) {
          const winner: 0 | 1 = p1Reached ? 0 : 1;
          const pts = POINTS_TABLE.explosive[target];
          const pWin = this.state.players[winner];
          const pLose = this.state.players[winner === 0 ? 1 : 0];
          if (pWin) pWin.score = pts;
          if (pLose) pLose.score = 0;
          this.state.status = "finished";
        } else {
          // Start next round.
          this.state.currentPlayer = Math.random() < 0.5 ? 0 : 1;
          this.state.explosiveCooldownUntil = Date.now() + 5000;
          this.clearExplosiveCooldownTimer();
          this.explosiveCooldownTimer = setTimeout(
            () => void this.finishExplosiveCooldown(),
            5000,
          );
        }
      } else if (
        this.state.mode === "coop" &&
        areAllCoopSafeCellsRevealed(this.state)
      ) {
        this.state.status = "finished";
        this.state.coopResult = "win";
        // Base prize was already seeded into score at game start; nothing extra to add here.
      }
    }

    await this.finalizeMatchIfNeeded();
    await this.persist();
    this.broadcast();

    if (
      this.state.status === "playing" &&
      this.state.players[1]?.id === "ai" &&
      this.state.currentPlayer === 1
    ) {
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
      this.state.flags = Array.from({ length: rows }, () =>
        Array(cols).fill(false),
      );
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
    if (this.defuseState) {
      if (
        this.defuseState.status !== "playing" &&
        this.defuseState.status !== "finished"
      ) {
        return;
      }
      if (!this.defuseConnectionToName.has(conn.id)) return;
      if (!isValidStickerId(id)) return;

      const now = Date.now();
      const last = this.lastStickerAt.get(conn.id) ?? 0;
      if (now - last < 900) return;
      this.lastStickerAt.set(conn.id, now);

      this.room.broadcast(
        JSON.stringify({
          type: "sticker",
          id,
          from: 0,
          at: now,
        } satisfies ServerMessage),
      );
      return;
    }
    if (!this.state) return;
    if (this.state.status !== "playing" && this.state.status !== "finished")
      return;

    const from = this.connectionToPlayer.get(conn.id);
    if (from === undefined) return;
    if (!isValidStickerId(id)) return;

    const now = Date.now();
    const last = this.lastStickerAt.get(conn.id) ?? 0;
    // Server-side cooldown to avoid spamming.
    if (now - last < 900) return;
    this.lastStickerAt.set(conn.id, now);

    this.room.broadcast(
      JSON.stringify({
        type: "sticker",
        id,
        from,
        at: now,
      } satisfies ServerMessage),
    );
  }

  private handleRelay(conn: Party.Connection, payload: unknown) {
    // Broadcast relay payload to all connections except sender
    this.room.broadcast(
      JSON.stringify({
        type: "relay",
        from: conn.id,
        payload,
      } satisfies ServerMessage),
      [conn.id],
    );
  }

  private async handleVoiceJoin(conn: Party.Connection) {
    if (!this.defuseState) return;
    if (!this.defuseConnectionToName.has(conn.id)) return;

    // Only for multiplayer defuse
    if (!this.defuseState.isMulti) return;

    if (!this.defuseState.voiceSlots) {
      this.defuseState.voiceSlots = [null, null];
    }

    // Find first available slot
    const emptySlot = this.defuseState.voiceSlots.findIndex((s) => s === null);
    if (emptySlot === -1) {
      // Both slots full
      this.send(conn, { type: "voice-full" });
      return;
    }

    // Assign connection to slot
    this.defuseState.voiceSlots[emptySlot] = conn.id;
    await this.persistDefuse();
    this.broadcastDefuse();
  }

  private async handleVoiceLeave(conn: Party.Connection) {
    if (!this.defuseState?.voiceSlots) return;

    const idx = this.defuseState.voiceSlots.indexOf(conn.id);
    if (idx !== -1) {
      this.defuseState.voiceSlots[idx] = null;
      await this.persistDefuse();
      this.broadcastDefuse();
    }
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
    // Defer explosive grid generation to the first click of the round so
    // the click is guaranteed safe and distribution can be tuned.
    this.state.grid = Array.from({ length: rows }, () => Array(cols).fill(0));
    this.state.explosiveGridReady = false;
    this.state.revealed = Array.from({ length: rows }, () =>
      Array(cols).fill(false),
    );
    this.state.foundBy = Array.from({ length: rows }, () =>
      Array<0 | 1 | null>(cols).fill(null),
    );
    this.state.safeRevealedBy = [];
    this.state.lastClickedCell = undefined;
    this.state.lastPlayerClicks = [];
    this.state.explosiveBoardId = nextExplosiveBoardId(
      this.state.explosiveBoardId,
    );

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
    if (
      !this.state ||
      this.state.mode !== "coop" ||
      this.state.status !== "playing"
    )
      return false;
    const p0 = this.state.players[0];
    const p1 = this.state.players[1];
    if (!p0 && !p1) return false;
    // Both scores must be 0 to qualify for migration (avoid double-applying).
    const s0 = p0?.score ?? 0;
    const s1 = p1?.score ?? 0;
    if (s0 !== 0 || s1 !== 0) return false;
    // Count safe revealed cells per player via foundBy grid.
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
    // Coop: reset to zero-filled placeholder so next match also defers grid generation.
    if (prev.mode === "coop") {
      const { rows, cols } = COOP_CONFIGS[prev.difficulty];
      next.grid = Array.from({ length: rows }, () => Array(cols).fill(0));
      next.coopGridReady = false;
    }
    next.status = "playing";
    next.currentPlayer = Math.random() < 0.5 ? 0 : 1;
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
      hasTwoPlayers &&
      (p2IsAi || (this.state.rematchReady[0] && this.state.rematchReady[1]));

    if (shouldRestart) {
      this.rankingRecorded = false;
      await this.room.storage.put("rankingRecorded", this.rankingRecorded);

      this.resetMatchStatePreservingPlayers();

      // New match: always reset AI flags from scratch — stale flags from the
      // previous grid would cause the AI to misidentify safe cells as bombs.
      if (this.state.players[1]?.id === "ai") {
        const rows = this.state.grid.length;
        const cols = this.state.grid[0]?.length ?? 0;
        this.aiFlags = Array.from({ length: rows }, () =>
          Array(cols).fill(false),
        );
        await this.room.storage.put("aiFlags", this.aiFlags);
      } else {
        this.aiFlags = null;
        await this.room.storage.delete("aiFlags");
      }

      await this.persist();
      this.broadcast();

      if (
        this.state.players[1]?.id === "ai" &&
        this.state.currentPlayer === 1
      ) {
        this.scheduleAiMove(this.aiLevel);
      }
      return;
    }

    await this.persist();
    this.broadcast();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Coop only.
   * Generates the real coop grid from the first valid click.
   * This prevents the placeholder zero grid from ever being revealed.
   */
  private ensureCoopGridReady(firstClick: { row: number; col: number }) {
    if (!this.state) return;
    if (this.state.mode !== "coop") return;
    if (this.state.coopGridReady !== false) return;

    const { rows, cols, bombs } = COOP_CONFIGS[this.state.difficulty];

    if (
      firstClick.row < 0 ||
      firstClick.row >= rows ||
      firstClick.col < 0 ||
      firstClick.col >= cols
    ) {
      return;
    }

    const preset = ENERGY_PRESETS[this.state.difficulty];
    const result = generateCoopGrid({
      rows,
      cols,
      bombs,
      firstClick,
      ...preset,
    });

    this.state.grid = result.grid;
    this.state.coopGridReady = true;

    // Keep auxiliary matrices aligned with the coop config.
    this.state.revealed = Array.from({ length: rows }, () =>
      Array(cols).fill(false),
    );
    this.state.foundBy = Array.from({ length: rows }, () =>
      Array<0 | 1 | null>(cols).fill(null),
    );
    this.state.safeRevealedBy = [];
    this.state.flags = undefined;
  }

  /**
   * Explosive only.
   * Generates the real explosive grid from the first valid click.
   * Guarantees the first click is not a bomb, and reuses the coop distribution tuning.
   */
  private ensureExplosiveGridReady(firstClick: { row: number; col: number }) {
    if (!this.state) return;
    if (this.state.mode !== "explosive") return;
    if (this.state.explosiveGridReady !== false) return;

    const { rows, cols, bombs } = CONFIGS[this.state.difficulty];

    if (
      firstClick.row < 0 ||
      firstClick.row >= rows ||
      firstClick.col < 0 ||
      firstClick.col >= cols
    ) {
      return;
    }

    const preset = ENERGY_PRESETS[this.state.difficulty];
    const result = generateCoopGrid({
      rows,
      cols,
      bombs,
      firstClick,
      ...preset,
    });

    this.state.grid = result.grid;
    this.state.explosiveGridReady = true;

    // Keep auxiliary matrices aligned with the explosive config.
    this.state.revealed = Array.from({ length: rows }, () =>
      Array(cols).fill(false),
    );
    this.state.foundBy = Array.from({ length: rows }, () =>
      Array<0 | 1 | null>(cols).fill(null),
    );
    this.state.safeRevealedBy = [];
    this.state.lastClickedCell = undefined;
    this.state.lastPlayerClicks = [];

    // Explosive does not use coop flags.
    this.state.flags = undefined;
  }

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
    // Never send the real value of unrevealed cells to the client.
    // Important: do NOT mask hidden bombs as 0.
    // 0 is a meaningful Minesweeper value and can make client-side reveal/animation
    // logic think the whole hidden board is empty.
    //
    // -2 = hidden/unknown cell for the client.
    // Revealed cells keep their real value.
    // Finished games may reveal the full board.
    const shouldRevealFullBoard = state.status === "finished";

    const maskedGrid = state.grid.map((row, r) =>
      row.map((cell, c) => {
        if (shouldRevealFullBoard) return cell;
        return state.revealed[r]?.[c] ? cell : -2;
      }),
    );

    return { ...state, grid: maskedGrid };
  }

  private broadcast() {
    if (!this.state) return;
    const masked = this.maskStateForClient(this.state);
    this.room.broadcast(
      JSON.stringify({ type: "state", state: masked } satisfies ServerMessage),
    );
  }

  private send(conn: Party.Connection, msg: ServerMessage) {
    const outMsg =
      msg.type === "state"
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
    if (
      this.state.mode === "explosive" &&
      this.state.explosiveCooldownUntil &&
      Date.now() < this.state.explosiveCooldownUntil
    )
      return;

    const config =
      this.state.mode === "coop"
        ? COOP_CONFIGS[this.state.difficulty]
        : CONFIGS[this.state.difficulty];

    const { rows, cols } = config;

    // Critical for coop:
    // If the AI starts the match, the board is still a zero-filled placeholder.
    // Generate the real board and use the firstClick cell directly — it is guaranteed
    // safe by the energy propagation algorithm, so no separate pickAiCell needed.
    if (this.state.mode === "coop" && this.state.coopGridReady === false) {
      const firstClick = this.pickInitialAiCoopClick(rows, cols);
      if (!firstClick) return;
      this.ensureCoopGridReady(firstClick);
      this.ensureAiFlags();
      // Click exactly the cell used as firstClick — safe by construction.
      const { row: fcRow, col: fcCol } = firstClick;
      if (!this.state.revealed[fcRow][fcCol]) {
        const pick = { row: fcRow, col: fcCol };
        // Fall through to the reveal logic below by overwriting row/col.
        // We do this by continuing with the rest of aiMove using these coords.
        // Inline the reveal here to avoid duplicating the rest of the function.
        this.state.lastClickedCell = { row: fcRow, col: fcCol, playerIndex: 1 };
        this.state.lastPlayerClicks = [
          { row: fcRow, col: fcCol, playerIndex: 1 },
        ];
        const newlySafe = floodRevealWithAttribution(
          this.state.grid,
          this.state.revealed,
          fcRow,
          fcCol,
          rows,
          cols,
        );
        if (this.state.flags) {
          for (const { row: r, col: c } of newlySafe) {
            if (this.state.flags[r]?.[c]) this.state.flags[r][c] = false;
          }
        }
        if (this.state.safeRevealedBy) {
          for (let i = 0; i < newlySafe.length; i++)
            this.state.safeRevealedBy.push(1);
        } else {
          this.state.safeRevealedBy = Array.from(
            { length: newlySafe.length },
            () => 1 as 0 | 1,
          );
        }
        for (const { row: r, col: c } of newlySafe)
          this.state.foundBy[r][c] = 1;
        this.state.currentPlayer = 0;
        if (
          this.state.mode === "coop" &&
          areAllCoopSafeCellsRevealed(this.state)
        ) {
          this.state.status = "finished";
          this.state.coopResult = "win";
        }
        await this.finalizeMatchIfNeeded();
        await this.persist();
        await this.room.storage.put("aiFlags", this.aiFlags);
        this.broadcast();
        if (
          this.state.status === "playing" &&
          (this.state.currentPlayer as 0 | 1) === 1
        ) {
          this.scheduleAiMove(level);
        }
        return;
      }
    }

    // Explosive: if AI starts the match or a round, the board may be a placeholder.
    // Generate the real board on the first AI click (guaranteed safe by construction).
    if (
      this.state.mode === "explosive" &&
      this.state.explosiveGridReady === false
    ) {
      const firstClick = pickAiCell(this.state, this.aiFlags!, level);
      if (!firstClick) return;
      this.ensureExplosiveGridReady(firstClick);
      // Click exactly the cell used as firstClick.
      const { row: fcRow, col: fcCol } = firstClick;
      if (!this.state.revealed[fcRow][fcCol]) {
        // Inline reveal for explosive to avoid duplicating other mode logic.
        this.state.lastClickedCell = { row: fcRow, col: fcCol, playerIndex: 1 };
        this.state.lastPlayerClicks = [
          { row: fcRow, col: fcCol, playerIndex: 1 },
        ];
        const newlySafe = floodRevealWithAttribution(
          this.state.grid,
          this.state.revealed,
          fcRow,
          fcCol,
          rows,
          cols,
        );
        if (this.state.safeRevealedBy) {
          for (let i = 0; i < newlySafe.length; i++)
            this.state.safeRevealedBy.push(1);
        } else {
          this.state.safeRevealedBy = Array.from(
            { length: newlySafe.length },
            () => 1 as 0 | 1,
          );
        }
        for (const { row: r, col: c } of newlySafe)
          this.state.foundBy[r][c] = 1;
        this.state.currentPlayer = 0;
        await this.finalizeMatchIfNeeded();
        await this.persist();
        if (this.aiFlags) await this.room.storage.put("aiFlags", this.aiFlags);
        this.broadcast();
        return;
      }
    }

    this.ensureAiFlags();

    const pick = pickAiCell(this.state, this.aiFlags!, level);
    if (!pick) return;

    const { row, col } = pick;

    if (row < 0 || row >= rows || col < 0 || col >= cols) return;

    // Defensive guard: never reveal the coop placeholder.
    if (this.state.mode === "coop" && this.state.coopGridReady === false)
      return;

    if (this.state.revealed[row][col]) return;

    const aiPlayer = this.state.players[1]!;

    if (
      this.state.lastPlayerClicks.length > 0 &&
      this.state.lastPlayerClicks[0].playerIndex !== 1
    ) {
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
          // Loser starts the next round.
          this.state.currentPlayer = 1;
          this.state.explosiveCooldownUntil = Date.now() + 5000;
          this.clearExplosiveCooldownTimer();
          this.explosiveCooldownTimer = setTimeout(
            () => void this.finishExplosiveCooldown(),
            5000,
          );
        }

        await this.finalizeMatchIfNeeded();
        await this.persist();
        if (this.aiFlags) await this.room.storage.put("aiFlags", this.aiFlags);
        this.broadcast();
        this.room.broadcast(
          JSON.stringify({
            type: "bomb-found",
            playerIndex: 1,
          } satisfies ServerMessage),
        );
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
      // Only shake in modes where hitting a bomb is bad (not versus, where it scores points)
      if (this.state.mode === "coop") {
        this.room.broadcast(
          JSON.stringify({
            type: "bomb-found",
            playerIndex: 1,
          } satisfies ServerMessage),
        );
      }

      // Bomb keeps the turn, so schedule another move immediately.
      if (this.state.status === "playing" && this.state.currentPlayer === 1) {
        this.scheduleAiMove(level);
      }
      return; // Retorna aqui, não executa o resto
    } else {
      const newlySafe = floodRevealWithAttribution(
        this.state.grid,
        this.state.revealed,
        row,
        col,
        rows,
        cols,
      );
      // Clear coop flags from any newly revealed cells so slots are returned to the player.
      if (this.state.flags) {
        for (const { row: r, col: c } of newlySafe) {
          if (this.state.flags[r]?.[c]) this.state.flags[r][c] = false;
        }
      }
      if (this.state.safeRevealedBy) {
        for (let i = 0; i < newlySafe.length; i++)
          this.state.safeRevealedBy.push(1);
      } else {
        this.state.safeRevealedBy = Array.from(
          { length: newlySafe.length },
          () => 1,
        );
      }
      // Keep foundBy updated for safe cells too.
      for (const { row: r, col: c } of newlySafe) {
        this.state.foundBy[r][c] = 1;
      }
      this.state.currentPlayer = 0;
      if (areAllNonBombCellsRevealed(this.state, { rows, cols })) {
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

    if (
      this.state.status === "playing" &&
      (this.state.currentPlayer as 0 | 1) === 1
    ) {
      this.scheduleAiMove(level);
    }
  }

  private pickInitialAiCoopClick(
    rows: number,
    cols: number,
  ): { row: number; col: number } | null {
    if (!this.state) return null;

    const candidates: { row: number; col: number }[] = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (this.state.revealed[r]?.[c]) continue;
        if (this.state.flags?.[r]?.[c]) continue;
        candidates.push({ row: r, col: c });
      }
    }

    if (!candidates.length) return null;

    // Prefer a non-edge cell for a healthier first reveal shape.
    const inner = candidates.filter(
      (cell) =>
        cell.row > 0 &&
        cell.row < rows - 1 &&
        cell.col > 0 &&
        cell.col < cols - 1,
    );

    const pool = inner.length ? inner : candidates;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  private ensureAiFlags() {
    if (!this.state) return;
    const rows = this.state.grid.length;
    const cols = this.state.grid[0]?.length ?? 0;
    if (
      !this.aiFlags ||
      this.aiFlags.length !== rows ||
      (this.aiFlags[0]?.length ?? 0) !== cols
    ) {
      this.aiFlags = Array.from({ length: rows }, () =>
        Array(cols).fill(false),
      );
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
      const base =
        POINTS_TABLE.coop[
          this.state.difficulty as keyof typeof POINTS_TABLE.coop
        ] ?? 0;
      return [playerOne, playerTwo].map((p) => ({
        ...p,
        score: base + p.score,
      }));
    }
    if (playerOne.score === playerTwo.score) return [];
    return playerOne.score > playerTwo.score ? [playerOne] : [playerTwo];
  }

  // ── Defuse-room helpers ────────────────────────────────────────────────

  private ensureDefuseGridReady(firstClick: { row: number; col: number }) {
    if (!this.defuseState) return;
    if (this.defuseState.defuseGridReady !== false) return;

    const { rows, cols, bombs } = DEFUSE_CONFIGS[this.defuseState.difficulty];
    if (
      firstClick.row < 0 ||
      firstClick.row >= rows ||
      firstClick.col < 0 ||
      firstClick.col >= cols
    ) {
      return;
    }

    const preset = DEFUSE_ENERGY_PRESETS[this.defuseState.difficulty];
    const result = generateCoopGrid({
      rows,
      cols,
      bombs,
      firstClick,
      ...preset,
    });

    this.defuseState.grid = result.grid;
    this.defuseState.defuseGridReady = true;
    this.defuseState.revealed = Array.from({ length: rows }, () =>
      Array(cols).fill(false),
    );
    this.defuseState.defused = Array.from({ length: rows }, () =>
      Array(cols).fill(false),
    );
    this.defuseState.exploded = Array.from({ length: rows }, () =>
      Array(cols).fill(false),
    );
  }

  private maskedDefuseState(): DefuseState {
    if (!this.defuseState) throw new Error("no defuse state");
    const serverNow = Date.now();
    const elapsedMs =
      this.defuseState.finalTime ??
      (this.defuseState.startedAt
        ? Math.max(
            0,
            serverNow -
              this.defuseState.startedAt +
              this.defuseState.totalPenalties,
          )
        : 0);
    return {
      ...this.defuseState,
      serverNow,
      elapsedMs,
      grid: maskDefuseGrid(this.defuseState),
    };
  }

  private async ensureDefuseTimeout() {
    if (!this.defuseState) return;
    const s = this.defuseState;
    if (s.status === "finished") return;
    if (!s.startedAt) return;

    const effectiveElapsedMs = Date.now() - s.startedAt + s.totalPenalties;
    if (effectiveElapsedMs < 1_200_000) return;

    s.status = "finished";
    s.finalTime = 1_200_000;
    await this.persistDefuse();
  }

  private broadcastDefuse() {
    if (!this.defuseState) return;
    const msg = JSON.stringify({
      type: "defuse-state",
      state: this.maskedDefuseState(),
    } satisfies ServerMessage);
    this.room.broadcast(msg);
  }

  private async persistDefuse() {
    await this.room.storage.put("defuse-state", this.defuseState);
    await this.room.storage.put(
      "defuse-ranking-recorded",
      this.defuseRankingRecorded,
    );
  }

  private async handleDefuseJoin(
    conn: Party.Connection,
    name: string,
    difficulty: Difficulty,
    squadName?: string,
    isMulti?: boolean,
  ) {
    this.defuseConnectionToName.set(conn.id, name);
    // Reconnect: send current state
    if (this.defuseState) {
      await this.ensureDefuseTimeout();
      if (this.defuseState.isMulti) {
        const members = this.defuseState.squadMembers ?? [
          this.defuseState.playerName,
        ];
        const exists = members.some(
          (member) =>
            normalizeRankingName(member) === normalizeRankingName(name),
        );
        if (!exists) {
          this.defuseState.squadMembers = [...members, name];
          await this.persistDefuse();
          this.broadcastDefuse();
          return;
        }
      }
      conn.send(
        JSON.stringify({
          type: "defuse-state",
          state: this.maskedDefuseState(),
        } satisfies ServerMessage),
      );
      return;
    }
    this.defuseState = createDefuseState(difficulty, name, { deferGrid: true });
    this.defuseState.status = "waiting";
    if (isMulti) {
      this.defuseState.isMulti = true;
      this.defuseState.squadName =
        squadName && squadName.trim() ? squadName : name;
    }
    await this.persistDefuse();
    this.broadcastDefuse();
  }

  private async handleDefuseAction(
    conn: Party.Connection,
    row: number,
    col: number,
    action: "inspect" | "defuse",
  ) {
    if (!this.defuseState) return;
    await this.ensureDefuseTimeout();
    if (this.defuseState.status === "finished") return;

    const s = this.defuseState;
    const { rows, cols } = s;
    if (row < 0 || row >= rows || col < 0 || col >= cols) return;

    // Cell already resolved?
    if (s.revealed[row][col] || s.defused[row][col] || s.exploded[row][col])
      return;

    // Start timer on first action
    if (s.startedAt === null) {
      s.startedAt = Date.now();
      s.status = "playing";
      // Schedule server-side hard cap: alarm fires exactly at the 20-minute mark
      await this.room.storage.setAlarm(s.startedAt + 1_200_000);
    }
    this.ensureDefuseGridReady({ row, col });

    // Enforce 20-minute hard cap
    if (Date.now() - s.startedAt + s.totalPenalties > 1_200_000) {
      s.status = "finished";
      s.finalTime = 1_200_000;
      await this.persistDefuse();
      this.broadcastDefuse();
      return;
    }

    const isBomb = s.grid[row][col] === -1;
    let penaltySeconds = 0;

    if (action === "inspect") {
      if (isBomb) {
        // Triggered explosion
        s.exploded[row][col] = true;
        s.triggeredBombs++;
        s.combo = 0;
        s.bombsResolved++;
        penaltySeconds = 30;
        s.totalPenalties += 30_000;
      } else {
        // Safe: flood-reveal
        this.defuseFloodReveal(row, col);
      }
    } else {
      // defuse action
      if (isBomb) {
        // Correct defuse
        s.defused[row][col] = true;
        s.combo++;
        if (s.combo > s.highestCombo) s.highestCombo = s.combo;
        s.bombsResolved++;
      } else {
        // Wrong defuse
        s.revealed[row][col] = true;
        s.wrongDefuses++;
        s.combo = 0;
        penaltySeconds = 20;
        s.totalPenalties += 20_000;
      }
    }

    // Check win condition
    if (s.bombsResolved >= s.totalBombs || areAllDefuseSafeCellsRevealed(s)) {
      const realTime = s.startedAt ? Date.now() - s.startedAt : 0;
      s.finalTime = realTime + s.totalPenalties;
      s.status = "finished";
    }

    await this.persistDefuse();
    this.broadcastDefuse();

    if (penaltySeconds > 0) {
      this.room.broadcast(
        JSON.stringify({
          type: "defuse-penalty",
          seconds: penaltySeconds as 20 | 30,
          row,
          col,
        } satisfies ServerMessage),
      );
    }

    if (s.status === "finished") {
      await this.finalizeDefuseMatch();
    }
  }

  private defuseFloodReveal(startRow: number, startCol: number) {
    if (!this.defuseState) return;
    const s = this.defuseState;
    const { grid, revealed, rows, cols } = s;
    const stack = [{ row: startRow, col: startCol }];
    while (stack.length) {
      const { row, col } = stack.pop()!;
      if (row < 0 || row >= rows || col < 0 || col >= cols) continue;
      if (revealed[row][col]) continue;
      if (grid[row][col] === -1) continue;
      revealed[row][col] = true;
      if (grid[row][col] === 0) {
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++)
            if (dr !== 0 || dc !== 0)
              stack.push({ row: row + dr, col: col + dc });
      }
    }
  }

  private async handleDefuseRestart(conn: Party.Connection) {
    if (!this.defuseState) return;
    if (this.defuseState.isMulti) {
      return;
    }
    const requesterName = this.defuseConnectionToName.get(conn.id);
    if (!requesterName) {
      return;
    }
    const isOwner =
      normalizeRankingName(requesterName) ===
      normalizeRankingName(this.defuseState.playerName);
    if (!isOwner) {
      return;
    }
    await this.resetDefuseState();
  }

  private async handleDefusePlayAgain(conn: Party.Connection) {
    if (!this.defuseState) return;
    if (this.defuseState.status !== "finished") {
      return;
    }
    const requesterName = this.defuseConnectionToName.get(conn.id);
    if (!requesterName) {
      return;
    }
    const isParticipant = (
      this.defuseState.squadMembers ?? [this.defuseState.playerName]
    ).some(
      (name) =>
        normalizeRankingName(name) === normalizeRankingName(requesterName),
    );
    if (!isParticipant) {
      return;
    }
    await this.resetDefuseState();
  }

  private async resetDefuseState() {
    if (!this.defuseState) return;
    const { difficulty, playerName, isMulti, squadName, squadMembers } =
      this.defuseState;
    this.defuseState = createDefuseState(difficulty, playerName, {
      deferGrid: true,
    });
    this.defuseState.isMulti = isMulti;
    this.defuseState.squadName = squadName;
    this.defuseState.squadMembers = squadMembers ?? [playerName];
    this.defuseRankingRecorded = false;
    await this.persistDefuse();
    this.broadcastDefuse();
  }

  private async finalizeDefuseMatch() {
    if (!this.defuseState || this.defuseRankingRecorded) return;
    if (this.defuseState.status !== "finished") return;
    this.defuseRankingRecorded = true;
    const s = this.defuseState;
    const realTime = s.startedAt ? (s.finalTime ?? 0) - s.totalPenalties : 0;
    const totalActions = s.totalBombs;
    const accuracy =
      totalActions > 0
        ? Math.round(
            ((totalActions - s.wrongDefuses - s.triggeredBombs) /
              totalActions) *
              100,
          )
        : 100;
    const entry: DefuseRankingEntry = {
      name: s.isMulti && s.squadName ? s.squadName : s.playerName,
      finalTime: s.finalTime ?? 0,
      realTime,
      totalPenalties: s.totalPenalties,
      accuracy,
      highestCombo: s.highestCombo,
      triggeredBombs: s.triggeredBombs,
      wrongDefuses: s.wrongDefuses,
      difficulty: s.difficulty,
      timestamp: Date.now(),
      squadMembers: s.isMulti ? (s.squadMembers ?? [s.playerName]) : undefined,
    };
    await this.getDefuseRankingParty().fetch("/apply-defuse", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(entry),
    });
    await this.persistDefuse();
  }

  private getDefuseRankingParty() {
    return this.room.context.parties[this.room.name].get(
      DEFUSE_RANKING_ROOM_ID,
    );
  }

  // ── Ranking finalization ───────────────────────────────────────────────

  async onAlarm() {
    if (!this.defuseState || this.defuseState.status === "finished") return;
    await this.ensureDefuseTimeout();
    if (this.defuseState?.status === "finished") {
      this.broadcastDefuse();
      await this.finalizeDefuseMatch();
    }
  }

  // ── Ranking finalization ───────────────────────────────────────────────

  private async finalizeMatchIfNeeded() {
    if (!this.state || this.state.status !== "finished" || this.rankingRecorded)
      return;
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

export function pickAiCell(
  state: GameState,
  aiFlags: boolean[][],
  level: AiLevel,
): { row: number; col: number } | null {
  const rows = state.grid.length;
  const cols = state.grid[0]?.length ?? 0;
  if (rows === 0 || cols === 0) return null;

  const unknown: { row: number; col: number }[] = [];
  const frontier: { row: number; col: number }[] = [];
  const frontierSet = new Set<string>();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const playerFlagged = state.flags?.[r]?.[c] ?? false;
      if (!state.revealed[r][c] && !aiFlags[r][c] && !playerFlagged)
        unknown.push({ row: r, col: c });
      if (state.revealed[r][c] && state.grid[r][c] >= 0) {
        for (const n of neighbors(r, c, rows, cols)) {
          const nPlayerFlagged = state.flags?.[n.row]?.[n.col] ?? false;
          if (
            !state.revealed[n.row][n.col] &&
            !aiFlags[n.row][n.col] &&
            !nPlayerFlagged
          ) {
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
        if (!state.revealed[r][c] && !aiFlags[r][c])
          unknown.push({ row: r, col: c });
      }
    }
    if (unknown.length === 0) return null;
  }

  const avoidBombs = state.mode === "coop" || state.mode === "explosive";

  // Easy: just click random unrevealed.
  if (level === "easy")
    return unknown[Math.floor(Math.random() * unknown.length)];

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
          const playerFlagged = state.flags?.[n.row]?.[n.col] ?? false;
          const isKnownBomb =
            (state.revealed[n.row][n.col] && state.grid[n.row][n.col] === -1) ||
            aiFlags[n.row][n.col] ||
            playerFlagged;
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
  const bombs = dedup(certainBombs).filter(
    (c) => !state.revealed[c.row][c.col],
  );
  const safes = dedup(certainSafes).filter(
    (c) => !state.revealed[c.row][c.col] && !aiFlags[c.row][c.col],
  );

  if (avoidBombs) {
    // Coop / Explosive: avoid bombs. Prefer certain safes; otherwise click the lowest-risk cell we can estimate.
    if (safes.length) return safes[Math.floor(Math.random() * safes.length)];

    const probs = estimateBombProbabilities(state, aiFlags);
    // Important: do not bias towards the frontier in coop.
    // When probabilities tie (often early game), prefer cells away from revealed numbers.
    const candidates = unknown.filter((c) => !aiFlags[c.row][c.col]);
    if (candidates.length === 0) return null;

    let bestCells: { row: number; col: number }[] = [];
    let bestP = Number.POSITIVE_INFINITY;
    let bestIsFrontier = true; // used as tiebreaker: prefer non-frontier when rawP is equal
    for (const c of candidates) {
      const p = probs[c.row]?.[c.col] ?? 0;

      // Frontier tiebreaker: when raw probabilities are equal, prefer cells away from revealed numbers
      // (they carry less constraint info so are safer to guess). Do NOT add to rawP — that would
      // cause the AI to pick an interior bomb over a frontier cell that is actually safer.
      let touchesNumber = false;
      for (const n of neighbors(c.row, c.col, rows, cols)) {
        if (state.revealed[n.row][n.col] && state.grid[n.row][n.col] >= 0) {
          touchesNumber = true;
          break;
        }
      }

      if (p < bestP || (p === bestP && !touchesNumber && bestIsFrontier)) {
        bestP = p;
        bestIsFrontier = touchesNumber;
        bestCells = [c];
      } else if (p === bestP && touchesNumber === bestIsFrontier) {
        bestCells.push(c);
      }
    }
    return bestCells[Math.floor(Math.random() * bestCells.length)];
  }

  // Medium: use sure deductions, otherwise pick from frontier randomly (more "human").
  if (level === "medium") {
    if (bombs.length) return bombs[Math.floor(Math.random() * bombs.length)];
    if (frontier.length)
      return frontier[Math.floor(Math.random() * frontier.length)];
    return unknown[Math.floor(Math.random() * unknown.length)];
  }

  // Hard: prefer sure bombs, else estimate bomb probabilities from constraints.
  if (bombs.length) return bombs[Math.floor(Math.random() * bombs.length)];
  if (safes.length && frontier.length === 0)
    return safes[Math.floor(Math.random() * safes.length)];

  const probs = estimateBombProbabilities(state, aiFlags);
  let best: { row: number; col: number } | null = null;
  let bestScore = avoidBombs ? Number.POSITIVE_INFINITY : -1;
  const candidates = (frontier.length ? frontier : unknown).filter(
    (c) => !aiFlags[c.row][c.col],
  );
  if (candidates.length === 0) return null;

  for (const c of candidates) {
    const p = probs[c.row]?.[c.col] ?? 0;
    if (avoidBombs) {
      if (p < bestScore) {
        bestScore = p;
        best = c;
      }
    } else {
      if (p > bestScore) {
        bestScore = p;
        best = c;
      }
    }
  }

  return best ?? candidates[Math.floor(Math.random() * candidates.length)];
}

function neighbors(
  r: number,
  c: number,
  rows: number,
  cols: number,
): { row: number; col: number }[] {
  const out: { row: number; col: number }[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols)
        out.push({ row: nr, col: nc });
    }
  }
  return out;
}

function estimateBombProbabilities(
  state: GameState,
  aiFlags: boolean[][],
): number[][] {
  const rows = state.grid.length;
  const cols = state.grid[0]?.length ?? 0;
  const probs = Array.from({ length: rows }, () => Array(cols).fill(0));

  // Step 1 — Local constraint probabilities for frontier cells.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!state.revealed[r][c]) continue;
      const v = state.grid[r][c];
      if (v < 0) continue;

      const neigh = neighbors(r, c, rows, cols);
      let knownBombs = 0;
      const unknownNeigh: { row: number; col: number }[] = [];
      for (const n of neigh) {
        const playerFlagged = state.flags?.[n.row]?.[n.col] ?? false;
        const isKnownBomb =
          (state.revealed[n.row][n.col] && state.grid[n.row][n.col] === -1) ||
          aiFlags[n.row][n.col] ||
          playerFlagged;
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

  // Step 2 — Global probability floor for cells with no local constraint info.
  // Cells outside the frontier should not be treated as risk-0; they carry the
  // average bomb density of the remaining hidden region.
  let knownBombCount = 0;
  let hiddenCount = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const playerFlagged = state.flags?.[r]?.[c] ?? false;
      if (aiFlags[r][c] || playerFlagged) {
        knownBombCount++;
        continue;
      }
      if (!state.revealed[r][c]) hiddenCount++;
    }
  }
  const remainingBombs = Math.max(0, state.totalBombs - knownBombCount);
  const globalP = hiddenCount > 0 ? remainingBombs / hiddenCount : 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const playerFlagged = state.flags?.[r]?.[c] ?? false;
      if (state.revealed[r][c] || aiFlags[r][c] || playerFlagged) continue;
      // Apply global probability as a floor — never downgrade a cell that already
      // has a higher local estimate from constraints.
      if (probs[r][c] === 0) probs[r][c] = globalP;
    }
  }

  return probs;
}
