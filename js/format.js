import {
  GRID_COLS, GRID_ROWS, BLANK, CHAR_TO_CODE, CODE_TO_CHAR, COLOR_CODES, COLOR_NAMES
} from './constants.js';

const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** Replace {time}, {date}, {day} with the current values. */
export function expandDynamic(text, now = new Date()) {
  const h = now.getHours();
  const time = `${h % 12 || 12}:${String(now.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  const date = `${MONTHS[now.getMonth()]} ${now.getDate()}`;
  return text
    .replace(/\{time\}/gi, time)
    .replace(/\{date\}/gi, date)
    .replace(/\{day\}/gi, DAYS[now.getDay()]);
}

export function hasDynamic(message) {
  return /\{(time|date|day)\}/i.test(JSON.stringify(message));
}

/** Turn one line of text into an array of character codes. Supports {red}, {63}, etc. */
function lineToCodes(line) {
  const codes = [];
  const re = /\{(\w+)\}|([\s\S])/g;
  let m;
  while ((m = re.exec(line))) {
    if (m[1] !== undefined) {
      const token = m[1].toLowerCase();
      if (token in COLOR_NAMES) codes.push(COLOR_NAMES[token]);
      else if (/^\d+$/.test(token) && (token in CODE_TO_CHAR || token in COLOR_CODES)) codes.push(Number(token));
      // unknown tokens are dropped
    } else {
      const ch = m[2].toUpperCase();
      codes.push(ch in CHAR_TO_CODE ? CHAR_TO_CODE[ch] : BLANK);
    }
  }
  return codes;
}

/** Word-wrap a row of codes to GRID_COLS. */
function wrap(codes) {
  const words = [];
  let word = [];
  for (const c of codes) {
    if (c === BLANK) {
      if (word.length) words.push(word);
      word = [];
    } else {
      word.push(c);
    }
  }
  if (word.length) words.push(word);

  const rows = [];
  let row = [];
  for (let w of words) {
    // Hard-split words longer than a full row
    while (w.length > GRID_COLS) {
      if (row.length) { rows.push(row); row = []; }
      rows.push(w.slice(0, GRID_COLS));
      w = w.slice(GRID_COLS);
    }
    const needed = row.length ? row.length + 1 + w.length : w.length;
    if (needed > GRID_COLS) {
      rows.push(row);
      row = [...w];
    } else {
      row = row.length ? [...row, BLANK, ...w] : [...w];
    }
  }
  if (row.length || !rows.length) rows.push(row);
  return rows;
}

function emptyGrid() {
  return Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(BLANK));
}

function isGrid(value) {
  return Array.isArray(value) && value.length && Array.isArray(value[0]);
}

/**
 * Convert a message into a 6x22 grid of codes.
 * A message can be:
 *  - a string ("\n" separates lines)
 *  - an array of strings (one per line)
 *  - a 6x22 array of Vestaboard codes (or that as a JSON string)
 *  - an object { text | lines | grid, align: 'center' | 'left', valign: 'middle' | 'top' }
 */
export function messageToGrid(message, now = new Date()) {
  let msg = message;
  if (typeof msg === 'string' && msg.trim().startsWith('[[')) {
    try { msg = JSON.parse(msg); } catch (e) { /* treat as text */ }
  }
  if (!msg || typeof msg !== 'object' || Array.isArray(msg)) {
    msg = isGrid(msg) ? { grid: msg } : { text: msg ?? '' };
  }

  if (msg.grid) {
    const grid = emptyGrid();
    const src = typeof msg.grid === 'string' ? JSON.parse(msg.grid) : msg.grid;
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const code = Number(src[r]?.[c] ?? BLANK);
        grid[r][c] = (code in CODE_TO_CHAR || code in COLOR_CODES) ? code : BLANK;
      }
    }
    return grid;
  }

  const lines = Array.isArray(msg.lines) ? msg.lines
    : Array.isArray(msg.text) ? msg.text
    : String(msg.text ?? '').split('\n');

  let rows = lines.flatMap(line => wrap(lineToCodes(expandDynamic(String(line), now))));

  // Trim blank rows at the edges, then fit to the board
  while (rows.length && !rows[0].length) rows.shift();
  while (rows.length && !rows[rows.length - 1].length) rows.pop();
  rows = rows.slice(0, GRID_ROWS);

  const grid = emptyGrid();
  const top = msg.valign === 'top' ? 0 : Math.floor((GRID_ROWS - rows.length) / 2);
  rows.forEach((row, i) => {
    const left = msg.align === 'left' ? 0 : Math.floor((GRID_COLS - row.length) / 2);
    row.forEach((code, j) => { grid[top + i][left + j] = code; });
  });
  return grid;
}
