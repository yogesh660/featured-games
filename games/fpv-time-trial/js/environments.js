/**
 * Environments System - Living Room Loft, Cyber Warehouse, and Alpine Canyon
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
        bestFor: 'Tinywhoop 65 & Cinewhoop 2.5',
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
    // Remove all objects from environment group
    while (this.environmentGroup.children.length > 0) {
      const obj = this.environmentGroup.children[0];
      this.environmentGroup.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    }

    // Remove lights
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

    // Compute bounding box for collision
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
    const rugMat = new THREE.MeshStandardMaterial({ color: 0x9333ea, roughness: 0.95 }); // Purple rug
    const sofaMat = new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.7 }); // Navy blue couch
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
    this._addBoxObstacle(roomW, roomH, 0.4, 0, roomH / 2, -roomD / 2, wallMat); // North
    this._addBoxObstacle(roomW, roomH, 0.4, 0, roomH / 2,  roomD / 2, wallMat); // South
    this._addBoxObstacle(0.4, roomH, roomD, -roomW / 2, roomH / 2, 0, wallMat); // West
    this._addBoxObstacle(0.4, roomH, roomD,  roomW / 2, roomH / 2, 0, wallMat); // East

    // Large Living Room Rug
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 6.0), rugMat);
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(-3, 0.005, 1.5);
    this.environmentGroup.add(rug);

    // Sectional L-Sofa
    // Main couch
    this._addBoxObstacle(3.8, 0.65, 1.2, -3.5, 0.32, -0.5, sofaMat);
    // Couch backrest
    this._addBoxObstacle(3.8, 0.60, 0.3, -3.5, 0.85, -1.0, sofaMat);
    // Couch L-extension
    this._addBoxObstacle(1.2, 0.65, 2.4, -5.0, 0.32, 1.0, sofaMat);

    // Coffee Table (with space under for micro-drone gap dive!)
    // Tabletop
    this._addBoxObstacle(2.2, 0.05, 1.2, -3.5, 0.42, 1.8, woodMat);
    // 4 Table Legs
    const legW = 0.06;
    const legH = 0.40;
    this._addBoxObstacle(legW, legH, legW, -4.4, legH / 2, 1.3, metalMat);
    this._addBoxObstacle(legW, legH, legW, -2.6, legH / 2, 1.3, metalMat);
    this._addBoxObstacle(legW, legH, legW, -4.4, legH / 2, 2.3, metalMat);
    this._addBoxObstacle(legW, legH, legW, -2.6, legH / 2, 2.3, metalMat);

    // TV Entertainment Unit & Bookshelf Tunnels
    // Unit bench
    this._addBoxObstacle(4.2, 0.55, 0.8, -3.5, 0.28, 4.8, woodMat);
    // Flat TV
    const tvMat = new THREE.MeshStandardMaterial({ color: 0x050508, roughness: 0.1, metalness: 0.9 });
    this._addBoxObstacle(3.0, 1.6, 0.1, -3.5, 1.45, 4.9, tvMat);

    // Large Open Bookshelf with diving cubby gaps
    const shelfX = 4.5;
    const shelfZ = -4.0;
    // Outer frame
    this._addBoxObstacle(3.5, 3.8, 0.6, shelfX, 1.9, shelfZ, woodMat);
    // We add open gaps by stacking horizontal shelves
    for (let s = 1; s <= 4; s++) {
      this._addBoxObstacle(3.4, 0.04, 0.58, shelfX, s * 0.75, shelfZ, metalMat);
    }

    // Dining Table with 4 Chairs (Slalom obstacle!)
    const diningX = 4.0;
    const diningZ = 3.5;
    // Table top
    this._addBoxObstacle(3.2, 0.06, 1.6, diningX, 0.82, diningZ, woodMat);
    // Table 4 legs
    this._addBoxObstacle(0.08, 0.80, 0.08, diningX - 1.4, 0.40, diningZ - 0.65, metalMat);
    this._addBoxObstacle(0.08, 0.80, 0.08, diningX + 1.4, 0.40, diningZ - 0.65, metalMat);
    this._addBoxObstacle(0.08, 0.80, 0.08, diningX - 1.4, 0.40, diningZ + 0.65, metalMat);
    this._addBoxObstacle(0.08, 0.80, 0.08, diningX + 1.4, 0.40, diningZ + 0.65, metalMat);

    // 4 Dining Chairs around table
    const chairOffsets = [
      { x: diningX - 0.9, z: diningZ - 1.1, rot: 0 },
      { x: diningX + 0.9, z: diningZ - 1.1, rot: 0 },
      { x: diningX - 0.9, z: diningZ + 1.1, rot: Math.PI },
      { x: diningX + 0.9, z: diningZ + 1.1, rot: Math.PI }
    ];
    chairOffsets.forEach(cp => {
      // Chair seat
      this._addBoxObstacle(0.55, 0.04, 0.55, cp.x, 0.50, cp.z, chairMat);
      // Chair backrest
      this._addBoxObstacle(0.55, 0.55, 0.04, cp.x, 0.75, cp.z + (cp.rot === 0 ? -0.25 : 0.25), chairMat);
    });

    // Mezzanine / 2nd Floor Loft
    const loftY = 3.4;
    // Loft floor slab
    this._addBoxObstacle(roomW, 0.20, 8.0, 0, loftY, -8.0, floorWoodMat);
    // Loft safety railing with balusters
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
    // 4 Blades
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

    // Ambient & Directional
    const hemi = new THREE.HemisphereLight(0x00f0ff, 0x110522, 0.5);
    this.scene.add(hemi);
    this.lights.push(hemi);

    const mainLight = new THREE.DirectionalLight(0xff0077, 1.0);
    mainLight.position.set(20, 35, 20);
    this.scene.add(mainLight);
    this.lights.push(mainLight);

    // Neon Accent Lights
    const cyanLight = new THREE.PointLight(0x00ffff, 1.8, 45);
    cyanLight.position.set(-15, 12, 0);
    this.scene.add(cyanLight);
    this.lights.push(cyanLight);

    const magentaLight = new THREE.PointLight(0xff00aa, 1.8, 45);
    magentaLight.position.set(15, 12, 0);
    this.scene.add(magentaLight);
    this.lights.push(magentaLight);

    // Materials
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

    // Floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(hangW, hangD), concreteMat);
    floor.rotation.x = -Math.PI / 2;
    this.environmentGroup.add(floor);

    // Outer Boundary
    this._addBoxObstacle(hangW, hangH, 1.0, 0, hangH / 2, -hangD / 2, wallMat);
    this._addBoxObstacle(hangW, hangH, 1.0, 0, hangH / 2,  hangD / 2, wallMat);
    this._addBoxObstacle(1.0, hangH, hangD, -hangW / 2, hangH / 2, 0, wallMat);
    this._addBoxObstacle(1.0, hangH, hangD,  hangW / 2, hangH / 2, 0, wallMat);

    // High Steel Trusses (Ceiling beams for powerloops)
    for (let tz = -35; tz <= 35; tz += 14) {
      this._addBoxObstacle(hangW - 2, 0.8, 0.8, 0, hangH - 2.5, tz, trussMat);
    }

    // Stacked Shipping Containers (forming canyons, tunnels & elevated landing pads)
    const containerW = 3.0;
    const containerH = 3.2;
    const containerL = 8.5;

    // Left container wall stack
    this._addBoxObstacle(containerW, containerH, containerL, -12, 1.6, -10, cRed);
    this._addBoxObstacle(containerW, containerH, containerL, -12, 4.8, -10, cBlue);
    this._addBoxObstacle(containerW, containerH, containerL, -12, 1.6,  -1, cYellow);
    this._addBoxObstacle(containerW, containerH, containerL, -12, 4.8,  -1, cGreen);

    // Right container stack
    this._addBoxObstacle(containerW, containerH, containerL, 12, 1.6, -5, cBlue);
    this._addBoxObstacle(containerW, containerH, containerL, 12, 4.8, -5, cRed);
    this._addBoxObstacle(containerW, containerH, containerL, 12, 8.0, -5, cYellow);

    // Center Tunnel structure formed by bridge container
    this._addBoxObstacle(containerW, containerH, containerL, -5, 1.6, 15, cRed);
    this._addBoxObstacle(containerW, containerH, containerL,  5, 1.6, 15, cBlue);
    // Overhead bridge container
    this._addBoxObstacle(13.0, containerH, containerW, 0, 4.8, 15, cYellow);

    // High Elevated Catwalk
    this._addBoxObstacle(6.0, 0.3, 30.0, 16, 9.5, 5, trussMat);
  }

  /**
   * 3. ALPINE CANYON RACEWAY
   */
  _buildAlpineCanyon() {
    const THREE = this.THREE;
    this.scene.background = new THREE.Color(0x231429);
    this.scene.fog = new THREE.Fog(0x231429, 60, 240);

    this.spawnPoint.set(0, 1.5, -45);
    this.spawnRotationY = 0;

    // Golden Hour Sunset Lighting
    const hemi = new THREE.HemisphereLight(0xffaa55, 0x1f1430, 0.7);
    this.scene.add(hemi);
    this.lights.push(hemi);

    const sun = new THREE.DirectionalLight(0xff6622, 1.4);
    sun.position.set(60, 40, -80);
    this.scene.add(sun);
    this.lights.push(sun);

    // Materials
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x473c4d, roughness: 0.9 });
    const dirtMat = new THREE.MeshStandardMaterial({ color: 0x2e2422, roughness: 0.8 });
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x1a1a24, roughness: 0.3, metalness: 0.8 });

    // Terrain Ground Mesh
    const terrainGeo = new THREE.PlaneGeometry(240, 240, 24, 24);
    // Deform vertices slightly for mountain ridges
    const pos = terrainGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      // Gentle rolling hills
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

    // Canyon Walls (Towering rock formations)
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

    // Grand Speedway Dive Tower (Centrepiece for 5-inch power dive)
    this._addBoxObstacle(6.0, 32.0, 6.0, 0, 16.0, 10, towerMat);
    // Ring platforms on tower
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
