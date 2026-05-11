# Grid Generator — Energy Propagation Algorithm

A **pure, self-contained** TypeScript module (`src/grid-generator.ts`) for generating Minesweeper grids with a guaranteed safe zone around a chosen cell, using an energy propagation model to distribute danger across the board.

No dependency on game state, PartyKit, or any server type. Input: plain values. Output: plain `number[][]`.

---

## Algorithm

### Step 1 — Safe Energy Propagation

Starting from `firstClick`, propagate "safe energy" outward via BFS:

- `firstClick` starts with energy = `safeEnergy`
- Each neighbor receives `parentEnergy − 1`
- Cells with `energy >= 1` form the **safe zone** — no bombs ever placed here

| `safeEnergy` | Safe zone radius |
|---|---|
| 1 | Only immediate neighbors of `firstClick` |
| 2 | ~2 rings |
| 3 | ~3 rings |

### Step 2 — Danger Map

Pick `dangerSources` random cells **outside** the safe zone as epicenters. Propagate danger energy outward from each:

- Each source starts with energy = random in `[1, dangerEnergyMax]`
- Neighbors receive `parentEnergy − 1`
- A cell's danger score = sum of all danger energy reaching it
- Safe zone cells are clamped to 0

### Step 3 — Weighted Mine Placement

Convert danger scores to weights:
- Safe zone: weight = 0
- Others: weight = `max(1, dangerScore)`

Sample `bombs` cells without replacement using weighted random selection. Seeded LCG ensures determinism.

### Step 4 — Calculate Numbers

For each non-bomb cell, count adjacent bombs → value 0–8 (standard Minesweeper).

### Step 5 — Validate

- `firstClick` is not a bomb
- Exact bomb count matches `bombs`
- Fallback: if validation fails (very small grid edge case), retry with safe-zone-only guarantee

---

## Deterministic RNG — LCG

```typescript
export function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}
```

Default seed if none provided: `firstClick.row * 1000 + firstClick.col + Date.now() % 1000000`

---

## Public API (`src/grid-generator.ts`)

```typescript
export type Cell = { row: number; col: number };

export interface GridGenOptions {
  rows: number;
  cols: number;
  bombs: number;
  firstClick: Cell;
  safeEnergy: number;       // rings of guaranteed safe cells
  dangerSources: number;    // number of danger epicenters
  dangerEnergyMax: number;  // max initial energy per danger source
  seed?: number;            // omit for time-based seed
}

export interface GridGenResult {
  grid: number[][];        // -1 = bomb, 0–8 = neighbor count
  safeZone: Set<string>;   // "row,col" keys — cells guaranteed bomb-free
  dangerMap: number[][];   // raw scores, useful for debug/visualization
}

// Main entry point
export function generateGrid(options: GridGenOptions): GridGenResult

// Exported for testing and alternative compositions
export function lcg(seed: number): () => number
export function propagateSafeEnergy(rows: number, cols: number, firstClick: Cell, safeEnergy: number): Set<string>
export function generateDangerMap(rows: number, cols: number, safeZone: Set<string>, dangerSources: number, dangerEnergyMax: number, rng: () => number): number[][]
export function placeWeightedMines(rows: number, cols: number, dangerMap: number[][], bombs: number, rng: () => number): Set<string>
export function calcNumbers(rows: number, cols: number, mineSet: Set<string>): number[][]
export function validateBoard(grid: number[][], firstClick: Cell): boolean
```

### Preset Configs

```typescript
export type EnergyPreset = { safeEnergy: number; dangerSources: number; dangerEnergyMax: number };

export const ENERGY_PRESETS: Record<"easy" | "medium" | "hard", EnergyPreset> = {
  easy:   { safeEnergy: 3, dangerSources: 2, dangerEnergyMax: 4 },
  medium: { safeEnergy: 2, dangerSources: 3, dangerEnergyMax: 5 },
  hard:   { safeEnergy: 1, dangerSources: 4, dangerEnergyMax: 6 },
};
```

---

## Tests (`tests/game-logic.test.ts`)

Import directly from `src/grid-generator.ts`:

1. `firstClick` cell is never a bomb (all difficulties)
2. Easy — all immediate neighbors of `firstClick` are safe
3. Exact bomb count matches `bombs` parameter
4. Same seed → identical output (determinism)
5. `propagateSafeEnergy` with `safeEnergy=3` returns ≥ 8 cells
6. `placeWeightedMines` never places a mine inside the safe zone
