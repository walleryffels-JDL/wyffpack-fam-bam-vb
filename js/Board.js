import { Tile } from './Tile.js';
import { GRID_COLS, GRID_ROWS, STEP_INTERVAL, MAX_START_JITTER } from './constants.js';

export class Board {
  constructor(containerEl, soundEngine) {
    this.soundEngine = soundEngine;
    this.tiles = [];
    this._timer = null;

    this.boardEl = document.createElement('div');
    this.boardEl.className = 'board';

    this.gridEl = document.createElement('div');
    this.gridEl.className = 'tile-grid';

    for (let r = 0; r < GRID_ROWS; r++) {
      const row = [];
      for (let c = 0; c < GRID_COLS; c++) {
        const tile = new Tile();
        this.gridEl.appendChild(tile.el);
        row.push(tile);
      }
      this.tiles.push(row);
    }

    this.boardEl.appendChild(this.gridEl);
    containerEl.appendChild(this.boardEl);
  }

  get isTransitioning() {
    return this._timer !== null;
  }

  /** Show a 6x22 grid of codes, flipping only the tiles that change. */
  displayGrid(grid) {
    const now = performance.now();
    let hasChanges = false;

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const tile = this.tiles[r][c];
        const code = grid[r][c];
        if (code !== tile.target) {
          tile.flipTo(code, now + Math.random() * MAX_START_JITTER);
          hasChanges = true;
        }
      }
    }

    if (!hasChanges) return;
    if (this.soundEngine) this.soundEngine.playTransition();

    // One shared ticker drives every tile (cheap enough for a TV browser)
    if (!this._timer) {
      this._timer = setInterval(() => this._tick(), STEP_INTERVAL);
    }
  }

  _tick() {
    const now = performance.now();
    let active = false;
    let flapped = 0;
    for (const row of this.tiles) {
      for (const tile of row) {
        if (tile.step(now)) flapped++;
        if (tile.isFlipping) active = true;
      }
    }
    if (this.soundEngine) this.soundEngine.playFlaps(flapped);
    if (!active) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }
}
