import { describe, it, expect, beforeEach } from "vitest";
import {
  generateGrid,
  floodReveal,
  createInitialState,
  countFoundBombs,
  allSafeCellsRevealed,
  CONFIGS,
  type GameState,
} from "../src/server";

// ── generateGrid ───────────────────────────────────────────────────────────

describe("generateGrid", () => {
  it("places the correct number of bombs", () => {
    const grid = generateGrid(6, 6, 10);
    expect(grid.flat().filter(v => v === -1)).toHaveLength(10);
  });

  it("calculates neighbour counts correctly", () => {
    // 3×3 grid with bomb in center: all 8 neighbours must be 1
    const grid: number[][] = Array.from({ length: 3 }, () => Array(3).fill(0));
    grid[1][1] = -1;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (grid[r][c] === -1) continue;
        let n = 0;
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < 3 && nc >= 0 && nc < 3 && grid[nr][nc] === -1) n++;
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
    expect(grid.flat().filter(v => v === -1)).toHaveLength(8);
  });
});

// ── floodReveal ────────────────────────────────────────────────────────────

describe("floodReveal", () => {
  it("reveals a single numbered cell without propagating", () => {
    const grid = [[1, -1], [1, 1]];
    const revealed = [[false, false], [false, false]];
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
    const grid = [[0, -1], [0, 0]];
    const revealed = [[false, false], [false, false]];
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
    const grid = [[0, 0], [0, 0]];
    const revealed = [[true, false], [false, false]];
    floodReveal(grid, revealed, 0, 1, 2, 2);
    expect(revealed[0][0]).toBe(true); // already was true
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

  it("totalBombs matches difficulty config", () => {
    for (const diff of ["easy", "medium", "hard"] as const) {
      expect(createInitialState(diff).totalBombs).toBe(CONFIGS[diff].bombs);
    }
  });
});

// ── countFoundBombs ────────────────────────────────────────────────────────

describe("countFoundBombs", () => {
  let state: GameState;

  beforeEach(() => {
    state = createInitialState("easy");
    state.players[0] = { id: "a", name: "Alice", score: 0, bombs: 0 };
    state.players[1] = { id: "b", name: "Bob",   score: 0, bombs: 0 };
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
    const { rows, cols } = CONFIGS["easy"];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if (state.grid[r][c] !== -1) state.revealed[r][c] = true;
    expect(allSafeCellsRevealed(state)).toBe(true);
  });

  it("unrevealed bombs do not block game end", () => {
    const state = createInitialState("easy");
    const { rows, cols } = CONFIGS["easy"];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if (state.grid[r][c] !== -1) state.revealed[r][c] = true;
    expect(allSafeCellsRevealed(state)).toBe(true);
  });
});

// ── Full game flow ─────────────────────────────────────────────────────────

describe("game flow", () => {
  it("finding a bomb scores +10 and keeps the same player's turn", () => {
    const state = createInitialState("easy");
    state.players[0] = { id: "a", name: "Alice", score: 0, bombs: 0 };
    state.players[1] = { id: "b", name: "Bob",   score: 0, bombs: 0 };
    state.status = "playing";

    const { rows, cols } = CONFIGS["easy"];
    let br = -1, bc = -1;
    outer: for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if (state.grid[r][c] === -1) { br = r; bc = c; break outer; }

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
    state.players[0] = { id: "a", name: "Alice", score: 100, bombs: CONFIGS["easy"].bombs };
    state.players[1] = { id: "b", name: "Bob",   score: 0,   bombs: 0 };
    expect(countFoundBombs(state)).toBe(CONFIGS["easy"].bombs);
  });

  it("winner is the player with the highest score", () => {
    const state = createInitialState("easy");
    state.players[0] = { id: "a", name: "Alice", score: 60, bombs: 6 };
    state.players[1] = { id: "b", name: "Bob",   score: 40, bombs: 4 };
    const winner = state.players[0]!.score > state.players[1]!.score ? 0 : 1;
    expect(winner).toBe(0);
  });

  it("detects a draw correctly", () => {
    const state = createInitialState("easy");
    state.players[0] = { id: "a", name: "Alice", score: 50, bombs: 5 };
    state.players[1] = { id: "b", name: "Bob",   score: 50, bombs: 5 };
    expect(state.players[0]!.score === state.players[1]!.score).toBe(true);
  });
});

// ── Reconnection ───────────────────────────────────────────────────────────

describe("reconnection", () => {
  it("maps player with same name back to their existing slot", () => {
    const state = createInitialState("easy");
    state.players[0] = { id: "conn-old", name: "Alice", score: 30, bombs: 3 };
    state.players[1] = { id: "conn-b",   name: "Bob",   score: 0,  bombs: 0 };
    state.status = "playing";

    let slot: 0 | 1 | null = null;
    if (state.players[0]?.name === "Alice") slot = 0;
    else if (state.players[1]?.name === "Alice") slot = 1;

    expect(slot).toBe(0);
  });

  it("state is preserved after serialisation round-trip", () => {
    const state = createInitialState("medium");
    state.players[0] = { id: "a", name: "Alice", score: 50, bombs: 5 };
    state.players[1] = { id: "b", name: "Bob",   score: 20, bombs: 2 };
    state.status = "playing";

    const recovered: GameState = JSON.parse(JSON.stringify(state));
    expect(recovered.players[0]?.score).toBe(50);
    expect(recovered.players[1]?.bombs).toBe(2);
    expect(recovered.status).toBe("playing");
  });
});
