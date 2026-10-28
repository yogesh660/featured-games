/**
 * Open Road Racer - Main Game Controller & Loop
 * Integrates Three.js, Physics, Sound, World and Lap Timing.
 */

class OpenRoadGame {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.clock = new THREE.Clock();

    // Core Systems
    this.world = null;
    this.vehicle = null;
    this.input = null;
    this.sound = null;
    this.ui = null;

    // Game Mode & Timing
    this.mode = 'trial'; // 'trial' or 'free'
    this.isPaused = false;
    this.lapStartTime = 0;
    this.currentLapTime = 0;
    this.currentCheckpointIdx = 0;
    this.totalCheckpoints = 8;
    this.lapActive = false;

    // Graphics Quality
    this.quality = 'high';

    this.init();
  }

  init() {
    try {
      this.setupThree();
      this.sound = new SoundEngine();
      this.input = new InputManager();

      this.world = new WorldGenerator(this.scene);
      this.world.init(this.quality);

      this.vehicle = new Vehicle(this.scene, this.world);
      this.ui = new UIController(this);

      this.setupEventListeners();
      this.hideLoader();

      // Start render loop
      this.clock.start();
      requestAnimationFrame((t) => this.renderLoop(t));

      // Show welcome notice
      setTimeout(() => {
        this.ui.showAlert("WELCOME TO SAHYADRI GHATS — WASD TO DRIVE", 3500);
      }, 500);

    } catch (err) {
      console.error("Initialization error:", err);
      this.showError(err.message);
    }
  }

  setupThree() {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1200
    );

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);
  }

  setupEventListeners() {
    window.addEventListener('resize', () => this.onResize());

    // Resume Web Audio on first user interaction
    const unlockAudio = () => {
      if (this.sound) this.sound.init();
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

    // Clamp delta time to avoid large physics steps after tab focus loss
    let dt = this.clock.getDelta();
    if (dt > 0.1) dt = 0.1;

    // Check pause action from keyboard
    if (this.input.consumeAction('togglePause')) {
      this.togglePause();
    }

    if (this.isPaused) return;

    // 1. Update Input Manager
    this.input.update(dt);

    // 2. Update Vehicle Physics
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

    // 4. Update Camera Tracking
    this.vehicle.updateCamera(this.camera, dt);

    // 5. Update Time Trial / Lap Logic
    this.updateTiming(dt);

    // 6. Update HUD Displays
    this.ui.updateHUD(
      telemetry,
      this.currentLapTime,
      this.currentCheckpointIdx,
      this.totalCheckpoints,
      this.mode
    );

    // 7. Render Scene
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

    // Checkpoint gate crossing detection
    const carU = this.vehicle.progressU;
    const targetCp = this.world.checkpoints[this.currentCheckpointIdx];

    if (targetCp) {
      // Check proximity along spline
      let diff = carU - targetCp.u;
      if (diff < -0.5) diff += 1.0;
      if (diff > 0.5) diff -= 1.0;

      if (Math.abs(diff) < 0.025) {
        // Crossed checkpoint
        this.sound.playCheckpointChime();
        this.currentCheckpointIdx++;

        if (this.currentCheckpointIdx >= this.totalCheckpoints) {
          // Lap Completed!
          this.sound.playCheckpointChime();
          const finishedTime = this.currentLapTime;
          this.ui.showAlert(`LAP FINISHED: ${this.ui.formatTime(finishedTime)}!`, 4000);
          this.ui.saveBestTime(finishedTime);

          // Start next lap
          this.currentCheckpointIdx = 0;
          this.lapStartTime = performance.now();
        } else {
          this.ui.showAlert(`CHECKPOINT ${this.currentCheckpointIdx} PASSED!`);
        }
      }
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
    this.clock.getDelta(); // Clear delta accumulation
  }

  restartRun() {
    this.vehicle.progressU = 0.005;
    this.vehicle.resetPosition();
    this.lapActive = false;
    this.currentLapTime = 0;
    this.currentCheckpointIdx = 0;
    this.ui.showAlert("RUN RESTARTED");
  }

  toggleGameMode() {
    this.mode = this.mode === 'trial' ? 'free' : 'trial';
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
