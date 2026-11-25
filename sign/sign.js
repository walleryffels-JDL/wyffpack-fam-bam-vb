// A roadside marquee sign: a lit arrow on top and slide-in letters below.
// What it says comes from sign/messages.json, which is re-checked every minute.

const COLS = 20;
const ROWS = 4;
const POLL_SECONDS = 60;

const tracksEl = document.getElementById('tracks');
const signEl = document.getElementById('sign');
const bulbsEl = document.getElementById('bulbs');
const snowEl = document.getElementById('snow');

// --- Arrow bulbs ----------------------------------------------------------

const SVG_NS = 'http://www.w3.org/2000/svg';

// Globe bulbs in order: down the middle of the rail from the far end toward
// the arrow, then around the arrowhead (top, tip, bottom).
const BULBS = [
  [835, 132], [675, 132], [515, 132], [355, 132], [200, 132],
  [84, 52], [10, 132], [84, 212]
];

function buildBulbs() {
  BULBS.forEach(([x, y], i) => {
    const g = document.createElementNS(SVG_NS, 'g');
    // Colors only show with the Christmas theme: red, white, green, repeating
    g.setAttribute('class', `bulb phase-${i % 3} tint-${['red', 'white', 'green'][i % 3]}`);
    // Each globe sits in a dark socket ring on the face of the arrow; the lit
    // glass fades in over the unlit glass when the bulb is on
    g.innerHTML = `<circle class="bulb-halo" cx="${x}" cy="${y}" r="44"/>`
      + `<circle class="bulb-socket" cx="${x}" cy="${y}" r="21"/>`
      + `<circle class="bulb-glass" cx="${x}" cy="${y}" r="17"/>`
      + `<circle class="bulb-lit" cx="${x}" cy="${y}" r="17"/>`;
    bulbsEl.appendChild(g);
  });
}

function setLights(mode = 'blink') {
  const modes = ['chase', 'blink', 'on', 'off'];
  signEl.classList.remove(...modes.map(m => `lights-${m}`));
  signEl.classList.add(`lights-${modes.includes(mode) ? mode : 'blink'}`);
}

function setArrowDirection(direction = 'right') {
  signEl.classList.toggle('right', direction !== 'left');
}

// --- Themes ---------------------------------------------------------------

let snow = null;

function setTheme(theme) {
  const christmas = theme === 'christmas';
  document.body.classList.toggle('theme-christmas', christmas);
  if (christmas && !snow) snow = startSnow();
  if (!christmas && snow) { snow.stop(); snow = null; }
}

/** Light snowfall drawn on a canvas behind the sign. */
function startSnow() {
  const ctx = snowEl.getContext('2d');
  let flakes = [];
  let running = true;

  function resize() {
    snowEl.width = innerWidth;
    snowEl.height = innerHeight;
    const count = Math.round(innerWidth / 18);
    flakes = Array.from({ length: count }, () => ({
      x: Math.random() * innerWidth,
      y: Math.random() * innerHeight,
      r: 1 + Math.random() * 2.6,
      speed: 0.4 + Math.random() * 0.9,
      drift: Math.random() * Math.PI * 2
    }));
  }

  function frame() {
    if (!running) return;
    ctx.clearRect(0, 0, snowEl.width, snowEl.height);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    for (const f of flakes) {
      f.y += f.speed;
      f.drift += 0.01;
      f.x += Math.sin(f.drift) * 0.35;
      if (f.y > snowEl.height + 5) { f.y = -5; f.x = Math.random() * snowEl.width; }
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(frame);
  }

  resize();
  addEventListener('resize', resize);
  requestAnimationFrame(frame);
  return {
    stop() {
      running = false;
      removeEventListener('resize', resize);
      ctx.clearRect(0, 0, snowEl.width, snowEl.height);
    }
  };
}

// --- Letters ---------------------------------------------------------------

const slots = [];

// Small, fixed wobble per slot so the letters look hand-placed
function wobble(r, c) {
  const n = Math.sin(r * 127.1 + c * 311.7) * 43758.5453;
  const f = n - Math.floor(n);
  const g = (Math.sin(r * 269.5 + c * 183.3) * 43758.5453) % 1;
  return { tilt: (f - 0.5) * 2, nudge: g * 0.03 };
}

function buildTracks() {
  for (let r = 0; r < ROWS; r++) {
    const line = document.createElement('div');
    line.className = 'track-line';
    // Between rows, plus one under the last row
    line.style.top = `calc(var(--pad-y) + ${r + 1} * var(--row-h) + ${r} * var(--row-gap) + var(--row-gap) / 2 - 0.12 * var(--u))`;
    tracksEl.appendChild(line);
  }
  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      const letter = document.createElement('span');
      letter.className = 'letter';
      const { tilt, nudge } = wobble(r, c);
      letter.style.setProperty('--tilt', `${tilt.toFixed(2)}deg`);
      letter.style.setProperty('--nudge', `${nudge.toFixed(2)}em`);
      slot.appendChild(letter);
      tracksEl.appendChild(slot);
      row.push({ el: letter, ch: ' ', color: 'black' });
    }
    slots.push(row);
  }
}

const BLANK = { ch: ' ', color: 'black' };

/**
 * Turn a line into [{ ch, color }]. {black}, {red} and {green} switch the
 * color of the letters that follow; {candy} alternates red and green.
 */
function lineToCells(line, state) {
  const cells = [];
  const re = /\{(black|red|green|candy)\}|([\s\S])/gi;
  let m;
  while ((m = re.exec(line))) {
    if (m[1]) {
      state.color = m[1].toLowerCase();
      continue;
    }
    const ch = m[2].toUpperCase();
    let color = state.color;
    if (color === 'candy') {
      color = ch === ' ' ? 'black' : (state.candyIndex++ % 2 ? 'green' : 'red');
    }
    cells.push({ ch, color });
  }
  return cells;
}

function wrap(cells) {
  const words = [];
  let word = [];
  for (const cell of cells) {
    if (cell.ch === ' ') {
      if (word.length) words.push(word);
      word = [];
    } else {
      word.push(cell);
    }
  }
  if (word.length) words.push(word);

  // Keep a dash with the word after it, so "- DAD" never splits
  for (let i = words.length - 2; i >= 0; i--) {
    if (words[i].length === 1 && words[i][0].ch === '-') {
      words.splice(i, 2, [...words[i], BLANK, ...words[i + 1]]);
    }
  }

  const rows = [];
  let row = [];
  for (let w of words) {
    while (w.length > COLS) {
      if (row.length) { rows.push(row); row = []; }
      rows.push(w.slice(0, COLS));
      w = w.slice(COLS);
    }
    if (row.length && row.length + 1 + w.length > COLS) {
      rows.push(row);
      row = [];
    }
    row = row.length ? [...row, BLANK, ...w] : [...w];
  }
  if (row.length || !rows.length) rows.push(row);
  return rows;
}

/** message: "text" | ["line", ...] | { text } | { lines: [...] } */
function messageToGrid(message) {
  const msg = typeof message === 'object' && !Array.isArray(message) ? message : { text: message };
  const lines = Array.isArray(msg.lines) ? msg.lines
    : Array.isArray(msg.text) ? msg.text
    : String(msg.text ?? '').split('\n');

  const state = { color: 'black', candyIndex: 0 };
  let rows = lines.flatMap(line => wrap(lineToCells(String(line), state)));
  while (rows.length && !rows[0].length) rows.shift();
  while (rows.length && !rows[rows.length - 1].length) rows.pop();
  rows = rows.slice(0, ROWS);

  const grid = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => BLANK));
  const top = Math.floor((ROWS - rows.length) / 2);
  rows.forEach((row, i) => {
    const left = Math.floor((COLS - row.length) / 2);
    row.forEach((cell, j) => { grid[top + i][left + j] = cell; });
  });
  return grid;
}

function setLetter(el, cell) {
  el.textContent = cell.ch === ' ' ? '' : cell.ch;
  el.classList.toggle('red', cell.color === 'red');
  el.classList.toggle('green', cell.color === 'green');
}

/** Pull the old letters off, then slide the new ones in, left to right. */
function showGrid(grid, animate = true) {
  let changedIndex = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const slot = slots[r][c];
      const next = grid[r][c];
      if (slot.ch === next.ch && slot.color === next.color) continue;

      slot.ch = next.ch;
      slot.color = next.color;
      const el = slot.el;

      if (!animate) {
        setLetter(el, next);
        continue;
      }

      const outDelay = (r * 60 + c * 18);
      const inDelay = 900 + changedIndex * 55;
      changedIndex++;

      setTimeout(() => el.classList.add('out'), outDelay);
      setTimeout(() => {
        setLetter(el, next);
        el.classList.remove('out');
        el.classList.add('enter');
        el.getBoundingClientRect(); // start the slide from the 'enter' position
        el.classList.remove('enter');
      }, Math.max(inDelay, outDelay + 450));
    }
  }
}

// --- Loading messages.json -----------------------------------------------

let lastJson = null;
let firstShow = true;

async function load() {
  try {
    const res = await fetch(`messages.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (text === lastJson) return;
    lastJson = text;

    const data = JSON.parse(text);
    setTheme(data.theme);
    setLights(data.lights);
    setArrowDirection(data.arrow);
    showGrid(messageToGrid(data.message ?? ''), !firstShow);
    firstShow = false;
  } catch (e) {
    // Keep showing what we have; try again on the next poll
    console.warn('Could not load sign messages:', e);
  }
}

buildBulbs();
buildTracks();
setLights('blink');

// Wait for the sign font so the first message doesn't jump when it loads
(document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
  load();
  setInterval(load, POLL_SECONDS * 1000);
});

// Ask the browser not to dim/sleep the screen (ignored where unsupported)
if ('wakeLock' in navigator) {
  const request = () => navigator.wakeLock.request('screen').catch(() => {});
  request();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') request();
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'f' || e.key === 'F') {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  }
});
