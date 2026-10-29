/**
 * FPV Web Audio API Procedural Quadcopter Synthesizer
 * 100% Procedural synthesis of 4 brushless motors, blade chop, prop wash flutter,
 * wind turbulence, and race UI beeps. Zero external audio files required.
 */

class FpvAudio {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.enabled = true;
    this.initialized = false;

    // Motor Synthesizer Nodes
    this.motorOsc1 = null;
    this.motorOsc2 = null;
    this.motorFilter = null;
    this.motorGain = null;

    // Prop Wash / Flutter Modulation
    this.flutterLfo = null;
    this.flutterGain = null;

    // Wind Rush Noise
    this.windNode = null;
    this.windFilter = null;
    this.windGain = null;

    // Base Audio Profile (updated per drone spec)
    this.baseFreq = 260;
    this.maxFreq = 1200;
  }

  init() {
    if (this.initialized) return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this._setupMotorSynth();
      this._setupWindSynth();

      this.initialized = true;
    } catch (e) {
      console.warn('[FPV Audio] Web Audio API failed or blocked:', e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMuted(muted) {
    this.enabled = !muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.enabled ? 0.35 : 0.0, this.ctx.currentTime);
    }
  }

  setProfile(soundProfile) {
    if (!soundProfile) return;
    this.baseFreq = soundProfile.baseFreq || 260;
    this.maxFreq = soundProfile.maxFreq || 1200;
  }

  _setupMotorSynth() {
    const t = this.ctx.currentTime;

    // Dual Oscillators for authentic multi-motor dissonance
    this.motorOsc1 = this.ctx.createOscillator();
    this.motorOsc2 = this.ctx.createOscillator();

    this.motorOsc1.type = 'sawtooth';
    this.motorOsc2.type = 'triangle';

    this.motorOsc1.frequency.setValueAtTime(this.baseFreq, t);
    this.motorOsc2.frequency.setValueAtTime(this.baseFreq * 1.5, t); // Harmonic overtone

    // Lowpass filter for tone shaping
    this.motorFilter = this.ctx.createBiquadFilter();
    this.motorFilter.type = 'lowpass';
    this.motorFilter.frequency.setValueAtTime(1800, t);
    this.motorFilter.Q.setValueAtTime(3.0, t);

    // Motor Gain
    this.motorGain = this.ctx.createGain();
    this.motorGain.gain.setValueAtTime(0.0, t);

    // Flutter LFO (simulates rotor disc blade passing chop)
    this.flutterLfo = this.ctx.createOscillator();
    this.flutterLfo.frequency.setValueAtTime(14.0, t);
    this.flutterGain = this.ctx.createGain();
    this.flutterGain.gain.setValueAtTime(0.08, t);

    this.flutterLfo.connect(this.flutterGain.gain);

    // Connections
    this.motorOsc1.connect(this.motorFilter);
    this.motorOsc2.connect(this.motorFilter);
    this.motorFilter.connect(this.motorGain);
    this.motorGain.connect(this.masterGain);

    this.motorOsc1.start();
    this.motorOsc2.start();
    this.flutterLfo.start();
  }

  _setupWindSynth() {
    // Generate pink/white noise buffer for airspeed rush
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99 * b0 + white * 0.05;
      b1 = 0.96 * b1 + white * 0.11;
      b2 = 0.86 * b2 + white * 0.25;
      output[i] = (b0 + b1 + b2) * 0.3;
    }

    this.windNode = this.ctx.createBufferSource();
    this.windNode.buffer = noiseBuffer;
    this.windNode.loop = true;

    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.setValueAtTime(450, this.ctx.currentTime);
    this.windFilter.Q.setValueAtTime(1.2, this.ctx.currentTime);

    this.windGain = this.ctx.createGain();
    this.windGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    this.windNode.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.masterGain);

    this.windNode.start();
  }

  /**
   * Update synth state from physics loop
   * @param {number} throttle - 0.0 to 1.0
   * @param {number} speedKmh - Current drone airspeed in km/h
   * @param {number} angularSpeed - Total rotational velocity (rad/s)
   */
  update(throttle, speedKmh, angularSpeed = 0) {
    if (!this.initialized || !this.enabled || !this.ctx) return;

    const t = this.ctx.currentTime;
    const thr = Math.max(0, Math.min(1.0, throttle));

    // 1. Motor Pitch Mapping
    const freq = this.baseFreq + Math.pow(thr, 1.4) * (this.maxFreq - this.baseFreq);
    this.motorOsc1.frequency.setTargetAtTime(freq, t, 0.04);
    this.motorOsc2.frequency.setTargetAtTime(freq * 1.498, t, 0.04); // Minor harmonic

    // Motor Volume: Idle hum -> Full scream
    const targetMotorVol = thr > 0.01 ? 0.08 + thr * 0.32 : 0.03;
    this.motorGain.gain.setTargetAtTime(targetMotorVol, t, 0.05);

    // Motor Filter opens with throttle for brighter buzz
    this.motorFilter.frequency.setTargetAtTime(1200 + thr * 3400, t, 0.05);

    // 2. Blade Chop & Propwash Flutter
    // Flutter intensifies with rotational maneuvers (hard flips and banked turns)
    const flutterRate = 12.0 + (angularSpeed * 2.5);
    this.flutterLfo.frequency.setTargetAtTime(Math.min(35.0, flutterRate), t, 0.05);

    // 3. Airspeed Wind Rush
    const normSpeed = Math.min(1.0, speedKmh / 160.0);
    const targetWindVol = Math.pow(normSpeed, 1.8) * 0.28;
    this.windGain.gain.setTargetAtTime(targetWindVol, t, 0.08);
    this.windFilter.frequency.setTargetAtTime(300 + normSpeed * 1200, t, 0.08);
  }

  /**
   * Sound effect: Gate Checkpoint passed chime
   */
  playGateChime() {
    if (!this.initialized || !this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(1760, t + 0.12);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.36);
  }

  /**
   * Sound effect: Countdown Beep
   */
  playCountdownBeep(isFinal = false) {
    if (!this.initialized || !this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isFinal ? 1320 : 660, t);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + (isFinal ? 0.35 : 0.18));

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + (isFinal ? 0.36 : 0.19));
  }

  /**
   * Sound effect: Crash Impact
   */
  playCrash() {
    if (!this.initialized || !this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.25);

    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.30);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.31);
  }
}

window.FpvAudio = FpvAudio;
