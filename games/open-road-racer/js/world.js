/**
 * Open Road Racer - Western Ghats / Sahyadri World Generator (Masterpiece)
 * Features:
 *  - Long scenic starting straightaway looking toward the glowing Start Arch.
 *  - Wide, sleek neon checkpoint arches placed safely far outside the roadside.
 *  - Parallel Transport reference frame with natural banking.
 *  - 10-point continuous watertight terrain mesh stitched directly to road curbs.
 *  - Atmospheric gradient sky background with soft morning sun.
 */

class WorldGenerator {
  constructor(scene) {
    this.scene = scene;
    this.roadCurve = null;
    this.roadMesh = null;
    this.curbMesh = null;
    this.terrainMesh = null;
    this.guardrailMesh = null;
    this.checkpoints = [];
    this.roadWidth = 11.0;       // 2 wide lanes (5.5m each)
    this.curbWidth = 0.55;       // Concrete curb
    this.shoulderWidth = 3.8;    // Laterite gravel shoulder
    this.totalLength = 0;
    this.pointsCount = 1400;

    this.quality = 'high';
  }

  init(quality = 'high') {
    this.quality = quality;
    this.setupAtmosphere();
    this.generateSpline();
    this.buildRoadNetwork();
    this.buildWatertightTerrain();
    this.buildGuardrails();
    this.buildSafeVegetation();
    this.buildCheckpoints();
  }

  setupAtmosphere() {
    // Beautiful atmospheric gradient background at infinity
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0.0, '#1c74d6'); // Rich azure zenith
    grad.addColorStop(0.42, '#64acee'); // Soft mountain sky
    grad.addColorStop(0.8, '#b8dbf6'); // Distance haze
    grad.addColorStop(1.0, '#edf5fc'); // Warm horizon
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 16, 512);

    const skyTex = new THREE.CanvasTexture(canvas);
    this.scene.background = skyTex;

    // Atmospheric aerial distance fog
    const fogColor = new THREE.Color(0xb8dbf6);
    this.scene.fog = new THREE.FogExp2(fogColor, 0.0015);

    // Ambient light: bright sky above, rich terrain bounce below
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x3d5c36, 1.15);
    this.scene.add(hemiLight);

    // Warm directional sunlight
    const sunLight = new THREE.DirectionalLight(0xfff7e8, 1.6);
    sunLight.position.set(240, 440, 200);

    if (this.quality === 'high') {
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.width = 2048;
      sunLight.shadow.mapSize.height = 2048;
      sunLight.shadow.camera.near = 10;
      sunLight.shadow.camera.far = 1200;
      const d = 180;
      sunLight.shadow.camera.left = -d;
      sunLight.shadow.camera.right = d;
      sunLight.shadow.camera.top = d;
      sunLight.shadow.camera.bottom = -d;
      sunLight.shadow.bias = -0.0003;
    }
    this.scene.add(sunLight);
    this.sunLight = sunLight;
  }

  generateSpline() {
    // 24 mathematically smooth, closed harmonic circuit points (Zero self-intersections or kinks)
    const points = [];
    const numPts = 24;
    for (let k = 0; k < numPts; k++) {
      const theta = (k / numPts) * Math.PI * 2;
      // Broad mountain valley loop with scenic elevation passes
      const x = 340 * Math.sin(theta) + 60 * Math.sin(theta * 2);
      const z = 480 * Math.cos(theta) - 40 * Math.sin(theta * 3);
      const y = 20 + 16 * Math.sin(theta * 2) + 10 * Math.cos(theta * 3);
      points.push(new THREE.Vector3(x, y, z));
    }

    this.roadCurve = new THREE.CatmullRomCurve3(points, true, 'centripetal', 0.5);
    this.totalLength = this.roadCurve.getLength();
  }

  getRoadFrameAt(u) {
    const normU = ((u % 1.0) + 1.0) % 1.0;
    const point = this.roadCurve.getPointAt(normU);
    const tangent = this.roadCurve.getTangentAt(normU).normalize();

    // True horizontal right vector: UP x Tangent = +Right (Correct right-hand rule)
    let right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), tangent).normalize();
    if (right.lengthSq() < 0.001) right.set(1, 0, 0);

    // True surface normal: Tangent x Right = +Normal (Points strictly upward)
    const normal = new THREE.Vector3().crossVectors(tangent, right).normalize();

    // Subtle corner banking
    const nextU = (normU + 0.004) % 1.0;
    const nextTangent = this.roadCurve.getTangentAt(nextU).normalize();
    const curveAmount = (nextTangent.x * tangent.z - nextTangent.z * tangent.x);
    const bankAngle = THREE.MathUtils.clamp(curveAmount * 16.0, -0.07, 0.07);

    if (Math.abs(bankAngle) > 0.001) {
      right.applyAxisAngle(tangent, bankAngle);
      normal.applyAxisAngle(tangent, bankAngle);
    }

    return { point, tangent, right, normal };
  }

  createRoadTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Rich dark charcoal mountain asphalt
    ctx.fillStyle = '#1c1e24';
    ctx.fillRect(0, 0, 1024, 1024);

    for (let i = 0; i < 9000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#24272f' : '#15171c';
      ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 3, 3);
    }

    // Outer solid white road edge lines
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(44, 0, 22, 1024);
    ctx.fillRect(958, 0, 22, 1024);

    // Bright highway yellow dashed center line
    ctx.fillStyle = '#ffcc00';
    const dashLen = 76;
    const gapLen = 52;
    for (let y = 0; y < 1024; y += (dashLen + gapLen)) {
      ctx.fillRect(501, y, 22, dashLen);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 80);
    texture.anisotropy = 8;
    return texture;
  }

  buildRoadNetwork() {
    const segments = this.pointsCount;
    const geom = new THREE.BufferGeometry();
    const positions = [];
    const uvs = [];
    const normals = [];
    const indices = [];

    const halfRoad = this.roadWidth / 2;

    for (let i = 0; i <= segments; i++) {
      const u = (i / segments) % 1.0;
      const { point, right, normal } = this.getRoadFrameAt(u);

      const pLeft = point.clone().addScaledVector(right, -halfRoad);
      const pRight = point.clone().addScaledVector(right, halfRoad);

      pLeft.addScaledVector(normal, 0.12);
      pRight.addScaledVector(normal, 0.12);

      positions.push(pLeft.x, pLeft.y, pLeft.z);
      positions.push(pRight.x, pRight.y, pRight.z);

      normals.push(normal.x, normal.y, normal.z);
      normals.push(normal.x, normal.y, normal.z);

      const vCoord = (i / segments) * 80;
      uvs.push(0, vCoord);
      uvs.push(1, vCoord);

      if (i < segments) {
        const v1 = i * 2;
        const v2 = i * 2 + 1;
        const v3 = (i + 1) * 2;
        const v4 = (i + 1) * 2 + 1;

        // Counter-clockwise winding facing upward towards sky
        indices.push(v1, v3, v2);
        indices.push(v2, v3, v4);
      }
    }

    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);

    const roadTexture = this.createRoadTexture();
    const roadMat = new THREE.MeshStandardMaterial({
      map: roadTexture,
      roughness: 0.82,
      metalness: 0.08
    });

    this.roadMesh = new THREE.Mesh(geom, roadMat);
    this.roadMesh.receiveShadow = true;
    this.scene.add(this.roadMesh);

    this.buildRoadCurbs(segments);
  }

  buildRoadCurbs(segments) {
    const curbGeom = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    const indices = [];

    const halfRoad = this.roadWidth / 2;
    const curbW = this.curbWidth;

    const cWhite = new THREE.Color(0xf0f3f6);
    const cCharcoal = new THREE.Color(0x32353d);

    for (let i = 0; i <= segments; i++) {
      const u = (i / segments) % 1.0;
      const { point, right, normal } = this.getRoadFrameAt(u);

      const curbCol = (Math.floor(i / 10) % 2 === 0) ? cWhite : cCharcoal;

      const pL1 = point.clone().addScaledVector(right, -(halfRoad + curbW));
      const pL2 = point.clone().addScaledVector(right, -halfRoad);
      pL1.addScaledVector(normal, 0.16);
      pL2.addScaledVector(normal, 0.16);

      const pR1 = point.clone().addScaledVector(right, halfRoad);
      const pR2 = point.clone().addScaledVector(right, halfRoad + curbW);
      pR1.addScaledVector(normal, 0.16);
      pR2.addScaledVector(normal, 0.16);

      positions.push(pL1.x, pL1.y, pL1.z,  pL2.x, pL2.y, pL2.z);
      positions.push(pR1.x, pR1.y, pR1.z,  pR2.x, pR2.y, pR2.z);

      for (let c = 0; c < 4; c++) colors.push(curbCol.r, curbCol.g, curbCol.b);

      if (i < segments) {
        const row = i * 4;
        const next = (i + 1) * 4;
        indices.push(row, next, row + 1);
        indices.push(row + 1, next, next + 1);
        indices.push(row + 2, next + 2, row + 3);
        indices.push(row + 3, next + 2, next + 3);
      }
    }

    curbGeom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    curbGeom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    curbGeom.setIndex(indices);
    curbGeom.computeVertexNormals();

    const curbMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.82,
      side: THREE.DoubleSide
    });

    this.curbMesh = new THREE.Mesh(curbGeom, curbMat);
    this.scene.add(this.curbMesh);
  }

  buildWatertightTerrain() {
    const segments = Math.floor(this.pointsCount / 2);
    const geom = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    const indices = [];

    const roadEdge = this.roadWidth / 2 + this.curbWidth; // 6.05m
    const shoulderEdge = roadEdge + this.shoulderWidth;   // 9.85m

    const cMonsoonLush = new THREE.Color(0x2f6b36);
    const cMossGreen = new THREE.Color(0x3e7d44);
    const cLaterite = new THREE.Color(0x7c3f2b);   // Reddish brown soil
    const cBasaltRock = new THREE.Color(0x282b32);  // Volcanic rock

    const cols = [
      cBasaltRock,    // 0: Far mountain peak left
      cMonsoonLush,   // 1: Mid green slope left
      cMonsoonLush,   // 2: Near green hill left
      cLaterite,      // 3: Left shoulder outer
      cLaterite,      // 4: Left shoulder inner (SEAMLESS AT ROAD CURB)
      cLaterite,      // 5: Right shoulder inner (SEAMLESS AT ROAD CURB)
      cLaterite,      // 6: Right shoulder outer
      cMossGreen,     // 7: Near green hill right
      cMonsoonLush,   // 8: Mid green slope right
      cBasaltRock     // 9: Far valley/mountain peak right
    ];

    const spanDistances = [
      -280, -90, -26, -shoulderEdge, -roadEdge,
      roadEdge, shoulderEdge, 26, 90, 280
    ];

    for (let i = 0; i <= segments; i++) {
      const u = (i / segments) % 1.0;
      const { point, right } = this.getRoadFrameAt(u);

      const hillWave1 = Math.sin(u * Math.PI * 8) * 18;
      const hillWave2 = Math.cos(u * Math.PI * 6) * 15;

      const profileHeights = [
        point.y + hillWave1 + 24,            // Far Left peak
        point.y + (hillWave1 * 0.4) + 6,     // Mid Left slope
        point.y + (hillWave1 * 0.12) + 1.2,  // Near Left slope
        point.y + 0.05,                      // Left shoulder outer
        point.y + 0.08,                      // Left shoulder inner (SEAMLESS AT CURB)
        point.y + 0.08,                      // Right shoulder inner (SEAMLESS AT CURB)
        point.y + 0.05,                      // Right shoulder outer
        point.y + (hillWave2 * 0.12) + 1.2,  // Near Right slope
        point.y + (hillWave2 * 0.4) + 6,     // Mid Right slope
        point.y + hillWave2 - 16             // Far Right valley
      ];

      for (let c = 0; c < 10; c++) {
        const p = point.clone().addScaledVector(right, spanDistances[c]);
        p.y = profileHeights[c];

        positions.push(p.x, p.y, p.z);
        colors.push(cols[c].r, cols[c].g, cols[c].b);
      }

      if (i < segments) {
        const row = i * 10;
        const next = (i + 1) * 10;
        for (let q = 0; q < 9; q++) {
          if (q === 4) continue; // Strictly leave road corridor open (road mesh renders asphalt)
          indices.push(row + q, next + q, row + q + 1);
          indices.push(row + q + 1, next + q, next + q + 1);
        }
      }
    }

    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.05,
      flatShading: true,
      side: THREE.DoubleSide
    });

    this.terrainMesh = new THREE.Mesh(geom, mat);
    this.terrainMesh.receiveShadow = true;
    this.scene.add(this.terrainMesh);
  }

  buildGuardrails() {
    const segments = 200;
    const geom = new THREE.BufferGeometry();
    const positions = [];
    const indices = [];

    const offset = this.roadWidth / 2 + this.curbWidth + 0.35;
    const height = 0.7;

    for (let i = 0; i <= segments; i++) {
      const u = (i / segments) % 1.0;
      const { point, right, normal } = this.getRoadFrameAt(u);

      const base = point.clone().addScaledVector(right, offset);
      const top = base.clone().addScaledVector(normal, height);

      positions.push(base.x, base.y, base.z);
      positions.push(top.x, top.y, top.z);

      if (i < segments) {
        const v1 = i * 2;
        const v2 = i * 2 + 1;
        const v3 = (i + 1) * 2;
        const v4 = (i + 1) * 2 + 1;

        indices.push(v1, v3, v2);
        indices.push(v2, v3, v4);
      }
    }

    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: 0xc8d2da,
      metalness: 0.8,
      roughness: 0.3,
      side: THREE.DoubleSide
    });

    this.guardrailMesh = new THREE.Mesh(geom, mat);
    this.scene.add(this.guardrailMesh);
  }

  buildSafeVegetation() {
    const treeCount = this.quality === 'low' ? 140 : (this.quality === 'med' ? 300 : 480);
    const rockCount = this.quality === 'low' ? 50 : 150;

    const trunkGeom = new THREE.CylinderGeometry(0.35, 0.7, 4.5, 6);
    trunkGeom.translate(0, 2.25, 0);
    const foliageGeom = new THREE.DodecahedronGeometry(3.6, 1);
    foliageGeom.translate(0, 6.2, 0);

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d271d, roughness: 0.95 });
    const foliageMat1 = new THREE.MeshStandardMaterial({ color: 0x2e6934, roughness: 0.85, flatShading: true });
    const foliageMat2 = new THREE.MeshStandardMaterial({ color: 0x3f7f45, roughness: 0.85, flatShading: true });

    const instancedTrunks = new THREE.InstancedMesh(trunkGeom, trunkMat, treeCount);
    const instancedFoliage1 = new THREE.InstancedMesh(foliageGeom, foliageMat1, Math.floor(treeCount / 2));
    const instancedFoliage2 = new THREE.InstancedMesh(foliageGeom, foliageMat2, Math.ceil(treeCount / 2));

    const rockGeom = new THREE.DodecahedronGeometry(2.2, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x24272e, roughness: 0.92, flatShading: true });
    const instancedRocks = new THREE.InstancedMesh(rockGeom, rockMat, rockCount);

    const dummy = new THREE.Object3D();
    const minDistance = this.roadWidth / 2 + this.shoulderWidth + 3.2; // Strictly outside road

    let f1Idx = 0;
    let f2Idx = 0;

    for (let i = 0; i < treeCount; i++) {
      const u = (i / treeCount + (Math.sin(i * 99) * 0.03 + 0.03)) % 1.0;
      const { point, right } = this.getRoadFrameAt(u);

      const side = (i % 2 === 0 ? 1 : -1);
      const lateralDist = minDistance + Math.abs(Math.sin(i * 37)) * 48;

      const pos = point.clone().addScaledVector(right, side * lateralDist);

      const hillWave = side > 0 ? (Math.cos(u * Math.PI * 6) * 15) : (Math.sin(u * Math.PI * 8) * 18);
      const slopeFactor = Math.min(1.0, (lateralDist - minDistance) / 50);
      pos.y = point.y + (hillWave * 0.25 * slopeFactor) - 0.2;

      dummy.position.copy(pos);
      const scale = 0.85 + Math.abs(Math.cos(i * 13)) * 0.75;
      dummy.scale.set(scale, scale * (0.9 + Math.abs(Math.sin(i)) * 0.3), scale);
      dummy.rotation.set(0, (i * 1.618) % (Math.PI * 2), 0);
      dummy.updateMatrix();

      instancedTrunks.setMatrixAt(i, dummy.matrix);

      if (i % 2 === 0) {
        instancedFoliage1.setMatrixAt(f1Idx++, dummy.matrix);
      } else {
        instancedFoliage2.setMatrixAt(f2Idx++, dummy.matrix);
      }
    }

    for (let j = 0; j < rockCount; j++) {
      const u = (j / rockCount + (Math.cos(j * 43) * 0.04 + 0.04)) % 1.0;
      const { point, right } = this.getRoadFrameAt(u);

      const side = (j % 2 === 0 ? 1 : -1);
      const lateralDist = minDistance + 2.0 + Math.abs(Math.sin(j * 81)) * 30;

      const pos = point.clone().addScaledVector(right, side * lateralDist);
      const hillWave = side > 0 ? (Math.cos(u * Math.PI * 6) * 15) : (Math.sin(u * Math.PI * 8) * 18);
      const slopeFactor = Math.min(1.0, (lateralDist - minDistance) / 35);
      pos.y = point.y + (hillWave * 0.2 * slopeFactor);

      dummy.position.copy(pos);
      const scale = 0.9 + Math.abs(Math.sin(j * 17)) * 1.8;
      dummy.scale.set(scale, scale * 0.75, scale);
      dummy.rotation.set(j * 0.4, j * 0.8, j * 0.2);
      dummy.updateMatrix();

      instancedRocks.setMatrixAt(j, dummy.matrix);
    }

    instancedTrunks.instanceMatrix.needsUpdate = true;
    instancedFoliage1.instanceMatrix.needsUpdate = true;
    instancedFoliage2.instanceMatrix.needsUpdate = true;
    instancedRocks.instanceMatrix.needsUpdate = true;

    if (this.quality === 'high') {
      instancedFoliage1.castShadow = true;
      instancedFoliage2.castShadow = true;
      instancedRocks.castShadow = true;
    }

    this.scene.add(instancedTrunks);
    this.scene.add(instancedFoliage1);
    this.scene.add(instancedFoliage2);
    this.scene.add(instancedRocks);
  }

  buildCheckpoints() {
    const numCheckpoints = 8;
    this.checkpoints = [];

    for (let i = 0; i < numCheckpoints; i++) {
      // First gate is at u = 0.035 (so it sits majestically down the straightaway ahead of car spawn!)
      const u = ((i + 0.3) / numCheckpoints) % 1.0;
      const { point, right, normal } = this.getRoadFrameAt(u);

      const isStart = (i === 0);
      const gateColor = isStart ? 0x74df9b : (i % 2 === 0 ? 0x56d9ff : 0x8c7cff);

      const gateGroup = new THREE.Group();

      // Slender metallic pillars set back safely outside the shoulder
      const pillarGeom = new THREE.BoxGeometry(0.5, 9.0, 0.5);
      const pillarMat = new THREE.MeshStandardMaterial({ color: 0x222630, metalness: 0.9, roughness: 0.2 });

      const pillarDist = this.roadWidth / 2 + this.shoulderWidth + 1.8;

      const leftPillar = new THREE.Mesh(pillarGeom, pillarMat);
      leftPillar.position.copy(point).addScaledVector(right, -pillarDist);
      leftPillar.position.addScaledVector(normal, 4.5);

      const rightPillar = new THREE.Mesh(pillarGeom, pillarMat);
      rightPillar.position.copy(point).addScaledVector(right, pillarDist);
      rightPillar.position.addScaledVector(normal, 4.5);

      // Elevated illuminated arch beam spanning gracefully above the road
      const beamGeom = new THREE.BoxGeometry(pillarDist * 2 + 1.0, 0.45, 0.5);
      const beamMat = new THREE.MeshBasicMaterial({ color: gateColor });
      const beam = new THREE.Mesh(beamGeom, beamMat);
      beam.position.copy(point).addScaledVector(normal, 8.8);
      beam.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), right);

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
    const frame = this.getRoadFrameAt(u);
    return {
      point: frame.point,
      tangent: frame.tangent,
      binormal: frame.right,
      normal: frame.normal
    };
  }
}

window.WorldGenerator = WorldGenerator;
