/**
 * Open Road Racer - Input & Controls Manager
 * Handles Keyboard, Gamepad, and Mobile Touch controls seamlessly.
 */

class InputManager {
  constructor() {
    this.keys = {
      throttle: 0,   // 0 to 1
      brake: 0,      // 0 to 1
      steer: 0,      // -1 (left) to 1 (right)
      handbrake: false,
      reset: false,
      changeCamera: false,
      togglePause: false
    };

    // Raw key states
    this.rawKeys = {};

    // Touch states
    this.touchSteerLeft = false;
    this.touchSteerRight = false;
    this.touchGas = false;
    this.touchBrake = false;
    this.touchHandbrake = false;

    this.isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

    this.setupKeyboard();
    if (this.isTouchDevice) {
      this.setupTouch();
    }

    // QA test-drive mode support
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('testdrive') === '1') {
      let simTime = 0;
      setInterval(() => {
        simTime += 0.05;
        this.rawKeys['KeyW'] = true;
        if (simTime > 1.0 && simTime < 3.2) {
          this.rawKeys['KeyD'] = true;
        } else {
          this.rawKeys['KeyD'] = false;
        }
      }, 50);
    }
  }

  setupKeyboard() {
    window.addEventListener('keydown', (e) => {
      this.rawKeys[e.code] = true;

      if (e.code === 'KeyC') {
        this.keys.changeCamera = true;
      }
      if (e.code === 'KeyR') {
        this.keys.reset = true;
      }
      if (e.code === 'Escape' || e.code === 'KeyP') {
        this.keys.togglePause = true;
      }

      // Prevent default page scroll on arrow keys / space
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.rawKeys[e.code] = false;
    });

    window.addEventListener('blur', () => {
      this.rawKeys = {};
      this.resetInputs();
    });
  }

  setupTouch() {
    const touchUI = document.getElementById('touch-controls');
    if (touchUI) {
      touchUI.style.display = 'flex';
    }

    const bindTouch = (id, onDown, onUp) => {
      const el = document.getElementById(id);
      if (!el) return;

      const start = (e) => {
        e.preventDefault();
        el.classList.add('pressed');
        onDown();
      };
      const end = (e) => {
        e.preventDefault();
        el.classList.remove('pressed');
        onUp();
      };

      el.addEventListener('touchstart', start, { passive: false });
      el.addEventListener('touchend', end, { passive: false });
      el.addEventListener('touchcancel', end, { passive: false });
      el.addEventListener('mousedown', start);
      el.addEventListener('mouseup', end);
      el.addEventListener('mouseleave', end);
    };

    bindTouch('btn-steer-left', 
      () => { this.touchSteerLeft = true; }, 
      () => { this.touchSteerLeft = false; }
    );
    bindTouch('btn-steer-right', 
      () => { this.touchSteerRight = true; }, 
      () => { this.touchSteerRight = false; }
    );
    bindTouch('btn-pedal-gas', 
      () => { this.touchGas = true; }, 
      () => { this.touchGas = false; }
    );
    bindTouch('btn-pedal-brake', 
      () => { this.touchBrake = true; }, 
      () => { this.touchBrake = false; }
    );
    bindTouch('btn-touch-handbrake', 
      () => { this.touchHandbrake = true; }, 
      () => { this.touchHandbrake = false; }
    );
  }

  update(dt) {
    // Determine Throttle
    const keyUp = this.rawKeys['KeyW'] || this.rawKeys['ArrowUp'];
    const keyDown = this.rawKeys['KeyS'] || this.rawKeys['ArrowDown'];
    const keyLeft = this.rawKeys['KeyA'] || this.rawKeys['ArrowLeft'];
    const keyRight = this.rawKeys['KeyD'] || this.rawKeys['ArrowRight'];
    const keySpace = this.rawKeys['Space'];

    let targetThrottle = 0;
    if (keyUp || this.touchGas) targetThrottle = 1.0;

    let targetBrake = 0;
    if (keyDown || this.touchBrake) targetBrake = 1.0;

    let targetSteer = 0;
    if (keyLeft || this.touchSteerLeft) targetSteer -= 1.0;
    if (keyRight || this.touchSteerRight) targetSteer += 1.0;

    // Smooth inputs
    const steerSpeed = 6.0;
    this.keys.steer += (targetSteer - this.keys.steer) * Math.min(1.0, steerSpeed * dt);
    this.keys.throttle = targetThrottle;
    this.keys.brake = targetBrake;
    this.keys.handbrake = keySpace || this.touchHandbrake;
  }

  consumeAction(action) {
    if (this.keys[action]) {
      this.keys[action] = false;
      return true;
    }
    return false;
  }

  resetInputs() {
    this.keys.throttle = 0;
    this.keys.brake = 0;
    this.keys.steer = 0;
    this.keys.handbrake = false;
    this.touchSteerLeft = false;
    this.touchSteerRight = false;
    this.touchGas = false;
    this.touchBrake = false;
    this.touchHandbrake = false;
  }
}

window.InputManager = InputManager;
