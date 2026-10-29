/**
 * FPV Controls Engine - Web Gamepad API (RC Radio Transmitters & Controllers),
 * Keyboard smoothing filters, and Mobile Touch sticks.
 * Supports Mode 2 (Standard FPV) and Mode 1.
 */

class FpvControls {
  constructor() {
    // Current normalized inputs: 0..1 throttle, -1..1 roll, pitch, yaw
    this.inputs = {
      throttle: 0.0,
      roll: 0.0,
      pitch: 0.0,
      yaw: 0.0
    };

    // Controller configuration
    this.controllerMode = 2; // Mode 2: Left stick (Thr/Yaw), Right stick (Pitch/Roll)
    this.invertPitch = false;
    this.invertThrottle = false;
    this.gamepadIndex = null;
    this.gamepadName = '';

    // Keyboard state
    this.keys = {};
    this.virtualSticks = {
      throttle: 0.28, // Start with comfortable hover idle
      roll: 0.0,
      pitch: 0.0,
      yaw: 0.0
    };

    // Calibration offsets
    this.gamepadAxes = [0, 1, 2, 3];

    // Touch controls
    this.touchSticks = {
      left: { active: false, x: 0, y: 0, originX: 0, originY: 0 },
      right: { active: false, x: 0, y: 0, originX: 0, originY: 0 }
    };

    this._setupKeyboard();
    this._setupGamepadEvents();
    this._setupTouchEvents();
  }

  _setupKeyboard() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      // Prevent browser default scrolling for gameplay keys
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  }

  _setupGamepadEvents() {
    window.addEventListener('gamepadconnected', (e) => {
      this.gamepadIndex = e.gamepad.index;
      this.gamepadName = e.gamepad.id;
      console.log(`[FPV] Gamepad connected at index ${e.gamepad.index}: ${e.gamepad.id}`);
      if (window.onGamepadStatusChange) {
        window.onGamepadStatusChange(true, e.gamepad.id);
      }
    });

    window.addEventListener('gamepaddisconnected', (e) => {
      if (this.gamepadIndex === e.gamepad.index) {
        this.gamepadIndex = null;
        this.gamepadName = '';
        console.log(`[FPV] Gamepad disconnected: ${e.gamepad.id}`);
        if (window.onGamepadStatusChange) {
          window.onGamepadStatusChange(false, '');
        }
      }
    });
  }

  _setupTouchEvents() {
    const leftZone = document.getElementById('touch-left');
    const rightZone = document.getElementById('touch-right');
    if (!leftZone || !rightZone) return;

    const handleTouch = (zone, stickKey, isStart, touch) => {
      if (isStart) {
        const rect = zone.getBoundingClientRect();
        this.touchSticks[stickKey].active = true;
        this.touchSticks[stickKey].originX = rect.left + rect.width / 2;
        this.touchSticks[stickKey].originY = rect.top + rect.height / 2;
      }
      if (touch) {
        const dx = (touch.clientX - this.touchSticks[stickKey].originX) / 60;
        const dy = (touch.clientY - this.touchSticks[stickKey].originY) / 60;
        this.touchSticks[stickKey].x = Math.max(-1, Math.min(1, dx));
        this.touchSticks[stickKey].y = Math.max(-1, Math.min(1, dy));

        const knob = zone.querySelector('.touch-knob');
        if (knob) {
          knob.style.transform = `translate(${this.touchSticks[stickKey].x * 35}px, ${this.touchSticks[stickKey].y * 35}px)`;
        }
      } else {
        this.touchSticks[stickKey].active = false;
        this.touchSticks[stickKey].x = 0;
        this.touchSticks[stickKey].y = 0;
        const knob = zone.querySelector('.touch-knob');
        if (knob) {
          knob.style.transform = `translate(0px, 0px)`;
        }
      }
    };

    leftZone.addEventListener('touchstart', (e) => handleTouch(leftZone, 'left', true, e.touches[0]), { passive: true });
    leftZone.addEventListener('touchmove', (e) => handleTouch(leftZone, 'left', false, e.touches[0]), { passive: true });
    leftZone.addEventListener('touchend', () => handleTouch(leftZone, 'left', false, null), { passive: true });

    rightZone.addEventListener('touchstart', (e) => handleTouch(rightZone, 'right', true, e.touches[0]), { passive: true });
    rightZone.addEventListener('touchmove', (e) => handleTouch(rightZone, 'right', false, e.touches[0]), { passive: true });
    rightZone.addEventListener('touchend', () => handleTouch(rightZone, 'right', false, null), { passive: true });
  }

  /**
   * Update inputs each frame
   * @param {number} dt
   */
  update(dt) {
    let hasGamepad = false;

    // 1. Try Gamepad first (RC Radios, Xbox, PS)
    if (navigator.getGamepads) {
      const gamepads = navigator.getGamepads();
      let gp = null;
      if (this.gamepadIndex !== null && gamepads[this.gamepadIndex]) {
        gp = gamepads[this.gamepadIndex];
      } else {
        // Auto-find first connected gamepad
        for (let i = 0; i < gamepads.length; i++) {
          if (gamepads[i]) {
            gp = gamepads[i];
            this.gamepadIndex = i;
            this.gamepadName = gp.id;
            break;
          }
        }
      }

      if (gp && gp.axes && gp.axes.length >= 4) {
        hasGamepad = true;
        this._pollGamepad(gp);
      }
    }

    // 2. Fall back to Keyboard or Touch if no gamepad active
    if (!hasGamepad) {
      this._pollKeyboard(dt);
      this._pollTouch();
    }
  }

  _pollGamepad(gp) {
    const axes = gp.axes;

    if (this.controllerMode === 2) {
      // Standard Mode 2:
      // Left Stick: axes[0] = Yaw, axes[1] = Throttle
      // Right Stick: axes[2] = Roll, axes[3] = Pitch
      let rawYaw = axes[0];
      let rawThr = axes[1];
      let rawRoll = (axes.length > 2) ? axes[2] : 0;
      let rawPitch = (axes.length > 3) ? axes[3] : 0;

      this.inputs.yaw = rawYaw;
      let thrNorm = (-rawThr + 1.0) * 0.5;
      if (this.invertThrottle) thrNorm = 1.0 - thrNorm;
      this.inputs.throttle = Math.max(0, Math.min(1.0, thrNorm));

      this.inputs.roll = rawRoll;
      this.inputs.pitch = this.invertPitch ? rawPitch : -rawPitch;

    } else {
      // Mode 1:
      this.inputs.yaw = axes[0];
      this.inputs.pitch = this.invertPitch ? axes[1] : -axes[1];
      let thrNorm = (-axes[3] + 1.0) * 0.5;
      this.inputs.throttle = Math.max(0, Math.min(1.0, thrNorm));
      this.inputs.roll = axes[2];
    }
  }

  _pollKeyboard(dt) {
    const rate = 9.0 * dt; // Stick response snappiness

    // Throttle: Space or Shift to climb, Ctrl or X to descend
    // In keyboard play, when keys are idle, maintain base hover throttle
    const hoverBase = 0.28;
    let targetThr = this.virtualSticks.throttle;

    if (this.keys['Space'] || this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
      targetThr += 1.8 * dt;
    } else if (this.keys['ControlLeft'] || this.keys['ControlRight'] || this.keys['KeyX']) {
      targetThr -= 2.2 * dt;
    } else {
      // Gently return to hover throttle in Angle mode
      targetThr += (hoverBase - targetThr) * Math.min(1.0, 1.2 * dt);
    }
    this.virtualSticks.throttle = Math.max(0, Math.min(1.0, targetThr));

    // Pitch: W or ArrowUp = Pitch Forward (nose down); S or ArrowDown = Pitch Backward (nose up)
    let targetPitch = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp'] || this.keys['KeyI']) {
      targetPitch += 1.0;
    }
    if (this.keys['KeyS'] || this.keys['ArrowDown'] || this.keys['KeyK']) {
      targetPitch -= 1.0;
    }
    this.virtualSticks.pitch += (targetPitch - this.virtualSticks.pitch) * Math.min(1.0, rate);

    // Roll: D or ArrowRight = Roll Right; A or ArrowLeft = Roll Left
    let targetRoll = 0;
    if (this.keys['KeyD'] || this.keys['ArrowRight'] || this.keys['KeyL']) {
      targetRoll += 1.0;
    }
    if (this.keys['KeyA'] || this.keys['ArrowLeft'] || this.keys['KeyJ']) {
      targetRoll -= 1.0;
    }
    this.virtualSticks.roll += (targetRoll - this.virtualSticks.roll) * Math.min(1.0, rate);

    // Yaw: E = Yaw Right; Q = Yaw Left
    let targetYaw = 0;
    if (this.keys['KeyE']) targetYaw += 1.0;
    if (this.keys['KeyQ']) targetYaw -= 1.0;
    this.virtualSticks.yaw += (targetYaw - this.virtualSticks.yaw) * Math.min(1.0, rate);

    this.inputs.throttle = this.virtualSticks.throttle;
    this.inputs.pitch = this.virtualSticks.pitch;
    this.inputs.roll = this.virtualSticks.roll;
    this.inputs.yaw = this.virtualSticks.yaw;
  }

  _pollTouch() {
    if (this.touchSticks.left.active) {
      this.inputs.yaw = this.touchSticks.left.x;
      // Invert Y so up is higher throttle
      this.inputs.throttle = Math.max(0, Math.min(1.0, ((-this.touchSticks.left.y + 1) * 0.5)));
    }
    if (this.touchSticks.right.active) {
      this.inputs.roll = this.touchSticks.right.x;
      this.inputs.pitch = -this.touchSticks.right.y;
    }
  }
}

window.FpvControls = FpvControls;
