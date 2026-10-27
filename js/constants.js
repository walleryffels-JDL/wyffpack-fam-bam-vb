export const GRID_COLS = 22;
export const GRID_ROWS = 6;

// Timing
export const STEP_INTERVAL = 30;       // ms per flap step
export const MAX_START_JITTER = 450;   // ms of random delay before a tile starts flipping
export const DEFAULT_DURATION = 20;    // seconds each message stays up
export const FEED_POLL_SECONDS = 60;   // how often messages.json is re-fetched

// Vestaboard character codes (same numbering as the Vestaboard API / VBML)
export const BLANK = 0;
export const CODE_TO_CHAR = {
  0: ' ',
  1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E', 6: 'F', 7: 'G', 8: 'H', 9: 'I',
  10: 'J', 11: 'K', 12: 'L', 13: 'M', 14: 'N', 15: 'O', 16: 'P', 17: 'Q',
  18: 'R', 19: 'S', 20: 'T', 21: 'U', 22: 'V', 23: 'W', 24: 'X', 25: 'Y', 26: 'Z',
  27: '1', 28: '2', 29: '3', 30: '4', 31: '5', 32: '6', 33: '7', 34: '8', 35: '9', 36: '0',
  37: '!', 38: '@', 39: '#', 40: '$', 41: '(', 42: ')', 44: '-', 46: '+', 47: '&',
  48: '=', 49: ';', 50: ':', 52: '\'', 53: '"', 54: '%', 55: ',', 56: '.', 59: '/',
  60: '?', 62: '°'
};

export const COLOR_CODES = {
  63: '#DA291C', // red
  64: '#FF7500', // orange
  65: '#FFB81C', // yellow
  66: '#009A44', // green
  67: '#0084D5', // blue
  68: '#702F8A', // violet
  69: '#FFFFFF', // white
  70: '#000000'  // black
};

export const COLOR_NAMES = {
  red: 63, orange: 64, yellow: 65, green: 66,
  blue: 67, violet: 68, purple: 68, white: 69, black: 70
};

export const CHAR_TO_CODE = Object.fromEntries(
  Object.entries(CODE_TO_CHAR).map(([code, ch]) => [ch, Number(code)])
);
// Friendly aliases for characters the board doesn't have
Object.assign(CHAR_TO_CODE, { '’': 52, '‘': 52, '“': 53, '”': 53, '—': 44, '–': 44 });

// Physical drum order: each tile flips forward through this sequence
export const DRUM = [
  ...Object.keys(CODE_TO_CHAR).map(Number),
  ...Object.keys(COLOR_CODES).map(Number)
].sort((a, b) => a - b);
