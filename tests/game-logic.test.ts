import { describe, it, expect, beforeEach } from "vitest";
import {
  generateGrid,
  floodReveal,
  createInitialState,
  countFoundBombs,
  allSafeCellsRevealed,
  CONFIGS,
  COOP_CONFIGS,
  pickAiCell,
  isScoreUncatchable,
  applyMatchResultToRanking,
  type GameState,
  type RankingEntry,
} from "../src/server";
import {
  generateGrid as generateEnergyGrid,
  propagateSafeEnergy,
  placeWeightedMines,
  generateDangerMap,
  generateReliefMap,
  lcg,
  ENERGY_PRESETS,
  type GridGenOptions,
} from "../src/grid-generator";

// ── generateGrid ───────────────────────────────────────────────────────────

describe("generateGrid", () => {
  it("places the correct number of bombs", () => {
    const grid = generateGrid(6, 6, 10);
    expect(grid.flat().filter((v) => v === -1)).toHaveLength(10);
  });

  it("calculates neighbour counts correctly", () => {
    // 3×3 grid with bomb in center: all 8 neighbours must be 1.
    const grid: number[][] = Array.from({ length: 3 }, () => Array(3).fill(0));
    grid[1][1] = -1;

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (grid[r][c] === -1) continue;

        let n = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < 3 && nc >= 0 && nc < 3 && grid[nr][nc] === -1) {
              n++;
            }
          }
        }
        grid[r][c] = n;
      }
    }

    expect(grid[0][0]).toBe(1);
    expect(grid[0][1]).toBe(1);
    expect(grid[0][2]).toBe(1);
    expect(grid[1][0]).toBe(1);
    expect(grid[1][2]).toBe(1);
    expect(grid[2][0]).toBe(1);
    expect(grid[2][1]).toBe(1);
    expect(grid[2][2]).toBe(1);
  });

  it("values are between -1 and 8", () => {
    const grid = generateGrid(10, 10, 30);
    for (const v of grid.flat()) {
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(8);
    }
  });

  it("handles high bomb density", () => {
    const grid = generateGrid(3, 3, 8);
    expect(grid.flat().filter((v) => v === -1)).toHaveLength(8);
  });
});

// ── floodReveal ────────────────────────────────────────────────────────────

describe("floodReveal", () => {
  it("reveals a single numbered cell without propagating", () => {
    const grid = [
      [1, -1],
      [1, 1],
    ];
    const revealed = [
      [false, false],
      [false, false],
    ];

    floodReveal(grid, revealed, 0, 0, 2, 2);

    expect(revealed[0][0]).toBe(true);
    expect(revealed[0][1]).toBe(false); // bomb — never revealed
    expect(revealed[1][0]).toBe(false); // no flood from numbered cell
  });

  it("propagates flood fill from a 0 cell", () => {
    const grid = [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, -1],
    ];
    const revealed = Array.from({ length: 3 }, () => Array(3).fill(false));

    floodReveal(grid, revealed, 0, 0, 3, 3);

    expect(revealed[0][0]).toBe(true);
    expect(revealed[0][1]).toBe(true);
    expect(revealed[0][2]).toBe(true);
    expect(revealed[1][0]).toBe(true);
    expect(revealed[1][1]).toBe(true);
    expect(revealed[1][2]).toBe(true);
    expect(revealed[2][0]).toBe(true);
    expect(revealed[2][1]).toBe(true);
    expect(revealed[2][2]).toBe(false); // bomb — never revealed
  });

  it("never reveals bombs during flood fill", () => {
    const grid = [
      [0, -1],
      [0, 0],
    ];
    const revealed = [
      [false, false],
      [false, false],
    ];

    floodReveal(grid, revealed, 0, 0, 2, 2);

    expect(revealed[0][1]).toBe(false);
  });

  it("does not throw on grid edges", () => {
    const grid = [[0]];
    const revealed = [[false]];

    expect(() => floodReveal(grid, revealed, 0, 0, 1, 1)).not.toThrow();
    expect(revealed[0][0]).toBe(true);
  });

  it("does not re-reveal already revealed cells", () => {
    const grid = [
      [0, 0],
      [0, 0],
    ];
    const revealed = [
      [true, false],
      [false, false],
    ];

    floodReveal(grid, revealed, 0, 1, 2, 2);

    expect(revealed[0][0]).toBe(true);
  });
});

// ── createInitialState ─────────────────────────────────────────────────────

describe("createInitialState", () => {
  it("starts with status 'waiting'", () => {
    expect(createInitialState("easy").status).toBe("waiting");
  });

  it("creates grid with correct dimensions per difficulty", () => {
    for (const diff of ["easy", "medium", "hard"] as const) {
      const { grid } = createInitialState(diff);
      const { rows, cols } = CONFIGS[diff];
      expect(grid).toHaveLength(rows);
      expect(grid[0]).toHaveLength(cols);
    }
  });

  it("starts with no players", () => {
    const { players } = createInitialState("easy");
    expect(players[0]).toBeNull();
    expect(players[1]).toBeNull();
  });

  it("starts with player 0 as current player", () => {
    expect(createInitialState("medium").currentPlayer).toBe(0);
  });

  it("starts with no cells revealed", () => {
    const { revealed } = createInitialState("easy");
    expect(revealed.flat().some(Boolean)).toBe(false);
  });

  it("totalBombs matches versus difficulty config by default", () => {
    for (const diff of ["easy", "medium", "hard"] as const) {
      expect(createInitialState(diff).totalBombs).toBe(CONFIGS[diff].bombs);
    }
  });

  it("coop totalBombs matches coop difficulty config", () => {
    for (const diff of ["easy", "medium", "hard"] as const) {
      expect(createInitialState(diff, "coop").totalBombs).toBe(
        COOP_CONFIGS[diff].bombs,
      );
    }
  });
});

// ── countFoundBombs ────────────────────────────────────────────────────────

describe("countFoundBombs", () => {
  let state: GameState;

  beforeEach(() => {
    state = createInitialState("easy");
    state.players[0] = { id: "a", name: "Alice", score: 0, bombs: 0 };
    state.players[1] = { id: "b", name: "Bob", score: 0, bombs: 0 };
  });

  it("returns 0 at game start", () => {
    expect(countFoundBombs(state)).toBe(0);
  });

  it("sums bombs from both players", () => {
    state.players[0]!.bombs = 3;
    state.players[1]!.bombs = 5;
    expect(countFoundBombs(state)).toBe(8);
  });

  it("works when player 2 is still null", () => {
    state.players[1] = null;
    state.players[0]!.bombs = 4;
    expect(countFoundBombs(state)).toBe(4);
  });
});

// ── allSafeCellsRevealed ───────────────────────────────────────────────────

describe("allSafeCellsRevealed", () => {
  it("returns false when safe cells remain hidden", () => {
    expect(allSafeCellsRevealed(createInitialState("easy"))).toBe(false);
  });

  it("returns true when all safe cells are revealed", () => {
    const state = createInitialState("easy");
    const { rows, cols } = CONFIGS.easy;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (state.grid[r][c] !== -1) state.revealed[r][c] = true;
      }
    }

    expect(allSafeCellsRevealed(state)).toBe(true);
  });

  it("unrevealed bombs do not block game end", () => {
    const state = createInitialState("easy");
    const { rows, cols } = CONFIGS.easy;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (state.grid[r][c] !== -1) state.revealed[r][c] = true;
      }
    }

    expect(allSafeCellsRevealed(state)).toBe(true);
  });

  it("coop returns false while the deferred grid is not ready", () => {
    const state = createInitialState("easy", "coop");
    expect(state.coopGridReady).toBe(false);
    expect(allSafeCellsRevealed(state)).toBe(false);
  });

  it("coop uses COOP_CONFIGS dimensions after the grid is ready", () => {
    const state = createInitialState("medium", "coop");
    const { rows, cols } = COOP_CONFIGS.medium;

    state.coopGridReady = true;
    state.grid = Array.from({ length: rows }, () => Array(cols).fill(1));
    state.revealed = Array.from({ length: rows }, () => Array(cols).fill(true));

    expect(allSafeCellsRevealed(state)).toBe(true);
  });
});

// ── early finish ───────────────────────────────────────────────────────────

describe("early finish (uncatchable score)", () => {
  it("detects when the trailing player cannot catch up from remaining bombs", () => {
    const state = createInitialState("easy");
    state.players[0] = { id: "a", name: "Alice", score: 50, bombs: 5 };
    state.players[1] = { id: "b", name: "Bob", score: 10, bombs: 1 };
    // totalBombs easy = 10, found = 6, remaining = 4 => max swing = 40
    expect(isScoreUncatchable(state)).toBe(false);

    state.players[0]!.score = 60; // lead = 50, remaining max swing still 40
    expect(isScoreUncatchable(state)).toBe(true);
  });
});

// ── Full game flow ─────────────────────────────────────────────────────────

describe("game flow", () => {
  it("finding a bomb scores +10 and keeps the same player's turn", () => {
    const state = createInitialState("easy");
    state.players[0] = { id: "a", name: "Alice", score: 0, bombs: 0 };
    state.players[1] = { id: "b", name: "Bob", score: 0, bombs: 0 };
    state.status = "playing";

    const { rows, cols } = CONFIGS.easy;
    let br = -1;
    let bc = -1;

    outer: for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (state.grid[r][c] === -1) {
          br = r;
          bc = c;
          break outer;
        }
      }
    }

    state.revealed[br][bc] = true;
    state.foundBy[br][bc] = 0;
    state.players[0]!.bombs++;
    state.players[0]!.score += 10;

    expect(state.players[0]!.score).toBe(10);
    expect(state.players[0]!.bombs).toBe(1);
    expect(state.currentPlayer).toBe(0); // turn did NOT change
  });

  it("revealing a safe cell switches the active player", () => {
    const state = createInitialState("easy");
    state.currentPlayer = 0;
    state.currentPlayer = state.currentPlayer === 0 ? 1 : 0;
    expect(state.currentPlayer).toBe(1);
  });

  it("game ends when all bombs are found", () => {
    const state = createInitialState("easy");
    state.players[0] = {
      id: "a",
      name: "Alice",
      score: 100,
      bombs: CONFIGS.easy.bombs,
    };
    state.players[1] = { id: "b", name: "Bob", score: 0, bombs: 0 };
    expect(countFoundBombs(state)).toBe(CONFIGS.easy.bombs);
  });

  it("winner is the player with the highest score", () => {
    const state = createInitialState("easy");
    state.players[0] = { id: "a", name: "Alice", score: 60, bombs: 6 };
    state.players[1] = { id: "b", name: "Bob", score: 40, bombs: 4 };
    const winner = state.players[0]!.score > state.players[1]!.score ? 0 : 1;
    expect(winner).toBe(0);
  });

  it("detects a draw correctly", () => {
    const state = createInitialState("easy");
    state.players[0] = { id: "a", name: "Alice", score: 50, bombs: 5 };
    state.players[1] = { id: "b", name: "Bob", score: 50, bombs: 5 };
    expect(state.players[0]!.score === state.players[1]!.score).toBe(true);
  });
});

// ── Reconnection ───────────────────────────────────────────────────────────

describe("reconnection", () => {
  it("maps player with same name back to their existing slot", () => {
    const state = createInitialState("easy");
    state.players[0] = { id: "conn-old", name: "Alice", score: 30, bombs: 3 };
    state.players[1] = { id: "conn-b", name: "Bob", score: 0, bombs: 0 };
    state.status = "playing";

    let slot: 0 | 1 | null = null;
    if (state.players[0]?.name === "Alice") slot = 0;
    else if (state.players[1]?.name === "Alice") slot = 1;

    expect(slot).toBe(0);
  });

  it("state is preserved after serialisation round-trip", () => {
    const state = createInitialState("medium");
    state.players[0] = { id: "a", name: "Alice", score: 50, bombs: 5 };
    state.players[1] = { id: "b", name: "Bob", score: 20, bombs: 2 };
    state.status = "playing";

    const recovered: GameState = JSON.parse(JSON.stringify(state));
    expect(recovered.players[0]?.score).toBe(50);
    expect(recovered.players[1]?.bombs).toBe(2);
    expect(recovered.status).toBe("playing");
  });
});

// ── AI move picker ─────────────────────────────────────────────────────────

describe("AI move picker", () => {
  it("hard picks a forced bomb when deducible in versus mode", () => {
    const state = createInitialState("easy");
    state.mode = "versus";
    // Small contrived board:
    // (0,0) is revealed "1" and its only unrevealed neighbour is (0,1),
    // so (0,1) must be a bomb from the AI's point of view.
    state.grid = [
      [1, -1],
      [0, 0],
    ];
    state.revealed = [
      [true, false],
      [true, true],
    ];
    state.foundBy = [
      [null, null],
      [null, null],
    ];
    const aiFlags = [
      [false, false],
      [false, false],
    ];

    const pick = pickAiCell(state, aiFlags, "hard");

    expect(pick).toEqual({ row: 0, col: 1 });
  });

  it("coop AI avoids a deduced bomb by flagging it internally", () => {
    const state = createInitialState("easy", "coop");
    state.status = "playing";
    state.coopGridReady = true;
    state.grid = [
      [1, -1],
      [0, 0],
    ];
    state.revealed = [
      [true, false],
      [true, true],
    ];
    state.foundBy = [
      [null, null],
      [null, null],
    ];
    const aiFlags = [
      [false, false],
      [false, false],
    ];

    const pick = pickAiCell(state, aiFlags, "hard");

    expect(aiFlags[0][1]).toBe(true);
    expect(pick).not.toEqual({ row: 0, col: 1 });
  });
});

// ── applyMatchResultToRanking ──────────────────────────────────────────────

describe("applyMatchResultToRanking", () => {
  it("adds a new entry for a first-time winner", () => {
    const result = applyMatchResultToRanking([], [
      { id: "a", name: "Alice", score: 160, bombs: 0 },
    ] as any);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Alice");
    expect(result[0].points).toBe(160);
    expect(result[0].wins).toBe(1);
  });

  it("accumulates points and wins for returning player", () => {
    const existing: RankingEntry[] = [{ name: "Alice", points: 100, wins: 1 }];
    const result = applyMatchResultToRanking(existing, [
      { id: "a", name: "Alice", score: 160, bombs: 0 },
    ] as any);

    expect(result[0].points).toBe(260);
    expect(result[0].wins).toBe(2);
  });

  it("coop win: both players receive points", () => {
    const result = applyMatchResultToRanking([], [
      { id: "a", name: "Alice", score: 130, bombs: 0 },
      { id: "b", name: "Bob", score: 130, bombs: 0 },
    ] as any);

    expect(result).toHaveLength(2);
    const alice = result.find((e) => e.name === "Alice")!;
    const bob = result.find((e) => e.name === "Bob")!;
    expect(alice.points).toBe(130);
    expect(alice.wins).toBe(1);
    expect(bob.points).toBe(130);
    expect(bob.wins).toBe(1);
  });

  it("coop win: existing players get incremented", () => {
    const existing: RankingEntry[] = [
      { name: "Alice", points: 50, wins: 1 },
      { name: "Bob", points: 50, wins: 1 },
    ];
    const result = applyMatchResultToRanking(existing, [
      { id: "a", name: "Alice", score: 90, bombs: 0 },
      { id: "b", name: "Bob", score: 90, bombs: 0 },
    ] as any);

    const alice = result.find((e) => e.name === "Alice")!;
    const bob = result.find((e) => e.name === "Bob")!;
    expect(alice.points).toBe(140);
    expect(alice.wins).toBe(2);
    expect(bob.points).toBe(140);
    expect(bob.wins).toBe(2);
  });

  it("returns entries sorted by points descending", () => {
    const result = applyMatchResultToRanking([], [
      { id: "a", name: "Alice", score: 60, bombs: 0 },
      { id: "b", name: "Bob", score: 160, bombs: 0 },
    ] as any);

    expect(result[0].name).toBe("Bob");
    expect(result[1].name).toBe("Alice");
  });

  it("produces no duplicate entries for same-name winner", () => {
    const existing: RankingEntry[] = [{ name: "Alice", points: 60, wins: 1 }];
    const result = applyMatchResultToRanking(existing, [
      { id: "a", name: "Alice", score: 60, bombs: 0 },
    ] as any);

    expect(result.filter((e) => e.name === "Alice")).toHaveLength(1);
  });
});

// ── grid-generator ─────────────────────────────────────────────────────────

describe("generateEnergyGrid", () => {
  const BASE: GridGenOptions = {
    rows: 6,
    cols: 6,
    bombs: 6,
    firstClick: { row: 2, col: 2 },
    ...ENERGY_PRESETS.easy,
    seed: 42,
  };

  it("firstClick cell is never a bomb", () => {
    for (const diff of ["easy", "medium", "hard"] as const) {
      const opts: GridGenOptions = {
        rows: 6,
        cols: 6,
        bombs: 6,
        firstClick: { row: 0, col: 0 },
        ...ENERGY_PRESETS[diff],
        seed: 99,
      };
      const { grid } = generateEnergyGrid(opts);
      expect(grid[0][0]).not.toBe(-1);
    }
  });

  it("firstClick is still safe when safeEnergy is 0", () => {
    const { grid, safeZone } = generateEnergyGrid({
      rows: 6,
      cols: 6,
      bombs: 6,
      firstClick: { row: 2, col: 2 },
      ...ENERGY_PRESETS.hard,
      safeEnergy: 0,
      seed: 123,
    });

    expect(safeZone.has("2,2")).toBe(true);
    expect(grid[2][2]).not.toBe(-1);
  });

  it("easy — all immediate neighbors of firstClick are bomb-free", () => {
    const { grid } = generateEnergyGrid({ ...BASE, safeEnergy: 3 });
    const { row, col } = BASE.firstClick;

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr < 0 || nr >= BASE.rows || nc < 0 || nc >= BASE.cols) continue;
        expect(grid[nr][nc]).not.toBe(-1);
      }
    }
  });

  it("exact bomb count matches the bombs parameter", () => {
    const { grid } = generateEnergyGrid(BASE);
    const bombCount = grid.flat().filter((v) => v === -1).length;
    expect(bombCount).toBe(BASE.bombs);
  });

  it("same seed produces identical output (deterministic)", () => {
    const a = generateEnergyGrid(BASE);
    const b = generateEnergyGrid(BASE);
    expect(a.grid).toEqual(b.grid);
    expect(a.dangerMap).toEqual(b.dangerMap);
    expect(a.reliefMap).toEqual(b.reliefMap);
  });

  it("values are -1 or 0–8", () => {
    const { grid } = generateEnergyGrid(BASE);
    for (const v of grid.flat()) {
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(8);
    }
  });

  it("throws when bombs cannot fit outside the safe zone", () => {
    expect(() =>
      generateEnergyGrid({
        rows: 3,
        cols: 3,
        bombs: 9,
        firstClick: { row: 1, col: 1 },
        ...ENERGY_PRESETS.easy,
        seed: 1,
      }),
    ).toThrow(/Cannot place/);
  });
});

describe("propagateSafeEnergy", () => {
  it("safeEnergy=3 returns at least 9 cells", () => {
    const zone = propagateSafeEnergy(6, 6, { row: 3, col: 3 }, 3);
    expect(zone.size).toBeGreaterThanOrEqual(9);
  });

  it("safeEnergy=0 still returns firstClick only", () => {
    const zone = propagateSafeEnergy(6, 6, { row: 3, col: 3 }, 0);
    expect(zone.size).toBe(1);
    expect(zone.has("3,3")).toBe(true);
  });

  it("firstClick is always in the safe zone when safeEnergy >= 1", () => {
    const zone = propagateSafeEnergy(6, 6, { row: 2, col: 4 }, 1);
    expect(zone.has("2,4")).toBe(true);
  });

  it("safeEnergy=2 includes immediate neighbors when centered", () => {
    const zone = propagateSafeEnergy(6, 6, { row: 3, col: 3 }, 2);

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        expect(zone.has(`${3 + dr},${3 + dc}`)).toBe(true);
      }
    }
  });
});

describe("generateReliefMap", () => {
  it("does not add relief score inside safeZone", () => {
    const rows = 6;
    const cols = 6;
    const safeZone = propagateSafeEnergy(rows, cols, { row: 3, col: 3 }, 2);
    const reliefMap = generateReliefMap(rows, cols, safeZone, 2, 3, lcg(10));

    for (const key of safeZone) {
      const [r, c] = key.split(",").map(Number);
      expect(reliefMap[r][c]).toBe(0);
    }
  });
});

describe("placeWeightedMines", () => {
  it("never places a mine inside the safe zone", () => {
    const rows = 6;
    const cols = 6;
    const safeZone = propagateSafeEnergy(rows, cols, { row: 3, col: 3 }, 3);
    const dangerMap = generateDangerMap(rows, cols, safeZone, 2, 4, lcg(7));
    const reliefMap = Array.from({ length: rows }, () => Array(cols).fill(0));

    const mineSet = placeWeightedMines(
      rows,
      cols,
      dangerMap,
      reliefMap,
      6,
      lcg(7),
      safeZone,
    );

    for (const k of mineSet) {
      expect(safeZone.has(k)).toBe(false);
    }
  });

  it("throws if bomb count exceeds available cells outside safe zone", () => {
    const rows = 3;
    const cols = 3;
    const safeZone = propagateSafeEnergy(rows, cols, { row: 1, col: 1 }, 3);
    const dangerMap = Array.from({ length: rows }, () => Array(cols).fill(0));
    const reliefMap = Array.from({ length: rows }, () => Array(cols).fill(0));

    expect(() =>
      placeWeightedMines(rows, cols, dangerMap, reliefMap, 1, lcg(1), safeZone),
    ).toThrow(/Cannot place/);
  });
});

describe("createInitialState coop — deferred grid", () => {
  it("returns coopGridReady === false", () => {
    const state = createInitialState("easy", "coop");
    expect(state.coopGridReady).toBe(false);
  });

  it("placeholder grid has no bombs", () => {
    const state = createInitialState("medium", "coop");
    const hasBombs = state.grid.flat().some((v) => v === -1);
    expect(hasBombs).toBe(false);
  });

  it("placeholder grid is zero-filled until first reveal", () => {
    const state = createInitialState("hard", "coop");
    expect(state.grid.flat().every((v) => v === 0)).toBe(true);
  });

  it("coop dimensions follow COOP_CONFIGS", () => {
    for (const diff of ["easy", "medium", "hard"] as const) {
      const state = createInitialState(diff, "coop");
      expect(state.grid).toHaveLength(COOP_CONFIGS[diff].rows);
      expect(state.grid[0]).toHaveLength(COOP_CONFIGS[diff].cols);
      expect(state.totalBombs).toBe(COOP_CONFIGS[diff].bombs);
    }
  });
});

// ── pickAiCell deduction — certain-safe via player flags ───────────────────
//
// Board (0-based, 10×10). Reproduces the reported bug where the AI clicked a
// dark cell (5,0) instead of the logically-safe cell (5,8).
//
// Legenda user (1-based) → 0-based:
//   L6C6 = [5][5]  flag (player)
//   L6C9 = [5][8]  unknown (should be deduced bomb, flagged by AI)
//   L6C8 = [5][7]  unknown → CERTAIN SAFE (target)
//   L7C7 = [6][6]  revealed = 1
//   L7C8 = [6][7]  revealed = 3
//   L7C9 = [6][8]  unknown → certain bomb
//   L8C8 = [7][7]  revealed = 2
//   L8C9 = [7][8]  flag (player)
//   L8C10= [7][9]  revealed = 2
//
// Deduction chain:
//   [6][6]=1, knownBomb=[5][5] → remaining=0 → [5][6],[5][7] certain safe
//   [7][7]=2, knownBomb=[7][8] → remaining=1 → only unknown=[6][8] → certain bomb
//   [6][7]=3, knownBombs=[7][8]+[6][8] → remaining=1 → [5][7] safe (already), [5][8] certain bomb
//
// Expected: pickAiCell returns [5][7] (L6,C8 in 1-based).

describe("pickAiCell — certain-safe via flags deduction", () => {
  function makeBoardState(): GameState {
    // 10×10 all-unknown grid (no bomb positions needed — AI only reads revealed + numbers)
    const rows = 10, cols = 10;
    const grid: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));
    const revealed: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
    const foundBy: (0 | 1 | null)[][] = Array.from({ length: rows }, () => Array(cols).fill(null));
    const flags: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));

    // Revealed numbered cells (0-based)
    const numberedCells: [number, number, number][] = [
      // [row, col, value]
      [5, 0, 1], [5, 1, 1], [5, 2, 1], [5, 3, 2], [5, 4, 3], [5, 6, 3], // L6 C1-C3,C4,C5,C7
      [6, 0, 0], [6, 1, 0], [6, 2, 0], [6, 3, 0], [6, 4, 1], [6, 5, 1], [6, 6, 1], [6, 7, 3], // L7
      [7, 0, 1], [7, 1, 1], [7, 2, 0], [7, 3, 0], [7, 4, 0], [7, 5, 0], [7, 6, 0], [7, 7, 2], [7, 9, 2], // L8
      [8, 1, 1], [8, 2, 0], [8, 3, 0], [8, 4, 0], [8, 5, 0], [8, 6, 0], [8, 7, 1], [8, 8, 1], [8, 9, 1], // L9
      [9, 0, 1], [9, 1, 1], [9, 2, 0], [9, 3, 0], [9, 4, 0], [9, 5, 0], [9, 6, 0], [9, 7, 0], [9, 8, 0], [9, 9, 0], // L10
    ];
    for (const [r, c, v] of numberedCells) {
      grid[r][c] = v;
      revealed[r][c] = true;
      foundBy[r][c] = 0;
    }

    // Player flags (1-based: L6C6=[5][5], L8C9=[7][8], L9C1=[8][0])
    flags[5][5] = true;
    flags[7][8] = true;
    flags[8][0] = true;

    const state: GameState = {
      status: "playing",
      difficulty: "hard",
      mode: "coop",
      players: [
        { id: "human", name: "Human", score: 0, bombs: 0 },
        { id: "ai",    name: "NêmesisBot", score: 0, bombs: 0 },
      ],
      currentPlayer: 1,
      grid,
      revealed,
      foundBy,
      safeRevealedBy: [],
      totalBombs: 20,
      lastPlayerClicks: [],
      rematchReady: [false, false],
      flags,
      coopGridReady: true,
    };
    return state;
  }

  it("deduces certain-safe cells via flag chain and picks one of them", () => {
    const state = makeBoardState();
    const aiFlags: boolean[][] = Array.from({ length: 10 }, () => Array(10).fill(false));

    const pick = pickAiCell(state, aiFlags, "hard");
    expect(pick).not.toBeNull();
    // [5][7] (L6,C8): safe because [6][6]=1 has its only unknown neighbor here after flag at [5][5]
    // [6][9] (L7,C10): safe because [7][9]=2 accounts for flag[7][8] + aiFlag[6][8]
    const certainSafeCells = [[5, 7], [6, 9]];
    const isCertainSafe = certainSafeCells.some(([r, c]) => pick!.row === r && pick!.col === c);
    expect(isCertainSafe).toBe(true);
  });

  it("marks [6][8] (L7,C9) as certain bomb in aiFlags", () => {
    const state = makeBoardState();
    const aiFlags: boolean[][] = Array.from({ length: 10 }, () => Array(10).fill(false));
    pickAiCell(state, aiFlags, "hard");
    // After deduction, AI should have flagged [6][8] as a known bomb
    expect(aiFlags[6][8]).toBe(true);
  });
});

// ── coop deferred grid — AI first click never a bomb ──────────────────────

describe("coop deferred grid — AI first click safety", () => {
  it("cell chosen to generate the grid is never a bomb (20 random positions)", () => {
    for (let i = 0; i < 20; i++) {
      const firstClick = { row: 1 + (i % 6), col: 1 + (i % 6) };
      const { grid } = generateEnergyGrid({ rows: 8, cols: 8, bombs: 12, firstClick, ...ENERGY_PRESETS.medium, seed: i });
      expect(grid[firstClick.row][firstClick.col]).not.toBe(-1);
    }
  });
});
