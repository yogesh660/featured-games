/* FPV: the maps. Every solid thing is an axis-aligned box that is both drawn and collided
   with, so what you see is exactly what you hit. Gates are frames you fly through in order. */
'use strict';

function canvasTex(w, h, draw, repeat = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = 8;
  t.encoding = THREE.sRGBEncoding;
  return t;
}
function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
const srgb = hex => new THREE.Color(hex).convertSRGBToLinear();

class World {
  constructor(scene) {
    this.scene = scene; this.group = new THREE.Group(); scene.add(this.group);
    this.boxes = []; this.gates = []; this.lights = [];
  }

  clear() {
    this.scene.remove(this.group);
    this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    this.group = new THREE.Group(); this.scene.add(this.group);
    for (const l of this.lights) this.scene.remove(l);
    this.boxes = []; this.gates = []; this.lights = [];
  }

  mat(color, opts = {}) { return new THREE.MeshStandardMaterial({ color: srgb(color), roughness: 0.8, ...opts }); }

  /** A solid box from its minimum corner and size (metres). */
  box(x, y, z, w, h, d, material, { solid = true, cast = true } = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x + w / 2, y + h / 2, z + d / 2); m.castShadow = cast; m.receiveShadow = true;
    this.group.add(m);
    if (solid) this.boxes.push({ min: new THREE.Vector3(x, y, z), max: new THREE.Vector3(x + w, y + h, z + d) });
    return m;
  }

  /** A gate: centre, size and facing ('x' or 'z'). The frame is solid; the opening is the goal. */
  gate(cx, cy, cz, w, h, axis, color, t = 0.05) {
    const frame = this.mat('#1d1b26', { roughness: 0.5 });
    const glow = new THREE.MeshBasicMaterial({ color: srgb(color) });
    const g = { c: new THREE.Vector3(cx, cy, cz), w, h, axis, color, parts: [] };
    const along = axis === 'z';                    // fly along z, frame spans x
    const add = (dx, dy, sw, sh) => {
      const [bx, bz, bw, bd] = along ? [cx + dx - sw / 2, cz - t / 2, sw, t] : [cx - t / 2, cz + dx - sw / 2, t, sw];
      const part = this.box(bx, cy + dy - sh / 2, bz, bw, sh, bd, frame);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(along ? sw * 0.98 : t * 1.4, sh * 0.98, along ? t * 1.4 : sw * 0.98), glow.clone());
      strip.scale.set(along ? 1 : 1, 1, 1);
      strip.position.copy(part.position); strip.scale.multiplyScalar(0.999);
      // only the inner edge glows, like an LED strip
      if (sw > sh) strip.scale.y = 0.35; else strip.scale[along ? 'x' : 'z'] = 0.35;
      this.group.add(strip); g.parts.push(strip);
    };
    add(0, h / 2 + t / 2, w + 2 * t, t); add(0, -h / 2 - t / 2, w + 2 * t, t);
    add(-w / 2 - t / 2, 0, t, h); add(w / 2 + t / 2, 0, t, h);
    this.gates.push(g);
    return g;
  }

  setGateState(next) {
    this.gates.forEach((g, i) => {
      const col = i === next ? srgb('#74df9b') : i === (next + 1) % this.gates.length ? srgb('#ffc94d') : srgb(g.color).multiplyScalar(0.35);
      g.parts.forEach(p => p.material.color.copy(col));
    });
  }

  /** Signed distance of a point to a gate's plane, and whether it is inside the opening. */
  gateSide(g, p) {
    const d = g.axis === 'z' ? p.z - g.c.z : p.x - g.c.x;
    const lateral = g.axis === 'z' ? Math.abs(p.x - g.c.x) : Math.abs(p.z - g.c.z);
    return { d, inside: lateral < g.w / 2 && Math.abs(p.y - g.c.y) < g.h / 2 };
  }

  /** Push the quad's sphere out of every box and the floor; report impact speed. */
  collide(drone) {
    const r = drone.spec.radius, p = drone.pos, v = drone.vel, s = drone.spec;
    const contact = (n, depth) => {
      p.addScaledVector(n, depth);
      const vn = v.dot(n);
      if (vn < 0) {
        drone.impact = Math.max(drone.impact, -vn);
        v.addScaledVector(n, -vn * (1 + s.bounce));
        // friction along the surface, and a knock to the attitude
        const tangential = v.clone().addScaledVector(n, -v.dot(n));
        v.addScaledVector(tangential, -0.35);
        drone.w.add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(-vn * (s.ducted ? 2 : 4)));
      }
    };
    if (p.y < this.floor + r) contact(new THREE.Vector3(0, 1, 0), this.floor + r - p.y);
    if (this.ceiling && p.y > this.ceiling - r) contact(new THREE.Vector3(0, -1, 0), p.y - (this.ceiling - r));
    const c = new THREE.Vector3();
    for (const b of this.boxes) {
      if (p.x < b.min.x - r || p.x > b.max.x + r || p.y < b.min.y - r || p.y > b.max.y + r || p.z < b.min.z - r || p.z > b.max.z + r) continue;
      c.set(THREE.MathUtils.clamp(p.x, b.min.x, b.max.x), THREE.MathUtils.clamp(p.y, b.min.y, b.max.y), THREE.MathUtils.clamp(p.z, b.min.z, b.max.z));
      const dvec = p.clone().sub(c), dist = dvec.length();
      if (dist >= r) continue;
      if (dist > 1e-6) contact(dvec.divideScalar(dist), r - dist);
      else {
        // centre inside the box: leave by the nearest face
        const faces = [[b.min.x - p.x, 'x', -1], [b.max.x - p.x, 'x', 1], [b.min.y - p.y, 'y', -1], [b.max.y - p.y, 'y', 1], [b.min.z - p.z, 'z', -1], [b.max.z - p.z, 'z', 1]];
        faces.sort((a, b2) => Math.abs(a[0]) - Math.abs(b2[0]));
        const [dd, ax, sg] = faces[0], n = new THREE.Vector3(); n[ax] = sg;
        contact(n, Math.abs(dd) + r);
      }
    }
  }

  // ---------------------------------------------------------------- living room (Tinywhoop)
  buildLivingRoom() {
    this.clear();
    const S = this.scene;
    this.floor = 0; this.ceiling = 2.7; this.kind = 'indoor';
    S.background = srgb('#1a1612'); S.fog = null;
    const wood = canvasTex(512, 512, (g, w, h) => {
      const r = rng(4);
      for (let y = 0; y < h; y += 32) {
        let x = -r() * 200;
        while (x < w) {
          const len = 140 + r() * 160, tone = 120 + r() * 40;
          g.fillStyle = `rgb(${tone},${tone * 0.66 | 0},${tone * 0.42 | 0})`; g.fillRect(x, y, len, 32);
          g.strokeStyle = 'rgba(40,20,10,.35)'; g.strokeRect(x, y, len, 32);
          for (let i = 0; i < 6; i++) { g.strokeStyle = `rgba(60,30,15,${0.08 + r() * 0.1})`; g.beginPath(); g.moveTo(x, y + r() * 32); g.lineTo(x + len, y + r() * 32); g.stroke(); }
          x += len;
        }
      }
    }, 6);
    const rug = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#6b2f3a'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#e8c27a'; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28);
      g.lineWidth = 2; g.strokeRect(30, 30, w - 60, h - 60);
      g.fillStyle = '#2f4f6b'; g.beginPath(); g.moveTo(w / 2, 50); g.lineTo(w - 50, h / 2); g.lineTo(w / 2, h - 50); g.lineTo(50, h / 2); g.fill();
      g.fillStyle = '#e8c27a'; g.beginPath(); g.arc(w / 2, h / 2, 22, 0, 7); g.fill();
    });
    const wall = this.mat('#e9e2d6', { roughness: 0.95 });
    const accent = this.mat('#3c5a6b', { roughness: 0.95 });

    // floor, ceiling and the shell of two rooms joined by a doorway
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 8), new THREE.MeshStandardMaterial({ map: wood, roughness: 0.6 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(1, 0, 0); floor.receiveShadow = true; this.group.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(12, 8), this.mat('#f4f0e8', { emissive: srgb('#f4f0e8'), emissiveIntensity: 0.35 }));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(1, 2.7, 0); this.group.add(ceil);
    this.box(-5.1, 0, -4.1, 12.2, 2.7, 0.1, wall);                 // back wall
    this.box(-5.1, 0, 4, 12.2, 2.7, 0.1, wall);                    // front wall
    this.box(-5.1, 0, -4, 0.1, 2.7, 8, accent);                    // left wall (feature colour)
    this.box(7, 0, -4, 0.1, 2.7, 8, wall);                          // right wall
    // partition with a doorway into the kitchen
    this.box(2.4, 0, -4, 0.12, 2.7, 3.2, wall);
    this.box(2.4, 0, 0.2, 0.12, 2.7, 3.8, wall);
    this.box(2.4, 2.1, -0.8, 0.12, 0.6, 1, wall);
    // skirting
    const skirt = this.mat('#f7f4ee');
    this.box(-5, 0, -4, 12, 0.08, 0.02, skirt, { solid: false, cast: false });

    // window with daylight on the left wall
    const win = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.3), new THREE.MeshBasicMaterial({ color: srgb('#cfe6ff') }));
    win.position.set(-5.04, 1.5, -1); win.rotation.y = Math.PI / 2; this.group.add(win);
    this.box(-5.05, 0.82, -2.15, 0.12, 0.06, 2.3, skirt, { solid: false });
    const sun = new THREE.DirectionalLight(srgb('#fff1d6'), 1.6);
    sun.position.set(-9, 6, -2); sun.target.position.set(0, 0, 0); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 6, bottom: -6, near: 1, far: 25 }); sun.shadow.bias = -0.0005;
    const hemi = new THREE.HemisphereLight(srgb('#fff4e6'), srgb('#5a4030'), 0.55);
    const lamp = new THREE.PointLight(srgb('#ffcf8a'), 1.4, 7, 2); lamp.position.set(-3.6, 1.7, 2.6);
    const kitchen = new THREE.PointLight(srgb('#ffffff'), 1.1, 9, 2); kitchen.position.set(4.7, 2.5, 0);
    this.lights = [sun, sun.target, hemi, lamp, kitchen]; this.lights.forEach(l => S.add(l));

    // living room furniture
    const fabric = this.mat('#4b5c7a', { roughness: 1 }), cushion = this.mat('#c76b4f', { roughness: 1 });
    this.box(-4.6, 0, 1.6, 3, 0.45, 0.95, fabric);                 // sofa seat
    this.box(-4.6, 0.45, 2.3, 3, 0.45, 0.25, fabric);              // back
    this.box(-4.8, 0, 1.6, 0.22, 0.65, 0.95, fabric); this.box(-1.6, 0, 1.6, 0.22, 0.65, 0.95, fabric);
    this.box(-4.2, 0.45, 2.05, 0.5, 0.4, 0.15, cushion, { solid: false }); this.box(-2.4, 0.45, 2.05, 0.5, 0.4, 0.15, cushion, { solid: false });
    const rugMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.4), new THREE.MeshStandardMaterial({ map: rug, roughness: 1 }));
    rugMesh.rotation.x = -Math.PI / 2; rugMesh.position.set(-3, 0.005, 0.3); rugMesh.receiveShadow = true; this.group.add(rugMesh);
    const teak = this.mat('#6a4128', { roughness: 0.6 });
    this.box(-4, 0.38, -0.3, 1.6, 0.06, 0.8, teak);                // coffee table top
    for (const [x, z] of [[-3.95, -0.25], [-2.5, -0.25], [-3.95, 0.4], [-2.5, 0.4]]) this.box(x, 0, z, 0.06, 0.38, 0.06, teak);
    this.box(-4.5, 0, -3.9, 2.6, 0.5, 0.45, teak);                 // TV unit
    this.box(-4.1, 0.6, -3.95, 1.8, 1.0, 0.06, this.mat('#0b0b10', { roughness: 0.2 }));
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.92), new THREE.MeshBasicMaterial({ map: canvasTex(256, 140, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#241848'); gr.addColorStop(1, '#f3a06a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,.9)'; g.font = 'bold 22px sans-serif'; g.fillText('YA. FPV', 20, 40); g.font = '14px sans-serif'; g.fillText('tonight: whoop racing', 20, 64);
    }) }));
    screen.position.set(-3.2, 1.1, -3.885); this.group.add(screen);
    // bookshelf with books
    this.box(-1.2, 0, -3.95, 1.4, 2, 0.35, teak);
    const r = rng(9);
    for (let shelf = 0; shelf < 4; shelf++) for (let x = -1.15; x < 0.1;) {
      const bw = 0.04 + r() * 0.05, bh = 0.25 + r() * 0.15;
      this.box(x, 0.1 + shelf * 0.5, -3.6, bw, bh, 0.05, this.mat(['#b23a48', '#3a6ea5', '#e3b23c', '#2f6b4f', '#efe9df', '#5b3a7a'][Math.floor(r() * 6)]), { solid: false });
      x += bw + 0.005;
    }
    // floor lamp and plants
    this.box(-3.65, 0, 2.55, 0.06, 1.6, 0.06, this.mat('#222'));
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 0.3, 20, 1, true), new THREE.MeshStandardMaterial({ color: srgb('#f3e3c3'), emissive: srgb('#ffcf8a'), emissiveIntensity: 0.6, side: THREE.DoubleSide }));
    shade.position.set(-3.62, 1.72, 2.58); this.group.add(shade);
    this.boxes.push({ min: new THREE.Vector3(-3.9, 1.57, 2.3), max: new THREE.Vector3(-3.34, 1.87, 2.86) });
    for (const [x, z] of [[1.9, -3.6], [-1.3, 3.5]]) {
      this.box(x, 0, z, 0.32, 0.4, 0.32, this.mat('#a65a3a'));
      const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38, 0), this.mat('#3f7a3a', { flatShading: true }));
      leaves.position.set(x + 0.16, 0.8, z + 0.16); leaves.scale.y = 1.3; leaves.castShadow = true; this.group.add(leaves);
      this.boxes.push({ min: new THREE.Vector3(x - 0.15, 0.4, z - 0.15), max: new THREE.Vector3(x + 0.47, 1.25, z + 0.47) });
    }
    // dining table and chairs
    this.box(-0.6, 0.74, 0.9, 1.8, 0.05, 1, teak);
    for (const [x, z] of [[-0.55, 0.95], [1.1, 0.95], [-0.55, 1.8], [1.1, 1.8]]) this.box(x, 0, z, 0.06, 0.74, 0.06, teak);
    for (const [x, z, back] of [[-0.3, 0.35, 0], [0.6, 0.35, 0], [-0.3, 2, 1], [0.6, 2, 1]]) {
      this.box(x, 0.44, z, 0.42, 0.04, 0.42, teak);
      this.box(x, 0, z, 0.04, 0.44, 0.04, teak); this.box(x + 0.38, 0, z + 0.38, 0.04, 0.44, 0.04, teak);
      this.box(x, 0.48, back ? z + 0.38 : z, 0.42, 0.45, 0.04, teak);
    }
    // kitchen: counters, island, fridge
    const counter = this.mat('#d8d3cc', { roughness: 0.3 }), cab = this.mat('#2f3a44');
    this.box(2.6, 0, -4, 4.3, 0.9, 0.62, cab); this.box(2.6, 0.9, -4, 4.3, 0.04, 0.64, counter);
    this.box(6.35, 0, -3.3, 0.6, 1.9, 0.7, this.mat('#c9ccd1', { roughness: 0.25, metalness: 0.4 }));
    this.box(3.8, 0, -0.5, 1.6, 0.9, 0.9, cab); this.box(3.75, 0.9, -0.55, 1.7, 0.04, 1, counter);
    this.box(2.6, 1.45, -4, 4.3, 0.7, 0.35, cab);                   // wall cupboards
    // pendant lights over the island
    for (const x of [4.2, 5]) {
      this.box(x, 2.1, -0.05, 0.03, 0.6, 0.03, this.mat('#111'), { solid: false });
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: srgb('#ffe2a8'), emissiveIntensity: 2 }));
      bulb.position.set(x + 0.015, 2.05, -0.035); this.group.add(bulb);
      this.boxes.push({ min: new THREE.Vector3(x - 0.09, 1.95, -0.13), max: new THREE.Vector3(x + 0.12, 2.15, 0.06) });
    }

    // the course: round the coffee table, through the doorway, round the island, back under the dining table
    const G = '#8c7cff';
    this.gate(-1.0, 0.9, -1.4, 0.5, 0.5, 'x', G);
    this.gate(-3.2, 1.3, -1.6, 0.45, 0.45, 'z', G);
    this.gate(-4.3, 0.55, 0.9, 0.45, 0.45, 'z', G);
    this.gate(-2.9, 1.55, 1.2, 0.45, 0.45, 'x', G);
    this.gate(0.3, 0.32, 1.45, 0.45, 0.4, 'x', G);              // under the dining table
    this.gate(2.46, 1.0, -0.3, 0.7, 1.8, 'x', G, 0.03);          // the doorway itself
    this.gate(5.8, 1.2, -1.5, 0.5, 0.5, 'z', G);
    this.gate(4.6, 1.5, 1.2, 0.45, 0.45, 'x', G);
    this.spawn = { pos: new THREE.Vector3(0.8, 0.05, -1.4), yaw: Math.PI / 2 };
  }

  // ---------------------------------------------------------------- ghat bando (5")
  buildBando() {
    this.clear();
    const S = this.scene;
    this.floor = 0; this.ceiling = 0; this.kind = 'outdoor';
    S.background = srgb('#9db8d4'); S.fog = new THREE.Fog(srgb('#c7d3dc'), 60, 420);
    const grass = canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#4c6b2c'; g.fillRect(0, 0, w, h);
      const r = rng(3);
      for (let i = 0; i < 26000; i++) { const t = r(); g.fillStyle = t < 0.5 ? 'rgba(90,130,50,.5)' : t < 0.8 ? 'rgba(40,70,25,.5)' : 'rgba(140,110,60,.35)'; g.fillRect(r() * w, r() * h, 1 + r() * 2, 2 + r() * 4); }
      for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(122,66,40,.35)'; g.beginPath(); g.ellipse(r() * w, r() * h, 10 + r() * 30, 6 + r() * 16, r() * 3, 0, 7); g.fill(); }
    }, 60);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshStandardMaterial({ map: grass, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; this.group.add(ground);

    // sky dome with a warm horizon, and ridges all round like the Western Ghats
    const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 v; void main(){ v = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: 'varying vec3 v; void main(){ float y = max(v.y, 0.); vec3 c = mix(vec3(.96,.82,.66), vec3(.33,.52,.82), pow(y, .45)); gl_FragColor = vec4(c, 1.); }' }));
    this.group.add(sky);
    const ridge = canvasTex(2048, 256, (g, w, h) => {
      g.fillStyle = '#56657a'; g.beginPath(); g.moveTo(0, h);
      for (let x = 0; x <= w; x += 8) { const t = x / w * Math.PI * 2; g.lineTo(x, h - (110 + Math.sin(t * 3) * 45 + Math.sin(t * 7 + 1) * 25 + Math.sin(t * 17) * 8)); }
      g.lineTo(w, h); g.fill();
      g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, h - 40, w, 40);
    });
    ridge.wrapS = THREE.RepeatWrapping; ridge.wrapT = THREE.ClampToEdgeWrapping; ridge.repeat.set(1, 1);
    const ridgeMesh = new THREE.Mesh(new THREE.CylinderGeometry(600, 600, 140, 64, 1, true), new THREE.MeshBasicMaterial({ map: ridge, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    ridgeMesh.position.y = 50; this.group.add(ridgeMesh);

    const sun = new THREE.DirectionalLight(srgb('#fff0d8'), 2.2);
    sun.position.set(80, 120, 60); sun.target.position.set(0, 0, 0); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, near: 10, far: 400 }); sun.shadow.bias = -0.0008;
    const hemi = new THREE.HemisphereLight(srgb('#cfe0ff'), srgb('#4a5a2a'), 0.75);
    this.lights = [sun, sun.target, hemi]; this.lights.forEach(l => S.add(l));

    // the bando: an unfinished concrete frame, two floors, open window bays
    const concrete = this.mat('#9a968f', { roughness: 1 }), stained = this.mat('#7d7870', { roughness: 1 });
    const bx = -12, bz = -40, W = 24, D = 14, F = 4;
    for (let f = 0; f < 3; f++) this.box(bx, f * F, bz, W, 0.3, D, f ? concrete : stained);    // slabs (roof at 8 m)
    for (let f = 0; f < 2; f++) {
      for (let x = 0; x <= W; x += 6) for (const z of [0, D]) this.box(bx + x - 0.3, f * F + 0.3, bz + z - 0.3, 0.6, F - 0.3, 0.6, concrete);   // pillars
      // walls with window gaps on the long sides
      for (let x = 0; x < W; x += 6) {
        this.box(bx + x + 0.3, f * F + 0.3, bz - 0.12, 1.4, F - 0.3, 0.24, stained);
        this.box(bx + x + 4.3, f * F + 0.3, bz - 0.12, 1.4, F - 0.3, 0.24, stained);
        this.box(bx + x + 1.7, f * F + 0.3, bz - 0.12, 2.6, 0.9, 0.24, stained);              // sill: window 2.6 x 2.1 above it
        this.box(bx + x + 1.7, f * F + 3.3, bz - 0.12, 2.6, 0.7, 0.24, stained);
      }
    }
    this.box(bx - 6, 0, bz + 4, 6, 0.6, 0.6, stained);                                         // a fallen beam
    for (let i = 0; i < 8; i++) this.box(bx + 2 + i * 0.55, 0.3 + i * 0.5, bz + D - 3, 0.55, 0.5, 2.4, concrete);   // stairs
    // a rusty water tank on legs
    const rust = this.mat('#8b4a2c', { roughness: 0.9 });
    for (const [x, z] of [[18, -18], [22, -18], [18, -14], [22, -14]]) this.box(x, 0, z, 0.3, 6, 0.3, rust);
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 3.2, 20), rust); tank.position.set(20.15, 7.6, -15.85); tank.castShadow = true; this.group.add(tank);
    this.boxes.push({ min: new THREE.Vector3(17.2, 6, -18.8), max: new THREE.Vector3(23.1, 9.2, -12.9) });

    // trees: rain trees and tall ones, kept off the racing line
    const trunk = this.mat('#4a3528'), leaf = this.mat('#3d6b2a', { flatShading: true }), leaf2 = this.mat('#2f5a24', { flatShading: true });
    const r = rng(21);
    const trees = [[-30, 10], [-26, 22], [-40, -10], [30, 18], [38, 4], [8, 30], [-8, 38], [44, -30], [-44, -38], [26, 40], [-20, -70], [12, -66], [50, 30], [-56, 20]];
    for (let i = 0; i < 40; i++) trees.push([(r() - 0.5) * 300, (r() - 0.5) * 300]);
    trees.forEach(([x, z], i) => {
      if (i > 13 && Math.abs(x) < 70 && z > -75 && z < 35) return;          // random trees stay off the course
      const h = 6 + r() * 6, wide = r() < 0.6;
      this.box(x - 0.3, 0, z - 0.3, 0.6, h, 0.6, trunk);
      const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), r() < 0.5 ? leaf : leaf2);
      c.scale.set(wide ? 5 : 2.6, wide ? 2 : 4.5, wide ? 5 : 2.6); c.position.set(x, h + (wide ? 0.8 : 2.5), z); c.castShadow = true; this.group.add(c);
      const sx = c.scale.x * 0.8, sy = c.scale.y * 0.8;
      this.boxes.push({ min: new THREE.Vector3(x - sx, c.position.y - sy, z - sx), max: new THREE.Vector3(x + sx, c.position.y + sy, z + sx) });
    });
    // flags at the start, and a parked scooter for scale
    for (const [x, z, col] of [[-3, 8, '#ff6fae'], [3, 8, '#56d9ff']]) {
      this.box(x, 0, z, 0.06, 3, 0.06, this.mat('#222'));
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.6), new THREE.MeshStandardMaterial({ color: srgb(col), side: THREE.DoubleSide }));
      flag.position.set(x + 0.4, 2.1, z); this.group.add(flag);
    }
    this.box(6, 0, 12, 0.6, 0.9, 1.8, this.mat('#c4582f', { roughness: 0.4 }));

    // the course: out to the tank, through the bando's ground floor, up through a first-floor window, dive off the roof
    const G = '#ff9a3c';
    this.gate(0, 2, -4, 3, 2.2, 'z', G, 0.15);
    this.gate(20.15, 3, -10, 3, 2.2, 'z', G, 0.15);                    // under the tank
    this.gate(34, 4, -30, 3, 2.2, 'x', G, 0.15);
    this.gate(bx + 3 * 6 + 3, 2.4, bz - 0.12, 2.4, 1.9, 'z', G, 0.12);  // into the ground-floor window bay
    this.gate(bx + 6 + 3, 2.4 + F, bz - 0.12, 2.4, 1.9, 'z', G, 0.12);  // out through a first-floor window
    this.gate(-30, 3, -24, 3, 2.2, 'x', G, 0.15);
    this.gate(-24, 2.5, 14, 3, 2.2, 'z', G, 0.15);
    this.spawn = { pos: new THREE.Vector3(0, 0.15, 6), yaw: 0 };
  }
}
