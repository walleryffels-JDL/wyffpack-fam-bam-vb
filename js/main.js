import { Board } from './Board.js';
import { SoundEngine } from './SoundEngine.js';
import { MessageRotator } from './MessageRotator.js';
import { KeyboardController } from './KeyboardController.js';
import { FeedSource } from './FeedSource.js';
import { DEFAULT_MESSAGES } from './messages.js';
import { DEFAULT_DURATION } from './constants.js';

// URL options:
//   ?msg=HELLO&msg=WORLD   show these messages instead of the feed
//   ?feed=URL              load messages from another JSON file (default: messages.json)
//   ?duration=20           seconds per message
//   ?sound=0               start muted
//   ?sound=classic         use FlipOff's recorded clip instead of per-flap clicks
//   ?volume=0.5            flap volume (1 = normal); overrides "volume" in messages.json
const params = new URLSearchParams(location.search);

document.addEventListener('DOMContentLoaded', () => {
  const soundEngine = new SoundEngine({
    mode: params.get('sound') === 'classic' ? 'classic' : 'flaps',
    volume: params.has('volume') ? Number(params.get('volume')) || 0 : 1
  });
  if (params.get('sound') === '0') soundEngine.toggleMute();

  const board = new Board(document.getElementById('board-container'), soundEngine);
  const rotator = new MessageRotator(board, {
    duration: Number(params.get('duration')) || DEFAULT_DURATION
  });
  new KeyboardController(rotator, soundEngine);

  // Initialize audio on first user interaction (browser autoplay policy)
  let audioInitialized = false;
  const initAudio = async () => {
    if (audioInitialized) return;
    audioInitialized = true;
    await soundEngine.init();
    soundEngine.resume();
  };
  document.addEventListener('click', initAudio, { once: true });
  document.addEventListener('keydown', initAudio, { once: true });

  keepScreenAwake();

  const urlMessages = params.getAll('msg');
  if (urlMessages.length) {
    rotator.setMessages(urlMessages);
    return;
  }

  // Show built-ins right away, then switch to the feed once it loads
  rotator.setMessages(DEFAULT_MESSAGES);
  const feed = new FeedSource(params.get('feed') || 'messages.json', (messages, { duration, volume }) => {
    if (duration && !params.get('duration')) rotator.duration = Number(duration);
    if (volume !== undefined && !params.has('volume')) soundEngine.setVolume(volume);
    rotator.setMessages(messages);
  });
  feed.start();
});

// Ask the browser not to dim/sleep the screen (ignored where unsupported)
async function keepScreenAwake() {
  if (!('wakeLock' in navigator)) return;
  const request = () => navigator.wakeLock.request('screen').catch(() => {});
  await request();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') request();
  });
}
