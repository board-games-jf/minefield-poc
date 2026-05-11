# Coop — Deferred Grid Generation

Integration of the [Grid Generator](./grid-generator.md) into coop mode.

## Why Defer

Coop grids are generated **on the first reveal**, not on room creation. This guarantees:

- First click (human or AI) never hits a bomb
- Safe zone radius adapts to difficulty
- Grid state is hidden from client until then (already handled by `maskStateForClient`)

---

## State Change

Add to `GameState` interface in `src/server.ts`:

```typescript
coopGridReady?: boolean;
```

---

## `createInitialState` — coop branch

Replace `generateGrid(rows, cols, bombs)` with a zero-filled placeholder:

```typescript
grid: Array.from({ length: rows }, () => Array(cols).fill(0)),
coopGridReady: false,
```

---

## `handleReveal` — trigger on first reveal

At the top of `handleReveal`, before any existing logic:

```typescript
import { generateGrid, ENERGY_PRESETS } from "./grid-generator";

if (state.mode === "coop" && !state.coopGridReady) {
  const { rows, cols, bombs } = COOP_CONFIGS[state.difficulty];
  const preset = ENERGY_PRESETS[state.difficulty];
  const result = generateGrid({ rows, cols, bombs, firstClick: { row, col }, ...preset });
  state.grid = result.grid;
  state.coopGridReady = true;
}
```

---

## `allSafeCellsRevealed` — guard

```typescript
if (state.mode === "coop" && !state.coopGridReady) return false;
```

---

## `resetMatchStatePreservingPlayers` — rematch

Reset to placeholder again:

```typescript
// coop branch:
grid: Array.from({ length: rows }, () => Array(cols).fill(0)),
coopGridReady: false,
```

---

## AI Compatibility

`NemesisBot` calls `pickAiCell`, which reads the revealed/unknown layer — not `state.grid` directly. On an all-zeros grid it treats every cell as unknown and picks randomly, exactly like a first human click. The first reveal (AI or human) triggers generation. **No guard needed in `aiMove`.**

---

## Tests

1. `createInitialState("easy", "coop")` returns `coopGridReady === false`
2. After first reveal in coop, `coopGridReady === true` and grid contains `-1` bombs
3. AI first move also triggers grid generation via `handleReveal`

> Grid-level tests (safe zone, bomb count, determinism) live in [grid-generator.md](./grid-generator.md).

---

## File Changes

| File | Change |
|---|---|
| `src/grid-generator.ts` | **NEW** — see [grid-generator.md](./grid-generator.md) |
| `src/server.ts` | Import `generateGrid` and `ENERGY_PRESETS`; add `coopGridReady` to `GameState`; update `createInitialState`, `handleReveal`, `allSafeCellsRevealed`, `resetMatchStatePreservingPlayers` |
| `tests/game-logic.test.ts` | Add 3 coop integration tests + 6 grid-generator unit tests |
