# Implementation Plan — Desarma / Desarme / Disarm (Multiplayer)

> Mode name placeholder: **Desarma** (PT-BR) · **Desarme** (PT-PT) · **Disarm** (EN). Final name TBD.
> CE dialect name: TBD.
>
> This document is an implementation plan for the multiplayer variant of Disarm mode.
> Its purpose is to serve as input for UI/UX flow design and prototype suggestions.
> Reference spec: [mvp-operation-defuse.md](./mvp-operation-defuse.md)
> Companion: [implementation-plan-defuse-solo.md](./implementation-plan-defuse-solo.md)

---

## Design principle

> Solo and multiplayer share the same room model, the same components, and the same core loop.
> The difference is a **choice made at the Create screen**, not a different product.
> Multi adds: squad name, energy system, player presence, and a separate ranking.

---

## Overview

Multiplayer Disarm is a cooperative, turn-free, real-time mode. The creator sets a squad name, gets a shareable link, and can start playing immediately — no start button, no minimum player count. Anyone who joins with the link plays on the same live grid. The room is **persistent**: the same link can be replayed any number of times.

Each player has their own energy pool. The team's result is ranked by real elapsed time under the squad name.

---

## Room model

```
Create → Room open → [first click starts timer] → playing → finished → [play again or leave]
```

- **No lobby, no start button, no minimum player count.** The room is open the moment it is created.
- The creator gets the room link immediately, shown in a discreet but accessible spot on the game screen.
- The timer starts on the **first cell click by any player** in the room.
- Players can join at any time — before the first click or after the timer has already started. **No penalty for joining late.**
- The room never expires. The same link can be replayed infinitely. Each replay resets the grid and timer.

---

## Squad name

- The creator sets the **squad name** on the Create screen.
- Default value: the creator's own player name (pre-filled, editable before and after sharing).
- The squad name appears in the multiplayer ranking and on the result screen.
- If the creator plays alone without sharing the link, the result is submitted under the squad name to the **multiplayer ranking** (not solo) — because Multi was explicitly chosen at Create.

---

## Game states

```
created → playing → finished
```

- `created`: room open, grid ready; any number of players may already be present; timer not yet started
- `playing`: first cell click by any player has occurred; timer running; new players can still join
- `finished`: all bombs resolved; result shown to all present players; room immediately available for replay

---

## Player categories

The player category for ranking purposes is determined by the **number of effective players** at the end of the match, not at room creation.

```
Duo:           2 effective players  → 16×16 grid
3–5 players:   3–5 effective        → 20×20 grid
6–10 players:  6–10 effective       → 30×30 grid
11+ players:   11+ effective        → 40×40 grid
```

Effective player = at least 5–10 actions during the match.

Grid size is locked at the **first click** based on how many players are present at that moment. Late joiners play on the same grid; they do not resize it.

---

## Actions

Each player independently selects their active action. Actions are personal — switching your mode does not affect other players.

```
🔎 Inspect   — uncovers a cell on the shared grid
🛠️ Defuse    — attempts to defuse a bomb on a hidden cell
```

### Action selector — Sudoku pencil/pen analogy

The action toggle must feel identical to how Sudoku apps switch between **pencil (draft)** and **pen (final answer)** mode:

- The selected action is a **persistent mode per player**, not a hold-to-activate gesture.
- Switching between modes is fast, lightweight, and always visible to that player.
- The active action is clearly highlighted in the local HUD at all times.
- Tapping/clicking a cell always executes the **currently selected action** for that player.
- In Sudoku terms:
  - 🔎 Inspect = pencil/draft → "I'm exploring, gathering information"
  - 🛠️ Defuse = pen/final → "I'm committing to this cell being a bomb"

Other players on the grid each have their own mode states; their cursor/highlight on the grid can optionally show their current action to teammates (awareness feature).

#### Toggle interactions

| Platform | Toggle action          |
|----------|------------------------|
| Desktop  | Press `Space`          |
| Desktop  | Click the inactive button in the action bar |
| Mobile   | Tap the inactive button in the action bar   |
| Mobile   | (optional) long press on cell = alternate action |

---

## Energy system

Each player has their own energy pool, independent of teammates.

```
Max energy:      10
Starting energy: 10
Regeneration:    +1 every 3 seconds (per player)
```

### Energy costs and penalties

| Action                  | Energy change | Other effects                        |
|-------------------------|---------------|--------------------------------------|
| Inspect safe cell       | −1            | —                                    |
| Correct defuse          | 0             | +1 combo                             |
| Wrong defuse            | −4            | combo reset, safe cell revealed      |
| Inspect bomb (trigger)  | −5            | combo reset, bomb counts as exploded |
| Energy reaches 0        | —             | exhaustion: 4s lockout               |

### Exhaustion state

When a player's energy hits 0:
- They enter **exhaustion** for 4 seconds.
- During exhaustion they cannot Inspect or Defuse.
- The grid cells appear dimmed/locked from their perspective.
- Other players are unaffected.
- Energy regeneration continues during exhaustion (so they rejoin at ~1–2 energy).

---

## Combo

Each player has their own combo counter, independent of teammates.

| Event            | Combo effect       |
|------------------|--------------------|
| Correct defuse   | +1 combo           |
| Wrong defuse     | reset to 0         |
| Triggered bomb   | reset to 0         |

### Combo energy rewards (multiplayer only)

When a player's combo reaches a milestone, they receive bonus energy:

```
combo 3:  +1 energy
combo 6:  +1 energy
combo 10: +2 energy
```

Milestones trigger once per threshold crossing (not repeatedly at the same combo value).

---

## Sectors

The shared grid is divided into sectors to focus collaboration.

Example — 20×20 grid → 16 sectors of 5×5:

```
[A1] [A2] [A3] [A4]
[B1] [B2] [B3] [B4]
[C1] [C2] [C3] [C4]
[D1] [D2] [D3] [D4]
```

Each sector shows live progress (bombs resolved / total bombs in sector).

### Cleared sector

When all bombs in a sector are resolved:
- Sector receives a visual highlight (cleared state).
- Players currently active in that sector receive a brief celebration feedback.
- Those players gain **+2 energy** as a sector-clear bonus.

This creates natural team mini-objectives.

---

## Defuse constraint

Same as solo:

```
A Defuse action is only allowed on a hidden cell that is adjacent
to at least one already-revealed cell.
```

If a player tries to defuse in a fully hidden area, the action is rejected with a brief visual/haptic cue. No energy loss, no penalty.

---

## Per-player action cooldown

To prevent spam:

```
Minimum cooldown between actions per player: 250ms–400ms
```

The cooldown is per-player, not global. Other players are unaffected.

---

## HUD layout

The HUD has two layers: **shared (team)** info at the top and **personal** info at the bottom.

```
┌──────────────────────────────────────────┐
│  Operation Defuse              ⚙️        │
│                                          │
│  ⏱ 02:14   💣 37   🧹 6/16   👥 8   │
│   (time)  (left) (sectors) (players)   │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │                                  │   │
│  │           SHARED GRID            │   │
│  │            20 × 20               │   │
│  │  (other players visible as       │   │
│  │   colored cursors/highlights)    │   │
│  │                                  │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ─────────── Your status ─────────────  │
│  ⚡ ⚡ ⚡ ⚡ ⚡ ⚡ ⚡ ⚡ · ·   🔥 4     │
│       (energy bar)              (combo) │
│                                          │
│   ┌─────────┐  ┌─────────┐             │
│   │🔎Inspect│  │🛠️ Defuse│             │
│   └─────────┘  └─────────┘             │
│         (active = highlighted)          │
└──────────────────────────────────────────┘
```

Key HUD elements:
- **Shared timer**: counts up from 00:00, starts on first player interaction
- **Shared bomb counter**: remaining bombs (`totalBombs − resolved`)
- **Shared sector progress**: `cleared sectors / total sectors`
- **Active player count**: how many players are currently connected and playing
- **Personal energy bar**: current energy, clearly shows exhaustion state
- **Personal combo**: current streak
- **Personal action bar**: always visible, active action clearly highlighted

---

## Player presence on grid

Other players' activity should be visible to foster coordination:

- Each player has a distinct color.
- When a player interacts with a cell, their color briefly highlights that cell.
- Optional: player avatar/cursor visible near their last-interacted cell.
- Exhausted players' cursors appear greyed out.

This is awareness-only — it does not affect game logic.

---

## Result screen

Shown to all players when `bombs resolved === totalBombs`.

```
┌────────────────────────────────────────────┐
│     Operation Defuse — Medium — 3–5 players│
│                                            │
│  ⏱ Real time:         04:12               │
│                                            │
│  ✅ Bombs defused:    76                   │
│  💣 Bombs triggered:  4                    │
│  🎯 Team accuracy:    95%                  │
│  🧹 Sectors cleared:  16/16                │
│  👥 Effective players: 5                   │
│  📱 Device:           🔀 Mixed             │
│                                            │
│  ── Individual highlights ──               │
│  🔥 Highest combo:  PlayerA (9)            │
│  ⚡ Most efficient: PlayerB (0 mistakes)   │
│  🧹 Sector MVP:     PlayerC (closed A1+B2) │
│                                            │
│  [ Play again ]  [ Leaderboard ]           │
└────────────────────────────────────────────┘
```

---

## Difficulty configs (multiplayer)

| Difficulty | Grid    | Density | Notes                        |
|------------|---------|---------|------------------------------|
| Easy       | varies  | 16%     | Forgiving, good for learning |
| Medium     | varies  | 20%     | Default MVP density          |
| Hard       | varies  | 22%     | Challenging coordination     |

Grid size is determined by player count category, not difficulty.

---

## Leaderboard

Multiplayer leaderboard ranks by **real elapsed time** (lower = better).

Category key format:

```
operation-defuse:{playerCategory}:{difficulty}
```

Examples:
```
operation-defuse:duo:medium
operation-defuse:3-5:hard
operation-defuse:6-10:easy
```

Entry fields (extends `RankingEntry`):
```typescript
{
  teamName: string;         // team or room name
  realTime: number;         // ms, raw elapsed (no penalties added)
  accuracy: number;         // 0–100, team-wide
  highestCombo: number;     // best individual combo in the match
  sectorsCleared: number;   // out of total sectors
  effectivePlayers: number; // players with ≥ 5–10 actions
  deviceBadge: "mobile" | "desktop" | "mixed";
  playerCategory: "duo" | "3-5" | "6-10" | "11plus";
  difficulty: "easy" | "medium" | "hard";
}
```

### Device badge logic

```
"mobile"  → all effective players were on mobile
"desktop" → all effective players were on desktop
"mixed"   → mix of mobile and desktop effective players
```

Effective player threshold (MVP suggestion): **≥ 5 actions** during the match.

---

## Key flows to design (for UI/UX AI prompt)

1. **Create screen flow** — player chooses Multi, sets squad name (pre-filled with their own name, editable), sets difficulty; gets room link immediately with no start button.
2. **Pre-game state** — one or more players present, grid visible, timer not started; player list/avatars visible; subtle cue that the first click starts the clock for everyone.
3. **Late join flow** — a new player joins via link while the timer is already running; they land on the live grid mid-match with no penalty or interruption to others.
4. **Action toggle flow** — each player's local Inspect/Defuse bar; transitions (Sudoku pencil/pen UX); optional teammate awareness (seeing which action others currently have selected).
5. **Energy feedback flow** — energy drain animation per action; exhaustion state onset (dim, lock, countdown); recovery; energy bonus popup from combo milestones.
6. **Combo milestone flow** — visual/haptic reward when combo 3 / 6 / 10 is reached and energy is granted.
7. **Sector cleared flow** — sector highlight when fully resolved; energy bonus notification for active players in that sector.
8. **Player mistake flow** — wrong defuse or triggered bomb: cell animation (teal 💣 for correct defuse, red 💣 for triggered), energy drain indicator, combo reset; the board shakes briefly in coop and explosive modes (not in versus); other players see the event without being distracted.
9. **Player exhaustion flow** — exhausted player's HUD dims and locks, countdown to recovery visible; other players see the player greyed out in the presence indicator.
10. **Coordination awareness flow** — how other players' cursors and last-action indicators appear on the shared grid without cluttering it.
11. **Result screen flow** — transition from last bomb resolved → team stats → individual highlights (highest combo, most efficient, sector MVP) → multiplayer leaderboard → replay prompt.
12. **Replay flow** — "Play again" resets grid and timer on the same link; all players currently in the room restart together seamlessly.
13. **Shareable link** — discreet but accessible placement on the game screen so the creator can invite people at any point.
14. **Defuse constraint rejection** — visual/haptic feedback when a player tries to defuse in a fully hidden area (no adjacent reveals).
