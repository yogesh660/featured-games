/* Open Road: sound, synthesised live with the Web Audio API. No audio files.
   Engine: two detuned oscillators at the firing frequency through a low-pass that opens with
   the throttle. Wind, tyres and rain: filtered noise whose level follows speed and slip. */

'use strict';

class Sound {
  constructor() { this.ctx = null; this.muted = false; this.volume = 0.8; }

  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : this.volume;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp); comp.connect(ctx.destination);

    // engine
    this.engLP = ctx.createBiquadFilter(); this.engLP.type = 'lowpass'; this.engLP.Q.value = 2;
    this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
    this.o1 = ctx.createOscillator(); this.o1.type = 'sawtooth';
    this.o2 = ctx.createOscillator(); this.o2.type = 'square';
    this.o3 = ctx.createOscillator(); this.o3.type = 'sine';      // the low thrum underneath
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    const g3 = ctx.createGain(); g3.gain.value = 0.8;
    this.o1.connect(this.engLP); this.o2.connect(g2).connect(this.engLP); this.o3.connect(g3).connect(this.engGain);
    this.engLP.connect(this.engGain).connect(this.master);
    [this.o1, this.o2, this.o3].forEach(o => o.start());

    // one shared noise buffer for wind, tyres and rain
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), data = buf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < data.length; i++) { const w = Math.random() * 2 - 1; b = 0.97 * b + 0.03 * w; data[i] = w * 0.5 + b * 2.5; }
    const noise = (type, freq, q) => {
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      src.playbackRate.value = 0.8 + Math.random() * 0.4;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(f).connect(g).connect(this.master); src.start();
      return { f, g };
    };
    this.wind = noise('bandpass', 500, 0.6);
    this.tyre = noise('bandpass', 1400, 3);
    this.road = noise('lowpass', 180, 0.7);
    this.rain = noise('highpass', 2500, 0.3);
  }

  update(car, raining, paused) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, k = 0.08;
    const on = paused ? 0 : 1, v = Math.abs(car.v);
    const fire = car.rpm / 60 * 2;                      // four cylinders: two firings per turn
    this.o1.frequency.setTargetAtTime(fire, t, k);
    this.o2.frequency.setTargetAtTime(fire * 0.5 * 1.006, t, k);
    this.o3.frequency.setTargetAtTime(fire * 0.25, t, k);
    this.engLP.frequency.setTargetAtTime(380 + car.throttle * 1500 + car.rpm * 0.12, t, k);
    this.engGain.gain.setTargetAtTime(on * (0.07 + car.throttle * 0.09), t, k);
    this.wind.f.frequency.setTargetAtTime(300 + v * 14, t, 0.2);
    this.wind.g.gain.setTargetAtTime(on * Math.min(0.32, v * v * 0.00016), t, 0.2);
    this.road.g.gain.setTargetAtTime(on * Math.min(0.25, v * 0.006) * (car.offroad ? 2.5 : 1), t, 0.15);
    this.tyre.g.gain.setTargetAtTime(on * car.slipAmount * Math.min(1, v / 10) * 0.22, t, 0.05);
    this.rain.g.gain.setTargetAtTime(on * (raining ? 0.09 : 0), t, 0.6);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : this.volume, this.ctx.currentTime, 0.05);
  }

  /** Soft two-note chime, used when passing a milestone. */
  chime() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    [660, 880].forEach((f, i) => {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t + i * 0.12);
      g.gain.linearRampToValueAtTime(0.06, t + i * 0.12 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.12 + 1.2);
      o.connect(g).connect(this.master); o.start(t + i * 0.12); o.stop(t + i * 0.12 + 1.3);
    });
  }
}
