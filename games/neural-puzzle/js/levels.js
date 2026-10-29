/**
 * Neural Puzzle — Curated Level Database
 * 26 Handcrafted Levels across 4 Sectors with par moves, mechanics progression, and guaranteed solvability.
 */

const NEURAL_LEVELS = [
  /* =========================================================================
   * SECTOR 1: SYNTHETIC AWAKENING (Fundamentals & First Signals)
   * ========================================================================= */
  {
    id: 1,
    sector: 1,
    sectorName: 'Synthetic Awakening',
    title: 'Axon Ignition',
    description: 'Rotate the neural conduit to establish a direct synaptic channel between Soma and Receptor.',
    width: 3,
    height: 3,
    parMoves: 2,
    solution: [
      [0, 0, 0],
      [1, 1, 3],
      [0, 0, 0]
    ],
    tiles: [
      [
        { type: 'block' },
        { type: 'straight', rotation: 0 },
        { type: 'block' }
      ],
      [
        { type: 'source', rotation: 1, color: 'cyan', fixed: true },
        { type: 'straight', rotation: 0 }, // Player rotates this to 1 (East-West)
        { type: 'target', rotation: 3, color: 'cyan', fixed: true }
      ],
      [
        { type: 'block' },
        { type: 'corner', rotation: 2 },
        { type: 'block' }
      ]
    ]
  },
  {
    id: 2,
    sector: 1,
    sectorName: 'Synthetic Awakening',
    title: 'Corner Synapse',
    description: 'Neural signals cannot leap across gaps. Align the angled corner conductors to round the bend.',
    width: 3,
    height: 3,
    parMoves: 3,
    solution: [
      [1, 1, 2],
      [0, 0, 2],
      [0, 0, 0]
    ],
    tiles: [
      [
        { type: 'source', rotation: 1, color: 'cyan', fixed: true },
        { type: 'straight', rotation: 0 }, // Rotate to 1
        { type: 'corner', rotation: 0 }     // Rotate to 2 (South & West)
      ],
      [
        { type: 'block' },
        { type: 'block' },
        { type: 'target', rotation: 0, color: 'cyan', fixed: true } // Target at (2,1) facing North
      ],
      [
        { type: 'block' },
        { type: 'block' },
        { type: 'block' }
      ]
    ]
  },
  {
    id: 3,
    sector: 1,
    sectorName: 'Synthetic Awakening',
    title: 'Dendrite Bifurcation',
    description: 'Synaptic Splitters (T-Junctions) divide one incoming action potential into two distinct channels.',
    width: 3,
    height: 3,
    parMoves: 3,
    solution: [
      [0, 0, 0],
      [1, 1, 3],
      [0, 0, 0]
    ],
    tiles: [
      [
        { type: 'block' },
        { type: 'target', rotation: 2, color: 'cyan', fixed: true }, // Top target facing South
        { type: 'block' }
      ],
      [
        { type: 'source', rotation: 1, color: 'cyan', fixed: true },
        { type: 'tee', rotation: 0 }, // Rotate to 1 (North, East, South)
        { type: 'target', rotation: 3, color: 'cyan', fixed: true }  // Right target facing West
      ],
      [
        { type: 'block' },
        { type: 'block' },
        { type: 'block' }
      ]
    ]
  },
  {
    id: 4,
    sector: 1,
    sectorName: 'Synthetic Awakening',
    title: 'Dual Terminals',
    description: 'Distribute power from the central hub out to both peripheral synaptic receptors.',
    width: 4,
    height: 3,
    parMoves: 4,
    solution: [
      [0, 2, 2, 0],
      [1, 1, 1, 3],
      [0, 0, 0, 0]
    ],
    tiles: [
      [
        { type: 'block' },
        { type: 'target', rotation: 2, color: 'cyan', fixed: true },
        { type: 'corner', rotation: 0 },
        { type: 'block' }
      ],
      [
        { type: 'source', rotation: 1, color: 'cyan', fixed: true },
        { type: 'tee', rotation: 2 },
        { type: 'straight', rotation: 0 },
        { type: 'target', rotation: 3, color: 'cyan', fixed: true }
      ],
      [
        { type: 'block' },
        { type: 'straight', rotation: 1 },
        { type: 'corner', rotation: 3 },
        { type: 'block' }
      ]
    ]
  },
  {
    id: 5,
    sector: 1,
    sectorName: 'Synthetic Awakening',
    title: 'Nexus Cross',
    description: 'The Nexus Cross tile conducts signals in all four orthogonal directions simultaneously.',
    width: 4,
    height: 4,
    parMoves: 5,
    solution: [
      [0, 2, 0, 0],
      [1, 0, 1, 3],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ],
    tiles: [
      [
        { type: 'block' },
        { type: 'target', rotation: 2, color: 'cyan', fixed: true },
        { type: 'block' },
        { type: 'block' }
      ],
      [
        { type: 'source', rotation: 1, color: 'cyan', fixed: true },
        { type: 'cross', rotation: 0 },
        { type: 'straight', rotation: 0 },
        { type: 'target', rotation: 3, color: 'cyan', fixed: true }
      ],
      [
        { type: 'block' },
        { type: 'straight', rotation: 1 },
        { type: 'block' },
        { type: 'block' }
      ],
      [
        { type: 'block' },
        { type: 'target', rotation: 0, color: 'cyan', fixed: true },
        { type: 'block' },
        { type: 'block' }
      ]
    ]
  },
  {
    id: 6,
    sector: 1,
    sectorName: 'Synthetic Awakening',
    title: 'Cerebral Serpentine',
    description: 'Navigate around dense cortical barriers using coordinated corner alignments.',
    width: 4,
    height: 4,
    parMoves: 6,
    solution: [
      [1, 2, 0, 0],
      [0, 0, 1, 2],
      [1, 3, 0, 0],
      [0, 1, 1, 0]
    ],
    tiles: [
      [
        { type: 'source', rotation: 1, color: 'cyan', fixed: true },
        { type: 'corner', rotation: 0 },
        { type: 'block' },
        { type: 'block' }
      ],
      [
        { type: 'block' },
        { type: 'straight', rotation: 1 },
        { type: 'corner', rotation: 3 },
        { type: 'corner', rotation: 0 }
      ],
      [
        { type: 'corner', rotation: 2 },
        { type: 'corner', rotation: 1 },
        { type: 'block' },
        { type: 'straight', rotation: 1 }
      ],
      [
        { type: 'straight', rotation: 0 },
        { type: 'straight', rotation: 0 },
        { type: 'corner', rotation: 3 },
        { type: 'target', rotation: 0, color: 'cyan', fixed: true }
      ]
    ]
  },

  /* =========================================================================
   * SECTOR 2: SYNAPTIC JUNCTIONS (Bridges & Complex Topologies)
   * ========================================================================= */
  {
    id: 7,
    sector: 2,
    sectorName: 'Synaptic Junctions',
    title: 'Quantum Bridge',
    description: 'Quantum Bridges transmit two signals right across each other without mixing or interference.',
    width: 4,
    height: 4,
    parMoves: 5,
    solution: [
      [0, 2, 0, 0],
      [1, 0, 1, 3],
      [0, 2, 0, 0],
      [0, 0, 0, 0]
    ],
    tiles: [
      [
        { type: 'block' },
        { type: 'source', rotation: 2, color: 'magenta', fixed: true },
        { type: 'block' },
        { type: 'block' }
      ],
      [
        { type: 'source', rotation: 1, color: 'cyan', fixed: true },
        { type: 'bridge', rotation: 1 }, // Rotate to 0
        { type: 'straight', rotation: 0 },
        { type: 'target', rotation: 3, color: 'cyan', fixed: true }
      ],
      [
        { type: 'block' },
        { type: 'straight', rotation: 1 },
        { type: 'block' },
        { type: 'block' }
      ],
      [
        { type: 'block' },
        { type: 'target', rotation: 0, color: 'magenta', fixed: true },
        { type: 'block' },
        { type: 'block' }
      ]
    ]
  },
  {
    id: 8,
    sector: 2,
    sectorName: 'Synaptic Junctions',
    title: 'Cortical Interlock',
    description: 'Weave two intersecting signal routes across the central bridge without collision.',
    width: 4,
    height: 4,
    parMoves: 6,
    solution: [
      [1, 1, 2, 0],
      [0, 0, 0, 2],
      [1, 0, 1, 3],
      [0, 0, 0, 0]
    ],
    tiles: [
      [
        { type: 'source', rotation: 1, color: 'cyan', fixed: true },
        { type: 'straight', rotation: 0 },
        { type: 'corner', rotation: 0 },
        { type: 'block' }
      ],
      [
        { type: 'source', rotation: 2, color: 'magenta', fixed: true },
        { type: 'block' },
        { type: 'straight', rotation: 1 },
        { type: 'block' }
      ],
      [
        { type: 'straight', rotation: 1 },
        { type: 'bridge', rotation: 1 },
        { type: 'straight', rotation: 0 },
        { type: 'target', rotation: 3, color: 'cyan', fixed: true }
      ],
      [
        { type: 'corner', rotation: 2 },
        { type: 'straight', rotation: 0 },
        { type: 'target', rotation: 0, color: 'magenta', fixed: true },
        { type: 'block' }
      ]
    ]
  },
  {
    id: 9,
    sector: 2,
    sectorName: 'Synaptic Junctions',
    title: 'Neural Web',
    description: 'A 5x5 network matrix with multiple branch junctions. Keep conduit loops coherent.',
    width: 5,
    height: 5,
    parMoves: 8,
    solution: [
      [1, 1, 2, 0, 0],
      [0, 0, 0, 1, 2],
      [0, 1, 0, 1, 2],
      [0, 0, 1, 0, 2],
      [0, 0, 0, 0, 0]
    ],
    tiles: [
      [
        { type: 'source', rotation: 1, color: 'cyan', fixed: true },
        { type: 'tee', rotation: 3 },
        { type: 'corner', rotation: 1 },
        { type: 'straight', rotation: 0 },
        { type: 'target', rotation: 2, color: 'cyan', fixed: true }
      ],
      [
        { type: 'block' },
        { type: 'straight', rotation: 1 },
        { type: 'straight', rotation: 0 },
        { type: 'corner', rotation: 3 },
        { type: 'corner', rotation: 1 }
      ],
      [
        { type: 'block' },
        { type: 'tee', rotation: 0 },
        { type: 'cross', rotation: 1 },
        { type: 'straight', rotation: 0 },
        { type: 'straight', rotation: 1 }
      ],
      [
        { type: 'block' },
        { type: 'corner', rotation: 3 },
        { type: 'straight', rotation: 0 },
        { type: 'tee', rotation: 2 },
        { type: 'target', rotation: 3, color: 'cyan', fixed: true }
      ],
      [
        { type: 'block' },
        { type: 'block' },
        { type: 'target', rotation: 0, color: 'cyan', fixed: true },
        { type: 'block' },
        { type: 'block' }
      ]
    ]
  },
  {
    id: 10,
    sector: 2,
    sectorName: 'Synaptic Junctions',
    title: 'Dual Frequency Highway',
    description: 'Cyan and Magenta frequencies must simultaneously feed their respective synaptic terminals.',
    width: 5,
    height: 5,
    parMoves: 9,
    solution: [
      [1, 1, 2, 0, 0],
      [0, 0, 0, 0, 0],
      [1, 0, 0, 0, 3],
      [0, 0, 0, 0, 0],
      [0, 0, 1, 1, 0]
    ],
    tiles: [
      [
        { type: 'source', rotation: 1, color: 'cyan', fixed: true },
        { type: 'straight', rotation: 0 },
        { type: 'corner', rotation: 3 },
        { type: 'block' },
        { type: 'target', rotation: 2, color: 'cyan', fixed: true }
      ],
      [
        { type: 'block' },
        { type: 'block' },
        { type: 'straight', rotation: 1 },
        { type: 'block' },
        { type: 'straight', rotation: 1 }
      ],
      [
        { type: 'source', rotation: 1, color: 'magenta', fixed: true },
        { type: 'bridge', rotation: 1 },
        { type: 'cross', rotation: 0 },
        { type: 'straight', rotation: 0 },
        { type: 'target', rotation: 3, color: 'magenta', fixed: true }
      ],
      [
        { type: 'block' },
        { type: 'straight', rotation: 1 },
        { type: 'straight', rotation: 1 },
        { type: 'block' },
        { type: 'block' }
      ],
      [
        { type: 'block' },
        { type: 'corner', rotation: 2 },
        { type: 'straight', rotation: 0 },
        { type: 'corner', rotation: 1 },
        { type: 'block' }
      ]
    ]
  },
  {
    id: 11,
    sector: 2,
    sectorName: 'Synaptic Junctions',
    title: 'Synaptic Labyrinth',
    description: 'Decoy paths and dead-ends crowd the cortex. Chart the minimal resistance route.',
    width: 5,
    height: 5,
    parMoves: 10,
    solution: [
      [1, 2, 0, 1, 2],
      [0, 1, 2, 0, 0],
      [1, 0, 1, 2, 0],
      [0, 0, 0, 1, 2],
      [0, 1, 1, 0, 0]
    ],
    tiles: [
      [
        { type: 'source', rotation: 1, color: 'cyan', fixed: true },
        { type: 'corner', rotation: 3 },
        { type: 'straight', rotation: 1 },
        { type: 'corner', rotation: 0 },
        { type: 'corner', rotation: 1 }
      ],
      [
        { type: 'block' },
        { type: 'straight', rotation: 0 },
        { type: 'tee', rotation: 1 },
        { type: 'block' },
        { type: 'straight', rotation: 1 }
      ],
      [
        { type: 'corner', rotation: 2 },
        { type: 'cross', rotation: 0 },
        { type: 'bridge', rotation: 1 },
        { type: 'corner', rotation: 3 },
        { type: 'target', rotation: 3, color: 'cyan', fixed: true }
      ],
      [
        { type: 'straight', rotation: 1 },
        { type: 'block' },
        { type: 'straight', rotation: 0 },
        { type: 'corner', rotation: 2 },
        { type: 'block' }
      ],
      [
        { type: 'corner', rotation: 0 },
        { type: 'straight', rotation: 0 },
        { type: 'target', rotation: 0, color: 'cyan', fixed: true },
        { type: 'block' },
        { type: 'block' }
      ]
    ]
  },
  {
    id: 12,
    sector: 2,
    sectorName: 'Synaptic Junctions',
    title: 'Triple Axon Relay',
    description: 'A centralized distribution tree powering three separate peripheral receptors.',
    width: 5,
    height: 5,
    parMoves: 8,
    solution: [
      [0, 2, 0, 2, 0],
      [0, 0, 0, 0, 0],
      [1, 1, 1, 1, 3],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0]
    ],
    tiles: [
      [
        { type: 'block' },
        { type: 'target', rotation: 2, color: 'cyan', fixed: true },
        { type: 'block' },
        { type: 'target', rotation: 2, color: 'cyan', fixed: true },
        { type: 'block' }
      ],
      [
        { type: 'block' },
        { type: 'straight', rotation: 1 },
        { type: 'block' },
        { type: 'straight', rotation: 1 },
        { type: 'block' }
      ],
      [
        { type: 'source', rotation: 1, color: 'cyan', fixed: true },
        { type: 'tee', rotation: 3 },
        { type: 'straight', rotation: 0 },
        { type: 'tee', rotation: 2 },
        { type: 'target', rotation: 3, color: 'cyan', fixed: true }
      ],
      [
        { type: 'block' },
        { type: 'corner', rotation: 1 },
        { type: 'straight', rotation: 0 },
        { type: 'corner', rotation: 0 },
        { type: 'block' }
      ],
      [
        { type: 'block' },
        { type: 'block' },
        { type: 'block' },
        { type: 'block' },
        { type: 'block' }
      ]
    ]
  },
  {
    id: 13,
    sector: 2,
    sectorName: 'Synaptic Junctions',
    title: 'The Great Cortex Grid',
    description: 'A dense 5x5 computational mesh. Plan your turns before committing rotates.',
    width: 5,
    height: 5,
    parMoves: 10,
    solution: [
      [1, 1, 2, 0, 2],
      [0, 0, 0, 0, 0],
      [1, 1, 0, 1, 3],
      [0, 0, 0, 0, 0],
      [0, 1, 1, 0, 0]
    ],
    tiles: [
      [
        { type: 'source', rotation: 1, color: 'cyan', fixed: true },
        { type: 'tee', rotation: 2 },
        { type: 'corner', rotation: 0 },
        { type: 'straight', rotation: 1 },
        { type: 'target', rotation: 2, color: 'cyan', fixed: true }
      ],
      [
        { type: 'block' },
        { type: 'straight', rotation: 0 },
        { type: 'straight', rotation: 1 },
        { type: 'block' },
        { type: 'straight', rotation: 0 }
      ],
      [
        { type: 'source', rotation: 1, color: 'cyan', fixed: true },
        { type: 'cross', rotation: 3 },
        { type: 'bridge', rotation: 1 },
        { type: 'tee', rotation: 0 },
        { type: 'target', rotation: 3, color: 'cyan', fixed: true }
      ],
      [
        { type: 'block' },
        { type: 'corner', rotation: 2 },
        { type: 'straight', rotation: 1 },
        { type: 'corner', rotation: 3 },
        { type: 'block' }
      ],
      [
        { type: 'block' },
        { type: 'straight', rotation: 0 },
        { type: 'target', rotation: 0, color: 'cyan', fixed: true },
        { type: 'block' },
        { type: 'block' }
      ]
    ]
  },

  /* =========================================================================
   * SECTOR 3: LOGIC GATES (AND Synapses & Frequency Transmutation)
   * ========================================================================= */
  {
    id: 14,
    sector: 3,
    sectorName: 'Logic Gates',
    title: 'The Synaptic AND Gate',
    description: 'The AND Synapse requires TWO concurrent action potentials to cross its threshold and fire onward.',
    width: 4,
    height: 4,
    parMoves: 5,
    solution: [
      [0, 0, 0, 0],
      [1, 1, 0, 3],
      [0, 2, 0, 0],
      [0, 0, 0, 0]
    ],
    tiles: [
      [
        { type: 'block' },
        { type: 'target', rotation: 2, color: 'cyan', fixed: true },
        { type: 'block' },
        { type: 'block' }
      ],
      [
        { type: 'source', rotation: 1, color: 'cyan', fixed: true },
        { type: 'straight', rotation: 0 },
        { type: 'gate-and', rotation: 2 }, // Player rotates to 0 (accepts West & South, outputs North)
        { type: 'block' }
      ],
      [
        { type: 'block' },
        { type: 'straight', rotation: 1 },
        { type: 'corner', rotation: 0 },
        { type: 'block' }
      ],
      [
        { type: 'block' },
        { type: 'source', rotation: 0, color: 'cyan', fixed: true },
        { type: 'block' },
        { type: 'block' }
      ]
    ]
  },
  {
    id: 15,
    sector: 3,
    sectorName: 'Logic Gates',
    title: 'Bicortical Convergence',
    description: 'Coordinate two distant axonal somata into the dual inputs of a single gate.',
    width: 5,
    height: 4,
    parMoves: 6,
    solution: [
      [1, 1, 2, 0, 0],
      [0, 0, 0, 0, 0],
      [1, 1, 0, 1, 3],
      [0, 0, 0, 0, 0]
    ],
    tiles: [
      [
        { type: 'source', rotation: 1, color: 'cyan', fixed: true },
        { type: 'straight', rotation: 0 },
        { type: 'corner', rotation: 1 },
        { type: 'block' },
        { type: 'target', rotation: 2, color: 'cyan', fixed: true }
      ],
      [
        { type: 'block' },
        { type: 'block' },
        { type: 'straight', rotation: 1 },
        { type: 'block' },
        { type: 'straight', rotation: 0 }
      ],
      [
        { type: 'source', rotation: 1, color: 'cyan', fixed: true },
        { type: 'straight', rotation: 0 },
        { type: 'gate-and', rotation: 3 }, // Rotate to 0
        { type: 'corner', rotation: 2 },
        { type: 'corner', rotation: 0 }
      ],
      [
        { type: 'block' },
        { type: 'block' },
        { type: 'block' },
        { type: 'block' },
        { type: 'block' }
      ]
    ]
  },
  {
    id: 16,
    sector: 3,
    sectorName: 'Logic Gates',
    title: 'Frequency Transmuter',
    description: 'The Transmuter filter converts Cyan signals into higher-frequency Magenta resonance.',
    width: 5,
    height: 4,
    parMoves: 5,
    solution: [
      [0, 0, 0, 0, 0],
      [1, 1, 0, 1, 3],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0]
    ],
    tiles: [
      [
        { type: 'block' },
        { type: 'block' },
        { type: 'block' },
        { type: 'block' },
        { type: 'block' }
      ],
      [
        { type: 'source', rotation: 1, color: 'cyan', fixed: true },
        { type: 'straight', rotation: 0 },
        { type: 'filter', rotation: 1, filterToColor: 'magenta' }, // Rotate to 3 (South in, North out)
        { type: 'straight', rotation: 0 },
        { type: 'target', rotation: 3, targetColor: 'magenta', fixed: true }
      ],
      [
        { type: 'block' },
        { type: 'block' },
        { type: 'straight', rotation: 1 },
        { type: 'block' },
        { type: 'block' }
      ],
      [
        { type: 'block' },
        { type: 'block' },
        { type: 'block' },
        { type: 'block' },
        { type: 'block' }
      ]
    ]
  },
  {
    id: 17,
    sector: 3,
    sectorName: 'Logic Gates',
    title: 'Logic Lattice Cascade',
    description: 'Cascade multiple logic nodes to unlock the deepest receptor chamber.',
    width: 5,
    height: 5,
    parMoves: 8,
    solution: [
      [1, 1, 2, 0, 0],
      [0, 0, 0, 0, 0],
      [1, 1, 0, 1, 3],
      [0, 0, 0, 0, 0],
      [0, 0, 1, 1, 0]
    ],
    tiles: [
      [
        { type: 'source', rotation: 1, color: 'cyan', fixed: true },
        { type: 'straight', rotation: 0 },
        { type: 'corner', rotation: 3 },
        { type: 'block' },
        { type: 'target', rotation: 2, color: 'cyan', fixed: true }
      ],
      [
        { type: 'block' },
        { type: 'block' },
        { type: 'straight', rotation: 0 },
        { type: 'block' },
        { type: 'straight', rotation: 1 }
      ],
      [
        { type: 'source', rotation: 1, color: 'cyan', fixed: true },
        { type: 'straight', rotation: 0 },
        { type: 'gate-and', rotation: 1 },
        { type: 'straight', rotation: 0 },
        { type: 'target', rotation: 3, color: 'cyan', fixed: true }
      ],
      [
        { type: 'block' },
        { type: 'corner', rotation: 0 },
        { type: 'straight', rotation: 1 },
        { type: 'corner', rotation: 2 },
        { type: 'block' }
      ],
      [
        { type: 'source', rotation: 0, color: 'cyan', fixed: true },
        { type: 'corner', rotation: 3 },
        { type: 'straight', rotation: 0 },
        { type: 'straight', rotation: 1 },
        { type: 'block' }
      ]
    ]
  },
  {
    id: 18,
    sector: 3,
    sectorName: 'Logic Gates',
    title: 'Dual Filter Splitter',
    description: 'One neutral source feeds two transmuters to fulfill both Cyan and Magenta requirements.',
    width: 5,
    height: 5,
    parMoves: 9,
    solution: [
      [0, 2, 0, 2, 0],
      [0, 0, 0, 0, 0],
      [1, 1, 1, 1, 3],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0]
    ],
    tiles: [
      [
        { type: 'block' },
        { type: 'target', rotation: 2, targetColor: 'cyan', fixed: true },
        { type: 'block' },
        { type: 'target', rotation: 2, targetColor: 'magenta', fixed: true },
        { type: 'block' }
      ],
      [
        { type: 'block' },
        { type: 'straight', rotation: 1 },
        { type: 'block' },
        { type: 'filter', rotation: 2, filterToColor: 'magenta' },
        { type: 'block' }
      ],
      [
        { type: 'source', rotation: 1, color: 'cyan', fixed: true },
        { type: 'tee', rotation: 0 },
        { type: 'straight', rotation: 1 },
        { type: 'corner', rotation: 3 },
        { type: 'block' }
      ],
      [
        { type: 'block' },
        { type: 'straight', rotation: 0 },
        { type: 'block' },
        { type: 'block' },
        { type: 'block' }
      ],
      [
        { type: 'block' },
        { type: 'target', rotation: 0, targetColor: 'cyan', fixed: true },
        { type: 'block' },
        { type: 'block' },
        { type: 'block' }
      ]
    ]
  },
  {
    id: 19,
    sector: 3,
    sectorName: 'Logic Gates',
    title: 'Synaptic Threshold',
    description: 'Both primary axonal pathways must coordinate through an AND synapse to ignite the neural core.',
    width: 6,
    height: 5,
    parMoves: 10,
    solution: [
      [1, 1, 2, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [1, 1, 0, 1, 1, 3],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 1, 1, 0, 0]
    ],
    tiles: [
      [
        { type: 'source', rotation: 1, color: 'cyan', fixed: true },
        { type: 'straight', rotation: 0 },
        { type: 'corner', rotation: 3 },
        { type: 'block' },
        { type: 'block' },
        { type: 'target', rotation: 2, color: 'cyan', fixed: true }
      ],
      [
        { type: 'block' },
        { type: 'block' },
        { type: 'straight', rotation: 1 },
        { type: 'block' },
        { type: 'block' },
        { type: 'straight', rotation: 1 }
      ],
      [
        { type: 'source', rotation: 1, color: 'cyan', fixed: true },
        { type: 'straight', rotation: 0 },
        { type: 'gate-and', rotation: 1 },
        { type: 'straight', rotation: 0 },
        { type: 'straight', rotation: 1 },
        { type: 'corner', rotation: 2 }
      ],
      [
        { type: 'block' },
        { type: 'corner', rotation: 1 },
        { type: 'straight', rotation: 1 },
        { type: 'corner', rotation: 0 },
        { type: 'block' },
        { type: 'block' }
      ],
      [
        { type: 'source', rotation: 0, color: 'cyan', fixed: true },
        { type: 'corner', rotation: 3 },
        { type: 'straight', rotation: 0 },
        { type: 'straight', rotation: 1 },
        { type: 'block' },
        { type: 'block' }
      ]
    ]
  },
  {
    id: 20,
    sector: 3,
    sectorName: 'Logic Gates',
    title: 'The Cerebral Nexus Gate',
    description: 'A 6x6 high-complexity logic network. Bridges, AND gates, and splitters in harmony.',
    width: 6,
    height: 6,
    parMoves: 12,
    solution: [
      [1, 1, 2, 0, 0, 2],
      [0, 0, 0, 0, 0, 0],
      [1, 0, 0, 1, 1, 3],
      [0, 0, 0, 0, 0, 0],
      [0, 1, 0, 1, 0, 0],
      [0, 0, 0, 0, 0, 0]
    ],
    tiles: [
      [
        { type: 'source', rotation: 1, color: 'cyan', fixed: true },
        { type: 'straight', rotation: 0 },
        { type: 'tee', rotation: 3 },
        { type: 'straight', rotation: 0 },
        { type: 'corner', rotation: 1 },
        { type: 'target', rotation: 2, color: 'cyan', fixed: true }
      ],
      [
        { type: 'block' },
        { type: 'straight', rotation: 1 },
        { type: 'straight', rotation: 0 },
        { type: 'block' },
        { type: 'straight', rotation: 1 },
        { type: 'block' }
      ],
      [
        { type: 'source', rotation: 1, color: 'cyan', fixed: true },
        { type: 'bridge', rotation: 1 },
        { type: 'gate-and', rotation: 2 },
        { type: 'straight', rotation: 0 },
        { type: 'tee', rotation: 1 },
        { type: 'target', rotation: 3, color: 'cyan', fixed: true }
      ],
      [
        { type: 'block' },
        { type: 'straight', rotation: 0 },
        { type: 'straight', rotation: 1 },
        { type: 'block' },
        { type: 'straight', rotation: 0 },
        { type: 'block' }
      ],
      [
        { type: 'block' },
        { type: 'corner', rotation: 3 },
        { type: 'straight', rotation: 1 },
        { type: 'corner', rotation: 0 },
        { type: 'target', rotation: 0, color: 'cyan', fixed: true },
        { type: 'block' }
      ],
      [
        { type: 'block' },
        { type: 'block' },
        { type: 'block' },
        { type: 'block' },
        { type: 'block' },
        { type: 'block' }
      ]
    ]
  },

  /* =========================================================================
   * SECTOR 4: QUANTUM CORTEX (Master Mind & Massive Neural Arrays)
   * ========================================================================= */
  {
    id: 21,
    sector: 4,
    sectorName: 'Quantum Cortex',
    title: 'Superposition Conduits',
    description: 'Quantum bridges span the cerebral chasm. Align both horizontal and vertical streams.',
    width: 6,
    height: 6,
    parMoves: 12,
    solution: [
      [0, 2, 0, 2, 0, 0],
      [1, 0, 1, 0, 1, 3],
      [0, 0, 0, 0, 0, 0],
      [1, 0, 1, 0, 1, 3],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0]
    ],
    tiles: [
      [
        { type: 'block' },
        { type: 'source', rotation: 2, color: 'cyan', fixed: true },
        { type: 'block' },
        { type: 'source', rotation: 2, color: 'magenta', fixed: true },
        { type: 'block' },
        { type: 'block' }
      ],
      [
        { type: 'source', rotation: 1, color: 'amber', fixed: true },
        { type: 'bridge', rotation: 1 },
        { type: 'straight', rotation: 0 },
        { type: 'bridge', rotation: 1 },
        { type: 'straight', rotation: 0 },
        { type: 'target', rotation: 3, color: 'amber', fixed: true }
      ],
      [
        { type: 'block' },
        { type: 'straight', rotation: 1 },
        { type: 'block' },
        { type: 'straight', rotation: 1 },
        { type: 'block' },
        { type: 'block' }
      ],
      [
        { type: 'block' },
        { type: 'straight', rotation: 0 },
        { type: 'block' },
        { type: 'straight', rotation: 0 },
        { type: 'block' },
        { type: 'block' }
      ],
      [
        { type: 'block' },
        { type: 'target', rotation: 0, color: 'cyan', fixed: true },
        { type: 'block' },
        { type: 'target', rotation: 0, color: 'magenta', fixed: true },
        { type: 'block' },
        { type: 'block' }
      ],
      [
        { type: 'block' },
        { type: 'block' },
        { type: 'block' },
        { type: 'block' },
        { type: 'block' },
        { type: 'block' }
      ]
    ]
  },
  {
    id: 22,
    sector: 4,
    sectorName: 'Quantum Cortex',
    title: 'The Synaptic Singularity',
    description: 'Four quadrant receptors radiating outwards from an intense central logic engine.',
    width: 6,
    height: 6,
    parMoves: 14,
    solution: [
      [0, 0, 2, 0, 0, 0],
      [0, 1, 1, 2, 0, 0],
      [1, 1, 0, 1, 1, 3],
      [0, 0, 1, 1, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0]
    ],
    tiles: [
      [
        { type: 'block' },
        { type: 'block' },
        { type: 'target', rotation: 2, color: 'cyan', fixed: true },
        { type: 'block' },
        { type: 'block' },
        { type: 'block' }
      ],
      [
        { type: 'block' },
        { type: 'corner', rotation: 3 },
        { type: 'tee', rotation: 0 },
        { type: 'corner', rotation: 1 },
        { type: 'block' },
        { type: 'block' }
      ],
      [
        { type: 'source', rotation: 1, color: 'cyan', fixed: true },
        { type: 'straight', rotation: 0 },
        { type: 'cross', rotation: 0 },
        { type: 'straight', rotation: 0 },
        { type: 'straight', rotation: 1 },
        { type: 'target', rotation: 3, color: 'cyan', fixed: true }
      ],
      [
        { type: 'block' },
        { type: 'corner', rotation: 2 },
        { type: 'tee', rotation: 2 },
        { type: 'corner', rotation: 0 },
        { type: 'block' },
        { type: 'block' }
      ],
      [
        { type: 'block' },
        { type: 'block' },
        { type: 'target', rotation: 0, color: 'cyan', fixed: true },
        { type: 'block' },
        { type: 'block' },
        { type: 'block' }
      ],
      [
        { type: 'block' },
        { type: 'block' },
        { type: 'block' },
        { type: 'block' },
        { type: 'block' },
        { type: 'block' }
      ]
    ]
  },
  {
    id: 23,
    sector: 4,
    sectorName: 'Quantum Cortex',
    title: 'The 7x7 Neural Matrix',
    description: 'A grand expansive neural lattice spanning 49 computational nodes.',
    width: 7,
    height: 7,
    parMoves: 16,
    solution: [
      [1, 1, 1, 2, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [1, 1, 0, 1, 1, 1, 3],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 1, 1, 1, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0]
    ],
    tiles: [
      [
        { type: 'source', rotation: 1, color: 'cyan', fixed: true },
        { type: 'straight', rotation: 0 },
        { type: 'straight', rotation: 0 },
        { type: 'corner', rotation: 3 },
        { type: 'block' },
        { type: 'block' },
        { type: 'target', rotation: 2, color: 'cyan', fixed: true }
      ],
      [
        { type: 'block' },
        { type: 'block' },
        { type: 'block' },
        { type: 'straight', rotation: 1 },
        { type: 'block' },
        { type: 'block' },
        { type: 'straight', rotation: 1 }
      ],
      [
        { type: 'source', rotation: 1, color: 'cyan', fixed: true },
        { type: 'straight', rotation: 0 },
        { type: 'cross', rotation: 1 },
        { type: 'bridge', rotation: 1 },
        { type: 'straight', rotation: 0 },
        { type: 'tee', rotation: 2 },
        { type: 'target', rotation: 3, color: 'cyan', fixed: true }
      ],
      [
        { type: 'block' },
        { type: 'block' },
        { type: 'straight', rotation: 1 },
        { type: 'straight', rotation: 1 },
        { type: 'block' },
        { type: 'straight', rotation: 0 },
        { type: 'block' }
      ],
      [
        { type: 'block' },
        { type: 'corner', rotation: 1 },
        { type: 'straight', rotation: 0 },
        { type: 'corner', rotation: 0 },
        { type: 'block' },
        { type: 'target', rotation: 0, color: 'cyan', fixed: true },
        { type: 'block' }
      ],
      [
        { type: 'block' },
        { type: 'straight', rotation: 1 },
        { type: 'block' },
        { type: 'block' },
        { type: 'block' },
        { type: 'block' },
        { type: 'block' }
      ],
      [
        { type: 'block' },
        { type: 'target', rotation: 0, color: 'cyan', fixed: true },
        { type: 'block' },
        { type: 'block' },
        { type: 'block' },
        { type: 'block' },
        { type: 'block' }
      ]
    ]
  },
  {
    id: 24,
    sector: 4,
    sectorName: 'Quantum Cortex',
    title: 'Tri-Chamber Resonance',
    description: 'Balance Cyan, Magenta, and Amber frequencies simultaneously through the multi-layer router.',
    width: 7,
    height: 7,
    parMoves: 18,
    solution: [
      [1, 1, 2, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [1, 0, 1, 0, 1, 1, 3],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 1, 1, 1, 1, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0]
    ],
    tiles: [
      [
        { type: 'source', rotation: 1, color: 'cyan', fixed: true },
        { type: 'straight', rotation: 0 },
        { type: 'corner', rotation: 3 },
        { type: 'block' },
        { type: 'target', rotation: 2, color: 'cyan', fixed: true },
        { type: 'block' },
        { type: 'block' }
      ],
      [
        { type: 'block' },
        { type: 'block' },
        { type: 'straight', rotation: 1 },
        { type: 'block' },
        { type: 'straight', rotation: 1 },
        { type: 'block' },
        { type: 'block' }
      ],
      [
        { type: 'source', rotation: 1, color: 'magenta', fixed: true },
        { type: 'bridge', rotation: 1 },
        { type: 'straight', rotation: 0 },
        { type: 'bridge', rotation: 1 },
        { type: 'straight', rotation: 0 },
        { type: 'straight', rotation: 1 },
        { type: 'target', rotation: 3, color: 'magenta', fixed: true }
      ],
      [
        { type: 'block' },
        { type: 'straight', rotation: 1 },
        { type: 'block' },
        { type: 'straight', rotation: 1 },
        { type: 'block' },
        { type: 'block' },
        { type: 'block' }
      ],
      [
        { type: 'source', rotation: 1, color: 'amber', fixed: true },
        { type: 'cross', rotation: 2 },
        { type: 'straight', rotation: 0 },
        { type: 'cross', rotation: 1 },
        { type: 'corner', rotation: 0 },
        { type: 'target', rotation: 3, color: 'amber', fixed: true },
        { type: 'block' }
      ],
      [
        { type: 'block' },
        { type: 'straight', rotation: 1 },
        { type: 'block' },
        { type: 'straight', rotation: 1 },
        { type: 'block' },
        { type: 'block' },
        { type: 'block' }
      ],
      [
        { type: 'block' },
        { type: 'target', rotation: 0, color: 'cyan', fixed: true },
        { type: 'block' },
        { type: 'target', rotation: 0, color: 'magenta', fixed: true },
        { type: 'block' },
        { type: 'block' },
        { type: 'block' }
      ]
    ]
  },
  {
    id: 25,
    sector: 4,
    sectorName: 'Quantum Cortex',
    title: 'The Neural Labyrinth Apex',
    description: 'An intricate web of AND synapses where every turn must be calculated with precision.',
    width: 7,
    height: 7,
    parMoves: 20,
    solution: [
      [1, 1, 2, 0, 1, 1, 2],
      [0, 0, 0, 0, 0, 0, 0],
      [1, 0, 1, 0, 1, 0, 3],
      [0, 0, 0, 0, 0, 0, 0],
      [1, 1, 0, 1, 0, 1, 3],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0]
    ],
    tiles: [
      [
        { type: 'source', rotation: 1, color: 'cyan', fixed: true },
        { type: 'straight', rotation: 0 },
        { type: 'corner', rotation: 3 },
        { type: 'block' },
        { type: 'straight', rotation: 0 },
        { type: 'straight', rotation: 1 },
        { type: 'corner', rotation: 2 }
      ],
      [
        { type: 'block' },
        { type: 'block' },
        { type: 'straight', rotation: 1 },
        { type: 'block' },
        { type: 'straight', rotation: 1 },
        { type: 'block' },
        { type: 'straight', rotation: 0 }
      ],
      [
        { type: 'source', rotation: 1, color: 'cyan', fixed: true },
        { type: 'bridge', rotation: 1 },
        { type: 'gate-and', rotation: 2 },
        { type: 'bridge', rotation: 1 },
        { type: 'gate-and', rotation: 1 },
        { type: 'bridge', rotation: 1 },
        { type: 'target', rotation: 3, color: 'cyan', fixed: true }
      ],
      [
        { type: 'block' },
        { type: 'straight', rotation: 1 },
        { type: 'straight', rotation: 0 },
        { type: 'straight', rotation: 1 },
        { type: 'straight', rotation: 0 },
        { type: 'straight', rotation: 1 },
        { type: 'block' }
      ],
      [
        { type: 'source', rotation: 1, color: 'cyan', fixed: true },
        { type: 'cross', rotation: 1 },
        { type: 'straight', rotation: 0 },
        { type: 'cross', rotation: 2 },
        { type: 'straight', rotation: 0 },
        { type: 'cross', rotation: 0 },
        { type: 'target', rotation: 3, color: 'cyan', fixed: true }
      ],
      [
        { type: 'block' },
        { type: 'straight', rotation: 0 },
        { type: 'block' },
        { type: 'straight', rotation: 0 },
        { type: 'block' },
        { type: 'straight', rotation: 0 },
        { type: 'block' }
      ],
      [
        { type: 'block' },
        { type: 'target', rotation: 0, color: 'cyan', fixed: true },
        { type: 'block' },
        { type: 'target', rotation: 0, color: 'cyan', fixed: true },
        { type: 'block' },
        { type: 'target', rotation: 0, color: 'cyan', fixed: true },
        { type: 'block' }
      ]
    ]
  },
  {
    id: 26,
    sector: 4,
    sectorName: 'Quantum Cortex',
    title: 'The Synthetic Singularity',
    description: 'The ultimate synthesis. Harmonize all frequencies, logic gates, and channels into full consciousness.',
    width: 7,
    height: 7,
    parMoves: 22,
    solution: [
      [1, 1, 2, 0, 2, 1, 2],
      [0, 0, 0, 0, 0, 0, 0],
      [1, 0, 1, 0, 1, 0, 3],
      [0, 0, 0, 0, 0, 0, 0],
      [1, 1, 1, 1, 1, 1, 3],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0]
    ],
    tiles: [
      [
        { type: 'source', rotation: 1, color: 'cyan', fixed: true },
        { type: 'straight', rotation: 0 },
        { type: 'tee', rotation: 3 },
        { type: 'straight', rotation: 1 },
        { type: 'tee', rotation: 2 },
        { type: 'straight', rotation: 0 },
        { type: 'target', rotation: 2, color: 'cyan', fixed: true }
      ],
      [
        { type: 'block' },
        { type: 'straight', rotation: 1 },
        { type: 'straight', rotation: 0 },
        { type: 'block' },
        { type: 'straight', rotation: 1 },
        { type: 'straight', rotation: 0 },
        { type: 'block' }
      ],
      [
        { type: 'source', rotation: 1, color: 'magenta', fixed: true },
        { type: 'bridge', rotation: 1 },
        { type: 'gate-and', rotation: 3 },
        { type: 'bridge', rotation: 1 },
        { type: 'gate-and', rotation: 2 },
        { type: 'bridge', rotation: 1 },
        { type: 'target', rotation: 3, color: 'magenta', fixed: true }
      ],
      [
        { type: 'block' },
        { type: 'straight', rotation: 0 },
        { type: 'straight', rotation: 1 },
        { type: 'block' },
        { type: 'straight', rotation: 0 },
        { type: 'straight', rotation: 1 },
        { type: 'block' }
      ],
      [
        { type: 'source', rotation: 1, color: 'amber', fixed: true },
        { type: 'straight', rotation: 0 },
        { type: 'cross', rotation: 0 },
        { type: 'straight', rotation: 0 },
        { type: 'cross', rotation: 1 },
        { type: 'straight', rotation: 0 },
        { type: 'target', rotation: 3, color: 'amber', fixed: true }
      ],
      [
        { type: 'block' },
        { type: 'corner', rotation: 1 },
        { type: 'straight', rotation: 1 },
        { type: 'straight', rotation: 0 },
        { type: 'straight', rotation: 1 },
        { type: 'corner', rotation: 0 },
        { type: 'block' }
      ],
      [
        { type: 'block' },
        { type: 'target', rotation: 0, color: 'cyan', fixed: true },
        { type: 'block' },
        { type: 'target', rotation: 0, color: 'amber', fixed: true },
        { type: 'block' },
        { type: 'target', rotation: 0, color: 'magenta', fixed: true },
        { type: 'block' }
      ]
    ]
  }
];

window.NEURAL_LEVELS = NEURAL_LEVELS;
