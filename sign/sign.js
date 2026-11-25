// A roadside marquee sign: a lit arrow on top and slide-in letters below.
// What it says comes from sign/messages.json, which is re-checked every minute.

const COLS = 20;
const ROWS = 4;
const POLL_SECONDS = 60;

const tracksEl = document.getElementById('tracks');
const signEl = document.getElementById('sign');
const bulbsEl = document.getElementById('bulbs');

// --- Arrow bulbs ----------------------------------------------------------

const SVG_NS = 'http://www.w3.org/2000/svg';

// Globe bulbs in chase order: along the rail from the far end toward the
// arrow, then the back of the arrowhead, then the tip.
const BULBS = [
  [835, 112, 'rail'], [675, 112, 'rail'], [515, 112, 'rail'], [355, 112, 'rail'], [200, 112, 'rail'],
  [96, 72, 'head'], [96, 192, 'head'], [38, 132, 'head']
];

function buildBulbs() {
  BULBS.forEach(([x, y, where], i) => {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', `bulb phase-${i % 3}`);
    // Rail bulbs screw into a socket on top of the rail; arrowhead bulbs sit on its face
    const socket = where === 'rail'
      ? `<rect class="bulb-socket" x="${x - 9}" y="${y}" width="18" height="10" rx="2"/>`
      : '';
    g.innerHTML = `<circle class="bulb-halo" cx="${x}" cy="${y - 6}" r="46"/>`
      + socket
      + `<circle class="bulb-glass" cx="${x}" cy="${y - 8}" r="17"/>`;
    bulbsEl.appendChild(g);
  });
}

function setLights(mode = 'blink') {
  const modes = ['chase', 'blink', 'on', 'off'];
  signEl.classList.remove(...modes.map(m => `lights-${m}`));
  signEl.classList.add(`lights-${modes.includes(mode) ? mode : 'blink'}`);
}

function setArrowDirection(direction = 'left') {
  signEl.classList.toggle('right', direction === 'right');
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
      row.push({ el: letter, ch: ' ', red: false });
    }
    slots.push(row);
  }
}

/** Turn a line into [{ ch, red }]; {red} and {black} switch letter color. */
function lineToCells(line, state) {
  const cells = [];
  const re = /\{(red|black)\}|([\s\S])/gi;
  let m;
  while ((m = re.exec(line))) {
    if (m[1]) state.red = m[1].toLowerCase() === 'red';
    else cells.push({ ch: m[2].toUpperCase(), red: state.red });
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
      words.splice(i, 2, [...words[i], { ch: ' ', red: false }, ...words[i + 1]]);
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
    row = row.length ? [...row, { ch: ' ', red: false }, ...w] : [...w];
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

  const state = { red: false };
  let rows = lines.flatMap(line => wrap(lineToCells(String(line), state)));
  while (rows.length && !rows[0].length) rows.shift();
  while (rows.length && !rows[rows.length - 1].length) rows.pop();
  rows = rows.slice(0, ROWS);

  const grid = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ ch: ' ', red: false })));
  const top = Math.floor((ROWS - rows.length) / 2);
  rows.forEach((row, i) => {
    const left = Math.floor((COLS - row.length) / 2);
    row.forEach((cell, j) => { grid[top + i][left + j] = cell; });
  });
  return grid;
}

/** Pull the old letters off, then slide the new ones in, left to right. */
function showGrid(grid, animate = true) {
  let changedIndex = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const slot = slots[r][c];
      const next = grid[r][c];
      if (slot.ch === next.ch && slot.red === next.red) continue;

      slot.ch = next.ch;
      slot.red = next.red;
      const el = slot.el;

      if (!animate) {
        el.textContent = next.ch === ' ' ? '' : next.ch;
        el.classList.toggle('red', next.red);
        continue;
      }

      const outDelay = (r * 60 + c * 18);
      const inDelay = 900 + changedIndex * 55;
      changedIndex++;

      setTimeout(() => el.classList.add('out'), outDelay);
      setTimeout(() => {
        el.textContent = next.ch === ' ' ? '' : next.ch;
        el.classList.toggle('red', next.red);
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
