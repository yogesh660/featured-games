/**
 * Neural Puzzle — Canvas 60fps Visualizer & Theme Renderer
 * Renders glowing neon conduits, flowing action potential particles, and smooth spring-interpolated tile rotations.
 */

const THEMES = {
  cyber: {
    id: 'cyber',
    name: 'Cyber Cortex',
    bg: '#080a11',
    gridLines: 'rgba(255, 255, 255, 0.03)',
    tileBg: 'rgba(18, 24, 38, 0.72)',
    tileBorder: 'rgba(56, 189, 248, 0.16)',
    tileBorderHover: 'rgba(56, 189, 248, 0.45)',
    conduitInactive: '#1e2638',
    conduitCore: '#0f172a',
    colors: {
      cyan: {
        glow: '#00f3ff',
        core: '#e0faff',
        particle: '#38bdf8'
      },
      magenta: {
        glow: '#ec4899',
        core: '#fdf2f8',
        particle: '#f43f5e'
      },
      amber: {
        glow: '#f59e0b',
        core: '#fffbeb',
        particle: '#fbbf24'
      }
    }
  },
  bio: {
    id: 'bio',
    name: 'Bio-Cortex',
    bg: '#05110d',
    gridLines: 'rgba(52, 211, 153, 0.04)',
    tileBg: 'rgba(10, 31, 24, 0.75)',
    tileBorder: 'rgba(52, 211, 153, 0.18)',
    tileBorderHover: 'rgba(52, 211, 153, 0.5)',
    conduitInactive: '#16382b',
    conduitCore: '#0a231b',
    colors: {
      cyan: {
        glow: '#10b981',
        core: '#ecfdf5',
        particle: '#34d399'
      },
      magenta: {
        glow: '#a855f7',
        core: '#faf5ff',
        particle: '#c084fc'
      },
      amber: {
        glow: '#f59e0b',
        core: '#fffbeb',
        particle: '#fbbf24'
      }
    }
  },
  quantum: {
    id: 'quantum',
    name: 'Quantum Lattice',
    bg: '#0b0d13',
    gridLines: 'rgba(255, 255, 255, 0.03)',
    tileBg: 'rgba(21, 26, 36, 0.75)',
    tileBorder: 'rgba(148, 163, 184, 0.2)',
    tileBorderHover: 'rgba(226, 232, 240, 0.5)',
    conduitInactive: '#262d3d',
    conduitCore: '#131722',
    colors: {
      cyan: {
        glow: '#38bdf8',
        core: '#ffffff',
        particle: '#93c5fd'
      },
      magenta: {
        glow: '#818cf8',
        core: '#ffffff',
        particle: '#a5b4fc'
      },
      amber: {
        glow: '#34d399',
        core: '#ffffff',
        particle: '#6ee7b7'
      }
    }
  },
  solar: {
    id: 'solar',
    name: 'Solar Synapse',
    bg: '#120907',
    gridLines: 'rgba(251, 146, 60, 0.04)',
    tileBg: 'rgba(36, 17, 13, 0.75)',
    tileBorder: 'rgba(251, 146, 60, 0.2)',
    tileBorderHover: 'rgba(251, 146, 60, 0.5)',
    conduitInactive: '#3d2019',
    conduitCore: '#1f100d',
    colors: {
      cyan: {
        glow: '#f59e0b',
        core: '#fffbeb',
        particle: '#fbbf24'
      },
      magenta: {
        glow: '#ef4444',
        core: '#fef2f2',
        particle: '#f87171'
      },
      amber: {
        glow: '#fb923c',
        core: '#fff7ed',
        particle: '#fed7aa'
      }
    }
  }
};

class NeuralRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.theme = THEMES.cyber;

    // View metrics
    this.dpr = window.devicePixelRatio || 1;
    this.boardWidth = 0;
    this.boardHeight = 0;
    this.tileSize = 72;
    this.padding = 24;
    this.offsetX = 0;
    this.offsetY = 0;

    // Animation states
    // tileRotations[y][x] = { visualAngle, targetAngle, vel }
    this.tileAnimations = [];
    this.particles = [];
    this.maxParticles = 65;
    this.particleSpawnTimer = 0;

    // Interaction highlights
    this.hoveredTile = null; // { x, y }
    this.selectedTile = null; // { x, y }
    this.hintTile = null; // { x, y }
    this.hintPulse = 0;
  }

  setTheme(themeId) {
    if (THEMES[themeId]) {
      this.theme = THEMES[themeId];
    }
  }

  initTileAnimations(width, height, tiles) {
    this.tileAnimations = [];
    for (let y = 0; y < height; y++) {
      const row = [];
      for (let x = 0; x < width; x++) {
        const t = tiles[y][x];
        const rot = t ? (t.rotation || 0) : 0;
        row.push({
          visualAngle: rot * (Math.PI / 2),
          targetAngle: rot * (Math.PI / 2)
        });
      }
      this.tileAnimations.push(row);
    }
    this.particles = [];
  }

  onTileRotated(x, y, newRotation, direction = 1) {
    if (this.tileAnimations[y] && this.tileAnimations[y][x]) {
      const anim = this.tileAnimations[y][x];
      // Increment target by 90 degrees * direction
      anim.targetAngle += direction * (Math.PI / 2);
    }
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height || 600;

    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.dpr, this.dpr);
  }

  updateMetrics(gridWidth, gridHeight) {
    const parent = this.canvas.parentElement;
    const containerW = parent ? parent.clientWidth : 600;
    const containerH = parent ? parent.clientHeight : 600;

    const availableW = containerW - this.padding * 2;
    const availableH = containerH - this.padding * 2;

    const sizeW = availableW / gridWidth;
    const sizeH = availableH / gridHeight;

    // Constrain tile size: min 52, max 104
    this.tileSize = Math.floor(Math.min(Math.min(sizeW, sizeH), 104));
    this.tileSize = Math.max(this.tileSize, 48);

    this.boardWidth = gridWidth * this.tileSize;
    this.boardHeight = gridHeight * this.tileSize;

    this.offsetX = Math.floor((containerW - this.boardWidth) / 2);
    this.offsetY = Math.floor((containerH - this.boardHeight) / 2);
  }

  /**
   * Convert screen/client coordinates to grid cell { x, y }
   */
  screenToGrid(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = clientX - rect.left - this.offsetX;
    const y = clientY - rect.top - this.offsetY;

    if (x < 0 || y < 0 || x >= this.boardWidth || y >= this.boardHeight) {
      return null;
    }

    const gx = Math.floor(x / this.tileSize);
    const gy = Math.floor(y / this.tileSize);
    return { x: gx, y: gy };
  }

  /**
   * Main render loop frame
   */
  render(gameState, dt = 0.016) {
    const ctx = this.ctx;
    const w = this.canvas.width / this.dpr;
    const h = this.canvas.height / this.dpr;

    // 1. Clear background
    ctx.fillStyle = this.theme.bg;
    ctx.fillRect(0, 0, w, h);

    if (!gameState || !gameState.tiles) return;

    this.updateMetrics(gameState.width, gameState.height);

    // 2. Subtle grid background mesh
    ctx.save();
    ctx.strokeStyle = this.theme.gridLines;
    ctx.lineWidth = 1;
    const gridSize = 32;
    for (let x = 0; x < w; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.restore();

    // 3. Update spring rotations
    for (let y = 0; y < gameState.height; y++) {
      for (let x = 0; x < gameState.width; x++) {
        const anim = this.tileAnimations[y] ? this.tileAnimations[y][x] : null;
        if (anim) {
          // Smooth asymptotic approach
          const diff = anim.targetAngle - anim.visualAngle;
          if (Math.abs(diff) > 0.001) {
            anim.visualAngle += diff * 0.22;
          } else {
            anim.visualAngle = anim.targetAngle;
          }
        }
      }
    }

    // 4. Update and spawn action potential particles
    this.updateParticles(gameState, dt);

    // 5. Draw Board Tiles
    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);

    this.hintPulse += dt * 4;

    for (let y = 0; y < gameState.height; y++) {
      for (let x = 0; x < gameState.width; x++) {
        const tile = gameState.tiles[y][x];
        const anim = this.tileAnimations[y] ? this.tileAnimations[y][x] : null;
        const angle = anim ? anim.visualAngle : 0;
        const isHovered = this.hoveredTile && this.hoveredTile.x === x && this.hoveredTile.y === y;
        const isSelected = this.selectedTile && this.selectedTile.x === x && this.selectedTile.y === y;
        const isHint = this.hintTile && this.hintTile.x === x && this.hintTile.y === y;

        this.drawTile(ctx, tile, x, y, angle, isHovered, isSelected, isHint);
      }
    }

    // 6. Draw Action Potential Particles
    this.drawParticles(ctx);

    ctx.restore();
  }

  /**
   * Draw an individual grid tile card and its neural conduit glyphs
   */
  drawTile(ctx, tile, gx, gy, visualAngle, isHovered, isSelected, isHint) {
    const size = this.tileSize;
    const px = gx * size;
    const py = gy * size;
    const half = size / 2;
    const radius = Math.max(6, Math.floor(size * 0.12));

    ctx.save();
    ctx.translate(px + half, py + half);

    // --- Tile Card Background ---
    ctx.beginPath();
    this.roundRect(ctx, -half + 3, -half + 3, size - 6, size - 6, radius);

    if (tile.type === 'block') {
      ctx.fillStyle = 'rgba(12, 14, 20, 0.4)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.stroke();

      // Subtle diagonal hazard stripes
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 2;
      for (let d = -size; d < size * 2; d += 10) {
        ctx.beginPath();
        ctx.moveTo(d, -half);
        ctx.lineTo(d + size, half);
        ctx.stroke();
      }
      ctx.restore();

      ctx.restore();
      return;
    }

    // Interactive card fill
    ctx.fillStyle = this.theme.tileBg;
    ctx.fill();

    // Tile border
    if (isSelected) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
    } else if (isHovered && !tile.fixed) {
      ctx.strokeStyle = this.theme.tileBorderHover;
      ctx.lineWidth = 1.8;
    } else {
      ctx.strokeStyle = this.theme.tileBorder;
      ctx.lineWidth = 1;
    }
    ctx.stroke();

    // Hint Pulse Aura
    if (isHint) {
      const pulseAlpha = 0.4 + Math.sin(this.hintPulse) * 0.35;
      ctx.strokeStyle = `rgba(245, 158, 11, ${pulseAlpha})`;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Hint rotation arrow
      ctx.save();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, half * 0.75, -Math.PI * 0.4, Math.PI * 0.4);
      ctx.stroke();
      // Arrowhead
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(half * 0.75 + 4, half * 0.4 - 4);
      ctx.lineTo(half * 0.75, half * 0.4 + 4);
      ctx.lineTo(half * 0.75 - 4, half * 0.4 - 4);
      ctx.fill();
      ctx.restore();
    }

    // Fixed Indicator (pin badge for immovable sources/targets)
    if (tile.fixed && !tile.type.includes('source') && !tile.type.includes('target')) {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
      ctx.beginPath();
      ctx.arc(-half + 10, -half + 10, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // --- Rotate and draw conduits & symbols ---
    ctx.save();
    ctx.rotate(visualAngle);

    const wireWidth = Math.max(6, Math.floor(size * 0.14));
    const activeColorKey = tile.color || 'cyan';
    const activeThemeColor = this.theme.colors[activeColorKey] || this.theme.colors.cyan;

    // Draw conduit base grooves
    this.drawConduits(ctx, tile, half, wireWidth, false, activeThemeColor);

    // If powered, draw luminous core and bloom
    if (tile.powered) {
      this.drawConduits(ctx, tile, half, wireWidth, true, activeThemeColor);
    }

    // Draw component glyphs (Sources, Targets, Gates, Filters)
    this.drawComponentGlyphs(ctx, tile, half, wireWidth, activeThemeColor);

    ctx.restore(); // visualAngle rotate
    ctx.restore(); // px, py translate
  }

  /**
   * Draw conduit tracks and illuminated active paths
   */
  drawConduits(ctx, tile, half, wireWidth, isPowered, themeColor) {
    const type = tile.type;
    const def = TILE_DEFINITIONS[type];
    if (!def) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (!isPowered) {
      ctx.strokeStyle = this.theme.conduitInactive;
      ctx.lineWidth = wireWidth + 2;
    } else {
      ctx.strokeStyle = themeColor.glow;
      ctx.lineWidth = wireWidth;
      ctx.shadowColor = themeColor.glow;
      ctx.shadowBlur = Math.min(16, wireWidth * 2);
    }

    const drawArm = (dir) => {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      switch (dir) {
        case DIRS.NORTH: ctx.lineTo(0, -half); break;
        case DIRS.EAST:  ctx.lineTo(half, 0); break;
        case DIRS.SOUTH: ctx.lineTo(0, half); break;
        case DIRS.WEST:  ctx.lineTo(-half, 0); break;
      }
      ctx.stroke();
    };

    if (type === 'straight') {
      ctx.beginPath();
      ctx.moveTo(0, -half);
      ctx.lineTo(0, half);
      ctx.stroke();
    } else if (type === 'corner') {
      ctx.beginPath();
      ctx.moveTo(0, -half);
      ctx.quadraticCurveTo(0, 0, half, 0);
      ctx.stroke();
    } else if (type === 'tee') {
      drawArm(DIRS.NORTH);
      drawArm(DIRS.EAST);
      drawArm(DIRS.WEST);
    } else if (type === 'cross') {
      drawArm(DIRS.NORTH);
      drawArm(DIRS.EAST);
      drawArm(DIRS.SOUTH);
      drawArm(DIRS.WEST);
    } else if (type === 'bridge') {
      // Overpass Bridge: N-S is underpass, E-W is elevated bridge
      ctx.beginPath();
      ctx.moveTo(0, -half);
      ctx.lineTo(0, half);
      ctx.stroke();

      if (!isPowered) {
        // Draw bridge overpass mask
        ctx.save();
        ctx.fillStyle = this.theme.tileBg;
        ctx.fillRect(-wireWidth * 0.9, -wireWidth * 0.9, wireWidth * 1.8, wireWidth * 1.8);
        ctx.restore();
      }

      ctx.beginPath();
      ctx.moveTo(-half, 0);
      ctx.lineTo(half, 0);
      ctx.stroke();
    } else if (type === 'source') {
      drawArm(DIRS.NORTH);
    } else if (type === 'target') {
      if (tile.activePorts && tile.activePorts.size > 0) {
        tile.activePorts.forEach(p => {
          const rot = Math.round(visualAngle / (Math.PI / 2)) % 4;
          const localDir = (p - rot + 4) % 4;
          drawArm(localDir);
        });
      } else {
        [DIRS.NORTH, DIRS.EAST, DIRS.SOUTH, DIRS.WEST].forEach(d => {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          switch (d) {
            case DIRS.NORTH: ctx.lineTo(0, -half * 0.5); break;
            case DIRS.EAST:  ctx.lineTo(half * 0.5, 0); break;
            case DIRS.SOUTH: ctx.lineTo(0, half * 0.5); break;
            case DIRS.WEST:  ctx.lineTo(-half * 0.5, 0); break;
          }
          ctx.stroke();
        });
      }
    }
    } else if (type === 'gate-and') {
      drawArm(DIRS.WEST);
      drawArm(DIRS.SOUTH);
      drawArm(DIRS.NORTH);
    } else if (type === 'filter') {
      drawArm(DIRS.SOUTH);
      drawArm(DIRS.NORTH);
    }

    // Powered Inner Core Highlight
    if (isPowered) {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = themeColor.core;
      ctx.lineWidth = Math.max(2, wireWidth * 0.35);

      if (type === 'straight') {
        ctx.beginPath();
        ctx.moveTo(0, -half);
        ctx.lineTo(0, half);
        ctx.stroke();
      } else if (type === 'corner') {
        ctx.beginPath();
        ctx.moveTo(0, -half);
        ctx.quadraticCurveTo(0, 0, half, 0);
        ctx.stroke();
      } else if (type === 'tee') {
        drawArm(DIRS.NORTH);
        drawArm(DIRS.EAST);
        drawArm(DIRS.WEST);
      } else if (type === 'cross') {
        drawArm(DIRS.NORTH);
        drawArm(DIRS.EAST);
        drawArm(DIRS.SOUTH);
        drawArm(DIRS.WEST);
      } else if (type === 'bridge') {
        ctx.beginPath();
        ctx.moveTo(0, -half);
        ctx.lineTo(0, half);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-half, 0);
        ctx.lineTo(half, 0);
        ctx.stroke();
      } else if (type === 'source') {
        drawArm(DIRS.NORTH);
      } else if (type === 'target') {
        if (tile.activePorts && tile.activePorts.size > 0) {
          tile.activePorts.forEach(p => {
            const rot = Math.round(visualAngle / (Math.PI / 2)) % 4;
            const localDir = (p - rot + 4) % 4;
            drawArm(localDir);
          });
        }
      } else if (type === 'gate-and') {
        drawArm(DIRS.WEST);
        drawArm(DIRS.SOUTH);
        drawArm(DIRS.NORTH);
      } else if (type === 'filter') {
        drawArm(DIRS.SOUTH);
        drawArm(DIRS.NORTH);
      }
    }

    ctx.restore();
  }

  /**
   * Draw specialized icons (Soma, Synapse Receptor, AND Logic Gate, Color Filter)
   */
  drawComponentGlyphs(ctx, tile, half, wireWidth, themeColor) {
    const type = tile.type;

    // --- Action Potential (Source Soma) ---
    if (type === 'source') {
      ctx.save();
      const nodeR = half * 0.42;

      ctx.beginPath();
      ctx.arc(0, 0, nodeR, 0, Math.PI * 2);
      ctx.fillStyle = themeColor.glow;
      ctx.shadowColor = themeColor.glow;
      ctx.shadowBlur = 14;
      ctx.fill();

      // Pulsing central nucleus
      ctx.beginPath();
      ctx.arc(0, 0, nodeR * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 0;
      ctx.fill();

      // Outward directional arrow indicator
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-4, -2);
      ctx.lineTo(0, -8);
      ctx.lineTo(4, -2);
      ctx.stroke();

      ctx.restore();
    }

    // --- Synaptic Receptor (Target) ---
    else if (type === 'target') {
      ctx.save();
      const nodeR = half * 0.44;
      const targetCol = this.theme.colors[tile.targetColor || tile.color || 'cyan'] || themeColor;

      // Receptor Cup / Hexagon
      ctx.beginPath();
      this.drawHexagon(ctx, 0, 0, nodeR);

      if (tile.satisfied) {
        ctx.fillStyle = targetCol.glow;
        ctx.shadowColor = targetCol.glow;
        ctx.shadowBlur = 20;
        ctx.fill();

        ctx.beginPath();
        this.drawHexagon(ctx, 0, 0, nodeR * 0.55);
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 0;
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(24, 32, 48, 0.85)';
        ctx.fill();
        ctx.strokeStyle = targetCol.glow;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = targetCol.glow;
        ctx.shadowBlur = 6;
        ctx.stroke();

        // Inward receptive dot
        ctx.fillStyle = targetCol.glow;
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    // --- Logic AND Gate ---
    else if (type === 'gate-and') {
      ctx.save();
      const gw = half * 0.75;
      const gh = half * 0.75;

      ctx.beginPath();
      this.roundRect(ctx, -gw / 2, -gh / 2, gw, gh, 4);

      if (tile.andTriggered) {
        ctx.fillStyle = themeColor.glow;
        ctx.shadowColor = themeColor.glow;
        ctx.shadowBlur = 15;
        ctx.fill();
        ctx.fillStyle = '#ffffff';
      } else {
        ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#94a3b8';
      }

      // "AND" / "&" glyph
      ctx.font = `bold ${Math.floor(half * 0.4)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 0;
      ctx.fillText('&', 0, 1);

      ctx.restore();
    }

    // --- Frequency Transmuter / Filter ---
    else if (type === 'filter') {
      ctx.save();
      const nodeR = half * 0.42;

      ctx.beginPath();
      ctx.arc(0, 0, nodeR, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fill();

      const outColKey = tile.filterToColor || 'magenta';
      const outCol = this.theme.colors[outColKey] || this.theme.colors.magenta;

      ctx.strokeStyle = outCol.glow;
      ctx.lineWidth = 3;
      ctx.shadowColor = outCol.glow;
      ctx.shadowBlur = 10;
      ctx.stroke();

      // Prismatic diamond glyph
      ctx.beginPath();
      ctx.moveTo(0, -nodeR * 0.5);
      ctx.lineTo(nodeR * 0.5, 0);
      ctx.lineTo(0, nodeR * 0.5);
      ctx.lineTo(-nodeR * 0.5, 0);
      ctx.closePath();
      ctx.fillStyle = outCol.glow;
      ctx.fill();

      ctx.restore();
    }
  }

  /**
   * Action potential electron particles that travel along active circuit paths
   */
  updateParticles(gameState, dt) {
    if (!gameState || !gameState.simResult || !gameState.simResult.activePaths) return;
    const paths = gameState.simResult.activePaths;
    if (paths.length === 0) {
      this.particles = [];
      return;
    }

    // Spawn new particles periodically
    this.particleSpawnTimer += dt;
    if (this.particleSpawnTimer >= 0.08 && this.particles.length < this.maxParticles) {
      this.particleSpawnTimer = 0;
      const path = paths[Math.floor(Math.random() * paths.length)];
      this.particles.push({
        fromX: path.fromX,
        fromY: path.fromY,
        toX: path.toX,
        toY: path.toY,
        progress: 0,
        speed: 1.6 + Math.random() * 0.8,
        color: path.color || 'cyan',
        size: 2.2 + Math.random() * 1.5
      });
    }

    // Update existing particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.progress += p.speed * dt;
      if (p.progress >= 1.0) {
        this.particles.splice(i, 1);
      }
    }
  }

  drawParticles(ctx) {
    const size = this.tileSize;
    const half = size / 2;

    this.particles.forEach(p => {
      const px = (p.fromX + (p.toX - p.fromX) * p.progress) * size + half;
      const py = (p.fromY + (p.toY - p.fromY) * p.progress) * size + half;

      const col = this.theme.colors[p.color] || this.theme.colors.cyan;
      const alpha = Math.sin(p.progress * Math.PI); // fade in and out

      ctx.save();
      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, Math.PI * 2);
      ctx.fillStyle = col.particle;
      ctx.shadowColor = col.glow;
      ctx.shadowBlur = 8;
      ctx.globalAlpha = alpha;
      ctx.fill();
      ctx.restore();
    });
  }

  // Canvas Drawing Helpers
  roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  drawHexagon(ctx, x, y, radius) {
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const hx = x + radius * Math.cos(angle);
      const hy = y + radius * Math.sin(angle);
      if (i === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
  }
}

window.NeuralRenderer = NeuralRenderer;
window.THEMES = THEMES;
