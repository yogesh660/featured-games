/**
 * Space Defender — Game Entities (Player, Enemies, Projectiles, Power-ups)
 */

class Projectile {
  constructor(x, y, vx, vy, isPlayer = true, damage = 1, type = 'laser', color = '#38bdf8') {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.isPlayer = isPlayer;
    this.damage = damage;
    this.type = type;
    this.color = color;
    this.radius = type === 'torpedo' ? 5 : (type === 'boss_orb' ? 7 : 3.5);
    this.alive = true;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  draw(ctx) {
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 10;

    if (this.type === 'laser') {
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, 2.5, 9, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'boss_orb') {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
      // Outer pulse
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

class PowerUp {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type; // 'spread', 'rapid', 'shield', 'bomb', 'drone'
    this.vy = 65;
    this.vx = (Math.random() - 0.5) * 30;
    this.radius = 12;
    this.alive = true;
    this.pulse = 0;

    const typeConfigs = {
      spread: { label: 'S', color: '#38bdf8', name: 'Spread Shot' },
      rapid:  { label: 'R', color: '#f59e0b', name: 'Rapid Fire' },
      shield: { label: 'D', color: '#10b981', name: 'Shield Boost' },
      bomb:   { label: 'B', color: '#a855f7', name: 'Smart Bomb' },
      drone:  { label: 'W', color: '#ec4899', name: 'Wingman Escort' }
    };
    this.config = typeConfigs[type] || typeConfigs.spread;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.pulse += dt * 4;
  }

  draw(ctx) {
    ctx.save();
    const scale = 1.0 + Math.sin(this.pulse) * 0.15;
    ctx.shadowColor = this.config.color;
    ctx.shadowBlur = 12;

    // Diamond shape
    ctx.strokeStyle = this.config.color;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.lineWidth = 2;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.moveTo(0, -this.radius);
    ctx.lineTo(this.radius, 0);
    ctx.moveTo(this.radius, 0);
    ctx.lineTo(0, this.radius);
    ctx.lineTo(-this.radius, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.config.label, 0, 1);
    ctx.restore();

    ctx.restore();
  }
}

class PlayerShip {
  constructor(shipClass = 'interceptor') {
    this.x = 400;
    this.y = 550;
    this.vx = 0;
    this.vy = 0;
    this.shipClass = shipClass;
    this.radius = 16;
    this.alive = true;

    // Ship configurations
    const configs = {
      interceptor: {
        name: 'Interceptor Alpha',
        maxHealth: 100,
        maxShield: 100,
        shieldRegen: 8,
        speed: 380,
        accel: 2400,
        color: '#38bdf8',
        fireRate: 0.14
      },
      valkyrie: {
        name: 'Valkyrie Heavy',
        maxHealth: 160,
        maxShield: 150,
        shieldRegen: 12,
        speed: 310,
        accel: 1800,
        color: '#f59e0b',
        fireRate: 0.18
      },
      phantom: {
        name: 'Phantom Scout',
        maxHealth: 70,
        maxShield: 70,
        shieldRegen: 6,
        speed: 460,
        accel: 3200,
        color: '#ec4899',
        fireRate: 0.09
      }
    };

    this.cfg = configs[shipClass] || configs.interceptor;

    this.health = this.cfg.maxHealth;
    this.shield = this.cfg.maxShield;
    this.maxHealth = this.cfg.maxHealth;
    this.maxShield = this.cfg.maxShield;

    this.energy = 100;
    this.maxEnergy = 100;

    this.fireTimer = 0;
    this.invulnerableTimer = 1.5; // Spawn protection

    // Power-up durations (seconds)
    this.spreadTimer = 0;
    this.rapidTimer = 0;
    this.wingmanActive = false;
    this.smartBombs = 2;

    this.tilt = 0; // Visual bank
  }

  setShipClass(cls) {
    this.shipClass = cls;
    const configs = {
      interceptor: { maxHealth: 100, maxShield: 100, shieldRegen: 8, speed: 380, accel: 2400, color: '#38bdf8', fireRate: 0.14 },
      valkyrie: { maxHealth: 160, maxShield: 150, shieldRegen: 12, speed: 310, accel: 1800, color: '#f59e0b', fireRate: 0.18 },
      phantom: { maxHealth: 70, maxShield: 70, shieldRegen: 6, speed: 460, accel: 3200, color: '#ec4899', fireRate: 0.09 }
    };
    this.cfg = configs[cls] || configs.interceptor;
    this.health = this.cfg.maxHealth;
    this.shield = this.cfg.maxShield;
    this.maxHealth = this.cfg.maxHealth;
    this.maxShield = this.cfg.maxShield;
  }

  takeDamage(amount) {
    if (this.invulnerableTimer > 0) return false;

    if (this.shield > 0) {
      if (this.shield >= amount) {
        this.shield -= amount;
        return 'shield_hit';
      } else {
        const remaining = amount - this.shield;
        this.shield = 0;
        this.health -= remaining;
        return 'shield_break';
      }
    } else {
      this.health -= amount;
      if (this.health <= 0) {
        this.health = 0;
        this.alive = false;
        return 'death';
      }
      return 'health_hit';
    }
  }

  update(dt, input, width, height, particleSystem) {
    // Timers
    if (this.invulnerableTimer > 0) this.invulnerableTimer -= dt;
    if (this.fireTimer > 0) this.fireTimer -= dt;
    if (this.spreadTimer > 0) this.spreadTimer -= dt;
    if (this.rapidTimer > 0) this.rapidTimer -= dt;

    // Passive Shield Regeneration
    if (this.shield < this.maxShield) {
      this.shield = Math.min(this.maxShield, this.shield + this.cfg.shieldRegen * dt);
    }

    // Energy Boost
    let currentSpeed = this.cfg.speed;
    if (input.boost && this.energy > 5) {
      currentSpeed *= 1.5;
      this.energy = Math.max(0, this.energy - 35 * dt);
    } else {
      this.energy = Math.min(this.maxEnergy, this.energy + 20 * dt);
    }

    // Movement
    let targetVx = input.x * currentSpeed;
    let targetVy = input.y * currentSpeed;

    const accel = this.cfg.accel;
    this.vx += (targetVx - this.vx) * Math.min(1.0, accel * dt / currentSpeed);
    this.vy += (targetVy - this.vy) * Math.min(1.0, accel * dt / currentSpeed);

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Screen bounds clamping
    const margin = 24;
    this.x = Math.max(margin, Math.min(width - margin, this.x));
    this.y = Math.max(margin + 50, Math.min(height - margin, this.y));

    // Tilt banking
    const targetTilt = (this.vx / currentSpeed) * 0.45;
    this.tilt += (targetTilt - this.tilt) * 12 * dt;

    // Thruster exhaust particles
    if (particleSystem) {
      particleSystem.createThrusterParticle(this.x - 7, this.y + 14, this.vx * 0.2, this.vy * 0.2, this.cfg.color);
      particleSystem.createThrusterParticle(this.x + 7, this.y + 14, this.vx * 0.2, this.vy * 0.2, this.cfg.color);
      if (input.boost) {
        particleSystem.createThrusterParticle(this.x, this.y + 18, this.vx * 0.3, this.vy * 0.3, '#f59e0b');
      }
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.tilt);

    // Invulnerability flashing
    if (this.invulnerableTimer > 0 && Math.floor(Date.now() / 80) % 2 === 0) {
      ctx.globalAlpha = 0.5;
    }

    // Shield Dome when active
    if (this.shield > 0) {
      ctx.strokeStyle = `rgba(56, 189, 248, ${0.25 + (this.shield / this.maxShield) * 0.5})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Ship Hull Vector Art
    ctx.shadowColor = this.cfg.color;
    ctx.shadowBlur = 14;

    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = this.cfg.color;
    ctx.lineWidth = 2.2;

    ctx.beginPath();
    // Nose
    ctx.moveTo(0, -22);
    // Right wing
    ctx.lineTo(16, 12);
    ctx.lineTo(8, 16);
    // Engines
    ctx.lineTo(0, 8);
    // Left wing
    ctx.lineTo(-8, 16);
    ctx.lineTo(-16, 12);
    ctx.closePath();

    ctx.fill();
    ctx.stroke();

    // Cockpit Canopy
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(0, -4, 3, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wingman Escort Drones
    if (this.wingmanActive) {
      [-28, 28].forEach(offsetX => {
        ctx.fillStyle = '#ec4899';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(offsetX, 4);
        ctx.lineTo(offsetX + 6, 14);
        ctx.lineTo(offsetX - 6, 14);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      });
    }

    ctx.restore();
  }
}

class Enemy {
  constructor(x, y, type = 'scout', wave = 1) {
    this.x = x;
    this.y = y;
    this.type = type; // 'scout', 'corvette', 'frigate', 'boss'
    this.wave = wave;
    this.alive = true;
    this.time = Math.random() * 10;
    this.fireTimer = 0.8 + Math.random() * 1.5;

    const waveFactor = 1.0 + (wave - 1) * 0.15;

    if (type === 'scout') {
      this.health = Math.round(14 * waveFactor);
      this.maxHealth = this.health;
      this.speed = 130 + Math.random() * 40;
      this.radius = 14;
      this.color = '#f43f5e';
      this.scoreVal = 100;
      this.amplitude = 70 + Math.random() * 50;
      this.startX = x;
    } else if (type === 'corvette') {
      this.health = Math.round(38 * waveFactor);
      this.maxHealth = this.health;
      this.speed = 70;
      this.radius = 22;
      this.color = '#f59e0b';
      this.scoreVal = 250;
      this.targetY = 80 + Math.random() * 140;
    } else if (type === 'frigate') {
      this.health = Math.round(75 * waveFactor);
      this.maxHealth = this.health;
      this.speed = 45;
      this.radius = 28;
      this.color = '#a855f7';
      this.scoreVal = 500;
      this.teleportTimer = 3.5;
    } else if (type === 'boss') {
      this.health = Math.round(550 * waveFactor);
      this.maxHealth = this.health;
      this.speed = 35;
      this.radius = 65;
      this.color = '#ef4444';
      this.scoreVal = 3000;
      this.turretAngle = 0;
      this.phase = 1;
    }
  }

  takeDamage(amount) {
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
      return true; // destroyed
    }
    return false;
  }

  update(dt, playerX, playerY, projectiles, width, height) {
    this.time += dt;

    if (this.type === 'scout') {
      // Sinusoidal swoop diving downwards
      this.y += this.speed * dt;
      this.x = this.startX + Math.sin(this.time * 3.5) * this.amplitude;

      // Fires downwards occasionally
      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        this.fireTimer = 2.0 + Math.random() * 2.0;
        projectiles.push(new Projectile(this.x, this.y + 12, 0, 220, false, 12, 'laser', '#f43f5e'));
      }

    } else if (this.type === 'corvette') {
      // Moves into formation, strafes horizontally, aims directly at player
      if (this.y < this.targetY) {
        this.y += this.speed * dt;
      } else {
        this.x += Math.sin(this.time * 1.8) * 60 * dt;
      }

      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        this.fireTimer = 1.8;
        // Targeted shot at player
        const angle = Math.atan2(playerY - this.y, playerX - this.x);
        projectiles.push(new Projectile(
          this.x, this.y + 16,
          Math.cos(angle) * 200, Math.sin(angle) * 200,
          false, 18, 'laser', '#f59e0b'
        ));
      }

    } else if (this.type === 'frigate') {
      // Phasing stealth ship: teleports across arena
      this.y += this.speed * dt;
      this.teleportTimer -= dt;
      if (this.teleportTimer <= 0) {
        this.teleportTimer = 4.0;
        this.x = 60 + Math.random() * (width - 120);
      }

      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        this.fireTimer = 2.2;
        // Launches twin plasma mines
        [-15, 15].forEach(ox => {
          projectiles.push(new Projectile(this.x + ox, this.y + 14, 0, 160, false, 24, 'torpedo', '#a855f7'));
        });
      }

    } else if (this.type === 'boss') {
      // Boss: Dreadnought Mothership
      if (this.y < 120) {
        this.y += this.speed * dt;
      } else {
        this.x += Math.sin(this.time * 0.9) * 80 * dt;
      }
      this.turretAngle += dt * 1.8;

      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        this.fireTimer = 1.1;

        // Radial turret burst (6 bullets)
        for (let i = 0; i < 6; i++) {
          const a = this.turretAngle + (i * Math.PI / 3);
          projectiles.push(new Projectile(
            this.x, this.y + 20,
            Math.cos(a) * 170, Math.sin(a) * 170,
            false, 20, 'boss_orb', '#ef4444'
          ));
        }

        // Targeted center beam
        const aimAngle = Math.atan2(playerY - this.y, playerX - this.x);
        projectiles.push(new Projectile(
          this.x, this.y + 25,
          Math.cos(aimAngle) * 260, Math.sin(aimAngle) * 260,
          false, 28, 'laser', '#ff0055'
        ));
      }
    }

    // Check bounds
    if (this.y > height + 80 && this.type !== 'boss') {
      this.alive = false;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    ctx.shadowColor = this.color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;

    if (this.type === 'scout') {
      // Fast triangle swoop
      ctx.beginPath();
      ctx.moveTo(0, 14);
      ctx.lineTo(12, -12);
      ctx.lineTo(0, -6);
      ctx.lineTo(-12, -12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

    } else if (this.type === 'corvette') {
      // Armored hexagon
      ctx.beginPath();
      ctx.moveTo(0, 20);
      ctx.lineTo(18, 6);
      ctx.lineTo(18, -14);
      ctx.lineTo(0, -20);
      ctx.lineTo(-18, -14);
      ctx.lineTo(-18, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Core
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();

    } else if (this.type === 'frigate') {
      // Stealth swept diamond
      ctx.beginPath();
      ctx.moveTo(0, 24);
      ctx.lineTo(26, 0);
      ctx.lineTo(12, -22);
      ctx.lineTo(-12, -22);
      ctx.lineTo(-26, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();

    } else if (this.type === 'boss') {
      // Massive Dreadnought Mothership
      ctx.beginPath();
      ctx.moveTo(0, 50);
      ctx.lineTo(55, 20);
      ctx.lineTo(65, -35);
      ctx.lineTo(25, -50);
      ctx.lineTo(-25, -50);
      ctx.lineTo(-65, -35);
      ctx.lineTo(-55, 20);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Glowing Power Core
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();

      // Rotating Turret Spokes
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 4; i++) {
        const a = this.turretAngle + (i * Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * 32, Math.sin(a) * 32);
        ctx.stroke();
      }

      // Boss Health Bar above ship
      ctx.restore();
      ctx.save();
      const barW = 160;
      const barH = 8;
      const barX = this.x - barW / 2;
      const barY = this.y - 75;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barW, barH);

      const healthPct = this.health / this.maxHealth;
      ctx.fillStyle = healthPct > 0.3 ? '#ef4444' : '#f59e0b';
      ctx.fillRect(barX, barY, barW * healthPct, barH);
      ctx.restore();
      return;
    }

    // Health bar for small damaged enemies
    if (this.health < this.maxHealth) {
      ctx.restore();
      ctx.save();
      const bW = 24;
      const bH = 3;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(this.x - bW / 2, this.y - this.radius - 8, bW, bH);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(this.x - bW / 2, this.y - this.radius - 8, bW * (this.health / this.maxHealth), bH);
      ctx.restore();
      return;
    }

    ctx.restore();
  }
}

window.Projectile = Projectile;
window.PowerUp = PowerUp;
window.PlayerShip = PlayerShip;
window.Enemy = Enemy;
