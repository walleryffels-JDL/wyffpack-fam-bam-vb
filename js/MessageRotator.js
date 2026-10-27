import { DEFAULT_DURATION } from './constants.js';
import { messageToGrid, hasDynamic } from './format.js';

export class MessageRotator {
  constructor(board, { duration = DEFAULT_DURATION } = {}) {
    this.board = board;
    this.messages = [];
    this.duration = duration;
    this.currentIndex = -1;
    this._timer = null;
    this._clockTimer = null;
  }

  setMessages(messages) {
    const changed = JSON.stringify(messages) !== JSON.stringify(this.messages);
    if (!changed) return;
    this.messages = messages;
    // New content: start from the top so updates show up right away
    this.currentIndex = -1;
    this.next();
  }

  next() {
    if (!this.messages.length) return;
    this.currentIndex = (this.currentIndex + 1) % this.messages.length;
    this._show();
  }

  prev() {
    if (!this.messages.length) return;
    this.currentIndex = (this.currentIndex - 1 + this.messages.length) % this.messages.length;
    this._show();
  }

  _show() {
    const message = this.messages[this.currentIndex];
    this.board.displayGrid(messageToGrid(message));

    // Messages with {time} etc. refresh in place while they're up
    clearInterval(this._clockTimer);
    if (hasDynamic(message)) {
      this._clockTimer = setInterval(() => this.board.displayGrid(messageToGrid(message)), 5000);
    }

    // A single message just stays put
    clearTimeout(this._timer);
    if (this.messages.length > 1) {
      const seconds = Number(message?.duration) || this.duration;
      this._timer = setTimeout(() => this.next(), seconds * 1000);
    }
  }
}
