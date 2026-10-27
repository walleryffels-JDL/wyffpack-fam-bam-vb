import { CODE_TO_CHAR, COLOR_CODES, DRUM, BLANK } from './constants.js';

export class Tile {
  constructor() {
    this.code = BLANK;
    this.target = BLANK;
    this.startAt = 0;

    this.el = document.createElement('div');
    this.el.className = 'tile';
    this.span = document.createElement('span');
    this.el.appendChild(this.span);
  }

  render(code) {
    this.code = code;
    const color = COLOR_CODES[code];
    if (color) {
      this.el.style.backgroundColor = color;
      this.span.textContent = '';
    } else {
      this.el.style.backgroundColor = '';
      this.span.textContent = CODE_TO_CHAR[code] === ' ' ? '' : (CODE_TO_CHAR[code] ?? '');
    }
  }

  /** Queue a flip to `code`, starting at time `startAt` (ms timestamp). */
  flipTo(code, startAt) {
    this.target = code;
    this.startAt = startAt;
  }

  get isFlipping() {
    return this.code !== this.target;
  }

  /** Advance one flap forward on the drum. Returns true if a flap fell. */
  step(now) {
    if (!this.isFlipping || now < this.startAt) return false;

    const i = DRUM.indexOf(this.code);
    this.render(DRUM[(i + 1) % DRUM.length]);
    this.el.classList.toggle('flap', this.isFlipping);
    return true;
  }
}
