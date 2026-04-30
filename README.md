# 💣 Minefield — Multiplayer

Two-player minesweeper in real time. Player 1 creates a room and shares the link. Player 2 clicks the link and joins instantly.

## How it works

- Players take turns revealing cells
- Finding a **bomb** scores **10 points** — and you play again
- Revealing a safe cell passes the turn to your opponent
- Most bombs wins

## Languages

| Code | Label |
|---|---|
| `pt-BR-x-CE` | Português (Ceará) — **default** |
| `pt-PT` | Português (Portugal) |
| `en` | English |

Language preference is saved in `localStorage` and persists between sessions.

## Stack

| Layer | Technology |
|---|---|
| Frontend | HTML + Vanilla JS (ES Modules) |
| Real-time backend | [PartyKit](https://partykit.io) |
| Frontend hosting | GitHub Pages |

---

## Prerequisites

- [Node.js](https://nodejs.org) v18+
- [GitHub](https://github.com) account
- [PartyKit](https://partykit.io) account (free, sign in with GitHub)

---

## Local setup

```bash
git clone https://github.com/SEU-USERNAME/minefield.git
cd minefield
npm install
```

---

## Local development

```bash
npm run dev
```

Open `http://localhost:1999`. To test with two players, open two tabs with different room hashes.

---

## Tests

```bash
npm test
```

Tests cover:

- Grid generation (bombs, neighbour counts)
- Flood fill (0-cell propagation, bomb boundary)
- Initial state creation
- Bomb counting
- Game-end detection
- Full turn flow (bomb found, safe cell, draw, winner)
- Player reconnection

---

## Deploy

### 1. Deploy the backend (PartyKit)

```bash
npx partykit login   # authenticates with GitHub
npm run deploy       # deploys the server
```

After deploy, the terminal shows your server URL:

```
https://minefield.SEU-USERNAME.partykit.dev
```

### 2. Update the frontend with your server URL

Open `public/index.html` and replace:

```js
const PARTYKIT_HOST = "minefield.SEU-USERNAME.partykit.dev";
```

### 3. Deploy the frontend (GitHub Pages)

1. Push the project to your GitHub repository
2. Go to **Settings → Pages**
3. Under **Source**, choose `Deploy from a branch`
4. Select branch `main` and folder `/public`
5. Click **Save**

Your game will be live at:

```
https://SEU-USERNAME.github.io/minefield
```

---

## Project structure

```
minefield/
├── public/
│   ├── index.html     # Full frontend (HTML + CSS + JS)
│   └── i18n.js        # All translations (pt-BR-x-CE, pt-PT, en)
├── src/
│   └── server.ts      # PartyKit server (room logic + state)
├── tests/
│   └── game-logic.test.ts  # Vitest tests
├── partykit.json
├── package.json
├── tsconfig.json
└── README.md
```

---

## Difficulty levels

| Level | Grid | Bombs |
|---|---|---|
| Easy / Molezinha / Fácil | 6 × 6 | 10 |
| Medium / Tá bom / Médio | 8 × 8 | 20 |
| Hard / Oxe, rapaiz! / Difícil | 10 × 10 | 30 |
