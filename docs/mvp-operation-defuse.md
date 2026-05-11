# MVP — Operation Defuse Mode

## Concept

**Operation Defuse** is a turn-free, solo or multiplayer mode where the goal is to resolve all bombs on the grid in the shortest time possible.

The match is a race against the clock. Players must inspect safe cells to gather information, deduce where the bombs are, and use the defuse action correctly.

## Golden rules

- The active player always contributes.
- The random player quickly self-punishes.
- The skilled player accelerates the team.
- Desktop may be more comfortable, but must not be mechanically more powerful.
- Mobile and desktop share the same core control logic.

---

# Objective

## Primary objective

Defuse or resolve all bombs on the grid in the shortest time possible.

```text
Bombs resolved: 0/80
Time: 00:00
```

The match ends when all bombs have been resolved.

A bomb can be resolved in two ways:

```text
1. Correct defuse
2. Explosion by mistake
```

Defusing correctly is ideal. Triggering a bomb still counts as resolved, but breaks the combo and applies a penalty.

---

# Actions

The player chooses their current action:

```text
🔎 Inspect
🛠️ Defuse
```

## 🔎 Inspect

Used to uncover information on the grid.

If the cell is a safe cell (`grid[r][c] >= 0`):

```text
- reveals a number or leaves the cell blank if it has no bomb neighbors
- in multiplayer: costs energy
- in solo: no energy system
```

If the cell is a bomb (`grid[r][c] === -1`):

```text
- bomb explodes
- bomb counts as resolved by explosion
- breaks combo
- applies mode penalty
```

## 🛠️ Defuse

Used when the player believes an unrevealed cell (`revealed[r][c] === false`) is a bomb.

If it is a bomb (`grid[r][c] === -1`):

```text
- bomb is defused
- bomb counts as correctly resolved
- increments combo
```

If it is not a bomb:

```text
- wrong defuse
- safe cell is revealed (blank if no bomb neighbors, number otherwise)
- breaks combo
- applies mode penalty (higher than Inspect mistake)
```

---

# No traditional flag

This mode has no flag action (`type: "flag"` is not used).

```text
Not present:
- placing a flag
- confirming a flag
- flag counter
```

The player does not mark bombs. They choose between:

```text
🔎 Reveal — to gather information
🛠️ Defuse — when confident about a bomb
```

---

# Controls

## Primary control

Controls must be equivalent on desktop and mobile:

```text
[🔎 Inspect] [🛠️ Defuse]

tap / click = executes the selected action
```

## Desktop

```text
left click    = selected action
Space key     = toggle between 🔎 and 🛠️
right click   = optional alternate action
```

## Mobile

```text
tap           = selected action
fixed button  = toggle between 🔎 and 🛠️
long press    = optional alternate action
```

The alternate action may exist but must not be required to play well.

The primary competitive flow should work as:

```text
choose action → tap / click cell
```

---

# Solo

In solo, there is no energy system.

The focus is:

```text
time + accuracy
```

## Solo penalties

Inspecting a bomb (triggered explosion):

```text
+5s added to final time
breaks combo
bomb counts as resolved by explosion
```

Wrong defuse (Defuse on a safe cell):

```text
+10s added to final time
breaks combo
safe cell is revealed
```

Rationale: Inspect is an exploratory action — a lighter penalty. Defuse is a confident commitment — a higher penalty for being wrong.

## Solo leaderboard

The leaderboard ranks by:

```text
final time = real time + accumulated penalties
```

Example:

```text
Real time:       03:20
Bombs triggered: 2 × 5s  = +10s  (Inspect mistakes)
Wrong defuses:   1 × 10s = +10s  (Defuse mistakes)

Final time:      03:40
```

---

# Multiplayer

In multiplayer, each player has an energy pool.

Energy prevents chaos, spam, and random clicking.

## Energy

```text
Max energy:      10
Starting energy: 10
Regeneration:    +1 every 3 seconds
```

## Costs and penalties

Inspect safe cell:

```text
-1 energy
```

Correct defuse:

```text
0 energy
+1 combo
```

Wrong defuse:

```text
-4 energy
breaks combo
safe cell is revealed
```

Trigger a bomb:

```text
-5 energy
breaks combo
bomb counts as resolved by explosion
```

Energy at zero:

```text
Energy = 0:
player enters exhaustion for 4 seconds
cannot inspect or defuse
```

## Time penalty in multiplayer

In the MVP, multiplayer does not add time penalties for mistakes.

Initial punishment is limited to:

```text
- energy loss
- combo break
- exhaustion
```

This prevents a careless or troll player from destroying the team's time.

---

# Combo

The combo rewards correct plays.

## Combo increment

```text
correct defuse: +1 combo
```

Optionally, revealing a safe cell could also increment the combo, but for the MVP keep it simple:

```text
combo only from correct defuses
```

## Combo break

```text
wrong defuse
triggered bomb
```

## Combo rewards

In multiplayer:

```text
combo 3:  +1 energy
combo 6:  +1 energy
combo 10: +2 energy
```

In solo:

```text
combo appears as visual feedback only
no effect on time in MVP
```

---

# Grid

The grid (`grid: number[][]`) must be larger than existing modes, since multiple players act simultaneously.

Suggested sizes:

```text
Solo:          12×12
Duo:           16×16
3–5 players:   20×20
6–10 players:  30×30
11+ players:   40×40 or dynamic sector-based grid
```

## Bomb density

Starting point (aligned with `DifficultyConfig`):

```text
Easy   (easy):   16%
Medium (medium): 20%
Hard   (hard):   22%
```

For the MVP, start with a fixed density:

```text
20%
```

---

# Sectors

The grid is divided into sectors to organize collaboration.

Example — 20×20 grid with 5×5 sectors:

```text
[A1] [A2] [A3] [A4]
[B1] [B2] [B3] [B4]
[C1] [C2] [C3] [C4]
[D1] [D2] [D3] [D4]
```

Each sector displays progress.

Example:

```text
A1 — 4/5 bombs resolved
A2 — needs investigation
B3 — many mistakes
C4 — cleared
```

## Cleared sector

When all bombs in a sector are resolved:

```text
- sector gets a visual highlight
- players active in that sector receive feedback
- in multiplayer, active players in that sector may gain +2 energy
```

This creates mini-objectives:

```text
"Close out A1!"
"2 bombs left in B3!"
"Someone help in C2!"
```

---

# Leaderboard

Aligned with `RankingEntry` (`name`, `points`, `wins`). This mode extends the concept with `finalTime` (solo) or `realTime` (multiplayer).

## General leaderboard

The main leaderboard is unified but displays a device badge.

Example:

```text
🏆 Operation Defuse — 3–5 players

#1  03:42  The Squad        📱 Mobile
#2  03:51  Sweepers         🖥️ Desktop
#3  04:05  Mine Crew        🔀 Mixed
```

## Device badges

```text
📱 Mobile:   all effective players were on mobile
🖥️ Desktop:  all effective players were on desktop
🔀 Mixed:    mix of mobile and desktop players
```

## Effective player

A player only counts toward device category if they had minimum participation.

Suggestion:

```text
effective player = at least 5–10 actions taken during the match
```

This prevents a player who joined and immediately left from affecting the ranking category.

## Leaderboard categories

Separated by player count:

```text
Solo
Duo
3–5 players
6–10 players
11+ players
```

And by difficulty:

```text
Easy
Medium
Hard
```

Example keys:

```text
Operation Defuse — Easy — Solo
Operation Defuse — Medium — 3–5 players
Operation Defuse — Hard — 6–10 players
```

---

# Match statistics

Beyond time, show:

```text
Time
Effective players
Device badge
Bombs correctly defused
Bombs triggered
Accuracy
Highest combo
Sectors cleared
```

Example:

```text
Time:               04:12
Effective players:  6
Device:             🔀 Mixed
Bombs defused:      68
Bombs triggered:    4
Accuracy:           94%
Highest combo:      11
Sectors cleared:    16/16
```

---

# Main UI

## Suggested HUD

```text
Operation Defuse

Time:             02:14
Bombs:            37/80
Sectors cleared:  6/16
Active players:   8

Current action: 🔎 Inspect

[🔎 Inspect] [🛠️ Defuse]

Energy: ⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡
```

In solo, hide energy:

```text
Time:           01:32
Bombs left:     13
Combo:          4
Current action: 🛠️ Defuse
```

---

# Cell states

Aligned with the existing `grid` and `revealed` model:

```text
grid[r][c] = -1, revealed = false  →  # (hidden cell)
grid[r][c] = 0,  revealed = true   →    (blank — no bomb neighbors)
grid[r][c] = 1–8, revealed = true  →  number revealed
grid[r][c] = -1, exploded          →  💣 (triggered bomb)
grid[r][c] = -1, defused           →  ✅ (defused bomb)
```

Empty cells (value 0) display as truly blank — no dot, no character.

Visual example:

```text
#  #  #  #  #
1  2  #  #  #
   1  #  ✅ #
   1  2  2  #
         1  💣 #
```

---

# Anti-random rules

## Multiplayer

```text
- energy limits spam
- mistakes drain significant energy
- energy at 0 causes exhaustion
- minimum per-player action cooldown
```

Suggestion:

```text
cooldown per player: 250ms–400ms
```

## Defuse constraint

Recommended rule:

```text
A player may only defuse an unrevealed cell (revealed[r][c] === false)
that is adjacent to at least one revealed cell (revealed[nr][nc] === true).
```

This forces players to generate information before defusing.

Prevents:

```text
players defusing blindly at random
```

---

# Solo vs. Multiplayer differences

## Solo

```text
no energy system
mistakes add seconds to final time
leaderboard ranked by final time
more arcade feel
```

## Multiplayer

```text
energy system active
mistakes drain energy
leaderboard ranked by real time
match stats show accuracy
more collaborative
```

---

# Solo match example

## Configuration

```text
Mode:       Operation Defuse — Solo
Difficulty: Easy
Grid:       12×12
Bombs:      25 (totalBombs = 25)
Energy:     disabled
```

## During the match

```text
00:00 — player starts inspecting safe cells
00:18 — first numbers hint at possible bombs
00:35 — first correct defuse
01:10 — wrong defuse, +10s
01:42 — bomb triggered while inspecting, +5s
02:50 — last bombs deduced
03:12 — last bomb resolved
```

## Result

```text
Real time:       03:12
Bombs triggered: 1 × 5s  = +5s   (Inspect mistake)
Wrong defuses:   1 × 10s = +10s  (Defuse mistake)

Final time:      03:27

Bombs defused:   24
Bombs triggered: 1
Accuracy:        96%
Device:          📱 Mobile
```

---

# Multiplayer match example

## Configuration

```text
Mode:       Operation Defuse
Category:   3–5 players
Difficulty: Medium
Grid:       20×20
Bombs:      80 (totalBombs = 80)
Energy:     enabled
Sectors:    4×4 sectors of 5×5
```

## Initial HUD

```text
Time:             00:00
Bombs resolved:   0/80
Sectors cleared:  0/16
Active players:   5
Device:           🔀 Mixed

Individual energy: 10/10
Current action:    🔎 Inspect
```

## During the match

```text
00:00 — timer starts on first inspect
00:20 — players spread across A1, A2, B1, and C3
00:55 — A1 shows 4/5 bombs resolved
01:10 — first sector cleared
01:35 — player makes wrong defuse in B2, loses 4 energy
02:00 — combo 6 by one player generates +1 energy
02:40 — C3 accumulates mistakes, players shift to help
03:30 — 9 bombs remaining
04:12 — last bomb resolved
```

## Result

```text
Final time:        04:12

Effective players: 5
Device:            🔀 Mixed
Bombs defused:     76
Bombs triggered:   4
Accuracy:          95%
Highest combo:     9
Sectors cleared:   16/16
```

## Leaderboard

```text
🏆 Operation Defuse — Medium — 3–5 players

#1  03:58  The Sweepers     🖥️ Desktop
#2  04:12  Mine Crew        🔀 Mixed
#3  04:40  United Bombers   📱 Mobile
```

---

# MVP summary

```text
Mode:
  Operation Defuse
  GameMode: "defuse"

Objective:
  Resolve all bombs in the shortest time.

Actions:
  🔎 Reveal   (ClientMessage type: "reveal")
  🛠️ Defuse   (ClientMessage type: "defuse" — new)

Not present:
  turns
  flag action (type: "flag" not used)

Solo:
  no energy
  mistakes add seconds to final time

Multiplayer:
  max energy: 10
  regen: +1 every 3s
  mistakes drain energy
  no time penalty in MVP

Grid:
  larger than existing CONFIGS / COOP_CONFIGS
  divided into sectors
  starting density: ~20%

Leaderboard (extends RankingEntry):
  solo: ranked by final time
  multiplayer: ranked by real time
  separated by solo / duo / 3–5 / 6–10 / 11+
  with device badge: 📱 / 🖥️ / 🔀

Golden rules:
  active player contributes
  random player self-punishes
  skilled player accelerates the team
```
