/**
 * Neural Puzzle — Master Game Controller
 * Manages player input, undo/redo, levels, daily challenges, sandbox, audio triggers, and UI state.
 */

class NeuralGame {
  constructor() {
    this.canvas = document.getElementById('neuralCanvas');
    this.audio = new NeuralAudio();
    this.renderer = new NeuralRenderer(this.canvas);
    this.simulator = null;

    // Game state
    this.currentLevelIndex = 0; // 0 to 25 in NEURAL_LEVELS
    this.currentLevelData = null;
    this.gridWidth = 3;
    this.gridHeight = 3;
    this.tiles = [];
    this.solution = null;
    this.moveCount = 0;
    this.parMoves = 0;
    this.startTime = null;
    this.elapsedSeconds = 0;
    this.timerInterval = null;
    this.isSolved = false;

    // Undo stack
    this.undoStack = [];

    // Keyboard selection cursor
    this.cursorX = 0;
    this.cursorY = 0;

    // Storage key
    this.STORAGE_KEY = 'neural_puzzle_progress_v1';
    this.progress = this.loadProgress();

    // Bind event handlers
    this.bindEvents();

    // Start render animation loop
    this.lastFrameTime = performance.now();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);

    // Initial load
    this.loadLevel(this.progress.lastLevel || 0);
  }

  loadProgress() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Storage unavailable', e);
    }
    return {
      solvedLevels: {}, // levelId: stars
      dailyCompleted: {},
      theme: 'cyber',
      volume: 0.45,
      muted: false,
      lastLevel: 0
    };
  }

  saveProgress() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.progress));
    } catch (e) {
      console.warn('Could not save progress', e);
    }
  }

  /**
   * Load an authored level by index
   */
  loadLevel(index) {
    if (index < 0 || index >= NEURAL_LEVELS.length) index = 0;
    this.currentLevelIndex = index;
    this.progress.lastLevel = index;
    this.saveProgress();

    const data = NEURAL_LEVELS[index];
    this.setupLevel(data);
  }

  /**
   * Setup active level data onto the board
   */
  setupLevel(levelData) {
    this.currentLevelData = levelData;
    this.gridWidth = levelData.width;
    this.gridHeight = levelData.height;
    this.parMoves = levelData.parMoves || 5;
    this.solution = levelData.solution;

    // Deep clone tiles to avoid mutating static level data
    this.tiles = [];
    for (let y = 0; y < this.gridHeight; y++) {
      const row = [];
      for (let x = 0; x < this.gridWidth; x++) {
        const srcTile = levelData.tiles[y][x];
        row.push({
          type: srcTile.type,
          rotation: srcTile.rotation || 0,
          color: srcTile.color,
          targetColor: srcTile.targetColor,
          filterToColor: srcTile.filterToColor,
          fixed: !!srcTile.fixed,
          powered: false
        });
      }
      this.tiles.push(row);
    }

    this.simulator = new NeuralSimulator({
      width: this.gridWidth,
      height: this.gridHeight,
      tiles: this.tiles
    });

    this.renderer.initTileAnimations(this.gridWidth, this.gridHeight, this.tiles);
    this.renderer.hintTile = null;

    this.moveCount = 0;
    this.undoStack = [];
    this.isSolved = false;

    // Reset timer
    this.elapsedSeconds = 0;
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.startTime = Date.now();
    this.timerInterval = setInterval(() => {
      if (!this.isSolved) {
        this.elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);
        this.updateHUD();
      }
    }, 1000);

    // Initial simulation pass
    this.simResult = this.simulator.simulate();

    this.updateHUD();
    this.hideWinModal();
  }

  /**
   * Rotate tile at grid coordinates
   */
  rotateTile(x, y, direction = 1, isUndo = false) {
    if (this.isSolved) return;
    if (x < 0 || x >= this.gridWidth || y < 0 || y >= this.gridHeight) return;

    const tile = this.tiles[y][x];
    if (!tile || tile.type === 'block' || tile.fixed) {
      return;
    }

    const prevRot = tile.rotation || 0;
    const newRot = (prevRot + direction + 4) % 4;
    tile.rotation = newRot;

    // Audio click
    this.audio.playRotate(direction);

    // Visual animation
    this.renderer.onTileRotated(x, y, newRot, direction);

    // Clear hint if resolved
    if (this.renderer.hintTile && this.renderer.hintTile.x === x && this.renderer.hintTile.y === y) {
      this.renderer.hintTile = null;
    }

    if (!isUndo) {
      this.undoStack.push({ x, y, prevRot, direction });
      this.moveCount++;
    }

    // Re-simulate circuit
    const prevTargets = this.simResult ? this.simResult.poweredTargets : 0;
    this.simResult = this.simulator.simulate();
    const newTargets = this.simResult.poweredTargets;

    // Sound chime if target connection increased
    if (newTargets > prevTargets) {
      this.audio.playConnect(newTargets);
    }

    this.updateHUD();

    // Check Victory
    if (this.simResult.isSolved && !this.isSolved) {
      this.onPuzzleSolved();
    }
  }

  /**
   * Undo last move
   */
  undo() {
    if (this.isSolved || this.undoStack.length === 0) return;
    const last = this.undoStack.pop();
    // Rotate reverse direction
    this.rotateTile(last.x, last.y, -last.direction, true);
    this.moveCount = Math.max(0, this.moveCount - 1);
    this.audio.playUndo();
    this.updateHUD();
  }

  /**
   * Reset current puzzle
   */
  resetCurrent() {
    if (this.currentLevelData) {
      this.setupLevel(this.currentLevelData);
      this.audio.playUndo();
    }
  }

  /**
   * Trigger intelligent hint
   */
  showHint() {
    if (this.isSolved || !this.solution) return;
    const hint = this.simulator.getHint(this.solution);
    if (hint) {
      this.renderer.hintTile = { x: hint.x, y: hint.y };
      this.audio.playHint();

      // Show toast
      const toast = document.getElementById('hintToast');
      if (toast) {
        toast.textContent = hint.message;
        toast.classList.add('visible');
        setTimeout(() => toast.classList.remove('visible'), 3800);
      }
    }
  }

  /**
   * Victory Handler
   */
  onPuzzleSolved() {
    this.isSolved = true;
    clearInterval(this.timerInterval);

    // Calculate stars
    let stars = 1;
    if (this.moveCount <= this.parMoves) {
      stars = 3;
    } else if (this.moveCount <= this.parMoves + 2) {
      stars = 2;
    }

    // Save level rating
    const levelId = this.currentLevelData.id;
    if (levelId) {
      const prevStars = this.progress.solvedLevels[levelId] || 0;
      this.progress.solvedLevels[levelId] = Math.max(prevStars, stars);
      this.saveProgress();
    } else if (this.currentLevelData.isDaily) {
      this.progress.dailyCompleted[this.currentLevelData.dateKey] = {
        moves: this.moveCount,
        time: this.elapsedSeconds
      };
      this.saveProgress();
    }

    // Play lush victory fanfare
    this.audio.playWin();

    // Display Win Modal
    setTimeout(() => {
      this.showWinModal(stars);
    }, 450);
  }

  showWinModal(stars) {
    const modal = document.getElementById('winModal');
    if (!modal) return;

    document.getElementById('winStars').innerHTML = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    document.getElementById('winMoves').textContent = `${this.moveCount} (Par: ${this.parMoves})`;
    document.getElementById('winTime').textContent = this.formatTime(this.elapsedSeconds);

    const nextBtn = document.getElementById('winNextBtn');
    if (nextBtn) {
      if (this.currentLevelIndex < NEURAL_LEVELS.length - 1 && !this.currentLevelData.isDaily && !this.currentLevelData.isCustom) {
        nextBtn.style.display = 'inline-flex';
        nextBtn.onclick = () => {
          this.loadLevel(this.currentLevelIndex + 1);
        };
      } else {
        nextBtn.style.display = 'none';
      }
    }

    modal.classList.add('active');
  }

  hideWinModal() {
    const modal = document.getElementById('winModal');
    if (modal) modal.classList.remove('active');
  }

  formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  updateHUD() {
    const titleEl = document.getElementById('hudLevelTitle');
    const descEl = document.getElementById('hudLevelDesc');
    const movesEl = document.getElementById('hudMoves');
    const parEl = document.getElementById('hudPar');
    const timerEl = document.getElementById('hudTimer');
    const targetsEl = document.getElementById('hudTargets');

    if (titleEl && this.currentLevelData) {
      titleEl.textContent = this.currentLevelData.title;
    }
    if (descEl && this.currentLevelData) {
      descEl.textContent = this.currentLevelData.description;
    }
    if (movesEl) movesEl.textContent = this.moveCount;
    if (parEl) parEl.textContent = this.parMoves;
    if (timerEl) timerEl.textContent = this.formatTime(this.elapsedSeconds);

    if (targetsEl && this.simResult) {
      targetsEl.textContent = `${this.simResult.poweredTargets} / ${this.simResult.totalTargets}`;
    }

    // Update undo button state
    const undoBtn = document.getElementById('undoBtn');
    if (undoBtn) {
      undoBtn.disabled = this.undoStack.length === 0;
    }
  }

  /**
   * Event listeners for Canvas click, right-click, keyboard, and modals
   */
  bindEvents() {
    window.addEventListener('resize', () => {
      this.renderer.resize();
    });

    // Pointer Move / Hover
    this.canvas.addEventListener('mousemove', (e) => {
      const gridPos = this.renderer.screenToGrid(e.clientX, e.clientY);
      this.renderer.hoveredTile = gridPos;
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.renderer.hoveredTile = null;
    });

    // Click to rotate clockwise
    this.canvas.addEventListener('click', (e) => {
      const gridPos = this.renderer.screenToGrid(e.clientX, e.clientY);
      if (gridPos) {
        this.renderer.selectedTile = gridPos;
        this.cursorX = gridPos.x;
        this.cursorY = gridPos.y;
        this.rotateTile(gridPos.x, gridPos.y, 1);
      }
    });

    // Right-click to rotate counter-clockwise
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const gridPos = this.renderer.screenToGrid(e.clientX, e.clientY);
      if (gridPos) {
        this.renderer.selectedTile = gridPos;
        this.cursorX = gridPos.x;
        this.cursorY = gridPos.y;
        this.rotateTile(gridPos.x, gridPos.y, -1);
      }
    });

    // Keyboard controls
    window.addEventListener('keydown', (e) => {
      // Ignore when typing in inputs/textareas
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          this.cursorY = Math.max(0, this.cursorY - 1);
          this.renderer.selectedTile = { x: this.cursorX, y: this.cursorY };
          e.preventDefault();
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          this.cursorY = Math.min(this.gridHeight - 1, this.cursorY + 1);
          this.renderer.selectedTile = { x: this.cursorX, y: this.cursorY };
          e.preventDefault();
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          this.cursorX = Math.max(0, this.cursorX - 1);
          this.renderer.selectedTile = { x: this.cursorX, y: this.cursorY };
          e.preventDefault();
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          this.cursorX = Math.min(this.gridWidth - 1, this.cursorX + 1);
          this.renderer.selectedTile = { x: this.cursorX, y: this.cursorY };
          e.preventDefault();
          break;
        case 'Enter':
        case ' ':
          this.rotateTile(this.cursorX, this.cursorY, e.shiftKey ? -1 : 1);
          e.preventDefault();
          break;
        case 'u':
        case 'U':
        case 'z':
        case 'Z':
          if (e.ctrlKey || e.metaKey || e.key.toLowerCase() === 'u') {
            this.undo();
            e.preventDefault();
          }
          break;
        case 'r':
        case 'R':
          this.resetCurrent();
          e.preventDefault();
          break;
        case 'h':
        case 'H':
          this.showHint();
          e.preventDefault();
          break;
      }
    });

    // HUD Button Actions
    const bindBtn = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
    };

    bindBtn('undoBtn', () => this.undo());
    bindBtn('resetBtn', () => this.resetCurrent());
    bindBtn('hintBtn', () => this.showHint());
    bindBtn('levelsBtn', () => this.openLevelsModal());
    bindBtn('dailyBtn', () => this.startDailyChallenge());
    bindBtn('sandboxBtn', () => this.openSandboxModal());
    bindBtn('settingsBtn', () => this.openSettingsModal());
    bindBtn('guideBtn', () => this.openGuideModal());
    bindBtn('winReplayBtn', () => this.resetCurrent());

    // Apply saved theme
    if (this.progress.theme) {
      this.renderer.setTheme(this.progress.theme);
    }
  }

  openLevelsModal() {
    const modal = document.getElementById('levelsModal');
    const grid = document.getElementById('levelsGridContainer');
    if (!modal || !grid) return;

    grid.innerHTML = '';

    // Group by Sectors
    const sectors = [
      { id: 1, name: 'Sector 1: Synthetic Awakening', levels: NEURAL_LEVELS.filter(l => l.sector === 1) },
      { id: 2, name: 'Sector 2: Synaptic Junctions', levels: NEURAL_LEVELS.filter(l => l.sector === 2) },
      { id: 3, name: 'Sector 3: Logic Gates', levels: NEURAL_LEVELS.filter(l => l.sector === 3) },
      { id: 4, name: 'Sector 4: Quantum Cortex', levels: NEURAL_LEVELS.filter(l => l.sector === 4) }
    ];

    sectors.forEach(sec => {
      const secHeader = document.createElement('div');
      secHeader.className = 'sector-header';
      secHeader.textContent = sec.name;
      grid.appendChild(secHeader);

      const levelCards = document.createElement('div');
      levelCards.className = 'sector-level-cards';

      sec.levels.forEach((lvl, idx) => {
        const card = document.createElement('button');
        card.className = 'level-select-card';
        if (lvl.id - 1 === this.currentLevelIndex) card.classList.add('current');

        const starsEarned = this.progress.solvedLevels[lvl.id] || 0;
        card.innerHTML = `
          <div class="level-num">L${lvl.id}</div>
          <div class="level-name">${lvl.title}</div>
          <div class="level-stars">${starsEarned > 0 ? '★'.repeat(starsEarned) : '---'}</div>
        `;

        card.onclick = () => {
          modal.classList.remove('active');
          this.loadLevel(lvl.id - 1);
        };

        levelCards.appendChild(card);
      });

      grid.appendChild(levelCards);
    });

    modal.classList.add('active');
  }

  startDailyChallenge() {
    const daily = NeuralGenerator.getDailyPuzzle();
    this.setupLevel(daily);
  }

  openSandboxModal() {
    const modal = document.getElementById('sandboxModal');
    if (modal) modal.classList.add('active');
  }

  generateCustomSandbox(size, difficulty) {
    const puzzle = NeuralGenerator.generatePuzzle({
      width: size,
      height: size,
      difficulty: difficulty,
      title: `${size}x${size} Neural Matrix (${difficulty.toUpperCase()})`,
      description: `Procedural neural circuit generated in Infinite Sandbox mode.`
    });
    puzzle.isCustom = true;
    this.setupLevel(puzzle);
    const modal = document.getElementById('sandboxModal');
    if (modal) modal.classList.remove('active');
  }

  openSettingsModal() {
    const modal = document.getElementById('settingsModal');
    if (modal) modal.classList.add('active');
  }

  openGuideModal() {
    const modal = document.getElementById('guideModal');
    if (modal) modal.classList.add('active');
  }

  setTheme(themeId) {
    this.renderer.setTheme(themeId);
    this.progress.theme = themeId;
    this.saveProgress();
  }

  loop(currentTime) {
    const dt = Math.min((currentTime - this.lastFrameTime) / 1000, 0.1);
    this.lastFrameTime = currentTime;

    this.renderer.render({
      width: this.gridWidth,
      height: this.gridHeight,
      tiles: this.tiles,
      simResult: this.simResult
    }, dt);

    requestAnimationFrame(this.loop);
  }
}

window.NeuralGame = NeuralGame;
