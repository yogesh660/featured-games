/* FPV: motor sound. Four detuned oscillators follow the four motor speeds, so rolls and punch-outs
   sound like a real quad; a band of noise adds prop wash and wind. Synthesised, no files. */
'use strict';
class QuadSound {
  constructor() { this.ctx = null; this.muted = false; }
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC();
    this.out = ctx.createGain(); this.out.gain.value = this.muted ? 0 : 0.5; this.out.connect(ctx.destination);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3800; lp.connect(this.out);
    this.motors = [0, 1, 2, 3].map(i => {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      const o2 = ctx.createOscillator(); o2.type = 'square';
      const g = ctx.createGain(); g.gain.value = 0;
      const g2 = ctx.createGain(); g2.gain.value = 0.3;
      o.connect(g); o2.connect(g2).connect(g); g.connect(lp); o.start(); o2.start();
      return { o, o2, g, detune: 1 + (i - 1.5) * 0.012 };
    });
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const n = ctx.createBufferSource(); n.buffer = buf; n.loop = true;
    this.windF = ctx.createBiquadFilter(); this.windF.type = 'bandpass'; this.windF.Q.value = 0.7;
    this.wind = ctx.createGain(); this.wind.gain.value = 0;
    n.connect(this.windF).connect(this.wind).connect(this.out); n.start();
  }
  update(drone, paused) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, [lo, hi] = drone.spec.motorHz;
    drone.motor.forEach((m, i) => {
      const M = this.motors[i], f = (lo + (hi - lo) * Math.sqrt(m)) * M.detune;
      M.o.frequency.setTargetAtTime(f, t, 0.02); M.o2.frequency.setTargetAtTime(f * 2.01, t, 0.02);
      M.g.gain.setTargetAtTime(paused || m === 0 ? 0 : 0.02 + m * 0.035, t, 0.03);
    });
    const v = drone.speed;
    this.windF.frequency.setTargetAtTime(300 + v * 25, t, 0.1);
    this.wind.gain.setTargetAtTime(paused ? 0 : Math.min(0.3, v * v * 0.0004 + (drone.armed ? drone.throttleOut * 0.05 : 0)), t, 0.1);
  }
  crash() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.3);
    g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(g).connect(this.out); o.start(t); o.stop(t + 0.4);
  }
  beep(f = 1200, dur = 0.08) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.out); o.start(t); o.stop(t + dur + 0.02);
  }
  setMuted(m) { this.muted = m; if (this.out) this.out.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.05); }
}
