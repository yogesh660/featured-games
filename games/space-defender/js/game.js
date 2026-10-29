/**
 * Space Defender — Main Game Coordinator & Game Loop
 */

class SpaceGame {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');

    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    // Subsystems
    this.audio = new SpaceAudio();
    this.starfield = new Starfield(this.width, this.height);
    this.particles = new ParticleSystem();
    this.waveDirector = new WaveDirector(this.width, this.height);

    // Entities
    this.player = new PlayerShip('interceptor');
    this.projectiles = [];
    this.enemies = [];
    this.powerups = [];

    // Game States: 'TITLE', 'PLAYING', 'PAUSED', 'GAMEOVER'
    this.state = 'TITLE';
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('space_defender_highscore') || '0', 10);
    this.multiplier = 1.0;
    this.comboTimer = 0;

    // Screen Shake
    this.shakeIntensity = 0;
    this.shakeDecay = 0.90;

    // Inputs
    this.keys = {};
    this.touchInput = { x: 0, y: 0, firing: false, boost: false };
    this.mouseInput = { x: 0, y: 0, down: false };

    // Timing
    this.lastTime = performance.now();

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.updateHUD();

    // Start loop
    requestAnimationFrame((t) => this.loop(t));
  }

  setupEventListeners() {
    // Window Resize
    window.addEventListener('resize', () => {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.canvas.width = this.width;
      this.canvas.height = this.height;
      this.starfield.resize(this.width, this.height);
      this.waveDirector.resize(this.width, this.height);
    });

    // Keyboard
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;

      // Audio unlock on user gesture
      if (!this.audio.initialized) this.audio.init();

      if (e.code === 'KeyP' || e.code === 'Escape') {
        this.togglePause();
      } else if (e.code === 'KeyR' && (this.state === 'GAMEOVER' || this.state === 'PLAYING')) {
        this.restartGame();
      } else if (e.code === 'KeyB') {
        this.triggerSmartBomb();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // Mouse Controls
    this.canvas.addEventListener('mousemove', (e) => {
      this.mouseInput.x = e.clientX;
      this.mouseInput.y = e.clientY;
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouseInput.down = true;
        if (!this.audio.initialized) this.audio.init();
      }
    });

    this.canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseInput.down = false;
    });

    // UI Buttons
    document.getElementById('btn-start-game').addEventListener('click', () => {
      this.audio.init();
      this.audio.resume();
      this.startGame();
    });

    document.getElementById('btn-restart-game').addEventListener('click', () => {
      this.restartGame();
    });

    document.getElementById('btn-resume-game').addEventListener('click', () => {
      this.togglePause();
    });

    document.getElementById('btn-sound-toggle').addEventListener('click', () => {
      const isMuted = this.audio.toggleMute();
      document.getElementById('btn-sound-toggle').textContent = isMuted ? '🔇 SOUND OFF' : '🔊 SOUND ON';
    });

    document.getElementById('btn-pause-toggle').addEventListener('click', () => {
      this.togglePause();
    });

    // Ship class selection cards
    document.querySelectorAll('.ship-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.ship-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        const shipClass = card.getAttribute('data-ship');
        this.player.setShipClass(shipClass);
      });
    });

    // Touch Controls
    this.setupTouchControls();
  }

  setupTouchControls() {
    const touchStick = document.getElementById('touch-stick');
    const touchKnob = touchStick.querySelector('.touch-knob');
    let touchId = null;
    let startX = 0;
    let startY = 0;

    const resetStick = () => {
      touchKnob.style.transform = 'translate(0px, 0px)';
      this.touchInput.x = 0;
      this.touchInput.y = 0;
      touchId = null;
    };

    touchStick.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (!this.audio.initialized) this.audio.init();
      const touch = e.changedTouches[0];
      touchId = touch.identifier;
      const rect = touchStick.getBoundingClientRect();
      startX = rect.left + rect.width / 2;
      startY = rect.top + rect.height / 2;
    });

    window.addEventListener('touchmove', (e) => {
      if (touchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === touchId) {
          const dx = touch.clientX - startX;
          const dy = touch.clientY - startY;
          const dist = Math.min(45, Math.hypot(dx, dy));
          const angle = Math.atan2(dy, dx);

          const knobX = Math.cos(angle) * dist;
          const knobY = Math.sin(angle) * dist;
          touchKnob.style.transform = `translate(${knobX}px, ${knobY}px)`;

          this.touchInput.x = knobX / 45;
          this.touchInput.y = knobY / 45;
        }
      }
    });

    window.addEventListener('touchend', (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchId) {
          resetStick();
        }
      }
    });

    window.addEventListener('touchcancel', () => resetStick());

    // Fire & Bomb touch buttons
    const btnFire = document.getElementById('touch-btn-fire');
    const btnBomb = document.getElementById('touch-btn-bomb');

    btnFire.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.touchInput.firing = true;
    });
    btnFire.addEventListener('touchend', () => {
      this.touchInput.firing = false;
    });

    btnBomb.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.triggerSmartBomb();
    });
  }

  startGame() {
    this.state = 'PLAYING';
    document.getElementById('modal-title-screen').classList.remove('active');
    document.getElementById('modal-pause-screen').classList.remove('active');
    document.getElementById('modal-gameover-screen').classList.remove('active');

    this.score = 0;
    this.multiplier = 1.0;
    this.projectiles = [];
    this.enemies = [];
    this.powerups = [];
    this.particles.clear();

    this.player.health = this.player.maxHealth;
    this.player.shield = this.player.maxShield;
    this.player.energy = 100;
    this.player.alive = true;
    this.player.x = this.width / 2;
    this.player.y = this.height * 0.82;
    this.player.smartBombs = 2;

    this.waveDirector.startWave(1);
    this.showAlert(`WAVE 1 — INCOMING`);
    this.updateHUD();
  }

  restartGame() {
    this.startGame();
  }

  togglePause() {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      document.getElementById('modal-pause-screen').classList.add('active');
    } else if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
      document.getElementById('modal-pause-screen').classList.remove('active');
    }
  }

  triggerSmartBomb() {
    if (this.state !== 'PLAYING' || this.player.smartBombs <= 0) return;

    this.player.smartBombs--;
    this.audio.playSmartBomb();
    this.shakeIntensity = 25;

    // Destroy all enemy projectiles
    this.projectiles = this.projectiles.filter(p => p.isPlayer);

    // Damage all enemies on screen
    this.enemies.forEach(enemy => {
      const destroyed = enemy.takeDamage(120);
      this.particles.createExplosion(enemy.x, enemy.y, enemy.color, 35, true);
      if (destroyed) {
        this.addScore(enemy.scoreVal);
      }
    });
    this.enemies = this.enemies.filter(e => e.alive);

    this.particles.addFloatingText(this.width / 2, this.height / 2, '⚡ SMART BOMB DETONATED ⚡', '#a855f7', 22);
    this.updateHUD();
  }

  showAlert(text) {
    const el = document.getElementById('hud-alert');
    el.textContent = text;
    el.classList.add('active');
    setTimeout(() => {
      el.classList.remove('active');
    }, 2000);
  }

  addScore(pts) {
    const earned = Math.round(pts * this.multiplier);
    this.score += earned;
    this.comboTimer = 2.5;
    this.multiplier = Math.min(4.0, +(this.multiplier + 0.1).toFixed(1));

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('space_defender_highscore', this.highScore.toString());
    }
    this.updateHUD();
  }

  updateHUD() {
    document.getElementById('hud-score-val').textContent = this.score.toLocaleString();
    document.getElementById('hud-highscore-val').textContent = this.highScore.toLocaleString();
    document.getElementById('hud-wave-val').textContent = `WAVE ${this.waveDirector.currentWave}`;
    document.getElementById('hud-multiplier-val').textContent = `x${this.multiplier.toFixed(1)}`;
    document.getElementById('hud-bombs-val').textContent = `⚡ x${this.player.smartBombs}`;

    // Bars
    const shieldPct = Math.max(0, Math.min(100, (this.player.shield / this.player.maxShield) * 100));
    const healthPct = Math.max(0, Math.min(100, (this.player.health / this.player.maxHealth) * 100));
    const energyPct = Math.max(0, Math.min(100, (this.player.energy / this.player.maxEnergy) * 100));

    document.getElementById('bar-shield-fill').style.width = `${shieldPct}%`;
    document.getElementById('bar-health-fill').style.width = `${healthPct}%`;
    document.getElementById('bar-energy-fill').style.width = `${energyPct}%`;

    // Active Perks display
    const perksContainer = document.getElementById('hud-perks');
    perksContainer.innerHTML = '';
    if (this.player.spreadTimer > 0) {
      perksContainer.innerHTML += `<div class="perk-badge"><span>S</span> SPREAD ${Math.ceil(this.player.spreadTimer)}s</div>`;
    }
    if (this.player.rapidTimer > 0) {
      perksContainer.innerHTML += `<div class="perk-badge"><span>R</span> RAPID ${Math.ceil(this.player.rapidTimer)}s</div>`;
    }
    if (this.player.wingmanActive) {
      perksContainer.innerHTML += `<div class="perk-badge"><span>W</span> ESCORT ACTIVE</div>`;
    }
  }

  // Main Loop
  loop(now) {
    const dt = Math.min(0.06, (now - this.lastTime) / 1000.0);
    this.lastTime = now;

    if (this.state === 'PLAYING') {
      this.update(dt);
    }

    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    // 1. Inputs resolution
    const input = { x: 0, y: 0, firing: false, boost: false };

    if (this.keys['ArrowLeft'] || this.keys['KeyA']) input.x -= 1;
    if (this.keys['ArrowRight'] || this.keys['KeyD']) input.x += 1;
    if (this.keys['ArrowUp'] || this.keys['KeyW']) input.y -= 1;
    if (this.keys['ArrowDown'] || this.keys['KeyS']) input.y += 1;

    if (this.keys['Space'] || this.mouseInput.down || this.touchInput.firing) input.firing = true;
    if (this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.touchInput.boost) input.boost = true;

    if (Math.abs(this.touchInput.x) > 0.05) input.x = this.touchInput.x;
    if (Math.abs(this.touchInput.y) > 0.05) input.y = this.touchInput.y;

    // Combo multiplier decay
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.multiplier = 1.0;
        this.updateHUD();
      }
    }

    // Screen Shake decay
    if (this.shakeIntensity > 0) {
      this.shakeIntensity *= Math.pow(this.shakeDecay, dt * 60);
      if (this.shakeIntensity < 0.2) this.shakeIntensity = 0;
    }

    // 2. Starfield & Particles
    this.starfield.update(dt, this.player.vy);
    this.particles.update(dt);

    // 3. Player Update
    this.player.update(dt, input, this.width, this.height, this.particles);

    // Player Shooting
    if (input.firing && this.player.fireTimer <= 0) {
      const rate = this.player.rapidTimer > 0 ? this.player.cfg.fireRate * 0.5 : this.player.cfg.fireRate;
      this.player.fireTimer = rate;

      if (this.player.spreadTimer > 0) {
        // Triple Spread Shot
        this.audio.playSpreadLaser();
        [-0.22, 0, 0.22].forEach(angle => {
          this.projectiles.push(new Projectile(
            this.player.x, this.player.y - 14,
            Math.sin(angle) * 600, -Math.cos(angle) * 600,
            true, 15, 'laser', '#38bdf8'
          ));
        });
      } else {
        // Dual Forward Plasma Cannons
        this.audio.playLaser(false);
        this.projectiles.push(new Projectile(this.player.x - 10, this.player.y - 12, 0, -650, true, 16, 'laser', '#38bdf8'));
        this.projectiles.push(new Projectile(this.player.x + 10, this.player.y - 12, 0, -650, true, 16, 'laser', '#38bdf8'));
      }

      // Wingman lasers
      if (this.player.wingmanActive) {
        this.projectiles.push(new Projectile(this.player.x - 28, this.player.y - 4, 0, -650, true, 12, 'laser', '#ec4899'));
        this.projectiles.push(new Projectile(this.player.x + 28, this.player.y - 4, 0, -650, true, 12, 'laser', '#ec4899'));
      }
    }

    // 4. Wave Director Update
    const waveEvent = this.waveDirector.update(dt, this.enemies);
    if (waveEvent === 'new_wave_started') {
      this.audio.playWaveClear();
      this.showAlert(`WAVE ${this.waveDirector.currentWave} — INCOMING`);
      this.addScore(1000);
    }

    // 5. Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.update(dt);
      if (p.x < -20 || p.x > this.width + 20 || p.y < -30 || p.y > this.height + 30) {
        this.projectiles.splice(i, 1);
      }
    }

    // 6. Update Enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.update(dt, this.player.x, this.player.y, this.projectiles, this.width, this.height);
      if (!enemy.alive) {
        this.enemies.splice(i, 1);
      }
    }

    // 7. Update Power-ups
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const pu = this.powerups[i];
      pu.update(dt);
      // Collection check
      const dist = Math.hypot(pu.x - this.player.x, pu.y - this.player.y);
      if (dist < pu.radius + this.player.radius) {
        this.collectPowerUp(pu);
        this.powerups.splice(i, 1);
        continue;
      }
      if (pu.y > this.height + 30) {
        this.powerups.splice(i, 1);
      }
    }

    // 8. Collisions: Player Lasers vs Enemies
    this.projectiles.filter(p => p.isPlayer).forEach(proj => {
      this.enemies.forEach(enemy => {
        if (!proj.alive || !enemy.alive) return;
        const dist = Math.hypot(proj.x - enemy.x, proj.y - enemy.y);
        if (dist < proj.radius + enemy.radius) {
          proj.alive = false;
          const destroyed = enemy.takeDamage(proj.damage);
          this.particles.createSparks(proj.x, proj.y, Math.PI / 2, proj.color, 5);

          if (destroyed) {
            this.audio.playExplosion(enemy.type === 'boss');
            this.particles.createExplosion(enemy.x, enemy.y, enemy.color, enemy.type === 'boss' ? 55 : 24, enemy.type === 'boss');
            this.addScore(enemy.scoreVal);
            this.particles.addFloatingText(enemy.x, enemy.y, `+${Math.round(enemy.scoreVal * this.multiplier)}`, '#f8fafc', 13);

            // Chance of power-up drop
            const pu = this.waveDirector.generatePowerUpDrop(enemy.x, enemy.y);
            if (pu) this.powerups.push(pu);

            if (enemy.type === 'boss') {
              this.shakeIntensity = 30;
              this.particles.addFloatingText(this.width / 2, this.height * 0.35, '🏆 DREADNOUGHT ANNIHILATED! 🏆', '#38bdf8', 26);
            }
          }
        }
      });
    });

    // 9. Collisions: Enemy Lasers vs Player
    this.projectiles.filter(p => !p.isPlayer).forEach(proj => {
      if (!proj.alive || !this.player.alive) return;
      const dist = Math.hypot(proj.x - this.player.x, proj.y - this.player.y);
      if (dist < proj.radius + this.player.radius) {
        proj.alive = false;
        const result = this.player.takeDamage(proj.damage);
        this.shakeIntensity = 10;
        this.particles.createSparks(this.player.x, this.player.y, -Math.PI / 2, '#f43f5e', 8);

        if (result === 'shield_hit') {
          this.audio.playShieldHit();
        } else if (result === 'shield_break') {
          this.audio.playShieldHit();
          this.particles.createExplosion(this.player.x, this.player.y, '#38bdf8', 20);
          this.particles.addFloatingText(this.player.x, this.player.y - 20, 'SHIELD BROKEN!', '#f43f5e', 14);
        } else if (result === 'health_hit') {
          this.audio.playExplosion(false);
        } else if (result === 'death') {
          this.onGameOver();
        }
        this.updateHUD();
      }
    });

    // 10. Direct Body Collisions: Enemies vs Player
    this.enemies.forEach(enemy => {
      if (!enemy.alive || !this.player.alive) return;
      const dist = Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y);
      if (dist < enemy.radius + this.player.radius) {
        this.shakeIntensity = 16;
        enemy.takeDamage(50);
        const result = this.player.takeDamage(40);
        this.particles.createExplosion(this.player.x, this.player.y, '#f59e0b', 20);
        if (result === 'death') {
          this.onGameOver();
        }
        this.updateHUD();
      }
    });

    // Clean up dead projectiles
    this.projectiles = this.projectiles.filter(p => p.alive);
    this.enemies = this.enemies.filter(e => e.alive);

    this.updateHUD();
  }

  collectPowerUp(pu) {
    this.audio.playPowerup();
    this.particles.createExplosion(pu.x, pu.y, pu.config.color, 18);
    this.particles.addFloatingText(pu.x, pu.y, pu.config.name.toUpperCase(), pu.config.color, 16);

    switch (pu.type) {
      case 'spread':
        this.player.spreadTimer = 12.0;
        break;
      case 'rapid':
        this.player.rapidTimer = 10.0;
        break;
      case 'shield':
        this.player.shield = this.player.maxShield;
        this.player.health = Math.min(this.player.maxHealth, this.player.health + 30);
        break;
      case 'bomb':
        this.player.smartBombs++;
        break;
      case 'drone':
        this.player.wingmanActive = true;
        break;
    }
    this.addScore(300);
    this.updateHUD();
  }

  onGameOver() {
    this.state = 'GAMEOVER';
    this.audio.playExplosion(true);
    this.particles.createExplosion(this.player.x, this.player.y, '#f43f5e', 50, true);
    this.shakeIntensity = 28;

    setTimeout(() => {
      document.getElementById('gameover-score').textContent = this.score.toLocaleString();
      document.getElementById('gameover-wave').textContent = this.waveDirector.currentWave.toString();
      document.getElementById('modal-gameover-screen').classList.add('active');
    }, 1200);
  }

  render() {
    this.ctx.save();

    // Clear background
    this.ctx.fillStyle = '#05060b';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Apply Screen Shake
    if (this.shakeIntensity > 0) {
      const shakeX = (Math.random() - 0.5) * this.shakeIntensity;
      const shakeY = (Math.random() - 0.5) * this.shakeIntensity;
      this.ctx.translate(shakeX, shakeY);
    }

    // 1. Draw Starfield & Planets
    this.starfield.draw(this.ctx);

    // 2. Draw Power-ups
    this.powerups.forEach(pu => pu.draw(this.ctx));

    // 3. Draw Projectiles
    this.projectiles.forEach(p => p.draw(this.ctx));

    // 4. Draw Enemies
    this.enemies.forEach(e => e.draw(this.ctx));

    // 5. Draw Player
    if (this.player.alive && this.state !== 'TITLE') {
      this.player.draw(this.ctx);
    }

    // 6. Draw Particles & Shockwaves
    this.particles.draw(this.ctx);

    this.ctx.restore();
  }
}

// Bootstrap on window load
window.addEventListener('DOMContentLoaded', () => {
  window.game = new SpaceGame();
});
