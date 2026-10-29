/**
 * Space Defender — Particle Effects, Starfield & Object Pools
 * High-performance pooled particle system and multi-layered starfield.
 */

class Starfield {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.stars = [];
    this.planets = [];
    this.init();
  }

  resize(w, h) {
    this.width = w;
    this.height = h;
    this.init();
  }

  init() {
    this.stars = [];
    const count = Math.min(220, Math.floor((this.width * this.height) / 4500));

    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        size: Math.random() < 0.75 ? 1 : (Math.random() < 0.92 ? 1.8 : 2.6),
        speed: 0.2 + Math.random() * 1.6,
        alpha: 0.3 + Math.random() * 0.7,
        twinkleSpeed: 0.02 + Math.random() * 0.05,
        color: Math.random() < 0.2 ? '#38bdf8' : (Math.random() < 0.35 ? '#c084fc' : '#ffffff')
      });
    }

    // 2 Procedural silhouettes of distant planets
    this.planets = [
      {
        x: this.width * 0.85,
        y: this.height * 0.22,
        radius: 46,
        speed: 0.04,
        color: '#1e1b4b',
        ring: true,
        ringColor: 'rgba(168, 85, 247, 0.25)'
      },
      {
        x: this.width * 0.15,
        y: this.height * 0.75,
        radius: 28,
        speed: 0.07,
        color: '#083344',
        ring: false
      }
    ];
  }

  update(dt, playerSpeedY = 0) {
    const baseSpeed = 40 * dt;
    this.stars.forEach(s => {
      s.y += (baseSpeed * s.speed) + (playerSpeedY * 0.15);
      if (s.y > this.height) {
        s.y = 0;
        s.x = Math.random() * this.width;
      } else if (s.y < 0) {
        s.y = this.height;
        s.x = Math.random() * this.width;
      }
      s.alpha += Math.sin(Date.now() * 0.003 * s.twinkleSpeed) * 0.01;
    });

    this.planets.forEach(p => {
      p.y += (baseSpeed * p.speed);
      if (p.y - p.radius > this.height) {
        p.y = -p.radius * 2;
        p.x = Math.random() * this.width;
      }
    });
  }

  draw(ctx) {
    // Draw Planets
    this.planets.forEach(p => {
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();

      // Atmospheric rim light
      const grad = ctx.createRadialGradient(p.x - p.radius * 0.3, p.y - p.radius * 0.3, 2, p.x, p.y, p.radius);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.2)');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();

      if (p.ring) {
        ctx.strokeStyle = p.ringColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.radius * 1.7, p.radius * 0.45, -Math.PI / 6, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    });

    // Draw Stars
    this.stars.forEach(s => {
      ctx.fillStyle = s.color;
      ctx.globalAlpha = Math.max(0.1, Math.min(1.0, s.alpha));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;
  }
}

class ParticleSystem {
  constructor() {
    this.particles = [];
    this.floatingTexts = [];
    this.shockwaves = [];
  }

  createExplosion(x, y, color = '#38bdf8', count = 25, isLarge = false) {
    const pCount = isLarge ? count * 2 : count;
    for (let i = 0; i < pCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (isLarge ? 60 : 30) + Math.random() * (isLarge ? 260 : 160);
      const life = 0.3 + Math.random() * (isLarge ? 0.7 : 0.45);

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: (isLarge ? 2.5 : 1.8) + Math.random() * 2.5,
        color: Math.random() < 0.4 ? '#ffffff' : color,
        life,
        maxLife: life,
        decay: 1.0,
        drag: 0.94
      });
    }

    // Shockwave ring
    this.shockwaves.push({
      x,
      y,
      radius: 4,
      maxRadius: isLarge ? 85 : 45,
      speed: isLarge ? 220 : 160,
      color,
      alpha: 1.0
    });
  }

  createSparks(x, y, angle, color = '#f59e0b', count = 6) {
    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * 0.8;
      const speed = 40 + Math.random() * 110;
      const life = 0.15 + Math.random() * 0.25;

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle + spread) * speed,
        vy: Math.sin(angle + spread) * speed,
        size: 1.2 + Math.random() * 1.5,
        color,
        life,
        maxLife: life,
        decay: 1.0,
        drag: 0.90
      });
    }
  }

  createThrusterParticle(x, y, vx, vy, color = '#38bdf8') {
    this.particles.push({
      x: x + (Math.random() - 0.5) * 4,
      y: y + (Math.random() - 0.5) * 4,
      vx: vx + (Math.random() - 0.5) * 20,
      vy: vy + 70 + Math.random() * 80,
      size: 1.5 + Math.random() * 2.2,
      color,
      life: 0.16 + Math.random() * 0.18,
      maxLife: 0.3,
      decay: 1.0,
      drag: 0.92
    });
  }

  addFloatingText(x, y, text, color = '#f8fafc', size = 14) {
    this.floatingTexts.push({
      x,
      y,
      text,
      color,
      size,
      alpha: 1.0,
      vy: -40,
      life: 0.8
    });
  }

  update(dt) {
    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    // Update Shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.radius += s.speed * dt;
      s.alpha = Math.max(0, 1.0 - (s.radius / s.maxRadius));
      if (s.radius >= s.maxRadius) {
        this.shockwaves.splice(i, 1);
      }
    }

    // Update Floating Texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const t = this.floatingTexts[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.floatingTexts.splice(i, 1);
        continue;
      }
      t.y += t.vy * dt;
      t.alpha = t.life / 0.8;
    }
  }

  draw(ctx) {
    // Draw shockwaves
    this.shockwaves.forEach(s => {
      ctx.save();
      ctx.strokeStyle = s.color;
      ctx.globalAlpha = s.alpha * 0.8;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });

    // Draw particles
    this.particles.forEach(p => {
      ctx.save();
      const progress = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, progress);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * progress, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Draw floating text
    this.floatingTexts.forEach(t => {
      ctx.save();
      ctx.fillStyle = t.color;
      ctx.font = `bold ${t.size}px monospace`;
      ctx.textAlign = 'center';
      ctx.globalAlpha = t.alpha;
      ctx.shadowColor = t.color;
      ctx.shadowBlur = 8;
      ctx.fillText(t.text, t.x, t.y);
      ctx.restore();
    });
  }

  clear() {
    this.particles = [];
    this.shockwaves = [];
    this.floatingTexts = [];
  }
}

window.Starfield = Starfield;
window.ParticleSystem = ParticleSystem;
