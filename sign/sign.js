// A roadside marquee sign: a lit arrow on top and slide-in letters below.
// What it says comes from sign/messages.json, which is re-checked every minute.

const COLS = 20;
const ROWS = 4;
const POLL_SECONDS = 60;

const tracksEl = document.getElementById('tracks');
const signEl = document.getElementById('sign');
const bulbsEl = document.getElementById('bulbs');
const snowEl = document.getElementById('snow');
const snowFrontEl = document.getElementById('snow-front');

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

/** Small repeatable random numbers, so the snow pile has the same shape every time. */
function seeded(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

/** Smooth path through points (Catmull-Rom turned into curves). */
function smoothPath(points) {
  let d = `M${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

/**
 * Snow lying on the rail: an uneven drift on top with a ragged lip hanging a
 * little over the front edge. At the arrowhead end it banks up against the
 * arrowhead, where snow sliding off its top has piled up; the far end rounds off.
 */
function buildSnowPile() {
  const rand = seeded(42);
  const RAIL_TOP = 90;
  const WALL = 121;  // just against the back of the arrowhead
  const RIGHT = 922;
  const top = [];
  const lip = [];

  // Closer points at both ends so the pile can curve smoothly there
  const xs = [WALL, WALL + 6, WALL + 16, WALL + 30, WALL + 48, WALL + 70];
  for (let x = WALL + 100; x < RIGHT - 50; x += 46) xs.push(x);
  xs.push(RIGHT - 36, RIGHT - 20, RIGHT - 8, RIGHT);

  for (const x of xs) {
    const t = (x - WALL) / (RIGHT - WALL);
    const farFade = Math.sin(Math.min(1, (RIGHT - x) / 55) * Math.PI / 2); // rounds off at the far end
    const swell = 0.8 + 0.2 * Math.sin(t * Math.PI * 2.6 + 0.8);           // long, gentle drifts
    const bank = 30 * Math.exp(-(x - WALL) / 38);                          // drift against the arrowhead
    const depth = ((24 + rand() * 7) * swell + bank) * farFade + 1;
    top.push([x, RAIL_TOP - depth]);
    lip.push([x, RAIL_TOP + 4 + rand() * 5 * farFade + bank * 0.12]);
  }

  const topPath = smoothPath(top);
  const lipPath = smoothPath(lip.reverse()).replace(/^M/, 'L');
  const d = `${topPath} ${lipPath} Z ${arrowheadSnow(rand)}`;

  document.getElementById('snow-body').setAttribute('d', d);
  document.getElementById('snow-texture').setAttribute('d', d);
  const shadow = document.getElementById('snow-shadow');
  shadow.setAttribute('d', d);
  shadow.setAttribute('transform', 'translate(0 5)');
}

/**
 * Snow on the arrowhead: piled on its top corner and thinning out down the
 * sloping top edge, stopping before the tip (snow slides off steep parts).
 */
function arrowheadSnow(rand) {
  const CORNER = [124, -14];
  const TIP = [-44, 132];
  const along = t => [CORNER[0] + (TIP[0] - CORNER[0]) * t, CORNER[1] + (TIP[1] - CORNER[1]) * t];
  const END = 0.6;
  // A rounded mound sitting on the corner, spilling a little over the back edge
  const top = [[133, CORNER[1] + 6], [133, CORNER[1] - 8], [126, CORNER[1] - 19], [114, CORNER[1] - 22]];
  const lip = [[133, CORNER[1] + 6]];

  for (let i = 1; i <= 8; i++) {
    const t = 0.05 + (END - 0.05) * i / 8;
    const [x, y] = along(t);
    const fade = 1 - (t - 0.05) / (END - 0.05);
    const depth = (5 + 15 * Math.pow(fade, 0.9)) * (0.9 + rand() * 0.2) * Math.min(1, fade * 4);
    top.push([x, y - depth]);
  }
  for (let i = 8; i >= 0; i--) {
    const t = (END * i) / 8;
    const [x, y] = along(t);
    lip.push([x, y + 3 + rand() * 2 * (1 - t / END)]);
  }

  const lipPath = smoothPath(lip.slice(1)).replace(/^M/, 'L');
  return `${smoothPath(top)} ${lipPath} Z`;
}

/** A soft, round snowflake image, drawn once and reused for every flake. */
function makeFlakeSprite(size, softness) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(softness, 'rgba(255, 255, 255, 0.8)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

/**
 * Falling snow with depth: lots of small, slow, faint flakes far away, fewer
 * bigger ones close up, and a handful of large out-of-focus flakes drifting in
 * front of the sign. Everything sways with a shared, slowly changing breeze.
 */
function startSnow() {
  const back = snowEl.getContext('2d');
  const front = snowFrontEl.getContext('2d');
  const sharp = makeFlakeSprite(32, 0.35);
  const blurry = makeFlakeSprite(64, 0.05);
  let backFlakes = [];
  let frontFlakes = [];
  let running = true;
  let time = 0;

  function makeFlake(isFront) {
    const z = isFront ? 1 : Math.pow(Math.random(), 1.6); // most flakes are far away
    return {
      x: Math.random() * innerWidth,
      y: Math.random() * innerHeight,
      z,
      size: isFront ? 10 + Math.random() * 14 : 1.5 + z * 5,
      fall: isFront ? 1.6 + Math.random() * 1.2 : 0.25 + z * 1.1 + Math.random() * 0.2,
      sway: Math.random() * Math.PI * 2,
      swaySpeed: 0.004 + Math.random() * 0.012,
      alpha: isFront ? 0.25 + Math.random() * 0.25 : 0.3 + z * 0.65
    };
  }

  function resize() {
    for (const c of [snowEl, snowFrontEl]) {
      c.width = innerWidth;
      c.height = innerHeight;
    }
    backFlakes = Array.from({ length: Math.round(innerWidth / 7) }, () => makeFlake(false));
    frontFlakes = Array.from({ length: Math.round(innerWidth / 160) }, () => makeFlake(true));
  }

  function draw(ctx, flakes, sprite, breeze) {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const f of flakes) {
      f.sway += f.swaySpeed;
      f.y += f.fall;
      f.x += breeze * (0.3 + f.z) + Math.sin(f.sway) * 0.3 * (0.4 + f.z);
      if (f.y > innerHeight + f.size) {
        Object.assign(f, makeFlake(flakes === frontFlakes), { y: -f.size });
      }
      if (f.x > innerWidth + f.size) f.x = -f.size;
      if (f.x < -f.size) f.x = innerWidth + f.size;
      ctx.globalAlpha = f.alpha;
      ctx.drawImage(sprite, f.x - f.size / 2, f.y - f.size / 2, f.size, f.size);
    }
    ctx.globalAlpha = 1;
  }

  function frame() {
    if (!running) return;
    time += 1;
    const breeze = 0.25 + Math.sin(time / 900) * 0.35 + Math.sin(time / 230) * 0.12;
    draw(back, backFlakes, sharp, breeze);
    draw(front, frontFlakes, blurry, breeze);
    requestAnimationFrame(frame);
  }

  resize();
  addEventListener('resize', resize);
  requestAnimationFrame(frame);
  return {
    stop() {
      running = false;
      removeEventListener('resize', resize);
      back.clearRect(0, 0, snowEl.width, snowEl.height);
      front.clearRect(0, 0, snowFrontEl.width, snowFrontEl.height);
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
buildSnowPile();
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
