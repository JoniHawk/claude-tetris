# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JS Tetris (HTML5 Canvas). No dependencies, no build, no tests, no linter. UI text and README are in Spanish.

## Run

Open `index.html` directly, or serve statically: `python3 -m http.server 8000` → http://localhost:8000.

## Architecture

Three files, all logic in `game.js` (single script, global state, no modules):

- `index.html` — fixed DOM ids that `game.js` looks up at load (`board`, `next-canvas`, `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`, plus records UI: `start-screen`, `start-btn`, `start-records`, `start-stats`, `over-records`, `over-stats`, `new-record`, `name-input`, class `.reset-records-btn`). Renaming ids breaks the game.
- `style.css` — layout/theme; overlay shown/hidden via `.hidden` class.
- `game.js` — game state lives in top-level `let` vars (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `animId`...), all reset in `init()`.

Key mechanics:
- Board is a 20×10 matrix of ints; 0 = empty, 1–8 = piece type indexing both `COLORS` and `PIECES` (piece shapes embed their own type number as cell value). Type 8 is the hollow 3×3 ring "challenge" piece, spawned with probability `RING_CHANCE` in `randomPiece()`.
- `requestAnimationFrame` `loop()` accumulates `dropAccum` and gravity-drops when it exceeds `dropInterval`; it also calls `draw()` each frame. Pause/game over `cancelAnimationFrame(animId)`; resume restarts `loop`.
- Lock flow: `lockPiece()` → `merge()` → `clearLines()` (updates score/level/`dropInterval`) → `spawn()` (game over if new piece collides).
- Rotation is clockwise-only with simple horizontal kicks `[0,-1,1,-2,2]` (not SRS). Pieces are picked with plain `Math.random` (no 7-bag).
- Scoring: `LINE_SCORES[n] * level`, +1 per soft-drop cell, +2 per hard-drop cell; level = `floor(lines/10)+1`; `dropInterval = max(100, 1000 - (level-1)*90)`.
- Start screen (`#start-screen` overlay) shows on load; `init()` runs only on "Jugar"/"Reiniciar". Records in `localStorage` key `tetris.records` = `{top:[{name,score,lines,level,date}] (max 5, desc), bestCombo, maxLines}`; read/write wrapped in try/catch (invalid JSON → empty). `combo` = consecutive locks that clear lines (reset on a non-clearing lock); `endGame()` updates bestCombo/maxLines, and if score qualifies it is saved at once as "Jugador" and the name input appears (`pendingIdx`; `commitRecord()` renames on Enter or Reiniciar). Names rendered via `textContent` only. Keydown ignored while the name input is focused or the start screen is visible.
- Input is a single `keydown` handler (arrows, X, Space, P); no key-repeat handling beyond the browser's.
