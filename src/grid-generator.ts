// ── Grid Generator — Energy Propagation Coop Mode ─────────────────────────
//
// Pure module. No dependency on game state, PartyKit, or any server type.
// Input: plain values. Output: plain number[][].
//
// Usage:
//   import { generateGrid, ENERGY_PRESETS } from "./grid-generator";
//
//   const result = generateGrid({
//     rows,
//     cols,
//     bombs,
//     firstClick,
//     ...ENERGY_PRESETS.easy,
//   });

export type Cell = { row: number; col: number };

export interface GridGenOptions {
  rows: number;
  cols: number;
  bombs: number;
  firstClick: Cell;

  /**
   * Energy for guaranteed safe cells around firstClick.
   * safeEnergy = 0 still guarantees firstClick only.
   * safeEnergy = 1 also means firstClick only.
   * safeEnergy = 2 means firstClick + one ring around it.
   */
  safeEnergy: number;

  /** Number of danger epicenters placed outside the safe zone. */
  dangerSources: number;

  /** Max initial danger energy per source. */
  dangerEnergyMax: number;

  /**
   * Number of relief pockets outside the initial safe zone.
   * These are areas with reduced bomb probability.
   */
  reliefPockets?: number;

  /** Max initial relief energy per relief pocket. */
  reliefEnergyMax?: number;

  /**
   * Multiplier applied to bomb weight inside relief pockets.
   * Lower = safer relief areas.
   * Example: 0.15 is very safe, 0.55 is mildly safer.
   */
  reliefWeightMultiplier?: number;

  /**
   * Multiplier applied to dangerMap score.
   * Higher = bombs follow danger zones more strongly.
   */
  dangerWeightMultiplier?: number;

  /** Optional deterministic seed. Defaults to time-based value. */
  seed?: number;
}

export interface GridGenResult {
  /** -1 = bomb, 0–8 = safe cell with adjacent bomb count. */
  grid: number[][];

  /** "row,col" string keys of every cell guaranteed bomb-free. */
  safeZone: Set<string>;

  /** Raw accumulated danger score per cell. Higher = more likely to receive bomb. */
  dangerMap: number[][];

  /** Raw accumulated relief score per cell. Higher = less likely to receive bomb. */
  reliefMap: number[][];
}

export type EnergyPreset = {
  safeEnergy: number;
  dangerSources: number;
  dangerEnergyMax: number;
  reliefPockets: number;
  reliefEnergyMax: number;
  reliefWeightMultiplier: number;
  dangerWeightMultiplier: number;
};

export type WeightedPreset = Omit<EnergyPreset, "safeEnergy">;

/**
 * Preset parameters keyed by coop difficulty.
 *
 * easy:
 * - safer start
 * - more relief
 * - weaker danger weighting
 *
 * hard:
 * - smaller safe start
 * - less relief
 * - stronger danger weighting
 */
export const ENERGY_PRESETS: Record<"easy" | "medium" | "hard", EnergyPreset> =
  {
    easy: {
      safeEnergy: 1,
      dangerSources: 2,
      dangerEnergyMax: 3,
      reliefPockets: 1,
      reliefEnergyMax: 2,
      reliefWeightMultiplier: 0.35,
      dangerWeightMultiplier: 1.0,
    },

    medium: {
      safeEnergy: 2,
      dangerSources: 3,
      dangerEnergyMax: 5,
      reliefPockets: 2,
      reliefEnergyMax: 3,
      reliefWeightMultiplier: 0.32,
      dangerWeightMultiplier: 1.2,
    },

    hard: {
      safeEnergy: 1,
      dangerSources: 4,
      dangerEnergyMax: 5,
      reliefPockets: 4,
      reliefEnergyMax: 3,
      reliefWeightMultiplier: 0.28,
      dangerWeightMultiplier: 1.25,
    },
  };

/**
 * Preset parameters keyed by defuse difficulty.
 * Defuse is a solo/coop timed mode — tune separately from coop.
 */
export const DEFUSE_ENERGY_PRESETS: Record<
  "easy" | "medium" | "hard",
  EnergyPreset
> = {
  easy: {
    safeEnergy: 2,
    dangerSources: 2,
    dangerEnergyMax: 3,
    reliefPockets: 1,
    reliefEnergyMax: 2,
    reliefWeightMultiplier: 0.35,
    dangerWeightMultiplier: 1.0,
  },

  medium: {
    safeEnergy: 2,
    dangerSources: 3,
    dangerEnergyMax: 5,
    reliefPockets: 2,
    reliefEnergyMax: 3,
    reliefWeightMultiplier: 0.32,
    dangerWeightMultiplier: 1.2,
  },

  hard: {
    safeEnergy: 1,
    dangerSources: 4,
    dangerEnergyMax: 5,
    reliefPockets: 4,
    reliefEnergyMax: 3,
    reliefWeightMultiplier: 0.28,
    dangerWeightMultiplier: 1.25,
  },
};

export const VERSUS_ENERGY_PRESETS: Record<
  "easy" | "medium" | "hard",
  WeightedPreset
> = {
  easy: {
    dangerSources: 2,
    dangerEnergyMax: 3,
    reliefPockets: 1,
    reliefEnergyMax: 1,
    reliefWeightMultiplier: 0.7,
    dangerWeightMultiplier: 1.05,
  },
  medium: {
    dangerSources: 3,
    dangerEnergyMax: 4,
    reliefPockets: 1,
    reliefEnergyMax: 2,
    reliefWeightMultiplier: 0.72,
    dangerWeightMultiplier: 1.15,
  },
  hard: {
    dangerSources: 4,
    dangerEnergyMax: 5,
    reliefPockets: 2,
    reliefEnergyMax: 2,
    reliefWeightMultiplier: 0.75,
    dangerWeightMultiplier: 1.25,
  },
};

export interface WeightedGridOptions extends WeightedPreset {
  rows: number;
  cols: number;
  bombs: number;
  safeZone?: Set<string>;
  seed?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────

export function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

export function isInside(
  rows: number,
  cols: number,
  row: number,
  col: number,
): boolean {
  return row >= 0 && row < rows && col >= 0 && col < cols;
}

export function validateOptions(options: GridGenOptions): void {
  const {
    rows,
    cols,
    bombs,
    firstClick,
    safeEnergy,
    dangerSources,
    dangerEnergyMax,
    reliefPockets = 0,
    reliefEnergyMax = 1,
    reliefWeightMultiplier = 0.35,
    dangerWeightMultiplier = 1,
  } = options;

  if (!Number.isInteger(rows) || rows <= 0) {
    throw new Error("rows must be a positive integer.");
  }

  if (!Number.isInteger(cols) || cols <= 0) {
    throw new Error("cols must be a positive integer.");
  }

  if (!Number.isInteger(bombs) || bombs < 0) {
    throw new Error("bombs must be a non-negative integer.");
  }

  if (!Number.isInteger(firstClick.row) || !Number.isInteger(firstClick.col)) {
    throw new Error("firstClick row and col must be integers.");
  }

  if (!isInside(rows, cols, firstClick.row, firstClick.col)) {
    throw new Error("firstClick is outside the board.");
  }

  if (!Number.isInteger(safeEnergy) || safeEnergy < 0) {
    throw new Error("safeEnergy must be a non-negative integer.");
  }

  if (!Number.isInteger(dangerSources) || dangerSources < 0) {
    throw new Error("dangerSources must be a non-negative integer.");
  }

  if (!Number.isInteger(dangerEnergyMax) || dangerEnergyMax < 1) {
    throw new Error("dangerEnergyMax must be an integer >= 1.");
  }

  if (!Number.isInteger(reliefPockets) || reliefPockets < 0) {
    throw new Error("reliefPockets must be a non-negative integer.");
  }

  if (!Number.isInteger(reliefEnergyMax) || reliefEnergyMax < 1) {
    throw new Error("reliefEnergyMax must be an integer >= 1.");
  }

  if (reliefWeightMultiplier <= 0 || reliefWeightMultiplier > 1) {
    throw new Error("reliefWeightMultiplier must be > 0 and <= 1.");
  }

  if (dangerWeightMultiplier < 0) {
    throw new Error("dangerWeightMultiplier must be >= 0.");
  }
}

// ── LCG ───────────────────────────────────────────────────────────────────

/**
 * Linear Congruential Generator seeded with `seed`.
 * Returns a function that yields values in [0, 1).
 */
export function lcg(seed: number): () => number {
  let s = seed >>> 0;

  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// ── Step 1 — Safe Energy Propagation ─────────────────────────────────────

/**
 * BFS from `firstClick` propagating integer energy outward.
 *
 * Important:
 * - firstClick is always included.
 * - If safeEnergy <= 1, only firstClick is guaranteed safe.
 * - Propagation uses 8 directions, matching Minesweeper adjacency.
 */
export function propagateSafeEnergy(
  rows: number,
  cols: number,
  firstClick: Cell,
  safeEnergy: number,
): Set<string> {
  const safeZone = new Set<string>();
  const energy = new Map<string, number>();
  const queue: Array<{ row: number; col: number; e: number }> = [];

  const startEnergy = Math.max(1, safeEnergy);
  const startKey = cellKey(firstClick.row, firstClick.col);

  safeZone.add(startKey);
  energy.set(startKey, startEnergy);
  queue.push({
    row: firstClick.row,
    col: firstClick.col,
    e: startEnergy,
  });

  let head = 0;

  while (head < queue.length) {
    const { row, col, e } = queue[head++];

    safeZone.add(cellKey(row, col));

    if (e <= 1) continue;

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;

        const nr = row + dr;
        const nc = col + dc;

        if (!isInside(rows, cols, nr, nc)) continue;

        const k = cellKey(nr, nc);
        const nextEnergy = e - 1;

        if ((energy.get(k) ?? 0) < nextEnergy) {
          energy.set(k, nextEnergy);
          queue.push({ row: nr, col: nc, e: nextEnergy });
        }
      }
    }
  }

  return safeZone;
}

// ── Step 2 — Relief Map ───────────────────────────────────────────────────

/**
 * Generates relief pockets outside the safe zone.
 *
 * Relief pockets are not guaranteed bomb-free.
 * They only reduce bomb probability.
 *
 * This creates the "alívio" part of:
 * tension → relief → tension.
 */
export function generateReliefMap(
  rows: number,
  cols: number,
  safeZone: Set<string>,
  reliefPockets: number,
  reliefEnergyMax: number,
  rng: () => number,
): number[][] {
  const relief: number[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(0),
  );

  if (reliefPockets <= 0) return relief;

  const candidates: Cell[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!safeZone.has(cellKey(r, c))) {
        candidates.push({ row: r, col: c });
      }
    }
  }

  if (candidates.length === 0) return relief;

  const sources = Math.min(reliefPockets, candidates.length);

  // Fisher-Yates partial shuffle to pick unique relief sources.
  for (let i = 0; i < sources; i++) {
    const j = i + Math.floor(rng() * (candidates.length - i));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];

    const src = candidates[i];
    const initialEnergy = 1 + Math.floor(rng() * reliefEnergyMax);

    const seen = new Set<string>();
    const queue: Array<{ row: number; col: number; e: number }> = [
      { row: src.row, col: src.col, e: initialEnergy },
    ];

    seen.add(cellKey(src.row, src.col));

    let head = 0;

    while (head < queue.length) {
      const { row, col, e } = queue[head++];

      if (!safeZone.has(cellKey(row, col))) {
        relief[row][col] += e;
      }

      if (e <= 1) continue;

      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;

          const nr = row + dr;
          const nc = col + dc;

          if (!isInside(rows, cols, nr, nc)) continue;

          const k = cellKey(nr, nc);

          if (!seen.has(k)) {
            seen.add(k);
            queue.push({ row: nr, col: nc, e: e - 1 });
          }
        }
      }
    }
  }

  return relief;
}

// ── Step 3 — Danger Map ───────────────────────────────────────────────────

/**
 * Selects `dangerSources` random cells outside `safeZone`, then propagates
 * danger energy outward from each.
 *
 * Returns a 2D score grid:
 * - higher = more likely to receive a bomb.
 */
export function generateDangerMap(
  rows: number,
  cols: number,
  safeZone: Set<string>,
  dangerSources: number,
  dangerEnergyMax: number,
  rng: () => number,
): number[][] {
  const danger: number[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(0),
  );

  const candidates: Cell[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!safeZone.has(cellKey(r, c))) {
        candidates.push({ row: r, col: c });
      }
    }
  }

  if (candidates.length === 0) return danger;

  const sources = Math.min(dangerSources, candidates.length);

  // Fisher-Yates partial shuffle to pick unique danger sources.
  for (let i = 0; i < sources; i++) {
    const j = i + Math.floor(rng() * (candidates.length - i));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];

    const src = candidates[i];
    const initialEnergy = 1 + Math.floor(rng() * dangerEnergyMax);

    const seen = new Set<string>();
    const queue: Array<{ row: number; col: number; e: number }> = [
      { row: src.row, col: src.col, e: initialEnergy },
    ];

    seen.add(cellKey(src.row, src.col));

    let head = 0;

    while (head < queue.length) {
      const { row, col, e } = queue[head++];

      if (!safeZone.has(cellKey(row, col))) {
        danger[row][col] += e;
      }

      if (e <= 1) continue;

      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;

          const nr = row + dr;
          const nc = col + dc;

          if (!isInside(rows, cols, nr, nc)) continue;

          const k = cellKey(nr, nc);

          if (!seen.has(k)) {
            seen.add(k);
            queue.push({ row: nr, col: nc, e: e - 1 });
          }
        }
      }
    }
  }

  return danger;
}

// ── Step 4 — Weighted Mine Placement ─────────────────────────────────────

/**
 * Samples `bombs` cells without replacement using weights derived from:
 * - dangerMap: increases bomb chance.
 * - reliefMap: decreases bomb chance.
 *
 * Safe zone cells always have weight 0 because they are excluded.
 */
export function placeWeightedMines(
  rows: number,
  cols: number,
  dangerMap: number[][],
  reliefMap: number[][],
  bombs: number,
  rng: () => number,
  safeZone: Set<string>,
  reliefWeightMultiplier = 0.35,
  dangerWeightMultiplier = 1,
): Set<string> {
  const available: Cell[] = [];
  const weights: number[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (safeZone.has(cellKey(r, c))) continue;

      let weight = 1 + dangerMap[r][c] * dangerWeightMultiplier;

      if (reliefMap[r][c] > 0) {
        // Stronger relief score means lower chance of bomb.
        const reliefStrength = 1 + reliefMap[r][c];
        weight *= reliefWeightMultiplier / reliefStrength;
      }

      // Keep every non-safe candidate technically possible,
      // so the generator can still place all bombs when the board is dense.
      weight = Math.max(0.001, weight);

      available.push({ row: r, col: c });
      weights.push(weight);
    }
  }

  if (bombs > available.length) {
    throw new Error(
      `Cannot place ${bombs} bombs: only ${available.length} cells available outside the safe zone.`,
    );
  }

  const mineSet = new Set<string>();

  for (let i = 0; i < bombs; i++) {
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    if (totalWeight <= 0) {
      throw new Error("Cannot place mines: total weight is zero.");
    }

    let pick = rng() * totalWeight;
    let idx = 0;

    while (idx < weights.length - 1 && pick >= weights[idx]) {
      pick -= weights[idx];
      idx++;
    }

    mineSet.add(cellKey(available[idx].row, available[idx].col));

    available.splice(idx, 1);
    weights.splice(idx, 1);
  }

  return mineSet;
}

// ── Step 5 — Calculate Numbers ────────────────────────────────────────────

/**
 * Returns a number[][] grid with:
 * - bomb cells: -1
 * - safe cells: 0–8 adjacent bomb count
 */
export function calcNumbers(
  rows: number,
  cols: number,
  mineSet: Set<string>,
): number[][] {
  const grid: number[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(0),
  );

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (mineSet.has(cellKey(r, c))) {
        grid[r][c] = -1;
      }
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === -1) continue;

      let count = 0;

      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;

          const nr = r + dr;
          const nc = c + dc;

          if (isInside(rows, cols, nr, nc) && grid[nr][nc] === -1) {
            count++;
          }
        }
      }

      grid[r][c] = count;
    }
  }

  return grid;
}

// ── Step 6 — Validate ─────────────────────────────────────────────────────

/**
 * Returns true if:
 * - firstClick is not a bomb
 * - safeZone has no bombs
 * - total bomb count is exactly expectedBombs
 */
export function validateBoard(
  grid: number[][],
  firstClick: Cell,
  expectedBombs: number,
  safeZone: Set<string>,
): boolean {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;

  if (!isInside(rows, cols, firstClick.row, firstClick.col)) {
    return false;
  }

  if (grid[firstClick.row][firstClick.col] === -1) {
    return false;
  }

  let actualBombs = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const isBomb = grid[r][c] === -1;

      if (isBomb) {
        actualBombs++;
      }

      if (safeZone.has(cellKey(r, c)) && isBomb) {
        return false;
      }
    }
  }

  return actualBombs === expectedBombs;
}

// ── Optional Debug Helpers ────────────────────────────────────────────────

export function countZeroCells(grid: number[][]): number {
  let total = 0;

  for (const row of grid) {
    for (const value of row) {
      if (value === 0) total++;
    }
  }

  return total;
}

export function countBombs(grid: number[][]): number {
  let total = 0;

  for (const row of grid) {
    for (const value of row) {
      if (value === -1) total++;
    }
  }

  return total;
}

export type ZeroIsland = {
  cells: Cell[];
  size: number;
  touchesFirstClick: boolean;
  centerRow: number;
  centerCol: number;
};

type EmotionalTarget = {
  minLaterIslands: number;
  maxLaterIslands: number;

  minIslandSize: number;
  maxIslandSize: number;

  minLaterZeroCells: number;
  maxLaterZeroCells: number;

  maxFirstRevealFootprint: number;
  maxLaterRevealFootprint: number;
};

const EMOTIONAL_TARGETS: Record<"easy" | "medium" | "hard", EmotionalTarget> = {
  easy: {
    // 6×6: very tight, so we allow even 0 later islands to avoid impossible boards.
    minLaterIslands: 0,
    maxLaterIslands: 1,

    minIslandSize: 1,
    maxIslandSize: 2,

    minLaterZeroCells: 0,
    maxLaterZeroCells: 3,

    maxFirstRevealFootprint: 6,
    maxLaterRevealFootprint: 5,
  },

  medium: {
    // 8×8: enough room for some breathing, but still small enough to feel tight.
    minLaterIslands: 1,
    maxLaterIslands: 2,

    minIslandSize: 1,
    maxIslandSize: 4,

    minLaterZeroCells: 2,
    maxLaterZeroCells: 7,

    maxFirstRevealFootprint: 9,
    maxLaterRevealFootprint: 8,
  },

  hard: {
    // 10×10: more breathing room, but still not too much.
    minLaterIslands: 3,
    maxLaterIslands: 5,

    minIslandSize: 1,
    maxIslandSize: 4,

    minLaterZeroCells: 5,
    maxLaterZeroCells: 14,

    maxFirstRevealFootprint: 12,
    maxLaterRevealFootprint: 10,
  },
};

function inferDifficultyFromBoard(
  rows: number,
  cols: number,
): "easy" | "medium" | "hard" {
  const cells = rows * cols;
  if (cells <= 36) return "easy";
  if (cells <= 64) return "medium";
  return "hard";
}

export function findZeroIslands(
  grid: number[][],
  firstClick: Cell,
): ZeroIsland[] {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
  const islands: ZeroIsland[] = [];

  for (let sr = 0; sr < rows; sr++) {
    for (let sc = 0; sc < cols; sc++) {
      if (visited[sr][sc]) continue;
      if (grid[sr][sc] !== 0) continue;

      const queue: Cell[] = [{ row: sr, col: sc }];
      const cells: Cell[] = [];

      visited[sr][sc] = true;

      let head = 0;
      let touchesFirstClick = false;
      let sumRow = 0;
      let sumCol = 0;

      while (head < queue.length) {
        const cur = queue[head++];
        cells.push(cur);

        sumRow += cur.row;
        sumCol += cur.col;

        if (cur.row === firstClick.row && cur.col === firstClick.col) {
          touchesFirstClick = true;
        }

        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;

            const nr = cur.row + dr;
            const nc = cur.col + dc;

            if (!isInside(rows, cols, nr, nc)) continue;
            if (visited[nr][nc]) continue;
            if (grid[nr][nc] !== 0) continue;

            visited[nr][nc] = true;
            queue.push({ row: nr, col: nc });
          }
        }
      }

      islands.push({
        cells,
        size: cells.length,
        touchesFirstClick,
        centerRow: sumRow / cells.length,
        centerCol: sumCol / cells.length,
      });
    }
  }

  return islands;
}

/**
 * Mede o tamanho visual da abertura causada por uma ilha de zero.
 *
 * No Campo Minado, clicar em um zero revela:
 * - todos os zeros conectados;
 * - todos os números ao redor desses zeros.
 *
 * Então a ilha visual costuma ser maior do que a quantidade de zeros.
 */
function getRevealFootprintSize(grid: number[][], zeroCells: Cell[]): number {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const footprint = new Set<string>();

  for (const cell of zeroCells) {
    footprint.add(cellKey(cell.row, cell.col));

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = cell.row + dr;
        const nc = cell.col + dc;

        if (!isInside(rows, cols, nr, nc)) continue;
        if (grid[nr][nc] === -1) continue;

        footprint.add(cellKey(nr, nc));
      }
    }
  }

  return footprint.size;
}

function scoreRange(
  value: number,
  min: number,
  max: number,
  weight: number,
): number {
  if (value >= min && value <= max) return weight;

  if (value < min) {
    return -(min - value) * weight;
  }

  return -(value - max) * weight;
}

function scoreBoardForCoop(
  result: GridGenResult,
  options: GridGenOptions,
): number {
  const { rows, cols, firstClick } = options;
  const difficulty = inferDifficultyFromBoard(rows, cols);
  const target = EMOTIONAL_TARGETS[difficulty];

  const islands = findZeroIslands(result.grid, firstClick);

  const firstIsland = islands.find((island) => island.touchesFirstClick);
  const laterIslands = islands.filter((island) => !island.touchesFirstClick);

  const meaningfulLaterIslands = laterIslands.filter(
    (island) => island.size >= target.minIslandSize,
  );

  const laterZeroCells = meaningfulLaterIslands.reduce(
    (sum, island) => sum + island.size,
    0,
  );

  let score = 0;

  // 1. Quantidade de ilhas fora do começo.
  score += scoreRange(
    meaningfulLaterIslands.length,
    target.minLaterIslands,
    target.maxLaterIslands,
    14,
  );

  // 2. Quantidade total de zeros fora do começo.
  score += scoreRange(
    laterZeroCells,
    target.minLaterZeroCells,
    target.maxLaterZeroCells,
    6,
  );

  // 3. Abertura inicial controlada.
  const firstRevealFootprint = firstIsland
    ? getRevealFootprintSize(result.grid, firstIsland.cells)
    : 0;

  if (firstRevealFootprint === 0) {
    score -= difficulty === "easy" ? 2 : 8;
  } else if (firstRevealFootprint <= target.maxFirstRevealFootprint) {
    score += 10;
  } else {
    score -= (firstRevealFootprint - target.maxFirstRevealFootprint) * 6;
  }

  // 4. Tamanho individual das ilhas e tamanho visual da abertura.
  for (const island of meaningfulLaterIslands) {
    if (
      island.size >= target.minIslandSize &&
      island.size <= target.maxIslandSize
    ) {
      score += 8;
    } else if (island.size > target.maxIslandSize) {
      score -= (island.size - target.maxIslandSize) * 5;
    }

    const revealFootprint = getRevealFootprintSize(result.grid, island.cells);

    if (revealFootprint <= target.maxLaterRevealFootprint) {
      score += 6;
    } else {
      // Essa é a penalidade que evita ilha visual gigante no hard.
      score -= (revealFootprint - target.maxLaterRevealFootprint) * 7;
    }
  }

  // 5. Recompensa ilhas espalhadas pelo mapa.
  for (const island of meaningfulLaterIslands) {
    const dist =
      Math.abs(island.centerRow - firstClick.row) +
      Math.abs(island.centerCol - firstClick.col);

    if (dist >= 3) score += 4;
    if (dist >= 5) score += 4;
  }

  // 6. Evita mapa totalmente seco.
  if (islands.length === 0) {
    score -= 80;
  }

  return score;
}

// ── Main Entry Point ──────────────────────────────────────────────────────

/**
 * Generates a Minesweeper grid for coop mode.
 *
 * Guarantees:
 * - firstClick is never a bomb.
 * - safeZone is never bombed.
 * - total bombs equals `bombs`, or the function throws an error.
 *
 * Behavior:
 * - safeZone creates the initial relief.
 * - reliefMap creates additional low-danger pockets.
 * - dangerMap creates high-tension areas.
 * - weighted mine placement combines danger and relief.
 */
export function generateGrid(options: GridGenOptions): GridGenResult {
  validateOptions(options);

  const difficulty = inferDifficultyFromBoard(options.rows, options.cols);

  const attempts =
    difficulty === "hard" ? 32 : difficulty === "medium" ? 18 : 12;

  const baseSeed =
    options.seed ??
    options.firstClick.row * 1000 +
      options.firstClick.col * 37 +
      options.rows * 101 +
      options.cols * 503 +
      options.bombs * 997 +
      (Date.now() % 1_000_000);

  let best: GridGenResult | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  let lastError: unknown = null;

  for (let i = 0; i < attempts; i++) {
    try {
      const candidate = generateGridOnce({
        ...options,
        seed: baseSeed + i * 7919,
      });

      const score = scoreBoardForCoop(candidate, options);

      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (!best) {
    if (lastError instanceof Error) throw lastError;
    throw new Error("Failed to generate coop grid.");
  }

  return best;
}

function buildWeightedGrid(
  options: WeightedGridOptions,
): Omit<GridGenResult, "safeZone"> & { safeZone: Set<string> } {
  const {
    rows,
    cols,
    bombs,
    dangerSources,
    dangerEnergyMax,
    reliefPockets = 0,
    reliefEnergyMax = 1,
    reliefWeightMultiplier = 0.35,
    dangerWeightMultiplier = 1,
  } = options;

  const safeZone = options.safeZone ?? new Set<string>();
  const availableOutsideSafeZone = rows * cols - safeZone.size;

  if (bombs > availableOutsideSafeZone) {
    throw new Error(
      `Cannot place ${bombs} bombs: safeZone has ${safeZone.size} cells, leaving only ${availableOutsideSafeZone} available cells.`,
    );
  }

  const seed =
    options.seed ??
    rows * 101 + cols * 503 + bombs * 997 + (Date.now() % 1_000_000);

  const rng = lcg(seed);

  const reliefMap = generateReliefMap(
    rows,
    cols,
    safeZone,
    reliefPockets,
    reliefEnergyMax,
    rng,
  );

  const dangerMap = generateDangerMap(
    rows,
    cols,
    safeZone,
    dangerSources,
    dangerEnergyMax,
    rng,
  );

  const mineSet = placeWeightedMines(
    rows,
    cols,
    dangerMap,
    reliefMap,
    bombs,
    rng,
    safeZone,
    reliefWeightMultiplier,
    dangerWeightMultiplier,
  );

  return {
    grid: calcNumbers(rows, cols, mineSet),
    safeZone,
    dangerMap,
    reliefMap,
  };
}

function generateGridOnce(options: GridGenOptions): GridGenResult {
  validateOptions(options);

  const { rows, cols, bombs, firstClick, safeEnergy } = options;
  const safeZone = propagateSafeEnergy(rows, cols, firstClick, safeEnergy);
  const result = buildWeightedGrid({
    ...options,
    safeZone,
    seed:
      options.seed ??
      firstClick.row * 1000 +
        firstClick.col * 37 +
        rows * 101 +
        cols * 503 +
        bombs * 997 +
        (Date.now() % 1_000_000),
  });

  if (!validateBoard(result.grid, firstClick, bombs, safeZone)) {
    throw new Error("Generated board failed validation.");
  }

  return result;
}

export function generateVersusGrid(
  options: WeightedGridOptions,
): GridGenResult {
  return buildWeightedGrid(options);
}
