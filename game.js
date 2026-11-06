'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - azul pálido
  '#ffb74d', // L - orange
  '#d32f2f', // Anillo 3x3 hueco - rojo
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // Anillo 3x3 hueco (reto)
];

const LINE_SCORES = [0, 100, 300, 500, 800];
const RING_CHANCE = 0.08; // probabilidad de la pieza reto (~1 de cada 12)

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeBtn = document.getElementById('theme-toggle');
const newRecordMsg = document.getElementById('new-record-msg');
const nameForm = document.getElementById('name-form');
const nameInput = document.getElementById('name-input');
const recordsListEl = document.getElementById('records-list');
const recordsStatsEl = document.getElementById('records-stats');
const resetRecordsBtn = document.getElementById('reset-records-btn');

const RECORDS_KEY = 'tetris-records';
const MAX_RECORDS = 5;

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
const pauseMenu = document.getElementById('pause-menu');
const controlsView = document.getElementById('controls-view');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const controlsBtn = document.getElementById('controls-btn');
const controlsBackBtn = document.getElementById('controls-back-btn');
const levelDownBtn = document.getElementById('level-down');
const levelUpBtn = document.getElementById('level-up');
const startLevelEl = document.getElementById('start-level');

const MAX_START_LEVEL = 10;
let startLevel = 1; // persiste entre partidas; se aplica en init()

function calcDropInterval(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
}

let combo = 0, bestCombo = 0; // combo = piezas consecutivas que limpian líneas
let pendingRank = -1; // puesto del juego actual si aún no se guarda el nombre
let theme = 'dark';
let gridColor = '#22222e';

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.random() < RING_CHANCE ? 8 : Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    combo++;
    if (combo > bestCombo) bestCombo = combo;
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = startLevel + Math.floor(lines / 10);
    dropInterval = calcDropInterval(level);
    updateHUD();
  } else {
    combo = 0;
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

// ---- Records (localStorage) ----
function loadRecords() {
  const empty = { top: [], bestCombo: 0, maxLines: 0 };
  try {
    const data = JSON.parse(localStorage.getItem(RECORDS_KEY));
    if (!data || !Array.isArray(data.top)) return empty;
    return {
      top: data.top
        .filter(e => e && Number.isFinite(e.score))
        .slice(0, MAX_RECORDS),
      bestCombo: Number(data.bestCombo) || 0,
      maxLines: Number(data.maxLines) || 0,
    };
  } catch (e) {
    return empty;
  }
}

function saveRecords(rec) {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(rec));
  } catch (e) { /* almacenamiento no disponible: se ignora */ }
}

// Puesto (0-based) que ocuparía una puntuación; -1 si no entra al top
function rankFor(rec, s) {
  if (s <= 0) return -1;
  const rank = rec.top.filter(e => e.score >= s).length;
  return rank < MAX_RECORDS ? rank : -1;
}

function renderRecords(highlight, pendingScore) {
  const rec = loadRecords();
  const rows = rec.top.map(e => ({ name: String(e.name), score: e.score }));
  if (pendingScore !== undefined && highlight >= 0) {
    rows.splice(highlight, 0, { name: 'Tú', score: pendingScore });
  }
  recordsListEl.textContent = '';
  rows.slice(0, MAX_RECORDS).forEach((r, i) => {
    const li = document.createElement('li');
    if (i === highlight) li.className = 'highlight';
    const left = document.createElement('span');
    left.textContent = `${i + 1}. ${r.name}`;
    const right = document.createElement('span');
    right.textContent = r.score.toLocaleString();
    li.append(left, right);
    recordsListEl.appendChild(li);
  });
  if (!rows.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Sin records';
    recordsListEl.appendChild(li);
  }
  recordsStatsEl.textContent = `Mejor combo: ${rec.bestCombo} · Líneas máx: ${rec.maxLines}`;
}

function hideRecordForm() {
  nameForm.classList.add('hidden');
  newRecordMsg.classList.add('hidden');
}

function submitRecord() {
  if (pendingRank < 0) return;
  const rec = loadRecords();
  const name = nameInput.value.trim().slice(0, 12) || 'Anónimo';
  const rank = rankFor(rec, score);
  if (rank >= 0) {
    rec.top.splice(rank, 0, { name, score, lines });
    rec.top = rec.top.slice(0, MAX_RECORDS);
    saveRecords(rec);
  }
  pendingRank = -1;
  hideRecordForm();
  renderRecords(rank);
}

function showStart() {
  gameOver = true; // bloquea el input hasta pulsar Jugar
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'TETRIS';
  overlayScore.textContent = '';
  restartBtn.textContent = 'Jugar';
  hideRecordForm();
  renderRecords(-1);
  overlay.classList.remove('hidden');
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  // actualizar mejor combo y líneas máximas
  const rec = loadRecords();
  rec.bestCombo = Math.max(rec.bestCombo, bestCombo);
  rec.maxLines = Math.max(rec.maxLines, lines);
  saveRecords(rec);

  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  restartBtn.textContent = 'Reiniciar';
  pendingRank = rankFor(rec, score);
  if (pendingRank >= 0) {
    newRecordMsg.textContent = `¡Nuevo récord! Puesto #${pendingRank + 1}`;
    newRecordMsg.classList.remove('hidden');
    nameForm.classList.remove('hidden');
    renderRecords(pendingRank, score);
    nameInput.value = '';
    overlay.classList.remove('hidden');
    nameInput.focus();
  } else {
    hideRecordForm();
    renderRecords(-1);
    overlay.classList.remove('hidden');
  }
}

function showPauseMenu(show) {
  pauseMenu.classList.toggle('hidden', !show);
  controlsView.classList.add('hidden');
  restartBtn.classList.toggle('hidden', show);
  overlayScore.classList.toggle('hidden', show);
  document.getElementById('records').classList.toggle('hidden', show);
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    overlay.classList.add('hidden');
    showPauseMenu(false);
    lastTime = performance.now();
    overlay.classList.add('hidden');
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    startLevelEl.textContent = startLevel;
    showPauseMenu(true);
    overlay.classList.remove('hidden');
    resumeBtn.focus();
  }
}

function setStartLevel(n) {
  startLevel = Math.min(MAX_START_LEVEL, Math.max(1, n));
  startLevelEl.textContent = startLevel;
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  combo = 0;
  bestCombo = 0;
  pendingRank = -1;
  paused = false;
  gameOver = false;
  dropInterval = calcDropInterval(level);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  showPauseMenu(false);
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

resumeBtn.addEventListener('click', togglePause);
pauseRestartBtn.addEventListener('click', init);
controlsBtn.addEventListener('click', () => {
  pauseMenu.classList.add('hidden');
  controlsView.classList.remove('hidden');
  controlsBackBtn.focus();
});
controlsBackBtn.addEventListener('click', () => {
  controlsView.classList.add('hidden');
  pauseMenu.classList.remove('hidden');
  controlsBtn.focus();
});
levelDownBtn.addEventListener('click', () => setStartLevel(startLevel - 1));
levelUpBtn.addEventListener('click', () => setStartLevel(startLevel + 1));

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') { e.preventDefault(); togglePause(); return; }
  if (paused || gameOver) return; // inputs del juego bloqueados con el menú abierto
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);
nameForm.addEventListener('submit', e => { e.preventDefault(); submitRecord(); });
resetRecordsBtn.addEventListener('click', () => {
  if (!confirm('¿Borrar todos los records?')) return;
  try { localStorage.removeItem(RECORDS_KEY); } catch (e) { /* ignorar */ }
  renderRecords(pendingRank, pendingRank >= 0 ? score : undefined);
  resetRecordsBtn.blur();
});

function applyTheme(t) {
  theme = t;
  document.documentElement.dataset.theme = t;
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim();
  const light = t === 'light';
  themeBtn.textContent = light ? 'Modo oscuro' : 'Modo claro';
  themeBtn.setAttribute('aria-pressed', String(light));
  if (current) draw(); // repinta también en pausa / game over
}

themeBtn.addEventListener('click', () => {
  applyTheme(theme === 'dark' ? 'light' : 'dark');
  themeBtn.blur(); // evita que Espacio active el botón
});

applyTheme('dark');

init();
showStart();
