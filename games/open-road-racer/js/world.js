/* Open Road: the world.
   The road is a pure function of distance s: its heading and height are sums of slow sine
   waves, so it is smooth everywhere and endless. Terrain is a ribbon either side of the road,
   so road and ground always meet without gaps. On a ghat one side climbs into a basalt wall
   and the other falls away into the valley; which side does which drifts as you drive. */

'use strict';

const ROAD = {
  half: 3.6,        // half the asphalt width (two lanes)
  edge: 5.2,        // asphalt + laterite shoulder
  lane: -1.8,       // centre of the left lane: India drives on the left
  step: 2,          // metres between samples
  chunk: 120,       // metres of road per mesh
  ribbon: 95,       // how far the terrain reaches either side
};

// ---------- small maths helpers ----------

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}

function fbm(x, y) {
  return vnoise(x, y) * 0.55 + vnoise(x * 2.1, y * 2.1) * 0.28 + vnoise(x * 4.3, y * 4.3) * 0.17;
}

const smooth01 = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- the road as a function of distance ----------

class Road {
  constructor(seed) {
    const r = mulberry32(seed);
    // heading terms: amplitude (rad) and wavelength (m). Max curvature stays below 1/120 m,
    // which keeps the inside of every bend wider than the terrain ribbon.
    this.turns = [[0.62, 230], [0.34, 113], [0.14, 57]].map(([a, l]) => ({ a, l, p: r() * 6.283 }));
    this.hills = [[24, 540], [9, 190], [2.5, 70]].map(([a, l]) => ({ a, l, p: r() * 6.283 }));
    this.sidePhase = r() * 6.283;
    this.xs = [0]; this.zs = [0];
  }

  heading(s) { let t = 0; for (const w of this.turns) t += w.a * Math.sin(s / w.l + w.p); return t; }
  height(s) { let h = 0; for (const w of this.hills) h += w.a * Math.sin(s / w.l + w.p); return h; }
  curvature(s) { let k = 0; for (const w of this.turns) k += (w.a / w.l) * Math.cos(s / w.l + w.p); return k; }
  // +1: the right side climbs and the left falls into the valley; -1 the other way round
  side(s) { return clamp(Math.sin(s / 1150 + this.sidePhase) * 1.5, -1, 1); }

  ensure(s) {
    while ((this.xs.length - 1) * ROAD.step < s + ROAD.step) {
      const i = this.xs.length - 1, sm = (i + 0.5) * ROAD.step, th = this.heading(sm);
      this.xs.push(this.xs[i] + Math.sin(th) * ROAD.step);
      this.zs.push(this.zs[i] + Math.cos(th) * ROAD.step);
    }
  }

  /** Centre point, unit tangent and right vector at distance s (s >= 0). */
  frame(s, out = {}) {
    s = Math.max(0, s);
    this.ensure(s);
    const f = s / ROAD.step, i = Math.floor(f), t = f - i;
    const th = this.heading(s);
    out.x = this.xs[i] + (this.xs[i + 1] - this.xs[i]) * t;
    out.z = this.zs[i] + (this.zs[i + 1] - this.zs[i]) * t;
    out.tx = Math.sin(th); out.tz = Math.cos(th);
    out.rx = -out.tz; out.rz = out.tx;
    out.h = this.height(s);
    return out;
  }

  /** Ground height at distance s and signed offset d (positive = right of the road). */
  ground(s, d, f = this.frame(s, Road._tmp)) {
    const ad = Math.abs(d);
    if (ad <= ROAD.half) return f.h;
    if (ad <= ROAD.edge) return f.h - 0.1 * (ad - ROAD.half) / (ROAD.edge - ROAD.half);
    const r = ad - ROAD.edge;
    const wx = f.x + f.rx * d, wz = f.z + f.rz * d;
    const c = d > 0 ? this.side(s) : -this.side(s);
    let shape;
    if (c > 0) shape = c * (r * 0.55 + r * r * 0.004);           // the cliff
    else shape = Math.max(c * r * 0.45, -48);                       // the drop to the valley
    const n = fbm(wx * 0.018, wz * 0.018) * 11 * smooth01(r / 22);
    return f.h - 0.1 + shape + n;
  }
}
Road._tmp = {};

// ---------- colours ----------

// colours are written as sRGB hex and converted once, because lighting happens in linear space
const lin = hex => new THREE.Color(hex).convertSRGBToLinear();
const PALETTE = {
  laterite: lin('#7a442e'),
  grass: lin('#41662b'),
  grassDeep: lin('#274821'),
  moss: lin('#5b7a31'),
  basalt: lin('#3b3836'),
  basaltWet: lin('#2a2828'),
};

// ---------- geometry helpers ----------

/** Merge simple geometries into one non-indexed geometry with a baked vertex colour each. */
function mergeColoured(parts) {
  const pos = [], nor = [], col = [];
  for (const { geo, color, matrix } of parts) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (matrix) g.applyMatrix4(matrix);
    g.computeVertexNormals();
    const p = g.attributes.position.array, n = g.attributes.normal.array, c = lin(color);
    for (let i = 0; i < p.length; i += 3) {
      pos.push(p[i], p[i + 1], p[i + 2]); nor.push(n[i], n[i + 1], n[i + 2]); col.push(c.r, c.g, c.b);
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}

const M4 = (x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz));

function buildProps() {
  const leaf = new THREE.IcosahedronGeometry(1, 0);   // flat facets: cheap, and it suits the look
  return {
    // rain-tree style umbrella canopy, the classic Sahyadri roadside tree
    umbrella: mergeColoured([
      { geo: new THREE.CylinderGeometry(0.18, 0.3, 4, 6), color: '#4a3528', matrix: M4(0, 2, 0) },
      { geo: leaf, color: '#3f6b2a', matrix: M4(0, 4.6, 0, 2.7, 1.1, 2.7) },
      { geo: leaf, color: '#4c7b31', matrix: M4(1, 5.2, 0.4, 1.8, 0.9, 1.8) },
    ]),
    // tall evergreen
    tall: mergeColoured([
      { geo: new THREE.CylinderGeometry(0.14, 0.24, 5, 6), color: '#3e2c22', matrix: M4(0, 2.5, 0) },
      { geo: leaf, color: '#2e5a26', matrix: M4(0, 6.2, 0, 1.7, 3.6, 1.7) },
    ]),
    shrub: mergeColoured([{ geo: leaf, color: '#557f34', matrix: M4(0, 0.5, 0, 1.2, 0.8, 1.2) }]),
    rock: mergeColoured([{ geo: new THREE.DodecahedronGeometry(1, 0), color: '#46423f', matrix: M4(0, 0.2, 0, 1.4, 0.8, 1.1) }]),
    // white verge post with a black band, every 25 m
    post: mergeColoured([
      { geo: new THREE.BoxGeometry(0.16, 0.9, 0.16), color: '#e9e6df', matrix: M4(0, 0.45, 0) },
      { geo: new THREE.BoxGeometry(0.17, 0.18, 0.17), color: '#1b1b1b', matrix: M4(0, 0.72, 0) },
    ]),
    // the parapet on the valley side, painted in alternating yellow and black
    parapet: new THREE.BoxGeometry(0.45, 0.62, 2.3).translate(0, 0.31, 0),
    stone: mergeColoured([
      { geo: new THREE.BoxGeometry(0.62, 0.62, 0.22), color: '#efece4', matrix: M4(0, 0.31, 0) },
      { geo: new THREE.CylinderGeometry(0.31, 0.31, 0.22, 12, 1, false, 0, Math.PI), color: '#f2c230',
        matrix: new THREE.Matrix4().makeRotationX(Math.PI / 2).premultiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2)).premultiply(M4(0, 0.62, 0)) },
    ]),
  };
}

function roadTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#3c3b40'; g.fillRect(0, 0, 256, 512);
  const r = mulberry32(7);
  for (let i = 0; i < 9000; i++) {          // aggregate speckle
    const v = 40 + r() * 40 | 0;
    g.fillStyle = `rgba(${v},${v},${v + 4},${0.35 + r() * 0.4})`;
    g.fillRect(r() * 256, r() * 512, 1 + r() * 2, 1 + r() * 2);
  }
  for (let i = 0; i < 5; i++) {             // a few repaired patches
    g.fillStyle = 'rgba(20,20,24,.08)';
    g.fillRect(r() * 200, r() * 470, 40 + r() * 60, 20 + r() * 40);
  }
  g.fillStyle = 'rgba(245,242,232,.92)';
  g.fillRect(6, 0, 7, 512); g.fillRect(243, 0, 7, 512);   // edge lines
  g.fillRect(125, 0, 6, 220);                              // centre dash
  g.fillStyle = 'rgba(0,0,0,.07)';
  g.fillRect(40, 0, 30, 512); g.fillRect(186, 0, 30, 512); // tyre wear
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function stoneLabel(place, km) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#efece4'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#1d1d1d'; g.textAlign = 'center';
  g.font = 'bold 17px system-ui, sans-serif'; g.fillText(place.toUpperCase(), 64, 48);
  g.font = 'bold 40px system-ui, sans-serif'; g.fillText(String(km), 64, 98);
  return new THREE.CanvasTexture(c);
}

const PLACES = ['Lonavala', 'Khandala', 'Malshej', 'Bhimashankar', 'Tamhini', 'Mahabaleshwar', 'Panchgani', 'Amboli', 'Matheran', 'Kaas'];

// ---------- chunks ----------

class World {
  constructor(scene, seed = 1977) {
    this.scene = scene;
    this.road = new Road(seed);
    this.seed = seed;
    this.chunks = new Map();
    this.treeDensity = 1;
    this.ahead = 9;       // chunks kept in front of the car
    this.wet = 0;         // 0 dry, 1 monsoon: darkens rock, greens the grass

    this.props = buildProps();
    this.roadMat = new THREE.MeshStandardMaterial({ map: roadTexture(), roughness: 0.92, metalness: 0 });
    this.groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
    this.propMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
    this.parapetMat = new THREE.MeshStandardMaterial({ roughness: 0.8 });
    this.offsets = [ROAD.edge, 6.4, 8, 10.5, 14, 18.5, 24, 31, 40, 51, 64, 79, ROAD.ribbon];
  }

  setWet(w) {
    this.wet = w;
    this.roadMat.roughness = 0.92 - w * 0.5;
    this.roadMat.color.setScalar(1 - w * 0.25);
  }

  update(s) {
    const first = Math.max(0, Math.floor(s / ROAD.chunk) - 2), last = Math.floor(s / ROAD.chunk) + this.ahead;
    for (const [k, c] of this.chunks) if (k < first || k > last) { this.dispose(c); this.chunks.delete(k); }
    // build one chunk per frame at most, nearest first, so driving never hitches
    for (let k = first; k <= last; k++) if (!this.chunks.has(k)) { this.chunks.set(k, this.build(k)); break; }
  }

  rebuildAll() { for (const [k, c] of this.chunks) this.dispose(c); this.chunks.clear(); }

  dispose(group) {
    group.traverse(o => {
      if (o.geometry && !o.userData.shared) o.geometry.dispose();
      if (o.material && o.userData.ownMaterial) { o.material.map && o.material.map.dispose(); o.material.dispose(); }
    });
    this.scene.remove(group);
  }

  build(k) {
    const road = this.road, s0 = k * ROAD.chunk, rows = ROAD.chunk / ROAD.step + 1;
    const o = road.frame(s0, {}), ox = o.x, oz = o.z, oy = o.h;   // chunk origin keeps vertices small
    const group = new THREE.Group();
    group.position.set(ox, oy, oz);

    // road surface
    const rp = [], ruv = [], ri = [];
    const f = {};
    for (let j = 0; j < rows; j++) {
      const s = s0 + j * ROAD.step; road.frame(s, f);
      for (const [d, u] of [[-ROAD.half, 0], [ROAD.half, 1]]) {
        rp.push(f.x + f.rx * d - ox, f.h + 0.02 - oy, f.z + f.rz * d - oz);
        ruv.push(u, s / 14);
      }
      if (j) { const a = (j - 1) * 2; ri.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
    rg.setAttribute('uv', new THREE.Float32BufferAttribute(ruv, 2));
    rg.setIndex(ri); rg.computeVertexNormals();
    const roadMesh = new THREE.Mesh(rg, this.roadMat);
    roadMesh.receiveShadow = true;
    group.add(roadMesh);

    // terrain: both sides, the shoulder included, as one mesh
    const offs = [...this.offsets.slice().reverse().map(v => -v), -ROAD.half, ROAD.half, ...this.offsets];
    const cols = offs.length, tp = [], tn = [], tc = [], ti = [];
    const col = new THREE.Color();
    const wet = this.wet;
    for (let j = 0; j < rows; j++) {
      const s = s0 + j * ROAD.step; road.frame(s, f);
      const fx = f.x, fz = f.z, frx = f.rx, frz = f.rz, ftx = f.tx, ftz = f.tz;
      for (let i = 0; i < cols; i++) {
        const d = offs[i], h = road.ground(s, d, f);
        tp.push(fx + frx * d - ox, h - oy, fz + frz * d - oz);
        // normal from finite differences along the road and across it
        const e = 1, hs = road.ground(s + e, d) - road.ground(s - e, d), hd = road.ground(s, d + e) - road.ground(s, d - e);
        road.frame(s, f);
        const nx = -(ftx * hs + frx * hd), nz = -(ftz * hs + frz * hd), ny = 2 * e;
        const L = Math.hypot(nx, ny, nz); tn.push(nx / L, ny / L, nz / L);
        const ad = Math.abs(d), steep = 1 - ny / L;
        const wx = fx + frx * d, wz = fz + frz * d, n = fbm(wx * 0.05 + 9, wz * 0.05);
        if (ad <= ROAD.edge + 0.01) col.copy(PALETTE.laterite);
        else {
          col.copy(PALETTE.grass).lerp(PALETTE.grassDeep, clamp(0.5 + n * 0.8, 0, 1));
          if (n > 0.35) col.lerp(PALETTE.moss, 0.5);
          if (ad < ROAD.edge + 2.5) col.lerp(PALETTE.laterite, 0.4);       // red soil spills off the shoulder
          col.lerp(wet ? PALETTE.basaltWet : PALETTE.basalt, smooth01((steep - 0.28) * 3.2));
          if (wet) col.multiplyScalar(0.92).lerp(PALETTE.grassDeep, 0.15 * (1 - steep));
        }
        tc.push(col.r, col.g, col.b);
      }
      if (j) for (let i = 0; i < cols - 1; i++) {
        if (i === cols / 2 - 1) continue;                     // the asphalt sits in this gap
        const a = (j - 1) * cols + i, b = a + cols;
        ti.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3));
    tg.setAttribute('normal', new THREE.Float32BufferAttribute(tn, 3));
    tg.setAttribute('color', new THREE.Float32BufferAttribute(tc, 3));
    tg.setIndex(ti);
    const ground = new THREE.Mesh(tg, this.groundMat);
    ground.receiveShadow = true;
    group.add(ground);

    this.scatter(group, k, s0, ox, oy, oz);
    this.scene.add(group);
    return group;
  }

  scatter(group, k, s0, ox, oy, oz) {
    const road = this.road, r = mulberry32(this.seed * 31 + k * 977), f = {};
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    const v = new THREE.Vector3(), sc = new THREE.Vector3();
    const lists = { umbrella: [], tall: [], shrub: [], rock: [], post: [] };

    const place = (list, s, d, scale, yaw, sink = 0) => {
      road.frame(s, f);
      const h = road.ground(s, d, f);
      q.setFromAxisAngle(up, yaw);
      v.set(f.x + f.rx * d - ox, h - oy - sink, f.z + f.rz * d - oz);
      list.push(m.compose(v, q, sc.setScalar(scale)).clone());
    };

    const tries = Math.round(150 * this.treeDensity);
    for (let i = 0; i < tries; i++) {
      const s = s0 + r() * ROAD.chunk, side = r() < 0.5 ? -1 : 1;
      const d = side * (ROAD.edge + 4 + Math.pow(r(), 1.3) * (ROAD.ribbon - 12));
      road.frame(s, f);
      const wx = f.x + f.rx * d, wz = f.z + f.rz * d, density = fbm(wx * 0.012 + 3, wz * 0.012);
      const slope = Math.abs(road.ground(s, d + side * 2) - road.ground(s, d)) / 2;
      if (slope > 1.1) { if (r() < 0.25) place(lists.rock, s, d, 0.8 + r() * 1.6, r() * 6, 0.3); continue; }
      if (density < -0.15 && r() < 0.7) continue;
      const pick = r();
      if (pick < 0.45) place(lists.umbrella, s, d, 0.8 + r() * 0.6, r() * 6, 0.2);
      else if (pick < 0.75) place(lists.tall, s, d, 0.8 + r() * 0.7, r() * 6, 0.2);
      else if (pick < 0.93) place(lists.shrub, s, d, 0.6 + r() * 0.8, r() * 6);
      else place(lists.rock, s, d, 0.5 + r() * 1.1, r() * 6, 0.2);
    }

    // verge posts every 25 m on both sides
    for (let s = s0 + 12.5; s < s0 + ROAD.chunk; s += 25)
      for (const d of [-ROAD.edge - 0.35, ROAD.edge + 0.35]) place(lists.post, s, d, 1, road.heading(s));

    for (const key of Object.keys(lists)) {
      if (!lists[key].length) continue;
      const mesh = new THREE.InstancedMesh(this.props[key], this.propMat, lists[key].length);
      lists[key].forEach((mx, i) => mesh.setMatrixAt(i, mx));
      mesh.userData.shared = true;
      mesh.castShadow = key !== 'post';
      group.add(mesh);
    }

    // parapet on the valley side where the drop is real
    const blocks = [], colours = [];
    for (let s = s0 + 1.25, n = 0; s < s0 + ROAD.chunk; s += 2.5, n++) {
      const side = road.side(s);
      if (Math.abs(side) < 0.35) continue;
      const d = side > 0 ? -(ROAD.edge + 0.25) : ROAD.edge + 0.25;   // the valley is on the falling side
      if (r() < 0.04) continue;                                      // the odd broken block
      road.frame(s, f);
      q.setFromAxisAngle(up, road.heading(s));
      v.set(f.x + f.rx * d - ox, road.ground(s, d, f) - oy - 0.05, f.z + f.rz * d - oz);
      blocks.push(m.compose(v, q, sc.set(1, 1, 1)).clone());
      colours.push(Math.floor(s / 2.5) % 2 ? '#e8b923' : '#1e1e1e');
    }
    if (blocks.length) {
      const mesh = new THREE.InstancedMesh(this.props.parapet, this.parapetMat, blocks.length);
      blocks.forEach((mx, i) => { mesh.setMatrixAt(i, mx); mesh.setColorAt(i, lin(colours[i])); });
      mesh.userData.shared = true; mesh.castShadow = true;
      group.add(mesh);
    }

    // a milestone at every kilometre, counting down to the next hill station
    const km = Math.ceil(s0 / 1000) * 1000;
    if (km >= s0 && km < s0 + ROAD.chunk && km > 0) {
      const idx = Math.floor(km / 15000), place15 = PLACES[(idx + this.seed) % PLACES.length];
      const left = 15 - ((km / 1000) % 15);
      const d = -(ROAD.edge + 0.6);
      road.frame(km, f);
      const stone = new THREE.Mesh(this.props.stone, this.propMat);
      stone.userData.shared = true;
      stone.position.set(f.x + f.rx * d - ox, road.ground(km, d, f) - oy, f.z + f.rz * d - oz);
      stone.rotation.y = road.heading(km) + Math.PI / 2;
      const label = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.5),
        new THREE.MeshStandardMaterial({ map: stoneLabel(place15, left), roughness: 0.9 }));
      label.userData.ownMaterial = true;
      label.position.set(0, 0.32, 0.115);
      stone.add(label);
      stone.castShadow = true;
      group.add(stone);
    }
  }
}

// ---------- sky, far ridges, rain ----------

class Sky {
  constructor(scene) {
    this.uniforms = {
      top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunColor: { value: new THREE.Color() }, haze: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
      fragmentShader: `
        uniform vec3 top, horizon, sunDir, sunColor; uniform float haze; varying vec3 vDir;
        void main(){
          float y = max(vDir.y, 0.);
          vec3 c = mix(horizon, top, pow(y, 0.55));
          float sd = max(dot(normalize(vDir), sunDir), 0.);
          c += sunColor * (pow(sd, 900.) * 4. * (1. - haze) + pow(sd, 12.) * .35 + pow(sd, 3.) * .12);
          c = mix(c, horizon, haze * (1. - y * .6));
          if (vDir.y < 0.) c = horizon;
          gl_FragColor = vec4(pow(c, vec3(1. / 2.2)), 1.);   // colours arrive linear
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 16), mat);
    this.mesh.renderOrder = -2;
    scene.add(this.mesh);

    // two rings of far ridges, painted once, tinted with the haze every frame
    this.ridges = [];
    [[1150, 230, 11, 0.9], [1400, 300, 23, 0.65]].forEach(([radius, height, seed, alpha], i) => {
      const c = document.createElement('canvas'); c.width = 2048; c.height = 256;
      const g = c.getContext('2d'), r = mulberry32(seed);
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, 256);
      for (let x = 0; x <= 2048; x += 8) {
        const t = x / 2048 * Math.PI * 2;
        const y = 120 + Math.sin(t * 3 + seed) * 40 + Math.sin(t * 7 + seed * 2) * 22 + Math.sin(t * 19) * 8 + (r() - 0.5) * 6;
        g.lineTo(x, 256 - y + (i ? 10 : 30));
      }
      g.lineTo(2048, 256); g.fill();
      const tex = new THREE.CanvasTexture(c);
      const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, fog: false, depthWrite: false, opacity: alpha });
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 64, 1, true), m);
      mesh.material.side = THREE.BackSide;
      mesh.position.y = height / 2 - 70;
      mesh.renderOrder = -1;
      scene.add(mesh);
      this.ridges.push(mesh);
    });
  }

  follow(cam) {
    this.mesh.position.copy(cam.position);
    for (const r of this.ridges) { r.position.x = cam.position.x; r.position.z = cam.position.z; r.position.y = cam.position.y + r.geometry.parameters.height / 2 - 90; }
  }
}

class Rain {
  constructor(scene, count = 1600) {
    this.count = count;
    this.pos = new Float32Array(count * 6);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.mesh = new THREE.LineSegments(this.geo, new THREE.LineBasicMaterial({ color: 0xaab6c8, transparent: true, opacity: 0.35 }));
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.r = mulberry32(5);
    for (let i = 0; i < count; i++) this.spawn(i, true);
  }
  spawn(i, anyHeight) {
    const r = this.r, p = this.pos, j = i * 6;
    p[j] = (r() - 0.5) * 70; p[j + 1] = anyHeight ? r() * 30 : 30; p[j + 2] = (r() - 0.5) * 70;
    p[j + 3] = p[j] + 0.05; p[j + 4] = p[j + 1] + 0.9; p[j + 5] = p[j + 2];
  }
  update(dt, cam, carVel) {
    if (!this.mesh.visible) return;
    this.mesh.position.set(cam.position.x, cam.position.y - 12, cam.position.z);
    const p = this.pos, fall = 24 * dt, dx = -carVel.x * dt * 0.6, dz = -carVel.z * dt * 0.6;
    for (let i = 0; i < this.count; i++) {
      const j = i * 6;
      p[j + 1] -= fall; p[j + 4] -= fall;
      p[j] += dx; p[j + 3] += dx; p[j + 2] += dz; p[j + 5] += dz;
      if (p[j + 1] < 0 || Math.abs(p[j]) > 35 || Math.abs(p[j + 2]) > 35) this.spawn(i, false);
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}
