/**
 * Open Road Racer - Main Game Controller & Loop (Overhauled)
 * Seamless 60fps render loop, ACES Filmic Tone Mapping, Time Trial logic & sound integration.
 */

class OpenRoadGame {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.clock = new THREE.Clock();

    // Systems
    this.world = null;
    this.vehicle = null;
    this.input = null;
    this.sound = null;
    this.ui = null;

    // State
    this.mode = 'trial'; // 'trial' or 'free'
    this.isPaused = false;
    this.lapActive = false;
    this.lapStartTime = 0;
    this.currentLapTime = 0;
    this.currentCheckpointIdx = 0;
    this.totalCheckpoints = 8;

    this.quality = 'high';

    this.init();
  }

  init() {
    try {
      this.setupThree();
      this.sound = new SoundEngine();
      this.input = new InputManager();

      this.world = new WorldGenerator(this.scene);
      this.world.init(this.renderer, this.quality);

      this.vehicle = new Vehicle(this.scene, this.world);
      this.ui = new UIController(this);

      this.setupEventListeners();
      this.hideLoader();

      // Start Clock & Render Loop
      this.clock.start();
      requestAnimationFrame((t) => this.renderLoop(t));

      setTimeout(() => {
        this.ui.showAlert("WELCOME TO SAHYADRI GHATS — WASD OR TOUCH TO DRIVE", 3800);
      }, 600);

    } catch (err) {
      console.error("Game initialization error:", err);
      this.showError(err.message);
    }
  }

  setupThree() {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1400
    );

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));

    // Cinematic Color Grading & Tone Mapping
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);
  }

  setupEventListeners() {
    window.addEventListener('resize', () => this.onResize());

    const unlockAudio = () => {
      if (this.sound) {
        this.sound.init();
        this.sound.resume();
      }
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
    window.addEventListener('click', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);
  }

  onResize() {
    if (!this.camera || !this.renderer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  renderLoop() {
    requestAnimationFrame((t) => this.renderLoop(t));

    let dt = this.clock.getDelta();
    if (dt > 0.08) dt = 0.08; // Clamp delta time

    if (this.input.consumeAction('togglePause')) {
      this.togglePause();
    }
    if (this.input.consumeAction('changeCamera')) {
      this.vehicle.toggleCamera();
      if (this.ui) this.ui.showAlert('CAMERA: ' + this.vehicle.cameraMode.toUpperCase());
    }
    if (this.input.consumeAction('reset')) {
      this.vehicle.resetPosition();
      if (this.ui) this.ui.showAlert('POSITION RESET');
    }
    if (this.input.consumeAction('switchVehicle')) {
      this.vehicle.cycleVehicle();
      if (this.ui) this.ui.showAlert('VEHICLE: ' + this.vehicle.metrics.name.toUpperCase());
    }

    if (this.isPaused) return;

    // 1. Process Inputs
    this.input.update(dt);

    // 2. Step Vehicle Simulation
    const telemetry = this.vehicle.update(dt, this.input);

    // 3. Update Audio Synthesizer
    if (this.sound) {
      this.sound.update(
        telemetry.speedKmh,
        telemetry.rpmNorm,
        telemetry.isSkidding,
        telemetry.isBraking
      );
    }

    // 4. Update Camera
    this.vehicle.updateCamera(this.camera, dt);

    // 5. Update Time Trial / Checkpoints
    this.updateTiming(dt);

    // 6. Update HUD
    this.ui.updateHUD(
      telemetry,
      this.currentLapTime,
      this.currentCheckpointIdx,
      this.totalCheckpoints,
      this.mode
    );

    // 7. Dynamic Shadow Frustum Focus
    if (this.world && this.world.updateShadowFocus) {
      this.world.updateShadowFocus(this.vehicle.carGroup.position);
    }

    // 8. Render
    this.renderer.render(this.scene, this.camera);
  }

  updateTiming(dt) {
    if (this.mode !== 'trial') return;

    if (!this.lapActive) {
      this.lapActive = true;
      this.lapStartTime = performance.now();
      this.currentLapTime = 0;
      this.currentCheckpointIdx = 0;
    } else {
      this.currentLapTime = performance.now() - this.lapStartTime;
    }

    const targetCp = this.world.checkpoints[this.currentCheckpointIdx];
    if (targetCp) {
      // Front wheels / front bumper 3D position (1.8m ahead of vehicle origin)
      const forward = this.vehicle.getForwardVector();
      const frontBumper = this.vehicle.carGroup.position.clone().addScaledVector(forward, 1.8);

      // Signed distance along gate road tangent
      const toFront = frontBumper.clone().sub(targetCp.position);
      const distAlongTangent = toFront.dot(targetCp.tangent);
      const distLateral = Math.abs(toFront.dot(targetCp.right));

      // Difference in spline progress
      let diffU = this.vehicle.progressU - targetCp.u;
      if (diffU < -0.5) diffU += 1.0;
      if (diffU > 0.5) diffU -= 1.0;

      // Trigger gate passed strictly when front wheels cross the gate plane:
      // 1. Vehicle is in proximity of the gate (-0.012 to +0.020 spline progress, within lateral corridor)
      // 2. Front wheels crossed plane: current distAlongTangent >= 0, and previous distance was < 0
      const inGateVicinity = (diffU >= -0.012 && diffU <= 0.020 && distLateral < 10.0);

      if (inGateVicinity) {
        if (distAlongTangent >= 0 && (targetCp.lastDist < 0 || targetCp.lastDist === -999)) {
          // Physical front-wheel gate crossing confirmed!
          if (this.sound) this.sound.playCheckpointChime();

          // Visual flash on checkpoint beam
          if (targetCp.beamMesh && targetCp.beamMesh.material) {
            const originalHex = targetCp.beamMesh.material.color.getHex();
            targetCp.beamMesh.material.color.setHex(0xffffff);
            setTimeout(() => {
              if (targetCp.beamMesh && targetCp.beamMesh.material) {
                targetCp.beamMesh.material.color.setHex(originalHex);
              }
            }, 350);
          }

          this.currentCheckpointIdx++;

          if (this.currentCheckpointIdx >= this.totalCheckpoints) {
            const finishedTime = this.currentLapTime;
            this.ui.showAlert(`LAP COMPLETE: ${this.ui.formatTime(finishedTime)}!`, 4500);
            this.ui.saveBestTime(finishedTime);

            // Start next lap
            this.currentCheckpointIdx = 0;
            this.lapStartTime = performance.now();
            this.world.checkpoints.forEach(cp => { cp.lastDist = -999; });
          } else {
            this.ui.showAlert(`CHECKPOINT ${this.currentCheckpointIdx} / ${this.totalCheckpoints}`);
          }
        }
      }

      targetCp.lastDist = distAlongTangent;
    }
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.ui.openPause();
    } else {
      this.ui.closePause();
    }
  }

  pauseGame() {
    this.isPaused = true;
  }

  resumeGame() {
    this.isPaused = false;
    this.clock.getDelta();
  }

  restartRun() {
    this.vehicle.progressU = 0.005;
    this.vehicle.resetPosition();
    this.lapActive = false;
    this.currentLapTime = 0;
    this.currentCheckpointIdx = 0;
    if (this.world && this.world.checkpoints) {
      this.world.checkpoints.forEach(cp => { cp.lastDist = -999; });
    }
    this.ui.showAlert("RUN RESTARTED");
  }

  toggleGameMode() {
    this.mode = (this.mode === 'trial') ? 'free' : 'trial';
    this.restartRun();
  }

  setQuality(q) {
    this.quality = q;
    if (q === 'low') {
      this.renderer.shadowMap.enabled = false;
      this.renderer.setPixelRatio(1.0);
    } else if (q === 'med') {
      this.renderer.shadowMap.enabled = false;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    } else {
      this.renderer.shadowMap.enabled = true;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
    }
  }

  hideLoader() {
    const loader = document.getElementById('loader-screen');
    if (loader) {
      loader.style.opacity = '0';
      setTimeout(() => loader.style.display = 'none', 500);
    }
  }

  showError(msg) {
    const errScreen = document.getElementById('error-screen');
    const errText = document.getElementById('error-message');
    if (errScreen) {
      errScreen.style.display = 'flex';
      if (errText) errText.innerText = msg;
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.gameInstance = new OpenRoadGame();
});
