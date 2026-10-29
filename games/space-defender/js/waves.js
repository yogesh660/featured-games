/**
 * Space Defender — Wave Director & Formation Spawner
 */

class WaveDirector {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.currentWave = 1;
    this.waveState = 'READY'; // 'READY', 'IN_PROGRESS', 'WAVE_CLEAR'
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.waveClearTimer = 0;
  }

  resize(w, h) {
    this.width = w;
    this.height = h;
  }

  startWave(waveNum) {
    this.currentWave = waveNum;
    this.waveState = 'IN_PROGRESS';
    this.spawnQueue = [];
    this.spawnTimer = 0.5;

    if (waveNum % 5 === 0) {
      // BOSS WAVE!
      this.spawnQueue.push({ type: 'boss', x: this.width * 0.5, y: -80, delay: 1.0 });
      // Add support escorts
      for (let i = 0; i < 4; i++) {
        this.spawnQueue.push({
          type: 'scout',
          x: this.width * (0.2 + i * 0.2),
          y: -120 - i * 30,
          delay: 2.0 + i * 0.6
        });
      }
      return;
    }

    // Standard Waves
    const baseEnemies = 6 + (waveNum * 3);

    // 1. Scout Waves (V-Formation)
    const vCenter = this.width * 0.5;
    for (let i = 0; i < Math.min(8, 4 + waveNum); i++) {
      const offset = (i % 2 === 0 ? 1 : -1) * Math.ceil(i / 2) * 45;
      this.spawnQueue.push({
        type: 'scout',
        x: vCenter + offset,
        y: -40 - Math.ceil(i / 2) * 35,
        delay: 0.8 + Math.ceil(i / 2) * 0.4
      });
    }

    // 2. Corvettes (Starting wave 2)
    if (waveNum >= 2) {
      const numCorvettes = Math.min(5, 1 + Math.floor(waveNum / 2));
      for (let i = 0; i < numCorvettes; i++) {
        this.spawnQueue.push({
          type: 'corvette',
          x: this.width * (0.2 + (i / Math.max(1, numCorvettes - 1)) * 0.6),
          y: -60,
          delay: 3.5 + i * 1.2
        });
      }
    }

    // 3. Stealth Frigates (Starting wave 3)
    if (waveNum >= 3) {
      const numFrigates = Math.min(4, Math.floor((waveNum - 1) / 2));
      for (let i = 0; i < numFrigates; i++) {
        this.spawnQueue.push({
          type: 'frigate',
          x: 80 + Math.random() * (this.width - 160),
          y: -70,
          delay: 5.5 + i * 2.0
        });
      }
    }
  }

  update(dt, enemiesList) {
    if (this.waveState === 'IN_PROGRESS') {
      this.spawnTimer -= dt;

      // Check spawn queue
      for (let i = this.spawnQueue.length - 1; i >= 0; i--) {
        const item = this.spawnQueue[i];
        item.delay -= dt;
        if (item.delay <= 0) {
          enemiesList.push(new Enemy(item.x, item.y, item.type, this.currentWave));
          this.spawnQueue.splice(i, 1);
        }
      }

      // Check if wave is defeated
      if (this.spawnQueue.length === 0 && enemiesList.length === 0) {
        this.waveState = 'WAVE_CLEAR';
        this.waveClearTimer = 2.4;
      }
    } else if (this.waveState === 'WAVE_CLEAR') {
      this.waveClearTimer -= dt;
      if (this.waveClearTimer <= 0) {
        this.startWave(this.currentWave + 1);
        return 'new_wave_started';
      }
    }
    return null;
  }

  generatePowerUpDrop(x, y) {
    // 30% chance of powerup drop on elite / special enemy death
    const r = Math.random();
    if (r < 0.32) {
      const types = ['spread', 'rapid', 'shield', 'bomb', 'drone'];
      const chosen = types[Math.floor(Math.random() * types.length)];
      return new PowerUp(x, y, chosen);
    }
    return null;
  }
}

window.WaveDirector = WaveDirector;
