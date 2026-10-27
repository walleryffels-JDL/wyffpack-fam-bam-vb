import { FLAP_AUDIO_BASE64 } from './flapAudio.js';
import { STEP_INTERVAL } from './constants.js';

const CLICK_VARIANTS = 12;     // pre-rendered clicks, picked at random so it never sounds looped
const MAX_CLICKS_PER_STEP = 14; // cap on voices per tick; loudness still scales with tile count

export class SoundEngine {
  /** mode: 'flaps' (a click per flap, synthesized) or 'classic' (FlipOff's recorded clip) */
  constructor({ mode = 'flaps' } = {}) {
    this.mode = mode;
    this.ctx = null;
    this.muted = false;
    this._initialized = false;
    this._audioBuffer = null;
    this._currentSource = null;
    this._clicks = [];
    this._bus = null;
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
    if (this.mode !== 'flaps' || !count || !this.ctx || this.muted || !this._clicks.length) return;
    this.resume();

    // Spread the clicks across the step so many tiles blur into a clatter
    const voices = Math.min(count, MAX_CLICKS_PER_STEP);
    const level = Math.min(1, 0.5 * Math.sqrt(count) / voices);
    const start = this.ctx.currentTime + 0.01;
    const spread = STEP_INTERVAL / 1000;

    for (let i = 0; i < voices; i++) {
      const source = this.ctx.createBufferSource();
      source.buffer = this._clicks[Math.floor(Math.random() * this._clicks.length)];
      source.playbackRate.value = 0.92 + Math.random() * 0.16;

      const gain = this.ctx.createGain();
      gain.gain.value = level * (0.7 + Math.random() * 0.3);

      source.connect(gain);
      gain.connect(this._bus);
      source.start(start + Math.random() * spread);
    }
  }

  // --- Flap voice -------------------------------------------------------

  /**
   * A flap click is two parts: a bright tick as the plastic flap releases,
   * and a short low knock as it lands on the one below. Rendered once into
   * small buffers so playback is cheap on a TV browser.
   */
  _buildFlapVoice() {
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * 0.045);

    for (let v = 0; v < CLICK_VARIANTS; v++) {
      const buffer = this.ctx.createBuffer(1, length, rate);
      const data = buffer.getChannelData(0);
      const tickFreq = 1700 + Math.random() * 1400;
      const knockFreq = 140 + Math.random() * 90;
      const knockAt = 0.006 + Math.random() * 0.006; // landing comes a few ms after release
      let hp = 0;
      let prev = 0;

      for (let i = 0; i < length; i++) {
        const t = i / rate;

        // Release: high-passed noise with a fast decay plus a faint ring
        const noise = Math.random() * 2 - 1;
        hp = 0.85 * (hp + noise - prev);
        prev = noise;
        const tick = (hp * 0.9 + Math.sin(2 * Math.PI * tickFreq * t) * 0.25) * Math.exp(-t / 0.0025);

        // Landing: damped low thump with a little noise for texture
        const k = t - knockAt;
        const knock = k < 0 ? 0
          : (Math.sin(2 * Math.PI * knockFreq * k) * 0.8 + noise * 0.25) * Math.exp(-k / 0.007);

        data[i] = tick * 0.55 + knock * 0.6;
      }
      this._clicks.push(buffer);
    }

    // Soft, muffled character (flaps behind a front panel), then a limiter
    const lowpass = this.ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 4200;
    lowpass.Q.value = 0.5;

    const body = this.ctx.createBiquadFilter();
    body.type = 'peaking';
    body.frequency.value = 900;
    body.gain.value = 3;

    const limiter = this.ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.ratio.value = 8;

    const master = this.ctx.createGain();
    master.gain.value = 0.9;

    lowpass.connect(body);
    body.connect(limiter);
    limiter.connect(master);
    master.connect(this.ctx.destination);
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
