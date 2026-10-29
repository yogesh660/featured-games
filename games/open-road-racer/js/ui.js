/**
 * Open Road Racer - UI & HUD Controller
 * Manages dials, lap timers, modal dialogs, quality toggles & local records.
 */

class UIController {
  constructor(game) {
    this.game = game;

    // Elements
    this.elSpeed = document.getElementById('speed-val');
    this.elGear = document.getElementById('gear-val');
    this.elRpmBar = document.getElementById('rpm-fill');
    this.elTimer = document.getElementById('hud-timer');
    this.elBestTime = document.getElementById('best-time-val');
    this.elCheckpoint = document.getElementById('checkpoint-status');
    this.elAlert = document.getElementById('hud-alert');
    this.elModePill = document.getElementById('hud-mode-pill');

    // Modals
    this.modalPause = document.getElementById('modal-pause');
    this.modalSettings = document.getElementById('modal-settings');
    this.modalOnboard = document.getElementById('modal-onboard');

    this.alertTimeout = null;
    this.loadBestTime();
    this.setupListeners();

    // Auto-start for headless testing or direct link
    if (window.location.search.includes('autostart=1')) {
      if (this.modalOnboard) this.modalOnboard.classList.remove('active');
      this.game.resumeGame();
      const urlParams = new URLSearchParams(window.location.search);
      const vehParam = urlParams.get('veh');
      if (vehParam && this.game.vehicle) {
        this.game.vehicle.setVehicle(vehParam);
      }
      const camParam = urlParams.get('cam');
      if (camParam && this.game.vehicle) {
        this.game.vehicle.cameraMode = camParam;
      }
      if (window.location.search.includes('speed=1')) {
        this.game.vehicle.speedKmh = 90.0;
        this.game.input.keys.throttle = true;
      }
    }
  }

  setupListeners() {
    // Top Bar HUD buttons
    const btnPause = document.getElementById('btn-hud-pause');
    if (btnPause) {
      btnPause.addEventListener('click', () => {
        this.game.sound.playClick();
        this.game.togglePause();
      });
    }

    const btnVehicle = document.getElementById('btn-hud-vehicle');
    if (btnVehicle) {
      btnVehicle.addEventListener('click', () => {
        if (this.game && this.game.sound) this.game.sound.playClick();
        this.game.vehicle.cycleVehicle();
        this.showAlert('VEHICLE: ' + this.game.vehicle.metrics.name.toUpperCase());
        const elVeh = document.getElementById('hud-vehicle-name');
        if (elVeh) elVeh.innerText = this.game.vehicle.metrics.name.toUpperCase();
      });
    }

    const btnCamera = document.getElementById('btn-hud-camera');
    if (btnCamera) {
      btnCamera.addEventListener('click', () => {
        this.game.sound.playClick();
        this.game.vehicle.toggleCamera();
        this.showAlert(`CAMERA: ${this.game.vehicle.cameraMode.toUpperCase()}`);
      });
    }

    const btnSettings = document.getElementById('btn-hud-settings');
    if (btnSettings) {
      btnSettings.addEventListener('click', () => {
        this.game.sound.playClick();
        this.openSettings();
      });
    }

    // Modal Action buttons
    const btnResume = document.getElementById('btn-resume');
    if (btnResume) {
      btnResume.addEventListener('click', () => {
        this.game.sound.playClick();
        this.game.togglePause();
      });
    }

    const btnRestart = document.getElementById('btn-restart');
    if (btnRestart) {
      btnRestart.addEventListener('click', () => {
        this.game.sound.playClick();
        this.game.restartRun();
        this.closeAllModals();
      });
    }

    const btnCloseSettings = document.getElementById('btn-close-settings');
    if (btnCloseSettings) {
      btnCloseSettings.addEventListener('click', () => {
        this.game.sound.playClick();
        this.modalSettings.classList.remove('active');
        if (!this.game.isPaused) this.game.resumeGame();
      });
    }

    const btnStartDriving = document.getElementById('btn-start-driving');
    const startDrivingAction = () => {
      if (this.game && this.game.sound) {
        this.game.sound.init();
        this.game.sound.playClick();
      }
      if (this.modalOnboard) this.modalOnboard.classList.remove('active');
      if (this.game) this.game.resumeGame();
    };

    if (btnStartDriving) {
      btnStartDriving.addEventListener('click', startDrivingAction);
    }

    // Dismiss start modal immediately when player presses any driving key
    window.addEventListener('keydown', (e) => {
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        if (this.modalOnboard && this.modalOnboard.classList.contains('active')) {
          startDrivingAction();
        }
      }
    });

    // Quality buttons
    const segButtons = document.querySelectorAll('.seg-btn');
    segButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        segButtons.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        const qual = e.target.getAttribute('data-quality');
        this.game.setQuality(qual);
        this.showAlert(`GRAPHICS: ${qual.toUpperCase()}`);
      });
    });

    // Sound Toggle
    const soundToggle = document.getElementById('toggle-sound');
    if (soundToggle) {
      soundToggle.addEventListener('change', (e) => {
        this.game.sound.setMuted(!e.target.checked);
      });
    }

    // Mode Toggle (Free Drive vs Time Trial)
    const modeToggle = document.getElementById('btn-toggle-mode');
    if (modeToggle) {
      modeToggle.addEventListener('click', () => {
        this.game.sound.playClick();
        this.game.toggleGameMode();
      });
    }

    // Auto-start if requested in URL (e.g. for testing / headless screenshot)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('start') === '1') {
      setTimeout(() => {
        if (this.modalOnboard) this.modalOnboard.classList.remove('active');
        this.game.resumeGame();
      }, 150);
    }
  }

  updateHUD(telemetry, lapTimeMs, currentCp, totalCp, mode) {
    if (this.elSpeed) this.elSpeed.innerText = Math.round(Math.abs(telemetry.speedKmh));
    if (this.elGear) this.elGear.innerText = `G ${telemetry.gear}`;
    if (this.elRpmBar) this.elRpmBar.style.width = `${telemetry.rpmNorm * 100}%`;

    // Timer display
    if (this.elTimer) {
      if (mode === 'trial') {
        this.elTimer.innerText = this.formatTime(lapTimeMs);
        if (this.elCheckpoint) this.elCheckpoint.innerText = `GATE ${currentCp} / ${totalCp}`;
      } else {
        this.elTimer.innerText = "FREE CRUISE";
        if (this.elCheckpoint) this.elCheckpoint.innerText = "SCENIC ROUTE";
      }
    }

    const elVeh = document.getElementById('hud-vehicle-name');
    if (elVeh && telemetry.vehicleName) {
      elVeh.innerText = telemetry.vehicleName.toUpperCase();
    }

    if (this.elModePill) {
      this.elModePill.innerHTML = `<span class="dot"></span> ${mode === 'trial' ? 'TIME TRIAL' : 'FREE DRIVE'}`;
    }
  }

  showAlert(msg, duration = 2200) {
    if (!this.elAlert) return;
    this.elAlert.innerText = msg;
    this.elAlert.classList.add('show');

    if (this.alertTimeout) clearTimeout(this.alertTimeout);
    this.alertTimeout = setTimeout(() => {
      this.elAlert.classList.remove('show');
    }, duration);
  }

  openPause() {
    this.modalPause.classList.add('active');
  }

  closePause() {
    this.modalPause.classList.remove('active');
  }

  openSettings() {
    this.game.pauseGame();
    this.modalSettings.classList.add('active');
  }

  closeAllModals() {
    this.modalPause.classList.remove('active');
    this.modalSettings.classList.remove('active');
    this.modalOnboard.classList.remove('active');
  }

  formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    const millis = Math.floor((ms % 1000) / 10);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(2, '0')}`;
  }

  saveBestTime(ms) {
    const curBest = localStorage.getItem('openRoadRacer_bestTime');
    if (!curBest || ms < parseInt(curBest)) {
      localStorage.setItem('openRoadRacer_bestTime', ms);
      this.loadBestTime();
      this.showAlert(`NEW RECORD: ${this.formatTime(ms)}!`, 4000);
    }
  }

  loadBestTime() {
    const curBest = localStorage.getItem('openRoadRacer_bestTime');
    if (this.elBestTime) {
      this.elBestTime.innerText = curBest ? this.formatTime(parseInt(curBest)) : "--:--.--";
    }
  }
}

window.UIController = UIController;
