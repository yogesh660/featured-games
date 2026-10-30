/* Space Defender: every sound is synthesised with the Web Audio API, including the music. */
'use strict';

class Sfx {
  constructor() { this.ctx = null; this.muted = false; this.musicOn = true; }

  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC();
    this.out = ctx.createGain(); this.out.gain.value = this.muted ? 0 : 0.7;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14;
    this.out.connect(comp).connect(ctx.destination);
    this.music = ctx.createGain(); this.music.gain.value = 0.32; this.music.connect(this.out);
    // a short feedback delay gives the music some space
    const delay = ctx.createDelay(); delay.delayTime.value = 0.27;
    const fb = ctx.createGain(); fb.gain.value = 0.28;
    const wet = ctx.createGain(); wet.gain.value = 0.35;
    this.music.connect(delay); delay.connect(fb).connect(delay); delay.connect(wet).connect(this.out);
    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.step = 0; this.nextNote = ctx.currentTime + 0.1; this.intensity = 0;
    setInterval(() => this.schedule(), 50);
  }

  setMuted(m) { this.muted = m; if (this.out) this.out.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.05); }

  tone(type, f0, f1, dur, vol, when = 0, dest = this.out) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.02);
  }

  burst(dur, vol, f0, f1, type = 'lowpass') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = this.noise; f.type = type; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.out); s.start(t, Math.random() * 0.5); s.stop(t + dur);
  }

  laser() { this.tone('square', 1500 + Math.random() * 200, 380, 0.07, 0.035); }
  enemyShot() { this.tone('sawtooth', 520, 180, 0.16, 0.025); }
  hit() { this.tone('triangle', 300, 120, 0.06, 0.06); }
  boom(size = 1) { this.burst(0.35 + size * 0.35, 0.22 + size * 0.12, 1800, 60); this.tone('sine', 120, 35, 0.4 + size * 0.3, 0.25 * size); }
  hurt() { this.burst(0.3, 0.3, 3000, 200, 'bandpass'); this.tone('sawtooth', 200, 60, 0.3, 0.1); }
  pickup() { [880, 1320, 1760].forEach((f, i) => this.tone('sine', f, f * 1.01, 0.18, 0.06, i * 0.05)); }
  dash() { this.burst(0.3, 0.16, 400, 4000, 'bandpass'); }
  bomb() { this.burst(1.4, 0.4, 4000, 40); this.tone('sine', 90, 25, 1.4, 0.4); }
  alarm() { for (let i = 0; i < 3; i++) this.tone('square', 440, 330, 0.28, 0.05, i * 0.36); }
  wave() { [523, 659, 784, 1046].forEach((f, i) => this.tone('triangle', f, f, 0.22, 0.05, i * 0.08)); }

  // a minor-key loop: bass on every beat, arpeggio in sixteenths, kick and hat; intensity adds layers
  schedule() {
    if (!this.ctx || !this.musicOn) return;
    const spb = 60 / 118 / 4;
    const roots = [57, 53, 48, 55];                               // A, F, C, G
    const arp = [0, 3, 7, 12, 7, 3, 10, 7];
    const midi = n => 440 * Math.pow(2, (n - 69) / 12);
    while (this.nextNote < this.ctx.currentTime + 0.15) {
      const s = this.step % 64, bar = Math.floor(s / 16), root = roots[bar], when = this.nextNote - this.ctx.currentTime;
      if (s % 4 === 0) this.tone('sawtooth', midi(root - 12), midi(root - 12), spb * 3.2, 0.09, when, this.music);
      if (this.intensity > 0.2 || s % 2 === 0) this.tone('square', midi(root + 12 + arp[s % 8]), midi(root + 12 + arp[s % 8]), spb * 0.9, 0.025, when, this.music);
      if (s % 4 === 0 && this.intensity > 0.1) this.tone('sine', 140, 40, 0.18, 0.22, when, this.music);
      if (s % 4 === 2 && this.intensity > 0.4) this.tone('square', 8000, 6000, 0.03, 0.012, when, this.music);
      this.nextNote += spb; this.step++;
    }
  }
}
