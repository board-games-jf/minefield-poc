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
      safeEnergy: 2,
      dangerSources: 2,
      dangerEnergyMax: 4,
      reliefPockets: 2,
      reliefEnergyMax: 3,
      reliefWeightMultiplier: 0.15,
      dangerWeightMultiplier: 1.0,
    },

    medium: {
      safeEnergy: 2,
      dangerSources: 3,
      dangerEnergyMax: 5,
      reliefPockets: 1,
      reliefEnergyMax: 3,
      reliefWeightMultiplier: 0.35,
      dangerWeightMultiplier: 1.2,
    },

    hard: {
      safeEnergy: 1,
      dangerSources: 4,
      dangerEnergyMax: 6,
      reliefPockets: 1,
      reliefEnergyMax: 2,
      reliefWeightMultiplier: 0.55,
      dangerWeightMultiplier: 1.4,
    },
  };

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

  const seed =
    options.seed ??
    firstClick.row * 1000 +
      firstClick.col * 37 +
      rows * 101 +
      cols * 503 +
      bombs * 997 +
      (Date.now() % 1_000_000);

  const rng = lcg(seed);

  const safeZone = propagateSafeEnergy(rows, cols, firstClick, safeEnergy);

  const availableOutsideSafeZone = rows * cols - safeZone.size;

  if (bombs > availableOutsideSafeZone) {
    throw new Error(
      `Cannot place ${bombs} bombs: safeZone has ${safeZone.size} cells, leaving only ${availableOutsideSafeZone} available cells.`,
    );
  }

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

  const grid = calcNumbers(rows, cols, mineSet);

  if (!validateBoard(grid, firstClick, bombs, safeZone)) {
    throw new Error("Generated board failed validation.");
  }

  return {
    grid,
    safeZone,
    dangerMap,
    reliefMap,
  };
}
