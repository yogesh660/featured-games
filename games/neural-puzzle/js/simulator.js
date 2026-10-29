/**
 * Neural Puzzle — Signal Simulation & Graph Traversal Engine
 * Models directional conduits, multi-color signal frequencies, logic gates, and solvability checks.
 */

// Orthogonal Direction Enums & Vectors
// 0: North (-Y), 1: East (+X), 2: South (+Y), 3: West (-X)
const DIRS = {
  NORTH: 0,
  EAST: 1,
  SOUTH: 2,
  WEST: 3
};

const DIR_VECTORS = [
  { dx:  0, dy: -1 }, // North
  { dx:  1, dy:  0 }, // East
  { dx:  0, dy:  1 }, // South
  { dx: -1, dy:  0 }  // West
];

const OPPOSITE_DIR = [2, 3, 0, 1];

// Canonical base ports for tile types at rotation 0:
const TILE_DEFINITIONS = {
  // Conduits
  straight: {
    name: 'Conduit (Line)',
    ports: [DIRS.NORTH, DIRS.SOUTH],
    rotatable: true
  },
  corner: {
    name: 'Conduit (Corner)',
    ports: [DIRS.NORTH, DIRS.EAST],
    rotatable: true
  },
  tee: {
    name: 'Synaptic Splitter',
    ports: [DIRS.NORTH, DIRS.EAST, DIRS.WEST],
    rotatable: true
  },
  cross: {
    name: 'Nexus Cross',
    ports: [DIRS.NORTH, DIRS.EAST, DIRS.SOUTH, DIRS.WEST],
    rotatable: true
  },
  bridge: {
    name: 'Quantum Bridge', // Two independent, non-mixing channels (N-S and E-W)
    isBridge: true,
    channels: [
      [DIRS.NORTH, DIRS.SOUTH],
      [DIRS.EAST, DIRS.WEST]
    ],
    rotatable: true
  },

  // Active Components
  source: {
    name: 'Action Potential (Soma)',
    ports: [DIRS.NORTH],
    isSource: true,
    rotatable: true
  },
  target: {
    name: 'Synaptic Receptor',
    ports: [DIRS.NORTH, DIRS.EAST, DIRS.SOUTH, DIRS.WEST],
    isTarget: true,
    rotatable: false
  },
  'gate-and': {
    name: 'Logic Synapse (AND)',
    isGate: true,
    gateType: 'AND',
    inputs: [DIRS.WEST, DIRS.SOUTH], // Requires inputs from both West & South at rot 0
    outputs: [DIRS.NORTH],           // Outputs to North at rot 0
    rotatable: true
  },
  filter: {
    name: 'Frequency Transmuter',
    isFilter: true,
    inputs: [DIRS.SOUTH],
    outputs: [DIRS.NORTH],
    rotatable: true
  },
  block: {
    name: 'Inert Neural Barrier',
    ports: [],
    rotatable: false,
    isBlock: true
  }
};

class NeuralSimulator {
  constructor(grid) {
    this.width = grid.width;
    this.height = grid.height;
    this.tiles = grid.tiles; // 2D array [y][x]
  }

  /**
   * Returns effective ports for a tile considering its current rotation
   */
  static getEffectivePorts(tile) {
    if (!tile || tile.type === 'block') return [];
    const def = TILE_DEFINITIONS[tile.type];
    if (!def) return [];

    const rot = (tile.rotation || 0) % 4;

    if (def.isBridge) {
      // Bridge has 2 channels
      return [
        (DIRS.NORTH + rot) % 4,
        (DIRS.EAST + rot) % 4,
        (DIRS.SOUTH + rot) % 4,
        (DIRS.WEST + rot) % 4
      ];
    }

    if (def.isGate || def.isFilter) {
      const ports = [];
      (def.inputs || []).forEach(p => ports.push((p + rot) % 4));
      (def.outputs || []).forEach(p => ports.push((p + rot) % 4));
      return ports;
    }

    return (def.ports || []).map(p => (p + rot) % 4);
  }

  /**
   * Check whether two adjacent tiles share a connected port
   */
  static areTilesConnected(tileA, xA, yA, dirA, tileB, xB, yB) {
    const oppDir = OPPOSITE_DIR[dirA];
    const portsA = NeuralSimulator.getEffectivePorts(tileA);
    const portsB = NeuralSimulator.getEffectivePorts(tileB);
    return portsA.includes(dirA) && portsB.includes(oppDir);
  }

  /**
   * Run full signal propagation across the network
   */
  simulate() {
    // Reset all dynamic simulation state on tiles
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const tile = this.tiles[y][x];
        if (!tile) continue;
        tile.powered = false;
        tile.activePorts = new Set();
        tile.activeSignals = []; // array of { color, energy }
        tile.incomingCount = 0;
        tile.satisfied = false;
        tile.andTriggered = false;
      }
    }

    const activePaths = []; // Array of { fromX, fromY, toX, toY, color } for particle rendering
    const sources = [];
    const targets = [];

    // Locate all sources and targets
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const tile = this.tiles[y][x];
        if (!tile) continue;
        if (tile.type === 'source') {
          sources.push({ x, y, tile });
        } else if (tile.type === 'target') {
          targets.push({ x, y, tile });
        }
      }
    }

    // Multi-pass propagation to properly support logic AND gates and convergent signals
    let stateChanged = true;
    let iterations = 0;
    const maxIterations = 20;

    // We keep track of signal states: key = `${x},${y},${port},${color}`
    const visitedEdges = new Set();

    while (stateChanged && iterations < maxIterations) {
      stateChanged = false;
      iterations++;

      // Queue initialized with all active sources
      const queue = [];
      sources.forEach(src => {
        const rot = (src.tile.rotation || 0) % 4;
        const outDir = (DIRS.NORTH + rot) % 4;
        const color = src.tile.color || 'cyan';
        const energy = src.tile.energy || 10;
        src.tile.powered = true;
        src.tile.activePorts.add(outDir);
        queue.push({
          x: src.x,
          y: src.y,
          dir: outDir,
          color,
          energy
        });
      });

      while (queue.length > 0) {
        const current = queue.shift();
        const nextX = current.x + DIR_VECTORS[current.dir].dx;
        const nextY = current.y + DIR_VECTORS[current.dir].dy;
        const inDir = OPPOSITE_DIR[current.dir];

        // Bounds check
        if (nextX < 0 || nextX >= this.width || nextY < 0 || nextY >= this.height) {
          continue;
        }

        const nextTile = this.tiles[nextY][nextX];
        if (!nextTile || nextTile.type === 'block') continue;

        // Check if next tile has a matching input port in direction inDir
        const rot = (nextTile.rotation || 0) % 4;
        const def = TILE_DEFINITIONS[nextTile.type];
        if (!def) continue;

        const edgeKey = `${current.x},${current.y}->${nextX},${nextY}[${current.dir}:${current.color}]`;
        if (visitedEdges.has(edgeKey)) continue;

        // Handle Bridge: independent channel routing
        if (def.isBridge) {
          const ch1 = [(DIRS.NORTH + rot) % 4, (DIRS.SOUTH + rot) % 4];
          const ch2 = [(DIRS.EAST + rot) % 4, (DIRS.WEST + rot) % 4];

          let outDir = null;
          if (ch1.includes(inDir)) {
            outDir = ch1[0] === inDir ? ch1[1] : ch1[0];
          } else if (ch2.includes(inDir)) {
            outDir = ch2[0] === inDir ? ch2[1] : ch2[0];
          }

          if (outDir !== null) {
            visitedEdges.add(edgeKey);
            nextTile.powered = true;
            nextTile.activePorts.add(inDir);
            nextTile.activePorts.add(outDir);
            activePaths.push({
              fromX: current.x, fromY: current.y,
              toX: nextX, toY: nextY,
              color: current.color
            });

            queue.push({
              x: nextX,
              y: nextY,
              dir: outDir,
              color: current.color,
              energy: current.energy - 1
            });
          }
          continue;
        }

        // Handle Target (accepts incoming signal from any connecting conduit)
        if (def.isTarget) {
          visitedEdges.add(edgeKey);
          nextTile.powered = true;
          nextTile.activePorts.add(inDir);
          activePaths.push({
            fromX: current.x, fromY: current.y,
            toX: nextX, toY: nextY,
            color: current.color
          });

          // Check if frequency requirement matches
          if (!nextTile.targetColor || nextTile.targetColor === current.color) {
            if (!nextTile.satisfied) {
              nextTile.satisfied = true;
              stateChanged = true;
            }
          }
          continue;
        }

        // Handle Logic AND Gate
        if (def.gateType === 'AND') {
          const effInputs = (def.inputs || []).map(p => (p + rot) % 4);
          const effOutputs = (def.outputs || []).map(p => (p + rot) % 4);

          if (effInputs.includes(inDir)) {
            visitedEdges.add(edgeKey);
            nextTile.powered = true;
            nextTile.activePorts.add(inDir);
            activePaths.push({
              fromX: current.x, fromY: current.y,
              toX: nextX, toY: nextY,
              color: current.color
            });

            // Increment incoming input count
            nextTile.incomingCount = (nextTile.incomingCount || 0) + 1;

            // If threshold reached (both inputs active), fire output!
            if (nextTile.incomingCount >= 2 && !nextTile.andTriggered) {
              nextTile.andTriggered = true;
              stateChanged = true;
              effOutputs.forEach(outPort => {
                nextTile.activePorts.add(outPort);
                queue.push({
                  x: nextX,
                  y: nextY,
                  dir: outPort,
                  color: current.color,
                  energy: 10
                });
              });
            }
          }
          continue;
        }

        // Handle Frequency Filter / Shifter
        if (def.isFilter) {
          const effInput = (DIRS.SOUTH + rot) % 4;
          const effOutput = (DIRS.NORTH + rot) % 4;

          if (inDir === effInput) {
            visitedEdges.add(edgeKey);
            nextTile.powered = true;
            nextTile.activePorts.add(effInput);
            nextTile.activePorts.add(effOutput);
            activePaths.push({
              fromX: current.x, fromY: current.y,
              toX: nextX, toY: nextY,
              color: current.color
            });

            const nextColor = nextTile.filterToColor || (current.color === 'cyan' ? 'magenta' : 'amber');
            queue.push({
              x: nextX,
              y: nextY,
              dir: effOutput,
              color: nextColor,
              energy: current.energy - 1
            });
          }
          continue;
        }

        // Standard Conduits (straight, corner, tee, cross)
        const effPorts = (def.ports || []).map(p => (p + rot) % 4);
        if (effPorts.includes(inDir)) {
          visitedEdges.add(edgeKey);
          nextTile.powered = true;
          nextTile.activePorts.add(inDir);
          activePaths.push({
            fromX: current.x, fromY: current.y,
            toX: nextX, toY: nextY,
            color: current.color
          });

          // Propagate to all OTHER effective ports of this tile
          effPorts.forEach(outDir => {
            if (outDir !== inDir) {
              nextTile.activePorts.add(outDir);
              queue.push({
                x: nextX,
                y: nextY,
                dir: outDir,
                color: current.color,
                energy: current.energy - 1
              });
            }
          });
        }
      }
    }

    // Check overall win condition: all targets must be satisfied
    let allTargetsSatisfied = targets.length > 0;
    let poweredTargetCount = 0;

    targets.forEach(t => {
      if (t.tile.satisfied) {
        poweredTargetCount++;
      } else {
        allTargetsSatisfied = false;
      }
    });

    return {
      isSolved: allTargetsSatisfied,
      totalTargets: targets.length,
      poweredTargets: poweredTargetCount,
      activePaths: activePaths
    };
  }

  /**
   * Intelligent Hint Generator:
   * Compares the current board state with the canonical level solution.
   * Finds the most impactful misoriented tile and returns hint details.
   */
  getHint(solution) {
    if (!solution) return null;

    // Scan for misoriented rotatable tiles
    const candidates = [];

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const tile = this.tiles[y][x];
        if (!tile || tile.type === 'block' || tile.fixed) continue;

        const currentRot = (tile.rotation || 0) % 4;
        const targetRot = (solution[y][x] || 0) % 4;

        // Symmetric tiles (e.g. straight line rotation 0 == 2, cross rotation 0 == 1 == 2 == 3)
        let isCorrect = (currentRot === targetRot);
        if (tile.type === 'straight') {
          isCorrect = (currentRot % 2 === targetRot % 2);
        } else if (tile.type === 'cross') {
          isCorrect = true; // 4-way cross is always symmetric
        }

        if (!isCorrect) {
          // Calculate turns needed clockwise
          let turnsNeeded = (targetRot - currentRot + 4) % 4;
          if (tile.type === 'straight' && turnsNeeded === 2) {
            turnsNeeded = 0; // already aligned
          }

          if (turnsNeeded > 0) {
            // Prioritize tiles that are already adjacent to active conduits or sources
            let priority = 1;
            if (tile.powered) priority += 2;
            for (let d = 0; d < 4; d++) {
              const nx = x + DIR_VECTORS[d].dx;
              const ny = y + DIR_VECTORS[d].dy;
              if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                if (this.tiles[ny][nx] && this.tiles[ny][nx].powered) {
                  priority += 3;
                }
              }
            }

            candidates.push({
              x,
              y,
              tile,
              turnsNeeded,
              priority
            });
          }
        }
      }
    }

    if (candidates.length === 0) return null;

    // Sort by priority descending (highest priority first)
    candidates.sort((a, b) => b.priority - a.priority);
    const best = candidates[0];

    const def = TILE_DEFINITIONS[best.tile.type] || { name: 'Conduit' };
    const turnText = best.turnsNeeded === 1 ? '1 click (90°)' : `${best.turnsNeeded} clicks (${best.turnsNeeded * 90}°)`;

    return {
      x: best.x,
      y: best.y,
      message: `Rotate the ${def.name} at [${best.x + 1}, ${best.y + 1}] by ${turnText}.`
    };
  }
}

window.NeuralSimulator = NeuralSimulator;
window.TILE_DEFINITIONS = TILE_DEFINITIONS;
window.DIRS = DIRS;
window.DIR_VECTORS = DIR_VECTORS;
window.OPPOSITE_DIR = OPPOSITE_DIR;
