/**
 * Open Road Racer - Western Ghats / Sahyadri World Generator
 * Creates continuous 3D mountain roads, basalt cliffs, instanced monsoon foliage & checkpoints.
 */

class WorldGenerator {
  constructor(scene) {
    this.scene = scene;
    this.roadCurve = null;
    this.roadMesh = null;
    this.terrainMesh = null;
    this.guardrails = null;
    this.checkpoints = [];
    this.instancedTrees = null;
    this.instancedRocks = null;
    this.roadWidth = 10;
    this.shoulderWidth = 4;
    this.totalLength = 0;
    this.pointsCount = 1200; // Resolution of road mesh

    this.quality = 'high'; // 'low', 'med', 'high'
  }

  init(quality = 'high') {
    this.quality = quality;
    this.setupAtmosphere();
    this.generateSpline();
    this.buildRoadMesh();
    this.buildTerrain();
    this.buildGuardrails();
    this.buildVegetation();
    this.buildCheckpoints();
  }

  setupAtmosphere() {
    // Sahyadri monsoon morning mist & sky
    const skyColor = new THREE.Color(0x0e1724);
    const horizonColor = new THREE.Color(0x1a2c42);

    this.scene.background = skyColor;
    this.scene.fog = new THREE.FogExp2(horizonColor, 0.0035);

    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x7890a8, 0.9);
    this.scene.add(ambientLight);

    // Directional sunlight cutting through mountain fog
    const sunLight = new THREE.DirectionalLight(0xfff3e0, 1.4);
    sunLight.position.set(250, 400, 200);
    if (this.quality === 'high') {
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.width = 1024;
      sunLight.shadow.mapSize.height = 1024;
      sunLight.shadow.camera.near = 10;
      sunLight.shadow.camera.far = 800;
      sunLight.shadow.camera.left = -150;
      sunLight.shadow.camera.right = 150;
      sunLight.shadow.camera.top = 150;
      sunLight.shadow.camera.bottom = -150;
      sunLight.shadow.bias = -0.0005;
    }
    this.scene.add(sunLight);
    this.sunLight = sunLight;
  }

  generateSpline() {
    // 36 control points forming a sweeping mountain pass circuit through Sahyadri peaks
    const rawPoints = [
      new THREE.Vector3(0, 20, 0),
      new THREE.Vector3(120, 35, -90),
      new THREE.Vector3(260, 60, -150),
      new THREE.Vector3(420, 95, -120),
      new THREE.Vector3(560, 130, -30),
      new THREE.Vector3(640, 160, 90),
      new THREE.Vector3(680, 185, 240),
      new THREE.Vector3(590, 200, 390),
      new THREE.Vector3(440, 180, 480),
      new THREE.Vector3(260, 150, 520),
      new THREE.Vector3(100, 120, 580),
      new THREE.Vector3(-40, 90, 660),
      new THREE.Vector3(-180, 70, 720),
      new THREE.Vector3(-340, 50, 680),
      new THREE.Vector3(-460, 40, 560),
      new THREE.Vector3(-520, 45, 420),
      new THREE.Vector3(-550, 65, 260),
      new THREE.Vector3(-610, 90, 120),
      new THREE.Vector3(-650, 120, -50),
      new THREE.Vector3(-600, 145, -200),
      new THREE.Vector3(-490, 150, -330),
      new THREE.Vector3(-330, 135, -420),
      new THREE.Vector3(-160, 110, -480),
      new THREE.Vector3(0, 85, -510),
      new THREE.Vector3(180, 60, -480),
      new THREE.Vector3(320, 45, -390),
      new THREE.Vector3(260, 35, -280),
      new THREE.Vector3(110, 25, -160)
    ];

    this.roadCurve = new THREE.CatmullRomCurve3(rawPoints, true, 'centripetal', 0.5);
    this.totalLength = this.roadCurve.getLength();
  }

  createRoadTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Dark mountain asphalt
    ctx.fillStyle = '#1c1e22';
    ctx.fillRect(0, 0, 512, 512);

    // Subtle asphalt grain
    for (let i = 0; i < 4000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#24272c' : '#141619';
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }

    // Outer edge solid white lines
    ctx.fillStyle = '#e8ebed';
    ctx.fillRect(24, 0, 10, 512);
    ctx.fillRect(478, 0, 10, 512);

    // Yellow dashed center line (Ghats style)
    ctx.fillStyle = '#f5c542';
    const dashLength = 36;
    const dashGap = 28;
    for (let y = 0; y < 512; y += (dashLength + dashGap)) {
      ctx.fillRect(251, y, 10, dashLength);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 75); // Repeat along road length
    return texture;
  }

  buildRoadMesh() {
    const segments = this.pointsCount;
    const geom = new THREE.BufferGeometry();
    const positions = [];
    const uvs = [];
    const normals = [];
    const indices = [];

    const halfWidth = this.roadWidth / 2;
    const frames = this.roadCurve.computeFrenetFrames(segments, true);

    for (let i = 0; i <= segments; i++) {
      const u = i / segments;
      const point = this.roadCurve.getPointAt(u % 1.0);
      const binormal = frames.binormals[i % segments];
      const normal = frames.normals[i % segments];

      // Cross section points: Left edge, Center, Right edge
      const left = point.clone().addScaledVector(binormal, -halfWidth);
      const right = point.clone().addScaledVector(binormal, halfWidth);

      positions.push(left.x, left.y + 0.1, left.z);
      positions.push(right.x, right.y + 0.1, right.z);

      normals.push(normal.x, normal.y, normal.z);
      normals.push(normal.x, normal.y, normal.z);

      uvs.push(0, u * 75);
      uvs.push(1, u * 75);

      if (i < segments) {
        const v1 = i * 2;
        const v2 = i * 2 + 1;
        const v3 = (i + 1) * 2;
        const v4 = (i + 1) * 2 + 1;

        indices.push(v1, v2, v3);
        indices.push(v2, v4, v3);
      }
    }

    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);

    const roadTexture = this.createRoadTexture();
    const mat = new THREE.MeshStandardMaterial({
      map: roadTexture,
      roughness: 0.85,
      metalness: 0.1
    });

    this.roadMesh = new THREE.Mesh(geom, mat);
    this.roadMesh.receiveShadow = true;
    this.scene.add(this.roadMesh);
  }

  buildTerrain() {
    // Expansive Sahyadri mountain terrain
    const segments = Math.floor(this.pointsCount / 2);
    const geom = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    const indices = [];

    const frames = this.roadCurve.computeFrenetFrames(segments, true);
    const halfWidth = this.roadWidth / 2;
    const terrainSpan = 180; // Distance terrain stretches out from road

    const cLaterite = new THREE.Color(0x5a2d1d); // Western Ghats red laterite soil
    const cMonsoonGreen = new THREE.Color(0x2d4f29); // Lush green cover
    const cDeepBasalt = new THREE.Color(0x1e2025); // Charcoal basalt rock

    for (let i = 0; i <= segments; i++) {
      const u = i / segments;
      const point = this.roadCurve.getPointAt(u % 1.0);
      const binormal = frames.binormals[i % segments];

      // Left shoulder, left slope, road left, road right, right shoulder, right slope
      const pFarLeft = point.clone().addScaledVector(binormal, -(halfWidth + terrainSpan));
      pFarLeft.y += Math.sin(u * 14) * 45 - 20;

      const pNearLeft = point.clone().addScaledVector(binormal, -(halfWidth + this.shoulderWidth));
      pNearLeft.y -= 0.2;

      const pNearRight = point.clone().addScaledVector(binormal, halfWidth + this.shoulderWidth);
      pNearRight.y -= 0.2;

      const pFarRight = point.clone().addScaledVector(binormal, halfWidth + terrainSpan);
      pFarRight.y += Math.cos(u * 12) * 55 - 25;

      const pts = [pFarLeft, pNearLeft, pNearRight, pFarRight];
      const cols = [cMonsoonGreen, cLaterite, cLaterite, cDeepBasalt];

      pts.forEach((p, pIdx) => {
        positions.push(p.x, p.y, p.z);
        colors.push(cols[pIdx].r, cols[pIdx].g, cols[pIdx].b);
      });

      if (i < segments) {
        const row = i * 4;
        const next = (i + 1) * 4;
        for (let col = 0; col < 3; col++) {
          indices.push(row + col, row + col + 1, next + col);
          indices.push(row + col + 1, next + col + 1, next + col);
        }
      }
    }

    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      metalness: 0.05,
      flatShading: true
    });

    this.terrainMesh = new THREE.Mesh(geom, mat);
    this.terrainMesh.receiveShadow = true;
    this.scene.add(this.terrainMesh);
  }

  buildGuardrails() {
    // Metallic guardrails placed along steep curve zones
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x9eabb5,
      metalness: 0.8,
      roughness: 0.3
    });

    const segments = 180;
    const dummy = new THREE.Object3D();
    const instancedBeams = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.2, 0.45, 12),
      railMat,
      segments
    );

    const halfWidth = (this.roadWidth / 2) + 0.8;
    let beamIndex = 0;

    for (let i = 0; i < segments; i++) {
      const u = i / segments;
      // Guardrails on outer bends
      const point = this.roadCurve.getPointAt(u);
      const tangent = this.roadCurve.getTangentAt(u);
      const binormal = new THREE.Vector3(0, 1, 0).cross(tangent).normalize();

      dummy.position.copy(point).addScaledVector(binormal, halfWidth);
      dummy.position.y += 0.55;
      dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
      dummy.updateMatrix();

      instancedBeams.setMatrixAt(beamIndex++, dummy.matrix);
    }

    instancedBeams.instanceMatrix.needsUpdate = true;
    this.scene.add(instancedBeams);
  }

  buildVegetation() {
    // Instanced Western Ghats umbrella canopy trees & rocks
    const treeCount = this.quality === 'low' ? 120 : (this.quality === 'med' ? 280 : 450);

    // Stylized low-poly tree geometry
    const trunkGeom = new THREE.CylinderGeometry(0.3, 0.6, 5, 5);
    trunkGeom.translate(0, 2.5, 0);
    const foliageGeom = new THREE.DodecahedronGeometry(3.5, 1);
    foliageGeom.translate(0, 6.5, 0);

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x2b1d14, roughness: 0.9 });
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x2a542b, roughness: 0.85, flatShading: true });

    const instancedTrunks = new THREE.InstancedMesh(trunkGeom, trunkMat, treeCount);
    const instancedFoliage = new THREE.InstancedMesh(foliageGeom, foliageMat, treeCount);

    // Instanced basalt boulders
    const rockCount = this.quality === 'low' ? 60 : 160;
    const rockGeom = new THREE.DodecahedronGeometry(2.4, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x1e2024, roughness: 0.95, flatShading: true });
    const instancedRocks = new THREE.InstancedMesh(rockGeom, rockMat, rockCount);

    const dummy = new THREE.Object3D();

    for (let i = 0; i < treeCount; i++) {
      const u = (i / treeCount + Math.random() * 0.05) % 1.0;
      const point = this.roadCurve.getPointAt(u);
      const tangent = this.roadCurve.getTangentAt(u);
      const binormal = new THREE.Vector3(0, 1, 0).cross(tangent).normalize();

      const side = (i % 2 === 0 ? 1 : -1);
      const offsetDist = (this.roadWidth / 2) + 6 + Math.random() * 45;

      dummy.position.copy(point).addScaledVector(binormal, side * offsetDist);
      dummy.position.y += Math.random() * 2 - 1;

      const scale = 0.8 + Math.random() * 0.7;
      dummy.scale.set(scale, scale * (0.9 + Math.random() * 0.4), scale);
      dummy.rotation.y = Math.random() * Math.PI * 2;
      dummy.updateMatrix();

      instancedTrunks.setMatrixAt(i, dummy.matrix);
      instancedFoliage.setMatrixAt(i, dummy.matrix);
    }

    for (let j = 0; j < rockCount; j++) {
      const u = (j / rockCount + Math.random() * 0.04) % 1.0;
      const point = this.roadCurve.getPointAt(u);
      const tangent = this.roadCurve.getTangentAt(u);
      const binormal = new THREE.Vector3(0, 1, 0).cross(tangent).normalize();

      const side = (j % 2 === 0 ? 1 : -1);
      const offsetDist = (this.roadWidth / 2) + 2.5 + Math.random() * 20;

      dummy.position.copy(point).addScaledVector(binormal, side * offsetDist);
      dummy.position.y += Math.random() * 0.5;

      const scale = 1.0 + Math.random() * 2.2;
      dummy.scale.set(scale, scale * 0.7, scale);
      dummy.rotation.set(Math.random(), Math.random(), Math.random());
      dummy.updateMatrix();

      instancedRocks.setMatrixAt(j, dummy.matrix);
    }

    instancedTrunks.instanceMatrix.needsUpdate = true;
    instancedFoliage.instanceMatrix.needsUpdate = true;
    instancedRocks.instanceMatrix.needsUpdate = true;

    if (this.quality === 'high') {
      instancedFoliage.castShadow = true;
      instancedRocks.castShadow = true;
    }

    this.scene.add(instancedTrunks);
    this.scene.add(instancedFoliage);
    this.scene.add(instancedRocks);
  }

  buildCheckpoints() {
    // 8 Checkpoint gates styled with glowing neon beams (Yogesh's cyan/violet theme)
    const numCheckpoints = 8;
    this.checkpoints = [];

    for (let i = 0; i < numCheckpoints; i++) {
      const u = i / numCheckpoints;
      const point = this.roadCurve.getPointAt(u);
      const tangent = this.roadCurve.getTangentAt(u);
      const binormal = new THREE.Vector3(0, 1, 0).cross(tangent).normalize();

      const isStart = (i === 0);
      const gateColor = isStart ? 0x74df9b : (i % 2 === 0 ? 0x56d9ff : 0x8c7cff);

      const gateGroup = new THREE.Group();

      // Left and right pillars
      const pillarGeom = new THREE.BoxGeometry(0.8, 7.5, 0.8);
      const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1a1a24, metalness: 0.8, roughness: 0.3 });

      const leftPillar = new THREE.Mesh(pillarGeom, pillarMat);
      leftPillar.position.copy(point).addScaledVector(binormal, -(this.roadWidth / 2 + 1.2));
      leftPillar.position.y += 3.75;

      const rightPillar = new THREE.Mesh(pillarGeom, pillarMat);
      rightPillar.position.copy(point).addScaledVector(binormal, (this.roadWidth / 2 + 1.2));
      rightPillar.position.y += 3.75;

      // Overhead glowing beam
      const beamGeom = new THREE.BoxGeometry(this.roadWidth + 3.2, 0.6, 0.8);
      const beamMat = new THREE.MeshBasicMaterial({ color: gateColor });
      const beam = new THREE.Mesh(beamGeom, beamMat);
      beam.position.copy(point);
      beam.position.y += 7.2;
      beam.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), binormal);

      gateGroup.add(leftPillar);
      gateGroup.add(rightPillar);
      gateGroup.add(beam);

      this.scene.add(gateGroup);

      this.checkpoints.push({
        index: i,
        u: u,
        position: point,
        passed: false,
        isStart: isStart
      });
    }
  }

  getRoadInfoAtProgress(u) {
    const normU = ((u % 1.0) + 1.0) % 1.0;
    const point = this.roadCurve.getPointAt(normU);
    const tangent = this.roadCurve.getTangentAt(normU);
    const binormal = new THREE.Vector3(0, 1, 0).cross(tangent).normalize();
    return { point, tangent, binormal };
  }
}

window.WorldGenerator = WorldGenerator;
