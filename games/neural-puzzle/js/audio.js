/**
 * Neural Puzzle — Procedural Web Audio Engine
 * Zero external audio files; 100% synthesized micro-transients, harmonic chords, and resonant filters.
 */

class NeuralAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.masterVolume = 0.45;
    this.initAudioContext();
  }

  initAudioContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    // Lazy init on first user interaction to satisfy browser autoplay policies
    const unlock = () => {
      if (!this.ctx) {
        this.ctx = new AudioContextClass();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      ['click', 'touchstart', 'keydown'].forEach(ev => {
        window.removeEventListener(ev, unlock, true);
      });
    };

    ['click', 'touchstart', 'keydown'].forEach(ev => {
      window.addEventListener(ev, unlock, { once: true, passive: true, capture: true });
    });
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx && this.ctx.state === 'running';
  }

  setMuted(muted) {
    this.muted = !!muted;
  }

  setVolume(vol) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
  }

  /**
   * Crisp micro-mechanical/synaptic tile rotation click
   */
  playRotate(direction = 1) {
    if (this.muted || !this.ensureContext()) return;
    const now = this.ctx.currentTime;

    // Transient tick
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    const baseFreq = direction > 0 ? 580 : 520;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.045);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, now);
    filter.Q.setValueAtTime(3.5, now);

    gain.gain.setValueAtTime(this.masterVolume * 0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.045);

    // Subtle sub-click for physical feel
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(95, now);
    subOsc.frequency.exponentialRampToValueAtTime(35, now + 0.035);
    subGain.gain.setValueAtTime(this.masterVolume * 0.25, now);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

    subOsc.connect(subGain);
    subGain.connect(this.ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.035);
  }

  /**
   * Resonant harmonic chime when a circuit branch connects or reaches a target
   */
  playConnect(toneIndex = 0) {
    if (this.muted || !this.ensureContext()) return;
    const now = this.ctx.currentTime;

    // Pentatonic scale frequencies [C5, D5, E5, G5, A5, C6, D6]
    const scale = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50, 1174.66];
    const freq = scale[Math.min(toneIndex, scale.length - 1)];

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.008, now + 0.18);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(this.masterVolume * 0.35, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  }

  /**
   * Deep synaptic activation surge when an AND gate triggers or high-energy node activates
   */
  playGateActivation() {
    if (this.muted || !this.ensureContext()) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(330, now + 0.12);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, now);
    filter.frequency.exponentialRampToValueAtTime(1200, now + 0.12);
    filter.Q.setValueAtTime(6.0, now);

    gain.gain.setValueAtTime(this.masterVolume * 0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  /**
   * Hint chime
   */
  playHint() {
    if (this.muted || !this.ensureContext()) return;
    const now = this.ctx.currentTime;

    const freqs = [659.25, 987.77]; // E5 to B5
    freqs.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);

      gain.gain.setValueAtTime(0, now + i * 0.08);
      gain.gain.linearRampToValueAtTime(this.masterVolume * 0.25, now + i * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.08 + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.32);
    });
  }

  /**
   * Undo / Reset click
   */
  playUndo() {
    if (this.muted || !this.ensureContext()) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.06);

    gain.gain.setValueAtTime(this.masterVolume * 0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  /**
   * Grand puzzle solved fanfare!
   * Lush futuristic chord arpeggio with shimmering decay
   */
  playWin() {
    if (this.muted || !this.ensureContext()) return;
    const now = this.ctx.currentTime;

    // Cyberpunk Major 9th Chord: C4 (261.63), G4 (392.00), B4 (493.88), D5 (587.33), E5 (659.25), G5 (783.99)
    const notes = [
      { f: 261.63, delay: 0.00, dur: 0.8 },
      { f: 392.00, delay: 0.09, dur: 0.8 },
      { f: 523.25, delay: 0.18, dur: 0.9 },
      { f: 659.25, delay: 0.27, dur: 1.1 },
      { f: 783.99, delay: 0.36, dur: 1.2 },
      { f: 1046.50, delay: 0.45, dur: 1.5 }
    ];

    notes.forEach(note => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.f, now + note.delay);

      gain.gain.setValueAtTime(0, now + note.delay);
      gain.gain.linearRampToValueAtTime(this.masterVolume * 0.32, now + note.delay + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + note.delay + note.dur);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + note.delay);
      osc.stop(now + note.delay + note.dur);
    });

    // Shimmering sub sparkle
    setTimeout(() => {
      if (this.muted || !this.ctx) return;
      const t = this.ctx.currentTime;
      [1318.51, 1567.98, 2093.00].forEach((sf, i) => {
        const sOsc = this.ctx.createOscillator();
        const sGain = this.ctx.createGain();
        sOsc.type = 'sine';
        sOsc.frequency.setValueAtTime(sf, t + i * 0.06);
        sGain.gain.setValueAtTime(0, t + i * 0.06);
        sGain.gain.linearRampToValueAtTime(this.masterVolume * 0.18, t + i * 0.06 + 0.02);
        sGain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.06 + 0.4);
        sOsc.connect(sGain);
        sGain.connect(this.ctx.destination);
        sOsc.start(t + i * 0.06);
        sOsc.stop(t + i * 0.06 + 0.42);
      });
    }, 450);
  }
}

window.NeuralAudio = NeuralAudio;
