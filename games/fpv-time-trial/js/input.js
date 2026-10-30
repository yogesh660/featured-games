/* FPV: inputs. Everything becomes four channels in Mode 2 layout:
   throttle 0..1, yaw, pitch, roll -1..1 (right / forward / right are positive), plus an arm switch.

   Keyboard (the layout Liftoff, Uncrashed and DRL use):
     W / S  throttle up / down (the stick stays where you leave it)   A / D  yaw
     ↑ / ↓  pitch forward / back                                      ← / →  roll
   Gamepads with the standard mapping (Xbox, PlayStation) work as they are.
   RC radios (RadioMaster Pocket, Boxer, TX16S... in USB joystick mode) report non-standard axes,
   so the setup wizard finds each stick, its direction and its end points, and stores that. */
'use strict';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

class Input {
  constructor() {
    this.keys = new Set();
    this.sticks = { throttle: 0, yaw: 0, pitch: 0, roll: 0 };
    this.kb = { throttle: 0, yaw: 0, pitch: 0, roll: 0 };
    this.source = 'keyboard';            // 'keyboard' | 'gamepad' | 'radio'
    this.padIndex = null;
    this.armSwitch = null;               // radio: armed while this channel is high
    this.map = this.load();
    this.listeners = {};
    addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
      if (!e.repeat) this.emit('key', e.code);
      this.keys.add(e.code);
      if (['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) this.source = 'keyboard';
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    addEventListener('gamepadconnected', e => { this.padIndex = e.gamepad.index; this.emit('pad', e.gamepad); });
    addEventListener('gamepaddisconnected', () => { this.padIndex = null; this.source = 'keyboard'; this.emit('pad', null); });
  }

  on(name, fn) { (this.listeners[name] = this.listeners[name] || []).push(fn); }
  emit(name, v) { (this.listeners[name] || []).forEach(fn => fn(v)); }

  load() { try { return JSON.parse(localStorage.getItem('fpv.radio')) || null; } catch (e) { return null; } }
  save(map) { this.map = map; try { localStorage.setItem('fpv.radio', JSON.stringify(map)); } catch (e) { /* private mode */ } }

  pad() {
    if (this.padIndex === null || !navigator.getGamepads) return null;
    return navigator.getGamepads()[this.padIndex] || null;
  }

  /** Read every source once per frame. */
  update(dt) {
    const k = c => this.keys.has(c);
    // keyboard: throttle is sticky like a real radio; the other axes spring back to centre
    const full = k('ShiftLeft') || k('ShiftRight') ? 1 : 0.65;
    const kb = this.kb;
    kb.throttle = clamp(kb.throttle + ((k('KeyW') ? 1 : 0) - (k('KeyS') ? 1 : 0)) * dt * 0.9, 0, 1);
    const ease = (cur, target, rate) => cur + (target - cur) * Math.min(1, dt * rate);
    kb.yaw = ease(kb.yaw, ((k('KeyD') ? 1 : 0) - (k('KeyA') ? 1 : 0)) * full, 9);
    kb.pitch = ease(kb.pitch, ((k('ArrowUp') ? 1 : 0) - (k('ArrowDown') ? 1 : 0)) * full, 9);
    kb.roll = ease(kb.roll, ((k('ArrowRight') ? 1 : 0) - (k('ArrowLeft') ? 1 : 0)) * full, 9);

    const pad = this.pad();
    if (pad) {
      const moved = pad.axes.some(a => Math.abs(a) > 0.25) || pad.buttons.some(b => b.pressed);
      if (moved && this.source === 'keyboard' && !this.keysActive()) this.source = this.isRadio(pad) ? 'radio' : 'gamepad';
    }
    if (pad && this.source !== 'keyboard') Object.assign(this.sticks, this.readPad(pad));
    else Object.assign(this.sticks, kb);
  }

  keysActive() { return ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].some(c => this.keys.has(c)); }

  isRadio(pad) { return pad.mapping !== 'standard' || /radiomaster|edgetx|opentx|frsky|jumper|tbs|betafpv|radio|joystick|stm/i.test(pad.id); }

  readPad(pad) {
    const dz = v => (Math.abs(v) < 0.03 ? 0 : v);
    if (this.isRadio(pad)) {
      const m = this.map || Input.defaultRadio();
      const axis = c => {
        const a = pad.axes[c.axis] ?? 0;
        // normalise with the calibrated end points, then flip if the axis runs backwards
        let v = c.max !== c.min ? ((a - c.min) / (c.max - c.min)) * 2 - 1 : a;
        if (c.invert) v = -v;
        return clamp(v, -1, 1);
      };
      const arm = m.arm ? (m.arm.type === 'button' ? !!pad.buttons[m.arm.index]?.pressed : (pad.axes[m.arm.index] ?? -1) * (m.arm.invert ? -1 : 1) > 0.3) : null;
      this.armSwitch = arm;
      const mode = m.mode ? ((pad.axes[m.mode.index] ?? -1) * (m.mode.invert ? -1 : 1) > 0.3 ? 'angle' : 'acro') : null;
      this.modeSwitch = mode;
      return { throttle: (axis(m.throttle) + 1) / 2, yaw: dz(axis(m.yaw)), pitch: dz(axis(m.pitch)), roll: dz(axis(m.roll)) };
    }
    // standard gamepad, Mode 2: left stick throttle and yaw, right stick pitch and roll
    this.armSwitch = null; this.modeSwitch = null;
    const ly = -pad.axes[1], lx = pad.axes[0], rx = pad.axes[2], ry = -pad.axes[3];
    return { throttle: clamp((ly + 1) / 2, 0, 1), yaw: dz(lx), pitch: dz(ry), roll: dz(rx) };
  }

  static defaultRadio() {
    // EdgeTX joystick mode with AETR channel order: CH1 roll, CH2 pitch, CH3 throttle, CH4 yaw
    return { roll: { axis: 0, min: -1, max: 1 }, pitch: { axis: 1, min: -1, max: 1 }, throttle: { axis: 2, min: -1, max: 1 }, yaw: { axis: 3, min: -1, max: 1 }, arm: { type: 'axis', index: 4 } };
  }
}

/* The radio setup wizard: each step watches every axis and picks the one that moved most. */
class RadioWizard {
  constructor(input, ui) {
    this.input = input; this.ui = ui;
    this.steps = [
      { key: 'center', text: 'Centre the right stick, put throttle all the way down, flip all switches off. Then press Next.' },
      { key: 'throttle', text: 'Move the throttle stick (left stick, up and down) through its full range a few times.' },
      { key: 'yaw', text: 'Push yaw (left stick) fully to the right and hold it.' },
      { key: 'pitch', text: 'Push pitch (right stick) fully forward, away from you, and hold it.' },
      { key: 'roll', text: 'Push roll (right stick) fully to the right and hold it.' },
      { key: 'arm', text: 'Optional: flip your arm switch on and leave it on. Press Skip if you arm with the Space bar.' },
      { key: 'mode', text: 'Optional: flip the switch you want for Angle / Acro to Angle. Press Skip to use the M key.' },
    ];
  }

  start() {
    const pad = this.input.pad();
    if (!pad) { this.ui.say('No controller found. Plug the radio in over USB, choose Joystick (HID) on the radio, then press any stick or switch.', true); return false; }
    this.i = 0; this.map = {}; this.used = new Set();
    this.ui.say(`Found: ${pad.id.slice(0, 60)}`);
    this.show();
    this.timer = setInterval(() => this.sample(), 30);
    return true;
  }

  show() { const s = this.steps[this.i]; this.ui.step(this.i + 1, this.steps.length, s.text, s.key === 'arm' || s.key === 'mode'); this.track = null; }

  sample() {
    const pad = this.input.pad(); if (!pad) return;
    const s = this.steps[this.i];
    if (s.key === 'center') { this.rest = pad.axes.slice(); this.restButtons = pad.buttons.map(b => b.pressed); this.ui.live(pad.axes); return; }
    if (!this.track) this.track = pad.axes.map(a => ({ min: a, max: a, last: a }));
    pad.axes.forEach((a, i) => { const t = this.track[i]; t.min = Math.min(t.min, a); t.max = Math.max(t.max, a); t.last = a; });
    this.ui.live(pad.axes);
    if (s.key === 'arm' || s.key === 'mode') {
      const b = pad.buttons.findIndex((x, i) => x.pressed && !this.restButtons[i]);
      if (b >= 0) { this.map[s.key] = { type: 'button', index: b }; this.ui.found(`Button ${b + 1}`); }
    }
  }

  best(exclude) {
    let best = -1, range = 0;
    this.track.forEach((t, i) => { if (exclude.has(i)) return; const r = t.max - t.min; if (r > range) { range = r; best = i; } });
    return range > 0.4 ? best : -1;
  }

  next() {
    const s = this.steps[this.i];
    if (s.key === 'throttle') {
      const a = this.best(this.used); if (a < 0) return this.ui.say('Did not see the throttle move. Try again.', true);
      const t = this.track[a];
      // throttle was down at the centring step: that end is the minimum
      const downIsLow = Math.abs(this.rest[a] - t.min) < Math.abs(this.rest[a] - t.max);
      this.map.throttle = { axis: a, min: downIsLow ? t.min : t.max, max: downIsLow ? t.max : t.min };
      this.used.add(a);
    } else if (['yaw', 'pitch', 'roll'].includes(s.key)) {
      const a = this.best(this.used); if (a < 0) return this.ui.say('Did not see that stick move. Hold it fully over and press Next.', true);
      const t = this.track[a], centre = this.rest[a];
      const span = Math.max(Math.abs(t.max - centre), Math.abs(t.min - centre)) || 1;
      const positive = Math.abs(t.last - t.max) < Math.abs(t.last - t.min);
      this.map[s.key] = { axis: a, min: centre - span, max: centre + span, invert: !positive };
      this.used.add(a);
    } else if ((s.key === 'arm' || s.key === 'mode') && !this.map[s.key]) {
      const a = this.best(this.used);
      if (a >= 0) { const t = this.track[a]; this.map[s.key] = { type: 'axis', index: a, invert: t.last < this.rest[a] }; this.used.add(a); }
    }
    this.i++;
    if (this.i >= this.steps.length) return this.finish();
    this.show();
  }

  skip() { this.i++; if (this.i >= this.steps.length) return this.finish(); this.show(); }

  finish() {
    clearInterval(this.timer);
    this.input.save(this.map);
    this.input.source = 'radio';
    this.ui.done(this.map);
  }

  cancel() { clearInterval(this.timer); }
}
