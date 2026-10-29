/**
 * Track & Neon Gate System with Checkpoint Triggers and Directional Validation
 */

class TrackManager {
  /**
   * @param {THREE} THREE
   * @param {THREE.Scene} scene
   */
  constructor(THREE, scene) {
    this.THREE = THREE;
    this.scene = scene;
    this.gates = [];
    this.gatesGroup = new THREE.Group();
    this.scene.add(this.gatesGroup);

    this.currentGateIndex = 0;
    this.lap = 1;
    this.totalLaps = 2;
    this.isRaceActive = false;
    this.isFinished = false;
    this.raceTime = 0.0;
    this.splitTimes = [];

    this._tempV = new THREE.Vector3();
  }

  /**
   * Track Definitions per Environment
   */
  static getTrackDefinitions() {
    return {
      'living-room': {
        name: 'Loft Micro Slalom',
        difficulty: 'Beginner / Technical',
        laps: 2,
        gates: [
          // x, y, z, rotY, rotX, radius, type
          { pos: [-3.5, 1.2, -0.5], rotY: 0, rotX: 0, r: 0.75, label: 'Sofa Flyover' },
          { pos: [ 2.0, 2.2, -4.0], rotY: -Math.PI / 3, rotX: 0, r: 0.85, label: 'Stair Ascent' },
          { pos: [ 0.0, 4.2, -7.5], rotY: Math.PI, rotX: 0, r: 0.85, label: 'Loft Mezzanine' },
          { pos: [ 4.5, 2.2, -4.0], rotY: 0, rotX: 0, r: 0.75, label: 'Bookshelf Gap' },
          { pos: [ 4.0, 0.6,  3.5], rotY: Math.PI / 2, rotX: 0, r: 0.70, label: 'Dining Table Dive' },
          { pos: [-3.5, 0.7,  2.0], rotY: 0, rotX: 0, r: 0.65, label: 'Start / Finish' }
        ]
      },
      'cyber-warehouse': {
        name: 'Cyber Hangar GP',
        difficulty: 'Intermediate / Acrobatic',
        laps: 2,
        gates: [
          { pos: [  0.0,  3.5, -15.0], rotY: 0, rotX: 0, r: 2.2, label: 'Runway Gate 1' },
          { pos: [-12.0,  6.5,  -5.0], rotY: Math.PI / 4, rotX: 0, r: 2.4, label: 'Container Climb' },
          { pos: [  0.0, 14.0,   0.0], rotY: 0, rotX: Math.PI / 2, r: 2.5, label: 'Truss Dive Gate' }, // Horizontal dive gate!
          { pos: [  0.0,  3.0,  15.0], rotY: 0, rotX: 0, r: 2.0, label: 'Bridge Tunnel' },
          { pos: [ 14.0,  6.0,   5.0], rotY: -Math.PI / 2, rotX: 0, r: 2.4, label: 'Catwalk Slalom' },
          { pos: [  0.0,  3.5, -28.0], rotY: 0, rotX: 0, r: 2.2, label: 'Start / Finish' }
        ]
      },
      'alpine-canyon': {
        name: 'Sunset Canyon Sprint',
        difficulty: 'Pro / High-Speed',
        laps: 2,
        gates: [
          { pos: [  0.0,  6.0, -25.0], rotY: 0, rotX: 0, r: 3.5, label: 'Valley Launch' },
          { pos: [ 35.0, 10.0,   0.0], rotY: -Math.PI / 3, rotX: 0, r: 3.8, label: 'East Ridge Bank' },
          { pos: [  0.0, 24.0,  10.0], rotY: 0, rotX: Math.PI / 2, r: 4.0, label: 'Tower Vertigo Dive' },
          { pos: [-35.0,  8.0,  15.0], rotY: Math.PI / 3, rotX: 0, r: 3.8, label: 'West Canyon Pass' },
          { pos: [  0.0,  6.0, -45.0], rotY: 0, rotX: 0, r: 3.5, label: 'Start / Finish' }
        ]
      }
    };
  }

  /**
   * Load track for the environment
   */
  loadTrack(envId) {
    this.clear();
    const trackDef = TrackManager.getTrackDefinitions()[envId] || TrackManager.getTrackDefinitions()['living-room'];
    this.totalLaps = trackDef.laps;

    trackDef.gates.forEach((gData, index) => {
      const gateObj = this._createNeonGate(gData, index);
      this.gates.push(gateObj);
      this.gatesGroup.add(gateObj.mesh);
    });

    this.currentGateIndex = 0;
    this.lap = 1;
    this.isRaceActive = false;
    this.isFinished = false;
    this.raceTime = 0.0;
    this.splitTimes = [];

    this._updateGateVisuals();
    return trackDef;
  }

  clear() {
    while (this.gatesGroup.children.length > 0) {
      const obj = this.gatesGroup.children[0];
      this.gatesGroup.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    }
    this.gates = [];
  }

  /**
   * Create a glowing 3D Neon Racing Gate with directional chevron
   */
  _createNeonGate(gData, index) {
    const THREE = this.THREE;
    const gateGroup = new THREE.Group();
    gateGroup.position.set(...gData.pos);
    gateGroup.rotation.y = gData.rotY || 0;
    gateGroup.rotation.x = gData.rotX || 0;

    const r = gData.r;
    const tubeR = Math.max(0.04, r * 0.06);

    // Arch Gate Frame Geometry (Torus arc or arch)
    const frameGeo = new THREE.TorusGeometry(r, tubeR, 8, 24, Math.PI);
    const neonMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.9,
      roughness: 0.2
    });

    const frameMesh = new THREE.Mesh(frameGeo, neonMat);
    frameMesh.position.y = 0;
    gateGroup.add(frameMesh);

    // Gate Base Pillars if arch
    const pillarGeo = new THREE.CylinderGeometry(tubeR, tubeR, r, 8);
    const p1 = new THREE.Mesh(pillarGeo, neonMat);
    p1.position.set(-r, -r / 2, 0);
    gateGroup.add(p1);

    const p2 = new THREE.Mesh(pillarGeo, neonMat);
    p2.position.set(r, -r / 2, 0);
    gateGroup.add(p2);

    // Directional Arrow Chevron in center
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.5 });
    const arrowGeo = new THREE.ConeGeometry(r * 0.22, r * 0.35, 3);
    const arrow = new THREE.Mesh(arrowGeo, arrowMat);
    arrow.rotation.x = -Math.PI / 2; // points in flight direction
    arrow.position.set(0, r * 0.4, 0);
    gateGroup.add(arrow);

    // Forward Normal of Gate (direction player must fly)
    const normal = new THREE.Vector3(0, 0, 1).applyEuler(gateGroup.rotation).normalize();

    return {
      index,
      data: gData,
      mesh: gateGroup,
      frameMesh,
      neonMat,
      arrow,
      pos: new THREE.Vector3(...gData.pos),
      normal,
      radius: r,
      isPassed: false
    };
  }

  /**
   * Update gate colors based on which gate is next
   */
  _updateGateVisuals() {
    this.gates.forEach((gate, idx) => {
      if (idx === this.currentGateIndex) {
        // Active target gate: Blazing Amber / Gold
        gate.neonMat.color.setHex(0xffaa00);
        gate.neonMat.emissive.setHex(0xffaa00);
        gate.neonMat.emissiveIntensity = 1.6;
        gate.arrow.visible = true;
        gate.arrow.material.color.setHex(0xffaa00);
        gate.mesh.scale.set(1.06, 1.06, 1.06);
      } else if (idx < this.currentGateIndex) {
        // Already passed gate: Soft Emerald Green
        gate.neonMat.color.setHex(0x10b981);
        gate.neonMat.emissive.setHex(0x10b981);
        gate.neonMat.emissiveIntensity = 0.4;
        gate.arrow.visible = false;
        gate.mesh.scale.set(1.0, 1.0, 1.0);
      } else {
        // Upcoming gate: Deep Cyan / Violet
        gate.neonMat.color.setHex(0x6366f1);
        gate.neonMat.emissive.setHex(0x6366f1);
        gate.neonMat.emissiveIntensity = 0.5;
        gate.arrow.visible = false;
        gate.mesh.scale.set(1.0, 1.0, 1.0);
      }
    });
  }

  /**
   * Check if drone passed the current target gate
   * @param {THREE.Vector3} dronePos
   * @param {THREE.Vector3} prevDronePos
   * @returns {Object|null} event info if passed
   */
  checkDronePass(dronePos, prevDronePos) {
    if (!this.isRaceActive || this.isFinished || this.gates.length === 0) return null;

    const targetGate = this.gates[this.currentGateIndex];
    if (!targetGate) return null;

    // Vector from gate to drone
    const toDrone = this._tempV.subVectors(dronePos, targetGate.pos);
    const distToCenter = toDrone.length();

    // Check if within gate aperture radius (+ margin)
    if (distToCenter <= targetGate.radius * 1.35) {
      // Check plane crossing along gate normal
      const prevDot = new this.THREE.Vector3().subVectors(prevDronePos, targetGate.pos).dot(targetGate.normal);
      const currDot = toDrone.dot(targetGate.normal);

      // Crossed plane or very close
      if ((prevDot < 0 && currDot >= 0) || (distToCenter < targetGate.radius * 0.7 && Math.abs(currDot) < 0.6)) {
        // Valid pass!
        return this._onGatePassed(targetGate);
      }
    }

    return null;
  }

  _onGatePassed(gate) {
    gate.isPassed = true;
    const isLapComplete = (this.currentGateIndex === this.gates.length - 1);
    const splitTime = this.raceTime;
    this.splitTimes.push({ gate: this.currentGateIndex, time: splitTime });

    let raceFinished = false;

    if (isLapComplete) {
      if (this.lap >= this.totalLaps) {
        // Finished race!
        this.isFinished = true;
        this.isRaceActive = false;
        raceFinished = true;
      } else {
        // Next Lap
        this.lap++;
        this.currentGateIndex = 0;
        this.gates.forEach(g => g.isPassed = false);
      }
    } else {
      this.currentGateIndex++;
    }

    this._updateGateVisuals();

    return {
      gateIndex: gate.index,
      label: gate.data.label,
      lap: this.lap,
      totalLaps: this.totalLaps,
      splitTime: splitTime,
      isLapComplete,
      raceFinished
    };
  }

  getCurrentTargetGate() {
    return this.gates[this.currentGateIndex] || null;
  }

  update(dt) {
    if (this.isRaceActive && !this.isFinished) {
      this.raceTime += dt;
    }
  }

  startRace() {
    this.isRaceActive = true;
    this.isFinished = false;
    this.raceTime = 0.0;
    this.splitTimes = [];
    this.currentGateIndex = 0;
    this.lap = 1;
    this.gates.forEach(g => g.isPassed = false);
    this._updateGateVisuals();
  }
}

window.TrackManager = TrackManager;
