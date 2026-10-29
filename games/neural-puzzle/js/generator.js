/**
 * Neural Puzzle — Procedural Circuit Generator & Daily Pulse Engine
 * Generates guaranteed-solvable circuit puzzles on demand and daily seeded challenges.
 */

class NeuralGenerator {
  /**
   * Mulberry32 Seeded PRNG for deterministic daily challenges
   */
  static createPRNG(seedNumber) {
    let s = seedNumber | 0;
    return function() {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * String to 32-bit integer hash
   */
  static hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash);
  }

  /**
   * Generate a procedural guaranteed-solvable circuit puzzle
   */
  static generatePuzzle(options = {}) {
    const width = options.width || 5;
    const height = options.height || 5;
    const rng = options.rng || Math.random;
    const difficulty = options.difficulty || 'medium'; // casual, medium, expert

    // 1. Initialize grid with empty connections
    // Each cell keeps track of open directional connections [North, East, South, West]
    const connections = Array.from({ length: height }, () =>
      Array.from({ length: width }, () => [false, false, false, false])
    );

    // 2. Select Source and Target positions
    const startX = 0;
    const startY = Math.floor(rng() * height);

    // Pick 1 to 3 spaced targets on the opposite edge
    const targetCount = (difficulty === 'casual' || height <= 3) ? 1 : (difficulty === 'expert' && height >= 6 ? 3 : 2);
    const targetPositions = [];
    if (targetCount === 1) {
      targetPositions.push({ x: width - 1, y: Math.floor(height / 2) });
    } else if (targetCount === 2) {
      targetPositions.push({ x: width - 1, y: 0 });
      targetPositions.push({ x: width - 1, y: height - 1 });
    } else {
      targetPositions.push({ x: width - 1, y: 0 });
      targetPositions.push({ x: width - 1, y: Math.floor(height / 2) });
      targetPositions.push({ x: width - 1, y: height - 1 });
    }

    // 3. Connect Source to all Targets using BFS Steiner Tree
    const connectedSet = new Set();
    connectedSet.add(`${startX},${startY}`);
    let sourceOutDir = null;

    for (const tgt of targetPositions) {
      if (connectedSet.has(`${tgt.x},${tgt.y}`)) continue;

      const queue = [{ x: tgt.x, y: tgt.y, path: [] }];
      const visited = new Set();
      visited.add(`${tgt.x},${tgt.y}`);

      let foundPath = null;
      while (queue.length > 0) {
        const cur = queue.shift();
        if (connectedSet.has(`${cur.x},${cur.y}`)) {
          foundPath = cur.path;
          break;
        }

        // Shuffle directions for variety
        const dirs = [0, 1, 2, 3].sort(() => rng() - 0.5);
        for (const d of dirs) {
          const nx = cur.x + DIR_VECTORS[d].dx;
          const ny = cur.y + DIR_VECTORS[d].dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const key = `${nx},${ny}`;
            const isOtherTarget = targetPositions.some(t => t.x === nx && t.y === ny && (t.x !== tgt.x || t.y !== tgt.y));
            if (!isOtherTarget && !visited.has(key)) {
              visited.add(key);
              queue.push({
                x: nx,
                y: ny,
                path: [...cur.path, { fromX: cur.x, fromY: cur.y, toX: nx, toY: ny, dir: d }]
              });
            }
          }
        }
      }

      if (foundPath) {
        foundPath.forEach(step => {
          connections[step.fromY][step.fromX][step.dir] = true;
          connections[step.toY][step.toX][OPPOSITE_DIR[step.dir]] = true;
          connectedSet.add(`${step.fromX},${step.fromY}`);
          connectedSet.add(`${step.toX},${step.toY}`);
          if (step.toX === startX && step.toY === startY) {
            sourceOutDir = OPPOSITE_DIR[step.dir];
          }
        });
      }
    }

    // 4. Optionally add loops/alternative routes ONLY between existing circuit nodes
    const extraLoops = difficulty === 'casual' ? 0 : (difficulty === 'expert' ? 2 : 1);
    for (let l = 0; l < extraLoops; l++) {
      const rx = Math.floor(rng() * (width - 1));
      const ry = Math.floor(rng() * (height - 1));
      const d = rng() > 0.5 ? DIRS.EAST : DIRS.SOUTH;
      const nx = rx + DIR_VECTORS[d].dx;
      const ny = ry + DIR_VECTORS[d].dy;
      const isSrcOrTgtA = (rx === startX && ry === startY) || targetPositions.some(t => t.x === rx && t.y === ry);
      const isSrcOrTgtB = (nx === startX && ny === startY) || targetPositions.some(t => t.x === nx && t.y === ny);
      if (!isSrcOrTgtA && !isSrcOrTgtB && connectedSet.has(`${rx},${ry}`) && connectedSet.has(`${nx},${ny}`)) {
        connections[ry][rx][d] = true;
        connections[ny][nx][OPPOSITE_DIR[d]] = true;
      }
    }

    // 5. Convert connections into tile types and canonical rotations
    const tiles = [];
    const solution = [];
    let scrambles = 0;

    for (let y = 0; y < height; y++) {
      const tileRow = [];
      const solRow = [];

      for (let x = 0; x < width; x++) {
        // Is this the source?
        if (x === startX && y === startY) {
          const rot = sourceOutDir !== null ? sourceOutDir : DIRS.EAST;
          tileRow.push({ type: 'source', rotation: rot, color: 'cyan', fixed: true });
          solRow.push(rot);
          continue;
        }

        // Is this one of the targets?
        const isTarget = targetPositions.some(t => t.x === x && t.y === y);
        if (isTarget) {
          tileRow.push({ type: 'target', rotation: 0, color: 'cyan', fixed: true });
          solRow.push(0);
          continue;
        }

        // Determine port count
        const ports = [];
        for (let d = 0; d < 4; d++) {
          if (connections[y][x][d]) ports.push(d);
        }

        if (ports.length === 0) {
          tileRow.push({ type: 'block' });
          solRow.push(0);
          continue;
        }

        if (ports.length === 1) {
          // Dead-end conduit: turn into a corner containing active port d1
          const d1 = ports[0];
          const rot = d1; // rot d1 has ports [d1, (d1+1)%4]
          const scrambleRot = (rot + Math.floor(rng() * 3) + 1) % 4;
          tileRow.push({ type: 'corner', rotation: scrambleRot });
          solRow.push(rot);
          scrambles++;
          continue;
        }

        if (ports.length === 2) {
          // Straight or corner?
          if (Math.abs(ports[0] - ports[1]) === 2) {
            // Straight
            const rot = ports[0] % 2 === 0 ? 0 : 1;
            const scrambleRot = (rot + 1) % 2; // flip 90 degrees
            tileRow.push({ type: 'straight', rotation: scrambleRot });
            solRow.push(rot);
            scrambles++;
          } else {
            // Corner
            let rot = 0;
            const p1 = Math.min(ports[0], ports[1]);
            const p2 = Math.max(ports[0], ports[1]);
            if (p1 === 0 && p2 === 1) rot = 0;
            else if (p1 === 1 && p2 === 2) rot = 1;
            else if (p1 === 2 && p2 === 3) rot = 2;
            else if (p1 === 0 && p2 === 3) rot = 3;

            const scrambleRot = (rot + Math.floor(rng() * 3) + 1) % 4;
            tileRow.push({ type: 'corner', rotation: scrambleRot });
            solRow.push(rot);
            scrambles++;
          }
          continue;
        }

        if (ports.length === 3) {
          // Tee (Splitter)
          // Find missing port
          let missing = 0;
          for (let d = 0; d < 4; d++) {
            if (!ports.includes(d)) missing = d;
          }
          // Tee at rot 0 has ports North, East, West (missing South=2). So rot = (missing + 2) % 4
          const rot = (missing + 2) % 4;
          const scrambleRot = (rot + Math.floor(rng() * 3) + 1) % 4;
          tileRow.push({ type: 'tee', rotation: scrambleRot });
          solRow.push(rot);
          scrambles++;
          continue;
        }

        if (ports.length === 4) {
          tileRow.push({ type: 'cross', rotation: 0 });
          solRow.push(0);
          continue;
        }
      }

      tiles.push(tileRow);
      solution.push(solRow);
    }

    const parMoves = Math.max(4, Math.ceil(scrambles * 1.3));

    return {
      title: options.title || 'Procedural Neural Network',
      description: options.description || 'Dynamically generated synthetic neural pathway.',
      width,
      height,
      parMoves,
      tiles,
      solution
    };
  }

  /**
   * Generates today's daily puzzle seeded by current UTC date YYYY-MM-DD
   */
  static getDailyPuzzle(dateString) {
    const todayStr = dateString || new Date().toISOString().slice(0, 10);
    const seed = NeuralGenerator.hashString('NEURAL_PULSE_DAILY_' + todayStr);
    const rng = NeuralGenerator.createPRNG(seed);

    // Day of week determines grid scale (0: Sun = 6x6, Mon = 4x4, Fri/Sat = 5x5 or 6x6)
    const dayOfWeek = new Date().getDay();
    let size = 4;
    let diff = 'casual';
    if (dayOfWeek >= 2 && dayOfWeek <= 4) {
      size = 5;
      diff = 'medium';
    } else if (dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0) {
      size = 6;
      diff = 'expert';
    }

    const puzzle = NeuralGenerator.generatePuzzle({
      width: size,
      height: size,
      rng: rng,
      difficulty: diff,
      title: `Daily Neural Pulse · ${todayStr}`,
      description: `Synchronized daily challenge for all neural architects. Seed: ${todayStr}`
    });

    puzzle.isDaily = true;
    puzzle.dateKey = todayStr;
    return puzzle;
  }
}

window.NeuralGenerator = NeuralGenerator;
