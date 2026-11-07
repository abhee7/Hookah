import type { AppState } from '../types/hookah';

/**
 * Procedural sound effects (no audio files): water bubbling while sipping, an exhale
 * whoosh, coal crackle that scales with heat, a fanning swoosh and a camera shutter.
 * Browsers only allow audio after a user gesture, so call unlock() from one.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;

  private enabled = true;
  private prevState: AppState = 'IDLE';
  private prevFanning = false;
  private nextBubbleAt = 0;
  private nextCrackleAt = 0;

  /** Create / resume the audio context. Must be called from a user gesture. */
  unlock() {
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.enabled ? 0.7 : 0;
        this.master.connect(this.ctx.destination);

        // 2s of white noise reused by every noise-based effect
        const length = this.ctx.sampleRate * 2;
        this.noise = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch (e) {
      console.warn('Audio unavailable:', e);
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(enabled ? 0.7 : 0, this.ctx.currentTime, 0.05);
    }
  }

  destroy() {
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.noise = null;
  }

  /** Call once per frame with the current interaction state. */
  update(state: AppState, heat: number, fanning: boolean, freshCoal: boolean) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || !this.enabled) {
      this.prevState = state;
      this.prevFanning = fanning;
      return;
    }
    const now = performance.now();

    // Water bubbling while inhaling
    if (state === 'SIP_DETECTED') {
      if (now >= this.nextBubbleAt) {
        this.bubble();
        this.nextBubbleAt = now + 45 + Math.random() * 110;
      }
    }

    // Exhale whoosh the moment vapour starts
    if (state === 'VAPOUR' && this.prevState !== 'VAPOUR') {
      this.whoosh(1.8, 1300, 350, 0.5);
    }

    // Coal: random crackle, faster and louder when hotter
    if (now >= this.nextCrackleAt) {
      this.crackle(0.05 + heat * 0.12);
      this.nextCrackleAt = now + (500 - heat * 400) * (0.4 + Math.random() * 1.2);
    }

    if (fanning && !this.prevFanning) this.whoosh(0.7, 900, 1800, 0.22);
    if (freshCoal) {
      for (let i = 0; i < 7; i++) {
        window.setTimeout(() => this.crackle(0.18), i * 55 + Math.random() * 40);
      }
    }

    this.prevState = state;
    this.prevFanning = fanning;
  }

  playShutter() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || !this.enabled) return;
    this.crackle(0.35, 0.05);
    window.setTimeout(() => this.crackle(0.28, 0.07), 90);
    this.tone(1800, 0.04, 0.08);
  }

  private bubble() {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const f0 = 180 + Math.random() * 240;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f0 * 1.9, t + 0.07);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.2, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  private whoosh(duration: number, fromHz: number, toHz: number, peak: number) {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noise) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 0.9;
    filter.frequency.setValueAtTime(fromHz, t);
    filter.frequency.exponentialRampToValueAtTime(toHz, t + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + duration * 0.15);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t, Math.random() * 0.8);
    src.stop(t + duration + 0.05);
  }

  private crackle(volume: number, length = 0.025) {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noise) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1500 + Math.random() * 2500;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t, Math.random() * 1.5);
    src.stop(t + length + 0.02);
  }

  private tone(freq: number, volume: number, length: number) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + length + 0.01);
  }
}
