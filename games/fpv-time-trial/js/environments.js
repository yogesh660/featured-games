/**
 * Environments System - Living Room Loft, Cyber Warehouse, Alpine Canyon, and Neon City Rooftops
 * Tailored for micro-drone tight gap diving (Liftoff: Micro Drones tribute) to high-speed 5" racing.
 */

class EnvironmentsManager {
  /**
   * @param {THREE} THREE
   * @param {THREE.Scene} scene
   */
  constructor(THREE, scene) {
    this.THREE = THREE;
    this.scene = scene;
    this.currentEnvId = null;
    this.environmentGroup = new THREE.Group();
    this.scene.add(this.environmentGroup);

    this.colliders = []; // Array of THREE.Box3 for drone collision
    this.lights = [];
    this.animatedObjects = []; // e.g. spinning ceiling fan

    this.spawnPoint = new THREE.Vector3(0, 0.4, 0);
    this.spawnRotationY = 0;
  }

  /**
   * List available environments
   */
  static getList() {
    return [
      {
        id: 'living-room',
        name: 'The Cozy Loft',
        tagline: 'Indoor Micro-Drone Haven',
        badge: 'Liftoff Micro Style',
        bestFor: 'Tinywhoop 65 & Meteor 75',
        description: 'Two-story residential living room with sectional sofa, dining table & chairs slalom, open bookshelf tunnels, loft mezzanine, and ceiling fan obstacle.',
        fogColor: 0x1e1e24,
        fogNear: 25,
        fogFar: 80
      },
      {
        id: 'cyber-warehouse',
        name: 'Neon Hangar',
        tagline: 'Industrial Freestyle Playground',
        badge: 'Mid & Fast Quads',
        bestFor: 'Toothpick 3 & Apex 5',
        description: 'Massive multi-tiered warehouse filled with stacked shipping containers, structural steel trusses for powerloops, high catwalks, and neon lighting.',
        fogColor: 0x090a0f,
        fogNear: 40,
        fogFar: 140
      },
      {
        id: 'cyber-city',
        name: 'Neon City Rooftops',
        tagline: 'Cyberpunk Skyscraper Course',
        badge: 'Technical & Fast',
        bestFor: 'Phantom 3.5 & CineBumble',
        description: 'Soar between high-tech futuristic skyscrapers at night with illuminated antennas, AC air duct tunnels, glass sky-bridges, and neon holographic billboards.',
        fogColor: 0x060919,
        fogNear: 35,
        fogFar: 180
      },
      {
        id: 'alpine-canyon',
        name: 'Sunset Ridge',
        tagline: 'Outdoor High-Speed Speedway',
        badge: 'High Speed & 5-Inch',
        bestFor: 'Apex Predator 5 Racer',
        description: 'Vast outdoor canyon valley at sunset. Towering rock formations, speedway dive towers, open sky, and high-velocity race lines.',
        fogColor: 0x2d182e,
        fogNear: 50,
        fogFar: 260
      }
    ];
  }

  /**
   * Clear active environment
   */
  clear() {
    while (this.environmentGroup.children.length > 0) {
      const obj = this.environmentGroup.children[0];
      this.environmentGroup.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    }

    this.lights.forEach(l => this.scene.remove(l));
    this.lights = [];
    this.colliders = [];
    this.animatedObjects = [];
  }

  /**
   * Load environment by ID
   */
  load(envId) {
    this.clear();
    this.currentEnvId = envId;

    switch (envId) {
      case 'cyber-warehouse':
        this._buildCyberWarehouse();
        break;
      case 'cyber-city':
        this._buildCyberCity();
        break;
      case 'alpine-canyon':
        this._buildAlpineCanyon();
        break;
      case 'living-room':
      default:
        this._buildLivingRoomLoft();
        break;
    }

    return {
      colliders: this.colliders,
      spawnPoint: this.spawnPoint,
      spawnRotationY: this.spawnRotationY
    };
  }

  /**
   * Helper: Add static box obstacle with physics collider
   */
  _addBoxObstacle(w, h, d, x, y, z, mat, rotY = 0) {
    const geo = new this.THREE.BoxGeometry(w, h, d);
    const mesh = new this.THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    if (rotY !== 0) mesh.rotation.y = rotY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.environmentGroup.add(mesh);

    const box = new this.THREE.Box3().setFromObject(mesh);
    this.colliders.push(box);
    return mesh;
  }

  /**
   * 1. LIVING ROOM & LOFT (Liftoff: Micro Drones Style)
   */
  _buildLivingRoomLoft() {
    const THREE = this.THREE;
    this.scene.background = new THREE.Color(0x18181f);
    this.scene.fog = new THREE.Fog(0x18181f, 25, 75);

    // Spawn on coffee table facing the TV / bookshelf
    this.spawnPoint.set(-3.5, 0.48, 2.0);
    this.spawnRotationY = 0;

    // Lights
    const hemiLight = new THREE.HemisphereLight(0xfff1e0, 0x1a1a24, 0.65);
    this.scene.add(hemiLight);
    this.lights.push(hemiLight);

    const warmPoint = new THREE.PointLight(0xffb366, 1.2, 28);
    warmPoint.position.set(0, 4.5, 0);
    warmPoint.castShadow = true;
    this.scene.add(warmPoint);
    this.lights.push(warmPoint);

    const lampLight = new THREE.PointLight(0xffeedd, 0.9, 14);
    lampLight.position.set(-6, 2.5, -4);
    this.scene.add(lampLight);
    this.lights.push(lampLight);

    // Materials
    const floorWoodMat = new THREE.MeshStandardMaterial({ color: 0x5a3d28, roughness: 0.45, metalness: 0.1 });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x2a2b34, roughness: 0.85 });
    const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x1e1f26, roughness: 0.9 });
    const rugMat = new THREE.MeshStandardMaterial({ color: 0x9333ea, roughness: 0.95 });
    const sofaMat = new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.7 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.5 });
    const chairMat = new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.6 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.25, metalness: 0.85 });
    const plantMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.8 });

    const roomW = 20;
    const roomH = 6.5;
    const roomD = 24;

    // Floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomD), floorWoodMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.environmentGroup.add(floor);

    // Ceiling
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomD), ceilingMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = roomH;
    this.environmentGroup.add(ceiling);

    // Outer Room Walls
    this._addBoxObstacle(roomW, roomH, 0.4, 0, roomH / 2, -roomD / 2, wallMat);
    this._addBoxObstacle(roomW, roomH, 0.4, 0, roomH / 2,  roomD / 2, wallMat);
    this._addBoxObstacle(0.4, roomH, roomD, -roomW / 2, roomH / 2, 0, wallMat);
    this._addBoxObstacle(0.4, roomH, roomD,  roomW / 2, roomH / 2, 0, wallMat);

    // Large Living Room Rug
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 6.0), rugMat);
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(-3, 0.005, 1.5);
    this.environmentGroup.add(rug);

    // Sectional L-Sofa
    this._addBoxObstacle(3.8, 0.65, 1.2, -3.5, 0.32, -0.5, sofaMat);
    this._addBoxObstacle(3.8, 0.60, 0.3, -3.5, 0.85, -1.0, sofaMat);
    this._addBoxObstacle(1.2, 0.65, 2.4, -5.0, 0.32, 1.0, sofaMat);

    // Coffee Table
    this._addBoxObstacle(2.2, 0.05, 1.2, -3.5, 0.42, 1.8, woodMat);
    const legW = 0.06;
    const legH = 0.40;
    this._addBoxObstacle(legW, legH, legW, -4.4, legH / 2, 1.3, metalMat);
    this._addBoxObstacle(legW, legH, legW, -2.6, legH / 2, 1.3, metalMat);
    this._addBoxObstacle(legW, legH, legW, -4.4, legH / 2, 2.3, metalMat);
    this._addBoxObstacle(legW, legH, legW, -2.6, legH / 2, 2.3, metalMat);

    // TV Entertainment Unit & Bookshelf Tunnels
    this._addBoxObstacle(4.2, 0.55, 0.8, -3.5, 0.28, 4.8, woodMat);
    const tvMat = new THREE.MeshStandardMaterial({ color: 0x050508, roughness: 0.1, metalness: 0.9 });
    this._addBoxObstacle(3.0, 1.6, 0.1, -3.5, 1.45, 4.9, tvMat);

    // Large Open Bookshelf with diving cubby gaps
    const shelfX = 4.5;
    const shelfZ = -4.0;
    this._addBoxObstacle(3.5, 3.8, 0.6, shelfX, 1.9, shelfZ, woodMat);
    for (let s = 1; s <= 4; s++) {
      this._addBoxObstacle(3.4, 0.04, 0.58, shelfX, s * 0.75, shelfZ, metalMat);
    }

    // Dining Table with 4 Chairs (Slalom obstacle)
    const diningX = 4.0;
    const diningZ = 3.5;
    this._addBoxObstacle(3.2, 0.06, 1.6, diningX, 0.82, diningZ, woodMat);
    this._addBoxObstacle(0.08, 0.80, 0.08, diningX - 1.4, 0.40, diningZ - 0.65, metalMat);
    this._addBoxObstacle(0.08, 0.80, 0.08, diningX + 1.4, 0.40, diningZ - 0.65, metalMat);
    this._addBoxObstacle(0.08, 0.80, 0.08, diningX - 1.4, 0.40, diningZ + 0.65, metalMat);
    this._addBoxObstacle(0.08, 0.80, 0.08, diningX + 1.4, 0.40, diningZ + 0.65, metalMat);

    const chairOffsets = [
      { x: diningX - 0.9, z: diningZ - 1.1, rot: 0 },
      { x: diningX + 0.9, z: diningZ - 1.1, rot: 0 },
      { x: diningX - 0.9, z: diningZ + 1.1, rot: Math.PI },
      { x: diningX + 0.9, z: diningZ + 1.1, rot: Math.PI }
    ];
    chairOffsets.forEach(cp => {
      this._addBoxObstacle(0.55, 0.04, 0.55, cp.x, 0.50, cp.z, chairMat);
      this._addBoxObstacle(0.55, 0.55, 0.04, cp.x, 0.75, cp.z + (cp.rot === 0 ? -0.25 : 0.25), chairMat);
    });

    // Mezzanine / 2nd Floor Loft
    const loftY = 3.4;
    this._addBoxObstacle(roomW, 0.20, 8.0, 0, loftY, -8.0, floorWoodMat);
    this._addBoxObstacle(roomW - 3.0, 0.90, 0.1, -1.5, loftY + 0.55, -4.0, metalMat);

    // Staircase leading up to loft
    const stepCount = 12;
    const stepW = 1.4;
    const startZ = 0.5;
    for (let st = 0; st < stepCount; st++) {
      const stepY = (st + 1) * (loftY / stepCount);
      const stepZ = startZ - (st * 0.38);
      this._addBoxObstacle(stepW, 0.12, 0.40, 7.5, stepY - 0.06, stepZ, woodMat);
    }

    // Ceiling Fan (Animated Obstacle)
    const fanGroup = new THREE.Group();
    fanGroup.position.set(-1.0, roomH - 0.8, 1.0);
    const fanMotor = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.25, 12), metalMat);
    fanGroup.add(fanMotor);
    for (let b = 0; b < 4; b++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.02, 0.18), woodMat);
      blade.rotation.y = (b * Math.PI) / 2;
      blade.position.x = Math.cos((b * Math.PI) / 2) * 0.8;
      blade.position.z = Math.sin((b * Math.PI) / 2) * 0.8;
      fanGroup.add(blade);
    }
    this.environmentGroup.add(fanGroup);
    this.animatedObjects.push({ obj: fanGroup, speedY: 2.2 });

    // Decorative Houseplants
    const plantPots = [
      { x: -8.0, z: -2.0 },
      { x:  8.0, z: -3.0 },
      { x: -8.0, z:  7.0 }
    ];
    plantPots.forEach(pp => {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.25, 0.65, 10), woodMat);
      pot.position.set(pp.x, 0.32, pp.z);
      this.environmentGroup.add(pot);
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8), plantMat);
      bush.position.set(pp.x, 0.85, pp.z);
      this.environmentGroup.add(bush);
      this.colliders.push(new THREE.Box3().setFromObject(pot));
    });
  }

  /**
   * 2. CYBER WAREHOUSE / HANGAR
   */
  _buildCyberWarehouse() {
    const THREE = this.THREE;
    this.scene.background = new THREE.Color(0x090a10);
    this.scene.fog = new THREE.Fog(0x090a10, 40, 130);

    this.spawnPoint.set(0, 0.4, -28);
    this.spawnRotationY = 0;

    const hemi = new THREE.HemisphereLight(0x00f0ff, 0x110522, 0.5);
    this.scene.add(hemi);
    this.lights.push(hemi);

    const mainLight = new THREE.DirectionalLight(0xff0077, 1.0);
    mainLight.position.set(20, 35, 20);
    this.scene.add(mainLight);
    this.lights.push(mainLight);

    const cyanLight = new THREE.PointLight(0x00ffff, 1.8, 45);
    cyanLight.position.set(-15, 12, 0);
    this.scene.add(cyanLight);
    this.lights.push(cyanLight);

    const magentaLight = new THREE.PointLight(0xff00aa, 1.8, 45);
    magentaLight.position.set(15, 12, 0);
    this.scene.add(magentaLight);
    this.lights.push(magentaLight);

    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x14161f, roughness: 0.6, metalness: 0.2 });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x0f1118, roughness: 0.8 });
    const trussMat = new THREE.MeshStandardMaterial({ color: 0x2e3440, roughness: 0.4, metalness: 0.8 });
    const cRed = new THREE.MeshStandardMaterial({ color: 0xbe123c, roughness: 0.5 });
    const cBlue = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.5 });
    const cYellow = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.5 });
    const cGreen = new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.5 });

    const hangW = 50;
    const hangH = 18;
    const hangD = 90;

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(hangW, hangD), concreteMat);
    floor.rotation.x = -Math.PI / 2;
    this.environmentGroup.add(floor);

    this._addBoxObstacle(hangW, hangH, 1.0, 0, hangH / 2, -hangD / 2, wallMat);
    this._addBoxObstacle(hangW, hangH, 1.0, 0, hangH / 2,  hangD / 2, wallMat);
    this._addBoxObstacle(1.0, hangH, hangD, -hangW / 2, hangH / 2, 0, wallMat);
    this._addBoxObstacle(1.0, hangH, hangD,  hangW / 2, hangH / 2, 0, wallMat);

    for (let tz = -35; tz <= 35; tz += 14) {
      this._addBoxObstacle(hangW - 2, 0.8, 0.8, 0, hangH - 2.5, tz, trussMat);
    }

    const containerW = 3.0;
    const containerH = 3.2;
    const containerL = 8.5;

    this._addBoxObstacle(containerW, containerH, containerL, -12, 1.6, -10, cRed);
    this._addBoxObstacle(containerW, containerH, containerL, -12, 4.8, -10, cBlue);
    this._addBoxObstacle(containerW, containerH, containerL, -12, 1.6,  -1, cYellow);
    this._addBoxObstacle(containerW, containerH, containerL, -12, 4.8,  -1, cGreen);

    this._addBoxObstacle(containerW, containerH, containerL, 12, 1.6, -5, cBlue);
    this._addBoxObstacle(containerW, containerH, containerL, 12, 4.8, -5, cRed);
    this._addBoxObstacle(containerW, containerH, containerL, 12, 8.0, -5, cYellow);

    this._addBoxObstacle(containerW, containerH, containerL, -5, 1.6, 15, cRed);
    this._addBoxObstacle(containerW, containerH, containerL,  5, 1.6, 15, cBlue);
    this._addBoxObstacle(13.0, containerH, containerW, 0, 4.8, 15, cYellow);

    this._addBoxObstacle(6.0, 0.3, 30.0, 16, 9.5, 5, trussMat);
  }

  /**
   * 3. NEON CITY ROOFTOPS (Cyberpunk Skyscraper Course)
   */
  _buildCyberCity() {
    const THREE = this.THREE;
    this.scene.background = new THREE.Color(0x060919);
    this.scene.fog = new THREE.Fog(0x060919, 35, 180);

    this.spawnPoint.set(0, 1.2, 0);
    this.spawnRotationY = 0;

    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 0.6);
    this.scene.add(hemiLight);
    this.lights.push(hemiLight);

    const cyanNeon = new THREE.PointLight(0x00f0ff, 1.8, 45);
    cyanNeon.position.set(0, 10, -15);
    this.scene.add(cyanNeon);
    this.lights.push(cyanNeon);

    const purpleNeon = new THREE.PointLight(0xa855f7, 1.8, 55);
    purpleNeon.position.set(20, 18, 5);
    this.scene.add(purpleNeon);
    this.lights.push(purpleNeon);

    const darkConcrete = new THREE.MeshStandardMaterial({ color: 0x111624, roughness: 0.85 });
    const metalDuct = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.35, metalness: 0.8 });
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x0284c7, transmission: 0.6, roughness: 0.1, transparent: true });
    const neonCyanMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const neonPinkMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });

    // Main Helipad Rooftop (Base Ground)
    const helipad = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), darkConcrete);
    helipad.rotation.x = -Math.PI / 2;
    this.environmentGroup.add(helipad);

    // Helipad Landing Circle
    const ringGeo = new THREE.RingGeometry(4.2, 4.6, 32);
    const ring = new THREE.Mesh(ringGeo, neonCyanMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.02, 0);
    this.environmentGroup.add(ring);

    // Surrounding Parapet Walls
    this._addBoxObstacle(50, 1.2, 0.4, 0, 0.6, -25, darkConcrete);
    this._addBoxObstacle(50, 1.2, 0.4, 0, 0.6, 25, darkConcrete);
    this._addBoxObstacle(0.4, 1.2, 50, -25, 0.6, 0, darkConcrete);
    this._addBoxObstacle(0.4, 1.2, 50, 25, 0.6, 0, darkConcrete);

    // Rooftop AC Cooling Units & Ventilation Duct Tunnels
    for (let i = 0; i < 4; i++) {
      const ductZ = -10 - (i * 7);
      this._addBoxObstacle(4.5, 2.4, 3.2, -12, 1.2, ductZ, metalDuct);
      const fanHousing = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.6, 16), metalDuct);
      fanHousing.position.set(-12, 2.7, ductZ);
      this.environmentGroup.add(fanHousing);
    }

    // East Skyscraper Tower
    this._addBoxObstacle(22, 14, 22, 24, 7, -6, darkConcrete);
    const edgeTrim = new THREE.Mesh(new THREE.BoxGeometry(22.2, 0.2, 0.2), neonPinkMat);
    edgeTrim.position.set(24, 14.1, 5);
    this.environmentGroup.add(edgeTrim);

    // Glass Skybridge connecting East and Main tower
    this._addBoxObstacle(16, 0.4, 5.0, 12, 10, -6, glassMat);
    this._addBoxObstacle(16, 0.4, 5.0, 12, 13.5, -6, metalDuct);
    this._addBoxObstacle(16, 1.0, 0.2, 12, 10.5, -3.6, glassMat);
    this._addBoxObstacle(16, 1.0, 0.2, 12, 10.5, -8.4, glassMat);

    // North Communications Mast
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.8, 30, 8), metalDuct);
    mast.position.set(0, 15, -35);
    this.environmentGroup.add(mast);
    this.colliders.push(new THREE.Box3().setFromObject(mast));

    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 8), neonPinkMat);
    beacon.position.set(0, 30, -35);
    this.environmentGroup.add(beacon);

    // Holographic Cyber Billboards
    const billboard = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide
    }));
    billboard.position.set(-18, 8, -6);
    billboard.rotation.y = Math.PI / 4;
    this.environmentGroup.add(billboard);
  }

  /**
   * 4. ALPINE CANYON RACEWAY
   */
  _buildAlpineCanyon() {
    const THREE = this.THREE;
    this.scene.background = new THREE.Color(0x231429);
    this.scene.fog = new THREE.Fog(0x231429, 60, 240);

    this.spawnPoint.set(0, 1.5, -45);
    this.spawnRotationY = 0;

    const hemi = new THREE.HemisphereLight(0xffaa55, 0x1f1430, 0.7);
    this.scene.add(hemi);
    this.lights.push(hemi);

    const sun = new THREE.DirectionalLight(0xff6622, 1.4);
    sun.position.set(60, 40, -80);
    this.scene.add(sun);
    this.lights.push(sun);

    const rockMat = new THREE.MeshStandardMaterial({ color: 0x473c4d, roughness: 0.9 });
    const dirtMat = new THREE.MeshStandardMaterial({ color: 0x2e2422, roughness: 0.8 });
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x1a1a24, roughness: 0.3, metalness: 0.8 });

    const terrainGeo = new THREE.PlaneGeometry(240, 240, 24, 24);
    const pos = terrainGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const distFromCenter = Math.sqrt(vx * vx + vy * vy);
      let elevation = 0;
      if (distFromCenter > 30) {
        elevation = Math.sin(vx * 0.08) * Math.cos(vy * 0.08) * 8.0 + (distFromCenter - 30) * 0.3;
      }
      pos.setZ(i, elevation);
    }
    terrainGeo.computeVertexNormals();

    const terrain = new THREE.Mesh(terrainGeo, dirtMat);
    terrain.rotation.x = -Math.PI / 2;
    this.environmentGroup.add(terrain);

    const rockCount = 18;
    for (let r = 0; r < rockCount; r++) {
      const angle = (r / rockCount) * Math.PI * 2;
      const dist = 65 + (r % 3) * 15;
      const rx = Math.cos(angle) * dist;
      const rz = Math.sin(angle) * dist;
      const height = 24 + (r % 4) * 12;
      const radius = 10 + (r % 3) * 6;

      const rock = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 6), rockMat);
      rock.position.set(rx, height / 2, rz);
      rock.rotation.y = r * 0.7;
      this.environmentGroup.add(rock);
      this.colliders.push(new THREE.Box3().setFromObject(rock));
    }

    this._addBoxObstacle(6.0, 32.0, 6.0, 0, 16.0, 10, towerMat);
    this._addBoxObstacle(14.0, 0.6, 14.0, 0, 22.0, 10, towerMat);
  }

  /**
   * Update animated obstacles (e.g., spinning ceiling fan)
   */
  update(dt) {
    for (let i = 0; i < this.animatedObjects.length; i++) {
      const anim = this.animatedObjects[i];
      if (anim.speedY) {
        anim.obj.rotation.y += anim.speedY * dt;
      }
    }
  }
}

window.EnvironmentsManager = EnvironmentsManager;
