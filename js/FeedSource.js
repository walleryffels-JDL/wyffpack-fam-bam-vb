import { FEED_POLL_SECONDS } from './constants.js';

/**
 * Polls a JSON file of messages. Accepts:
 *   [ message, ... ]                     a list of messages
 *   { "messages": [ ... ], "duration", "volume" }  same, with a default duration (seconds)
 *                                                and flap volume (0 = silent, 1 = normal)
 *   [[...6x22 codes...]]                 a single Vestaboard-style grid
 */
export class FeedSource {
  constructor(url, onMessages, { pollSeconds = FEED_POLL_SECONDS } = {}) {
    this.url = url;
    this.onMessages = onMessages;
    this.pollSeconds = pollSeconds;
  }

  async start() {
    const ok = await this.fetch();
    setInterval(() => this.fetch(), this.pollSeconds * 1000);
    return ok;
  }

  async fetch() {
    try {
      const sep = this.url.includes('?') ? '&' : '?';
      const res = await fetch(`${this.url}${sep}t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      let messages;
      let duration;
      let volume;
      if (Array.isArray(data) && Array.isArray(data[0]) && typeof data[0][0] === 'number') {
        messages = [{ grid: data }];
      } else if (Array.isArray(data)) {
        messages = data;
      } else {
        messages = data.messages ?? [data];
        duration = data.duration;
        volume = data.volume;
      }
      if (messages.length) this.onMessages(messages, { duration, volume });
      return true;
    } catch (e) {
      // Keep showing whatever we had; try again next poll
      console.warn('Could not load messages feed:', e);
      return false;
    }
  }
}
