# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JS Tetris (HTML5 Canvas). No dependencies, no build, no tests, no linter. UI text and README are in Spanish.

## Run

Open `index.html` directly, or serve statically: `python3 -m http.server 8000` → http://localhost:8000.

## Architecture

Three files, all logic in `game.js` (single script, global state, no modules):

- `index.html` — fixed DOM ids that `game.js` looks up at load (`board`, `next-canvas`, `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`). Renaming ids breaks the game.
- `style.css` — layout/theme; overlay shown/hidden via `.hidden` class.
- `game.js` — game state lives in top-level `let` vars (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `animId`...), all reset in `init()`.

Key mechanics:
- Board is a 20×10 matrix of ints; 0 = empty, 1–8 = piece type indexing both `COLORS` and `PIECES` (piece shapes embed their own type number as cell value). Type 8 is the hollow 3×3 ring "challenge" piece, spawned with probability `RING_CHANCE` in `randomPiece()`.
- `requestAnimationFrame` `loop()` accumulates `dropAccum` and gravity-drops when it exceeds `dropInterval`; it also calls `draw()` each frame. Pause/game over `cancelAnimationFrame(animId)`; resume restarts `loop`.
- Lock flow: `lockPiece()` → `merge()` → `clearLines()` (updates score/level/`dropInterval`) → `spawn()` (game over if new piece collides).
- Skins: `SKINS` object (`retro`, `neon`, `pastel`, `pixel`), each with `colors[9]`, `grid`/`boardBg` (null = use theme CSS vars) and `drawBlock`. Global `drawBlock` delegates to `SKINS[skinName]`; `COLORS` is reassigned by `applySkin()`. `<select id="skin-select">` persists to `localStorage` `tetris.skin` (try/catch); canvas background via CSS var `--canvas-bg`.
- Rotation is clockwise-only with simple horizontal kicks `[0,-1,1,-2,2]` (not SRS). Pieces are picked with plain `Math.random` (no 7-bag).
- Scoring: `LINE_SCORES[n] * level`, +1 per soft-drop cell, +2 per hard-drop cell; level = `floor(lines/10)+1`; `dropInterval = max(100, 1000 - (level-1)*90)`.
- Input is a single `keydown` handler (arrows, X, Space, P); no key-repeat handling beyond the browser's.
