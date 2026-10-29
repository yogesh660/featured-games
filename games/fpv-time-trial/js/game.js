/**
 * Main FPV Game Coordinator
 * Orchestrates Three.js rendering, physics loop, audio synthesis,
 * camera systems, tracks, telemetry HUD, UI modals, and automated test bench.
 */

class FpvGame {
  constructor() {
    this.container = document.getElementById('canvas-container');
    
    // Core Modules
    this.rates = new RatesEngine();
    this.rates.loadPreset('micro-indoor');

    this.currentSpecId = 'tinywhoop65';
    this.currentEnvId = 'living-room';
    this.cameraMode = 'FPV'; // 'FPV' or 'CHASE'
    this.cameraTilt = 20;    // degrees

    this.audio = new FpvAudio();
    this.controls = new FpvControls();
    
    // Three.js Scene Setup
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(115, window.innerWidth / window.innerHeight, 0.02, 500);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // Subsystems
    this.envManager = new EnvironmentsManager(THREE, this.scene);
    this.trackManager = new TrackManager(THREE, this.scene);
    this.physics = new FpvPhysics(THREE, DRONE_SPECS[this.currentSpecId], this.rates);
    this.testBench = new FpvTestBench(this);

    // Drone 3D Visual Mesh
    this.droneMesh = null;

    // Previous position for gate raycasting/plane pass
    this.prevPosition = new THREE.Vector3();

    // Clock & Timing
    this.clock = new THREE.Clock();
    this.countdownSeconds = -1;
    this.countdownTimer = null;
    this.isStarted = false;

    // Temp Math Helpers
    this._camOffset = new THREE.Vector3();
    this._camEuler = new THREE.Euler(0, 0, 0, 'YXZ');
    this._camQuat = new THREE.Quaternion();

    this.init();
  }

  init() {
    // 1. Load Initial Environment & Track
    this.loadEnvironment(this.currentEnvId);

    // 2. Build 3D Drone Mesh
    this.setDrone(this.currentSpecId);

    // 3. Setup Window Resize
    window.addEventListener('resize', () => this.onWindowResize());

    // 4. Setup Key Shortcuts
    window.addEventListener('keydown', (e) => this.onKeyDown(e));

    // 5. Wire Up UI Modals & Buttons
    this.setupUI();

    // 6. Hook Audio Activation on First User Interaction
    const unlockAudio = () => {
      this.audio.init();
      this.audio.resume();
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
    window.addEventListener('click', unlockAudio);
    window.addEventListener('keydown', unlockAudio);

    // 7. Start Render Loop
    this.animate();

    // 8. Auto-start if requested in URL query (e.g. ?testbench=1 for headless testing)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('testbench')) {
      const modalStart = document.getElementById('modal-start');
      if (modalStart) modalStart.classList.remove('open');
      unlockAudio();
      const sec = parseFloat(urlParams.get('testbench')) || 20.0;
      setTimeout(() => {
        this.testBench.start(sec);
      }, 500);
    } else if (urlParams.has('autostart')) {
      const modalStart = document.getElementById('modal-start');
      if (modalStart) modalStart.classList.remove('open');
      unlockAudio();
      setTimeout(() => {
        this.startCountdown();
      }, 500);
    }
  }

  loadEnvironment(envId) {
    this.currentEnvId = envId;
    const envData = this.envManager.load(envId);
    this.physics.setColliders(envData.colliders);

    // Load track corresponding to environment
    const trackDef = this.trackManager.loadTrack(envId);
    document.getElementById('hud-track-name').innerText = trackDef.name;

    // Reset physics to spawn point
    this.physics.reset(envData.spawnPoint, envData.spawnRotationY);
    this.prevPosition.copy(this.physics.position);

    // Update stored best time in HUD
    this.updateBestTimeDisplay();
  }

  setDrone(specId) {
    if (!DRONE_SPECS[specId]) return;
    this.currentSpecId = specId;
    const spec = DRONE_SPECS[specId];

    // Remove old drone mesh
    if (this.droneMesh) {
      this.scene.remove(this.droneMesh);
    }

    // Build new procedural drone mesh
    this.droneMesh = DroneModelBuilder.createDroneMesh(THREE, spec);
    this.scene.add(this.droneMesh);

    // Update physics spec
    this.physics.setDroneSpec(spec);
    this.cameraTilt = spec.defaultCameraTilt;
    this.camera.fov = spec.cameraFov || 115;
    this.camera.updateProjectionMatrix();

    // Update audio profile
    this.audio.setProfile(spec.soundProfile);

    // Update HUD
    document.getElementById('hud-drone-name').innerText = spec.name;
    document.getElementById('hud-drone-category').innerText = spec.category;
  }

  startCountdown() {
    this.isStarted = true;
    this.countdownSeconds = 3;
    const alertEl = document.getElementById('hud-alert');

    const tick = () => {
      if (this.countdownSeconds > 0) {
        alertEl.innerText = this.countdownSeconds.toString();
        alertEl.classList.add('show');
        this.audio.playCountdownBeep(false);
        this.countdownSeconds--;
        this.countdownTimer = setTimeout(tick, 900);
      } else if (this.countdownSeconds === 0) {
        alertEl.innerText = "GO!";
        alertEl.classList.add('show');
        this.audio.playCountdownBeep(true);
        this.trackManager.startRace();
        this.countdownSeconds = -1;
        setTimeout(() => {
          alertEl.classList.remove('show');
        }, 1000);
      }
    };
    tick();
  }

  resetDrone() {
    const envData = {
      spawnPoint: this.envManager.spawnPoint,
      spawnRotationY: this.envManager.spawnRotationY
    };
    this.physics.reset(envData.spawnPoint, envData.spawnRotationY);
    this.prevPosition.copy(this.physics.position);
    this.showAlert("DRONE RESET", 1000);
  }

  showAlert(text, durationMs = 1200) {
    const el = document.getElementById('hud-alert');
    if (!el) return;
    el.innerText = text;
    el.classList.add('show');
    setTimeout(() => {
      el.classList.remove('show');
    }, durationMs);
  }

  onKeyDown(e) {
    switch (e.code) {
      case 'KeyR':
        this.resetDrone();
        break;
      case 'KeyT':
        this.physics.triggerTurtleMode();
        this.showAlert("TURTLE MODE FLIP", 1000);
        break;
      case 'KeyC':
        this.toggleCameraMode();
        break;
      case 'KeyM':
        this.cycleFlightMode();
        break;
      case 'Escape':
        this.openStartMenu();
        break;
    }
  }

  toggleCameraMode() {
    this.cameraMode = (this.cameraMode === 'FPV') ? 'CHASE' : 'FPV';
    const btn = document.getElementById('btn-cam');
    if (btn) btn.innerText = `CAM: ${this.cameraMode}`;
    this.showAlert(`VIEW: ${this.cameraMode}`, 800);
  }

  cycleFlightMode() {
    const modes = ['ANGLE', 'ACRO', 'HORIZON'];
    const idx = modes.indexOf(this.physics.mode);
    const nextMode = modes[(idx + 1) % modes.length];
    this.physics.setMode(nextMode);

    const modeEl = document.getElementById('osd-flight-mode');
    if (modeEl) {
      modeEl.innerText = nextMode;
      modeEl.className = `osd-flight-mode ${nextMode.toLowerCase()}`;
    }
    this.showAlert(`FLIGHT MODE: ${nextMode}`, 900);
  }

  openStartMenu() {
    const modalStart = document.getElementById('modal-start');
    if (modalStart) {
      modalStart.classList.add('open');
    }
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const dt = this.clock.getDelta();

    // 1. Update Input Controls
    this.controls.update(dt);

    // 2. Allow Automated Test Bench / Autopilot to override inputs if active
    if (this.testBench && this.testBench.isActive) {
      this.testBench.update(dt, this.controls.inputs);
    }

    // 3. Physics Step
    this.physics.update(dt, this.controls.inputs);

    // 4. Audio Update
    const speedKmh = this.physics.velocity.length() * 3.6;
    const angSpeed = this.physics.angularVelocity.length();
    this.audio.update(this.physics.currentThrustPercent, speedKmh, angSpeed);

    // 5. Update Animated Environment Props (e.g. Ceiling Fan)
    this.envManager.update(dt);

    // 6. Update Drone 3D Visual Mesh
    if (this.droneMesh) {
      this.droneMesh.position.copy(this.physics.position);
      this.droneMesh.quaternion.copy(this.physics.quaternion);

      // Animate spinning props based on motor RPM
      if (this.droneMesh.userData && this.droneMesh.userData.props) {
        const spinSpeed = 30.0 + this.physics.motorRpm * 180.0;
        this.droneMesh.userData.props.forEach((prop, idx) => {
          prop.rotation.y += (idx % 2 === 0 ? 1 : -1) * spinSpeed * dt;
        });
      }

      // Hide drone frame in first-person view, show in chase view
      this.droneMesh.visible = (this.cameraMode === 'CHASE');
    }

    // 7. Camera Position & Attitude Update
    this.updateCamera();

    // 8. Track Gate Crossing Validation
    this.trackManager.update(dt);
    const passResult = this.trackManager.checkDronePass(this.physics.position, this.prevPosition);
    if (passResult) {
      this.audio.playGateChime();
      if (passResult.raceFinished) {
        this.onRaceFinished(passResult.splitTime);
      } else if (passResult.isLapComplete) {
        this.showAlert(`LAP ${passResult.lap} / ${passResult.totalLaps}!`, 1200);
      } else {
        this.showAlert(`GATE ${passResult.gateIndex + 1} PASSED!`, 800);
      }
    }
    this.prevPosition.copy(this.physics.position);

    // 9. Update HUD & OSD Telemetry
    this.updateHUD(speedKmh);

    // 10. Render 3D Scene
    this.renderer.render(this.scene, this.camera);
  }

  updateCamera() {
    if (this.cameraMode === 'FPV') {
      // First-Person View directly from drone camera pod
      this.camera.position.copy(this.physics.position);

      // Orient camera with quad attitude + upward camera tilt
      const tiltRad = (this.cameraTilt * Math.PI) / 180.0;
      const tiltQuat = this._camQuat.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -tiltRad);

      this.camera.quaternion.copy(this.physics.quaternion).multiply(tiltQuat);

    } else {
      // Third-Person Chase Cam
      const backOffset = new THREE.Vector3(0, 0.45, 1.2).applyQuaternion(this.physics.quaternion);
      const targetPos = this.physics.position.clone().add(backOffset);
      this.camera.position.lerp(targetPos, 0.15);
      this.camera.lookAt(this.physics.position.clone().add(new THREE.Vector3(0, 0.15, 0)));
    }
  }

  updateHUD(speedKmh) {
    // Timer
    const timerEl = document.getElementById('hud-timer');
    if (timerEl) {
      const t = this.trackManager.raceTime;
      const mins = Math.floor(t / 60);
      const secs = Math.floor(t % 60);
      const ms = Math.floor((t * 100) % 100);
      timerEl.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }

    // Gate & Lap Info
    const gateInfoEl = document.getElementById('hud-gate-info');
    if (gateInfoEl) {
      const curGate = this.trackManager.currentGateIndex + 1;
      const totalGates = this.trackManager.gates.length;
      gateInfoEl.innerText = `GATE ${curGate}/${totalGates} · LAP ${this.trackManager.lap}/${this.trackManager.totalLaps}`;
    }

    // Throttle gauge
    const thrFill = document.getElementById('osd-throttle-fill');
    const thrLabel = document.getElementById('osd-throttle-val');
    const thrPct = Math.round(this.physics.currentThrustPercent * 100);
    if (thrFill) thrFill.style.height = `${thrPct}%`;
    if (thrLabel) thrLabel.innerText = `${thrPct}%`;

    // Speedometer & Voltage Telemetry
    const speedEl = document.getElementById('osd-speed-val');
    if (speedEl) speedEl.innerText = Math.round(speedKmh).toString();

    const voltEl = document.getElementById('osd-volt-val');
    if (voltEl) voltEl.innerText = this.physics.batteryVoltage.toFixed(2);

    // Artificial Horizon Ladder
    const horizonEl = document.getElementById('osd-horizon-ladder');
    if (horizonEl) {
      this._camEuler.setFromQuaternion(this.camera.quaternion, 'YXZ');
      const rollDeg = (this._camEuler.z * 180) / Math.PI;
      const pitchOffset = Math.sin(this._camEuler.x) * 45; // pixel translation
      horizonEl.style.transform = `translateY(${pitchOffset}px) rotate(${-rollDeg}deg)`;
    }

    // Target Gate Direction Arrow
    const targetGate = this.trackManager.getCurrentTargetGate();
    const arrowEl = document.getElementById('gate-target-arrow');
    if (targetGate && arrowEl) {
      const dist = this.physics.position.distanceTo(targetGate.pos).toFixed(1);
      arrowEl.innerHTML = `TARGET: ${targetGate.data.label} <span style="color:#00f0ff;">${dist}m</span>`;
    }
  }

  onRaceFinished(totalTime) {
    const mins = Math.floor(totalTime / 60);
    const secs = Math.floor(totalTime % 60);
    const ms = Math.floor((totalTime * 100) % 100);
    const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;

    this.showAlert(`FINISH! TIME: ${timeStr}`, 3500);

    // Save Personal Best
    const key = `fpv_best_${this.currentEnvId}`;
    const prevBest = localStorage.getItem(key);
    if (!prevBest || totalTime < parseFloat(prevBest)) {
      localStorage.setItem(key, totalTime.toString());
      this.updateBestTimeDisplay();
      setTimeout(() => {
        this.showAlert("NEW PERSONAL BEST!", 2500);
      }, 3600);
    }
  }

  updateBestTimeDisplay() {
    const key = `fpv_best_${this.currentEnvId}`;
    const bestTime = localStorage.getItem(key);
    const bestEl = document.getElementById('hud-best-time-val');
    if (!bestEl) return;
    if (bestTime) {
      const t = parseFloat(bestTime);
      const mins = Math.floor(t / 60);
      const secs = Math.floor(t % 60);
      const ms = Math.floor((t * 100) % 100);
      bestEl.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    } else {
      bestEl.innerText = '--:--.--';
    }
  }

  setupUI() {
    // 0. Start Menu Modal Controls
    const modalStart = document.getElementById('modal-start');
    const btnOpenMenu = document.getElementById('btn-open-menu');
    if (btnOpenMenu && modalStart) {
      btnOpenMenu.addEventListener('click', () => {
        modalStart.classList.add('open');
      });
    }

    const btnStartFlight = document.getElementById('btn-start-flight');
    if (btnStartFlight && modalStart) {
      btnStartFlight.addEventListener('click', () => {
        modalStart.classList.remove('open');
        this.audio.init();
        this.audio.resume();
        this.startCountdown();
      });
    }

    const btnStartTestbench = document.getElementById('btn-start-testbench');
    if (btnStartTestbench && modalStart) {
      btnStartTestbench.addEventListener('click', () => {
        modalStart.classList.remove('open');
        this.audio.init();
        this.audio.resume();
        this.testBench.start(20);
      });
    }

    const btnTestbenchHud = document.getElementById('btn-testbench-hud');
    if (btnTestbenchHud) {
      btnTestbenchHud.addEventListener('click', () => {
        if (modalStart) modalStart.classList.remove('open');
        this.audio.init();
        this.audio.resume();
        this.testBench.start(20);
      });
    }

    // Start Menu Drone Pills
    const dronePills = document.querySelectorAll('#start-drone-pills .start-pill-opt');
    dronePills.forEach(pill => {
      pill.addEventListener('click', () => {
        dronePills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const dId = pill.getAttribute('data-drone');
        this.setDrone(dId);
      });
    });

    // Start Menu Environment Pills
    const envPills = document.querySelectorAll('#start-env-pills .start-pill-opt');
    envPills.forEach(pill => {
      pill.addEventListener('click', () => {
        envPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const eId = pill.getAttribute('data-env');
        this.loadEnvironment(eId);
      });
    });

    // Start Menu Mode Pills
    const modePills = document.querySelectorAll('#start-mode-pills .start-pill-opt');
    modePills.forEach(pill => {
      pill.addEventListener('click', () => {
        modePills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const m = pill.getAttribute('data-mode');
        this.physics.setMode(m);
        const modeEl = document.getElementById('osd-flight-mode');
        if (modeEl) {
          modeEl.innerText = m;
          modeEl.className = `osd-flight-mode ${m.toLowerCase()}`;
        }
      });
    });

    // Drone Modal
    const btnDrone = document.getElementById('btn-drone');
    const modalDrone = document.getElementById('modal-drone');
    const closeDrone = document.getElementById('close-modal-drone');
    if (btnDrone && modalDrone) {
      btnDrone.addEventListener('click', () => {
        this._renderDroneCards();
        modalDrone.classList.add('open');
      });
      closeDrone.addEventListener('click', () => modalDrone.classList.remove('open'));
    }

    // Environment Modal
    const btnEnv = document.getElementById('btn-env');
    const modalEnv = document.getElementById('modal-env');
    const closeEnv = document.getElementById('close-modal-env');
    if (btnEnv && modalEnv) {
      btnEnv.addEventListener('click', () => {
        this._renderEnvCards();
        modalEnv.classList.add('open');
      });
      closeEnv.addEventListener('click', () => modalEnv.classList.remove('open'));
    }

    // Rates Modal
    const btnRates = document.getElementById('btn-rates');
    const modalRates = document.getElementById('modal-rates');
    const closeRates = document.getElementById('close-modal-rates');
    if (btnRates && modalRates) {
      btnRates.addEventListener('click', () => {
        this._syncRatesInputs();
        modalRates.classList.add('open');
      });
      closeRates.addEventListener('click', () => modalRates.classList.remove('open'));
    }

    // Camera toggle button
    const btnCam = document.getElementById('btn-cam');
    if (btnCam) {
      btnCam.addEventListener('click', () => this.toggleCameraMode());
    }

    // Mode cycle button
    const btnMode = document.getElementById('btn-mode-toggle');
    if (btnMode) {
      btnMode.addEventListener('click', () => this.cycleFlightMode());
    }

    // Reset button
    const btnReset = document.getElementById('btn-reset');
    if (btnReset) {
      btnReset.addEventListener('click', () => this.resetDrone());
    }

    // Audio mute toggle
    const btnAudio = document.getElementById('btn-audio');
    if (btnAudio) {
      btnAudio.addEventListener('click', () => {
        const muted = this.audio.enabled;
        this.audio.setMuted(muted);
        btnAudio.innerText = muted ? '🔇 MUTED' : '🔊 AUDIO';
      });
    }

    // Gamepad status callback
    window.onGamepadStatusChange = (connected, id) => {
      const gpBadge = document.getElementById('hud-gamepad-badge');
      if (gpBadge) {
        if (connected) {
          gpBadge.innerText = '🎮 RC / GAMEPAD DETECTED';
          gpBadge.style.color = '#10b981';
          gpBadge.title = id;
        } else {
          gpBadge.innerText = '⌨ KEYBOARD MODE';
          gpBadge.style.color = '#9ca3af';
        }
      }
    };
  }

  _renderDroneCards() {
    const container = document.getElementById('drone-cards-container');
    if (!container) return;
    container.innerHTML = '';

    Object.values(DRONE_SPECS).forEach(spec => {
      const card = document.createElement('div');
      card.className = `select-card ${spec.id === this.currentSpecId ? 'selected' : ''}`;
      card.innerHTML = `
        <div class="card-title-row">
          <div class="card-name">${spec.name}</div>
          <span class="card-tag" style="color:${spec.themeColor};">${spec.badge}</span>
        </div>
        <div class="card-desc">${spec.description}</div>
        <div class="card-stats">
          <span>MASS: ${Math.round(spec.mass * 1000)}g</span>
          <span>TWR: ${spec.twr}:1</span>
          <span>MAX: ${spec.topSpeedKmh} KM/H</span>
        </div>
      `;
      card.addEventListener('click', () => {
        this.setDrone(spec.id);
        document.getElementById('modal-drone').classList.remove('open');
        this.showAlert(`LOADED: ${spec.name}`, 1200);
      });
      container.appendChild(card);
    });
  }

  _renderEnvCards() {
    const container = document.getElementById('env-cards-container');
    if (!container) return;
    container.innerHTML = '';

    EnvironmentsManager.getList().forEach(env => {
      const card = document.createElement('div');
      card.className = `select-card ${env.id === this.currentEnvId ? 'selected' : ''}`;
      card.innerHTML = `
        <div class="card-title-row">
          <div class="card-name">${env.name}</div>
          <span class="card-tag">${env.badge}</span>
        </div>
        <div class="card-desc">${env.description}</div>
        <div class="card-stats">
          <span style="color:#00f0ff;">RECOMMENDED: ${env.bestFor}</span>
        </div>
      `;
      card.addEventListener('click', () => {
        this.loadEnvironment(env.id);
        document.getElementById('modal-env').classList.remove('open');
        this.showAlert(`MAP: ${env.name}`, 1200);
      });
      container.appendChild(card);
    });
  }

  _syncRatesInputs() {
    const centerSlider = document.getElementById('rate-center');
    const maxSlider = document.getElementById('rate-max');
    const expoSlider = document.getElementById('rate-expo');
    const tiltSlider = document.getElementById('camera-tilt-input');

    if (centerSlider) centerSlider.value = this.rates.actual.roll.center;
    if (maxSlider) maxSlider.value = this.rates.actual.roll.max;
    if (expoSlider) expoSlider.value = Math.round(this.rates.actual.roll.expo * 100);
    if (tiltSlider) tiltSlider.value = this.cameraTilt;

    // Presets selector
    const presetSelect = document.getElementById('rates-preset-select');
    if (presetSelect) {
      presetSelect.onchange = (e) => {
        this.rates.loadPreset(e.target.value);
        this._syncRatesInputs();
      };
    }

    // Camera tilt live update
    if (tiltSlider) {
      tiltSlider.oninput = (e) => {
        this.cameraTilt = parseInt(e.target.value);
        document.getElementById('tilt-val-display').innerText = `${this.cameraTilt}°`;
      };
    }

    // Slider inputs
    if (centerSlider) {
      centerSlider.oninput = (e) => {
        const val = parseInt(e.target.value);
        this.rates.actual.roll.center = val;
        this.rates.actual.pitch.center = val;
        document.getElementById('center-val-display').innerText = `${val} deg/s`;
      };
    }
    if (maxSlider) {
      maxSlider.oninput = (e) => {
        const val = parseInt(e.target.value);
        this.rates.actual.roll.max = val;
        this.rates.actual.pitch.max = val;
        document.getElementById('max-val-display').innerText = `${val} deg/s`;
      };
    }
    if (expoSlider) {
      expoSlider.oninput = (e) => {
        const val = parseInt(e.target.value) / 100.0;
        this.rates.actual.roll.expo = val;
        this.rates.actual.pitch.expo = val;
        document.getElementById('expo-val-display').innerText = val.toFixed(2);
      };
    }
  }
}

// Start game when page loads
window.addEventListener('DOMContentLoaded', () => {
  window.fpvGame = new FpvGame();
});
