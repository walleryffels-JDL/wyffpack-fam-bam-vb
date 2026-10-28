import { FLAP_AUDIO_BASE64 } from './flapAudio.js';
import { STEP_INTERVAL } from './constants.js';

const CLICK_VARIANTS = 12;      // pre-rendered clicks, picked at random so it never sounds looped
const MAX_CLICKS_PER_STEP = 3;  // keep it a soft patter, not a buzz

export class SoundEngine {
  /** mode: 'flaps' (a click per flap, synthesized) or 'classic' (FlipOff's recorded clip) */
  constructor({ mode = 'flaps', volume = 1 } = {}) {
    this.mode = mode;
    this.volume = volume;
    this.ctx = null;
    this.muted = false;
    this._initialized = false;
    this._audioBuffer = null;
    this._currentSource = null;
    this._clicks = [];
    this._bus = null;
    this._master = null;
  }

  /** 0 = silent, 1 = normal. Can be changed any time (e.g. from messages.json). */
  setVolume(volume) {
    this.volume = Math.max(0, Number(volume));
    if (this._master) this._master.gain.value = 0.5 * this.volume;
  }

  async init() {
    if (this._initialized) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this._initialized = true;

    if (this.mode === 'classic') {
      await this._decodeClip();
    } else {
      this._buildFlapVoice();
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  /** Called once when a new message starts flipping. */
  playTransition() {
    if (this.mode === 'classic') this._playClip();
  }

  /** Called every flap step with how many tiles just flipped. */
  playFlaps(count) {
    if (this.mode !== 'flaps' || !count || !this.ctx || this.muted || !this.volume || !this._clicks.length) return;
    this.resume();

    // A few clicks per step, spread out, so many tiles blur into a soft patter
    const voices = Math.min(count, MAX_CLICKS_PER_STEP);
    const level = Math.min(0.3, 0.06 * Math.pow(count, 0.3));
    const start = this.ctx.currentTime + 0.01;
    const spread = STEP_INTERVAL / 1000;

    for (let i = 0; i < voices; i++) {
      const source = this.ctx.createBufferSource();
      source.buffer = this._clicks[Math.floor(Math.random() * this._clicks.length)];
      source.playbackRate.value = 0.92 + Math.random() * 0.16;

      const gain = this.ctx.createGain();
      gain.gain.value = level * (0.5 + Math.random() * 0.5) / Math.sqrt(voices);

      source.connect(gain);
      gain.connect(this._bus);
      source.start(start + Math.random() * spread);
    }
  }

  // --- Flap voice -------------------------------------------------------

  /**
   * A flap click is a soft, low "tup": a rounded knock with just a breath of
   * muffled noise. Every click fades in over a couple of milliseconds and
   * there's almost no treble, so nothing sharp reaches the TV speakers.
   * Rendered once into small buffers so playback is cheap.
   */
  _buildFlapVoice() {
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * 0.035);
    const attack = rate * 0.002;

    for (let v = 0; v < CLICK_VARIANTS; v++) {
      const buffer = this.ctx.createBuffer(1, length, rate);
      const data = buffer.getChannelData(0);
      const bodyFreq = 260 + Math.random() * 180;
      let lp = 0;

      for (let i = 0; i < length; i++) {
        const t = i / rate;
        const fadeIn = i < attack ? 0.5 - 0.5 * Math.cos(Math.PI * i / attack) : 1;

        // A breath of heavily muffled noise for texture
        lp += 0.05 * ((Math.random() * 2 - 1) - lp);
        const brush = lp * Math.exp(-t / 0.004);

        // Rounded low knock as the flap lands
        const body = Math.sin(2 * Math.PI * bodyFreq * t) * Math.exp(-t / 0.008);

        data[i] = fadeIn * (brush * 1.2 + body * 0.6);
      }
      this._clicks.push(buffer);
    }

    // Roll off what's left of the highs, then a gentle limiter
    const lowpass = this.ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 1200;
    lowpass.Q.value = 0.5;

    const limiter = this.ctx.createDynamicsCompressor();
    limiter.threshold.value = -18;
    limiter.ratio.value = 6;

    this._master = this.ctx.createGain();
    this.setVolume(this.volume);

    lowpass.connect(limiter);
    limiter.connect(this._master);
    this._master.connect(this.ctx.destination);
    this._bus = lowpass;
  }

  // --- Classic recorded clip ----------------------------------------------

  async _decodeClip() {
    try {
      const binaryStr = atob(FLAP_AUDIO_BASE64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      this._audioBuffer = await this.ctx.decodeAudioData(bytes.buffer);
    } catch (e) {
      console.warn('Failed to decode flap audio:', e);
    }
  }

  _playClip() {
    if (!this.ctx || !this._audioBuffer || this.muted) return;
    this.resume();

    // Stop any currently playing transition sound
    if (this._currentSource) {
      try {
        this._currentSource.stop();
      } catch (e) {
        // ignore if already stopped
      }
    }

    const source = this.ctx.createBufferSource();
    source.buffer = this._audioBuffer;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.8;

    source.connect(gain);
    gain.connect(this.ctx.destination);

    source.start(0);
    this._currentSource = source;

    source.onended = () => {
      if (this._currentSource === source) {
        this._currentSource = null;
      }
    };
  }
}
