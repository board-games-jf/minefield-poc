# Implementation Plan — Desarma / Desarme / Disarm (Solo)

> Mode name placeholder: **Desarma** (PT-BR) · **Desarme** (PT-PT) · **Disarm** (EN). Final name TBD.
> CE dialect name: TBD.
>
> This document is an implementation plan for the solo variant of Disarm mode.
> Its purpose is to serve as input for UI/UX flow design and prototype suggestions.
> Reference spec: [mvp-operation-defuse.md](./mvp-operation-defuse.md)
> Companion: [implementation-plan-defuse-multiplayer.md](./implementation-plan-defuse-multiplayer.md)

---

## Design principle

> Solo and multiplayer share the same room model, the same components, and the same core loop.
> The difference is a **choice made at the Create screen**, not a different product.
> This means solo is built once and the multi layer is added on top.

---

## Overview

Solo Disarm is a single-player, turn-free, timed mode. The player creates a room, gets a shareable link, and starts playing immediately — no waiting, no start button. If they never share the link, it stays solo. The room is **persistent**: the same link can be replayed any number of times, each replay starting a fresh timer.

There is no energy system in solo. Mistakes add time penalties to the final score.

---

## Room model

```
Create → Room open → [first click] → playing → finished → [play again or leave]
```

- **No lobby wait, no start button.** The room is open the moment it is created.
- The timer starts on the **first cell click** (either Inspect or Defuse).
- The shareable link is available immediately in a discreet location on the game screen.
- If the player never shares the link and plays alone, the result goes to the **solo ranking** under their name.
- The room never expires. The same link can be replayed as many times as desired.
- Each new game resets the grid and timer from zero.

---

## Solo vs. Multi — explicit choice at Create

Solo and Multi are **chosen explicitly** at the Create screen, not inferred from the number of players who joined.

```
[ Solo ]   [ Multi ]
```

- **Solo selected** → ranking entry uses the player's own name. Link can still be shared, but it is not the intended flow.
- **Multi selected** → player sets a squad name (see multiplayer doc). Covered in the companion document.

This keeps the internal architecture shared (same room, same components) while giving the UI and ranking a clean separation.

---

## Game states

```
created → playing → finished
```

- `created`: room exists, grid ready, player on the game screen; timer not yet started
- `playing`: first click has happened; timer is running
- `finished`: all bombs resolved; result screen shown; room immediately available for replay

The timer starts on the **first cell interaction** (either Inspect or Defuse).

---

## Actions

The player has exactly two actions, toggled via a persistent mode selector:

```
🔎 Inspect   — uncovers a cell
🛠️ Defuse    — attempts to defuse a bomb on a hidden cell
```

### Action selector — Sudoku pencil/pen analogy

The action toggle must feel identical to how Sudoku apps switch between **pencil (draft)** and **pen (final answer)** mode:

- The selected action is a **persistent mode**, not a hold-to-activate gesture.
- Switching between modes is fast, lightweight, and always visible.
- The selected action is clearly highlighted in the UI at all times — the player should never be unsure which mode is active.
- Tapping/clicking a cell always executes the **currently selected action**.
- In Sudoku terms:
  - 🔎 Inspect = pencil/draft → "I'm exploring, gathering information"
  - 🛠️ Defuse = pen/final → "I'm committing to this cell being a bomb"

#### Toggle interactions

| Platform | Toggle action          |
|----------|------------------------|
| Desktop  | Press `Space`          |
| Desktop  | Click the inactive button in the action bar |
| Mobile   | Tap the inactive button in the action bar   |
| Mobile   | (optional) long press on cell = alternate action |

The right-click / long press alternate action is **optional** and maps to whichever action is not currently selected. It must never be required to play well.

---

## Grid

```
Size:   12×12
Bombs:  ~29 (20% density for Medium/default)
Grid values: -1 = bomb, 0–8 = safe cell
```

Grid is **pre-generated when the game starts**. The first cell is guaranteed safe via replanting if needed.

### Cell display states

```
Hidden (unrevealed):           ░░ (closed cell)
Revealed empty (no neighbors): (blank)
Revealed numbered (1–8):       1–8, color-coded
Defused bomb:                  💣 (green)
Triggered bomb (exploded):     💣 (red)
```

---

## Penalty system

No energy. Mistakes accumulate time penalties applied to the final score.

| Mistake                         | Penalty  |
|---------------------------------|----------|
| Inspect a bomb (triggered)      | +5s      |
| Wrong defuse (Defuse safe cell) | +10s     |

Rationale: Inspect is exploratory — lighter penalty. Defuse is a confident commitment — higher penalty for being wrong.

```
final time = real elapsed time + sum of all penalties
```

Penalties are shown immediately on screen when they occur (e.g., "+5s" toast near the cell).

---

## Combo

Combo counts consecutive correct defuses.

| Event            | Combo effect       |
|------------------|--------------------|
| Correct defuse   | +1 combo           |
| Wrong defuse     | reset to 0         |
| Triggered bomb   | reset to 0         |

In the MVP, combo is **visual feedback only** — no effect on time. Display it prominently to reward skilled play and encourage streaks.

---

## Defuse constraint

To prevent blind random defusing:

```
A Defuse action is only allowed on a hidden cell that is adjacent
to at least one already-revealed cell.
```

If the player attempts to defuse a cell in a fully unrevealed area, the action is rejected with a brief visual/haptic cue — no penalty.

---

## HUD layout

```
┌──────────────────────────────────┐
│  Operation Defuse          ⚙️    │
│                                  │
│  ⏱ 01:32    💣 12/25   🔥 4    │
│         (time) (bombs) (combo)   │
│                                  │
│  ┌──────────────────────────┐   │
│  │                          │   │
│  │         GRID             │   │
│  │        12 × 12           │   │
│  │                          │   │
│  └──────────────────────────┘   │
│                                  │
│   ┌─────────┐  ┌─────────┐      │
│   │🔎Inspect│  │🛠️ Defuse│      │
│   └─────────┘  └─────────┘      │
│         (active = highlighted)   │
└──────────────────────────────────┘
```

Key HUD elements:
- **Timer**: counts up from 00:00, starts on first interaction
- **Bomb counter**: `resolved / total` (both defused ✅ and triggered 💣 count)
- **Combo**: current consecutive correct-defuse streak
- **Action bar**: always visible, active action clearly highlighted (like selected tool in Sudoku)

---

## Result screen

Shown when `bombs resolved === totalBombs`.

```
┌────────────────────────────────────┐
│       Operation Defuse — Solo      │
│                                    │
│  ⏱ Final time:       03:27         │
│                                    │
│  Real time:          03:12         │
│  Bombs triggered:    1 × +5s       │
│  Wrong defuses:      1 × +10s      │
│                                    │
│  ✅ Bombs defused:   24            │
│  💣 Bombs triggered: 1             │
│  🎯 Accuracy:        96%           │
│  🔥 Highest combo:   7             │
│                                    │
│  Device: 📱 Mobile                 │
│                                    │
│  [ Play again ]  [ Leaderboard ]   │
└────────────────────────────────────┘
```

---

## Difficulty configs

| Difficulty | Grid   | Bombs | Density |
|------------|--------|-------|---------|
| Easy       | 12×12  | ~23   | 16%     |
| Medium     | 12×12  | ~29   | 20%     |
| Hard       | 12×12  | ~32   | 22%     |

For MVP, default to Medium (20% density).

---

## Leaderboard

Solo leaderboard ranks by **final time** (lower = better).

Category key format:

```
operation-defuse:solo:{difficulty}
```

Examples:
```
operation-defuse:solo:easy
operation-defuse:solo:medium
operation-defuse:solo:hard
```

Entry fields (extends `RankingEntry`):
```typescript
{
  name: string;       // player name
  finalTime: number;  // ms, real + penalties
  realTime: number;   // ms, raw elapsed
  accuracy: number;   // 0–100
  highestCombo: number;
  device: "mobile" | "desktop";
  difficulty: "easy" | "medium" | "hard";
}
```

---

## Key flows to design (for UI/UX AI prompt)

1. **Create screen flow** — player chooses Solo or Multi, sets their name and difficulty; gets the room link immediately with no start button.
2. **Pre-game state** — player is on the game screen, grid is visible but timer has not started; a pregame hint pulses to invite the first click; the first click starts the clock.
3. **Action toggle flow** — how the Inspect/Defuse button pair looks, feels, and transitions when toggled (mirroring Sudoku pencil/pen UX).
4. **Penalty feedback flow** — moment a wrong defuse or triggered bomb occurs: cell animation (red 💣 for bomb, revealed cell for safe), penalty toast (+5s or +10s), combo reset animation.
5. **Combo streak flow** — visual build-up of combo counter; reset animation on break.
6. **Shareable link** — discreet but accessible placement of the room link on the game screen (for when the player decides to invite someone mid-game).
7. **Result screen flow** — transition from last bomb resolved → stats summary with penalty breakdown → solo leaderboard → replay prompt.
8. **Replay flow** — player clicks "Play again" on the same link; grid and timer reset; smooth transition back to `created` state.
9. **Defuse constraint rejection** — visual/haptic feedback when a player tries to defuse a cell in a fully hidden area (no adjacent reveals).
10. **Onboarding** (optional for MVP) — first-time tooltip sequence: what Inspect does, what Defuse does, the pencil/pen mental model.
