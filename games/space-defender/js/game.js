/* Space Defender 3D.
   You hold the line above a neon grid while waves come out of deep space. The ship has mass:
   thrust, drag and banking; hits push enemies back, asteroids tumble and split, wrecks throw
   debris. Kills chain into a multiplier, so the score rewards staying aggressive. */
'use strict';

(() => {
  const $ = id => document.getElementById(id);
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lin = hex => new THREE.Color(hex).convertSRGBToLinear();
  const store = {
    get(k, d) { try { const v = localStorage.getItem('sd3.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('sd3.' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };

  // ---------- renderer and scene ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  $('stage').appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = lin('#05040c');
  scene.fog = new THREE.FogExp2(lin('#0a0718'), 0.0042);
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 2000);
  scene.add(new THREE.HemisphereLight(lin('#9b8cff'), lin('#0a2030'), 0.9));
  const key = new THREE.DirectionalLight(lin('#ffffff'), 1.6); key.position.set(4, 10, 8); scene.add(key);
  const rim = new THREE.DirectionalLight(lin('#56d9ff'), 1.2); rim.position.set(-6, -2, -10); scene.add(rim);

  const BOUNDS = { x: 14, y: 7 };
  const PLAYER_Z = 0;

  function resize() {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.fov = camera.aspect < 1 ? 82 : 62;           // portrait phones see more
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize); resize();

  // ---------- shared textures and materials ----------
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const glow = (color, size) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: lin(color), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    s.scale.setScalar(size); return s;
  };
  const emissive = (color, intensity = 1.6) => new THREE.MeshStandardMaterial({ color: lin('#111'), emissive: lin(color), emissiveIntensity: intensity, roughness: 0.4 });
  const metal = (color, rough = 0.35) => new THREE.MeshStandardMaterial({ color: lin(color), roughness: rough, metalness: 0.7, flatShading: true });

  // ---------- backdrop: stars, nebulae, planet, the grid ----------
  const stars = (() => {
    const n = 2600, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = rand(-260, 260); pos[i * 3 + 1] = rand(-160, 160); pos[i * 3 + 2] = rand(-900, -20); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, map: glowTex, size: 2.2, sizeAttenuation: true, fog: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(p); return p;
  })();
  [['#8c7cff', -120, 60, -700, 520], ['#56d9ff', 200, -40, -760, 420], ['#ff6fae', -260, -90, -680, 360]].forEach(([c, x, y, z, s]) => {
    const n = glow(c, s); n.material.opacity = 0.22; n.position.set(x, y, z); scene.add(n);
  });
  const planet = new THREE.Mesh(new THREE.SphereGeometry(110, 48, 32), new THREE.MeshStandardMaterial({ color: lin('#3b2a7a'), roughness: 1, fog: false }));
  planet.position.set(230, 70, -820); scene.add(planet);
  const ring = new THREE.Mesh(new THREE.RingGeometry(140, 190, 96), new THREE.MeshBasicMaterial({ color: lin('#8c7cff'), transparent: true, opacity: 0.25, side: THREE.DoubleSide, fog: false }));
  ring.position.copy(planet.position); ring.rotation.set(1.2, 0.3, 0.2); scene.add(ring);
  const planetGlow = glow('#8c7cff', 420); planetGlow.material.opacity = 0.35; planetGlow.position.copy(planet.position); scene.add(planetGlow);

  const grid = new THREE.Mesh(new THREE.PlaneGeometry(900, 1400, 1, 1), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { t: { value: 0 }, tint: { value: new THREE.Color('#8c7cff') }, pulse: { value: 0 } },
    vertexShader: 'varying vec2 vUv; varying float vDist; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.); vDist = -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: `uniform float t, pulse; uniform vec3 tint; varying vec2 vUv; varying float vDist;
      void main(){
        vec2 p = vec2(vUv.x * 900., vUv.y * 1400. + t);
        vec2 g = abs(fract(p / 12.) - .5) / fwidth(p / 12.);
        float line = 1. - min(min(g.x, g.y), 1.);
        float fade = smoothstep(700., 40., vDist);
        gl_FragColor = vec4(tint * (1.4 + pulse * 2.), line * fade * .55);
      }`,
  }));
  grid.material.extensions = { derivatives: true };
  grid.rotation.x = -Math.PI / 2; grid.position.set(0, -15, -560); scene.add(grid);

  // ---------- the player's ship ----------
  function buildShip() {
    const g = new THREE.Group();
    const hull = metal('#e4e1f7'), dark = metal('#5a5680', 0.45), accent = emissive('#8c7cff', 2.2);
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.62, 3.2, 6), hull); body.rotation.x = -Math.PI / 2; g.add(body);
    const wingShape = new THREE.Shape([new THREE.Vector2(0, 0.9), new THREE.Vector2(2.6, -0.9), new THREE.Vector2(2.4, -1.25), new THREE.Vector2(0, -0.8)]);
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.12, bevelEnabled: false }); wingGeo.rotateX(Math.PI / 2); wingGeo.translate(0, 0.06, 0);
    for (const s of [1, -1]) {
      const w = new THREE.Mesh(wingGeo, dark); w.scale.x = s; w.position.set(0.25 * s, -0.05, 0.3); g.add(w);
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 0.9), accent); tip.position.set(2.55 * s, 0.05, 1.1); g.add(tip);
      const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 1, 10), dark); eng.rotation.x = Math.PI / 2; eng.position.set(0.75 * s, 0, 1.3); g.add(eng);
      const flame = glow('#56d9ff', 1.6); flame.position.set(0.75 * s, 0, 1.95); g.add(flame); g.userData['flame' + s] = flame;
    }
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8), new THREE.MeshStandardMaterial({ color: lin('#0d1830'), emissive: lin('#2a6cff'), emissiveIntensity: 0.6, roughness: 0.05, metalness: 0.9 }));
    canopy.scale.set(0.8, 0.55, 1.6); canopy.position.set(0, 0.32, -0.2); g.add(canopy);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.9), accent); fin.position.set(0, 0.45, 1.1); fin.rotation.x = -0.4; g.add(fin);
    const shield = new THREE.Mesh(new THREE.SphereGeometry(2.6, 24, 16), new THREE.MeshBasicMaterial({ color: lin('#8c7cff'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, wireframe: true }));
    g.add(shield); g.userData.shield = shield;
    return g;
  }
  const shipMesh = buildShip(); shipMesh.scale.setScalar(1.15); scene.add(shipMesh);
  const shipLight = new THREE.PointLight(lin('#56d9ff'), 1.4, 14); scene.add(shipLight);

  // ---------- pools ----------
  function pool(make, n) {
    const items = []; for (let i = 0; i < n; i++) { const o = make(); o.visible = false; scene.add(o); items.push(o); }
    return { items, get() { const o = items.find(x => !x.visible); if (o) o.visible = true; return o; } };
  }
  const laserGeo = new THREE.BoxGeometry(0.14, 0.14, 2.2), laserMat = emissive('#56d9ff', 3);
  const lasers = pool(() => { const m = new THREE.Mesh(laserGeo, laserMat); m.add(glow('#56d9ff', 1.8)); m.userData.v = new THREE.Vector3(); return m; }, 160);
  const orbGeo = new THREE.IcosahedronGeometry(0.42, 1), orbMat = emissive('#ff6fae', 2.6);
  const orbs = pool(() => { const m = new THREE.Mesh(orbGeo, orbMat); m.add(glow('#ff6fae', 2.6)); m.userData.v = new THREE.Vector3(); return m; }, 220);
  const debrisGeo = new THREE.TetrahedronGeometry(0.35, 0);
  const debris = pool(() => { const m = new THREE.Mesh(debrisGeo, metal('#6a6680')); m.userData = { v: new THREE.Vector3(), w: new THREE.Vector3(), life: 0 }; return m; }, 160);
  const rings = pool(() => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.userData = { life: 0, max: 1, grow: 1 }; return m;
  }, 24);

  // sparks and smoke: one point cloud with its own size and colour per particle
  const P = 2400;
  const pPos = new Float32Array(P * 3), pCol = new Float32Array(P * 3), pSize = new Float32Array(P), pVel = new Float32Array(P * 3), pLife = new Float32Array(P), pMax = new Float32Array(P);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  pGeo.setAttribute('size', new THREE.BufferAttribute(pSize, 1));
  const particles = new THREE.Points(pGeo, new THREE.ShaderMaterial({
    uniforms: { map: { value: glowTex }, scale: { value: innerHeight / 2 } },
    vertexShader: 'attribute float size; attribute vec3 color; varying vec3 vCol; void main(){ vCol = color; vec4 mv = modelViewMatrix * vec4(position,1.); gl_PointSize = size * (300. / -mv.z); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform sampler2D map; varying vec3 vCol; void main(){ gl_FragColor = vec4(vCol, 1.) * texture2D(map, gl_PointCoord); }',
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  }));
  particles.frustumCulled = false; scene.add(particles);
  let pNext = 0;
  const tmpC = new THREE.Color();
  function emit(pos, n, color, speed, size, life, spread = 1) {
    tmpC.copy(lin(color));
    for (let i = 0; i < n; i++) {
      const j = pNext = (pNext + 1) % P;
      pPos[j * 3] = pos.x; pPos[j * 3 + 1] = pos.y; pPos[j * 3 + 2] = pos.z;
      const u = rand(-1, 1), th = rand(0, Math.PI * 2), r = Math.sqrt(1 - u * u), s = speed * rand(0.3, 1);
      pVel[j * 3] = r * Math.cos(th) * s; pVel[j * 3 + 1] = r * Math.sin(th) * s * spread; pVel[j * 3 + 2] = u * s;
      pLife[j] = pMax[j] = life * rand(0.6, 1.2); pSize[j] = size * rand(0.6, 1.3);
      pCol[j * 3] = tmpC.r; pCol[j * 3 + 1] = tmpC.g; pCol[j * 3 + 2] = tmpC.b;
    }
  }
  const pColBase = new Float32Array(P * 3);

  // ---------- enemies ----------
  const TYPES = {
    drone: { hp: 3, r: 2.2, score: 100, mass: 1, color: '#74df9b' },
    kamikaze: { hp: 2, r: 1.9, score: 150, mass: 0.8, color: '#ff9a3c' },
    cruiser: { hp: 16, r: 4.6, score: 600, mass: 5, color: '#ff6fae' },
    rock: { hp: 4, r: 2.4, score: 60, mass: 3, color: '#8a8299' },
    boss: { hp: 220, r: 8.5, score: 6000, mass: 40, color: '#ff4d6d' },
  };
  function enemyMesh(type, size = 1) {
    const g = new THREE.Group(), c = TYPES[type].color;
    if (type === 'drone') {
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.8, 0), metal('#3a3f5a')); core.scale.set(1.3, 0.6, 1.3); g.add(core);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), emissive(c, 2.5)); eye.position.z = 0.7; g.add(eye);
      for (const s of [1, -1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.6), emissive(c, 1.2)); w.position.x = 1.1 * s; w.rotation.z = 0.3 * s; g.add(w); }
      g.add(glow(c, 3));
    } else if (type === 'kamikaze') {
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 0), metal('#3a2a2a'));
      g.add(core);
      for (let i = 0; i < 6; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.9, 5), emissive(c, 2));
        const dir = new THREE.Vector3().setFromSphericalCoords(1, Math.acos(rand(-1, 1)), rand(0, 6.28));
        spike.position.copy(dir.clone().multiplyScalar(0.8)); spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); g.add(spike);
      }
      g.add(glow(c, 3.4));
    } else if (type === 'cruiser') {
      const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.6, 4.8, 8), metal('#2c2840')); hull.rotation.x = Math.PI / 2; g.add(hull);
      for (const s of [1, -1]) {
        const pod = new THREE.Mesh(new THREE.BoxGeometry(1, 0.8, 3), metal('#3a3550')); pod.position.set(2 * s, 0, 0.3); g.add(pod);
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.2, 0.2), emissive(c, 2.4)); lamp.position.set(2 * s, 0, 1.85); g.add(lamp);
      }
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 1.2), emissive(c, 1.6)); bridge.position.set(0, 0.9, -0.3); g.add(bridge);
      g.add(glow(c, 7));
    } else if (type === 'rock') {
      const geo = new THREE.DodecahedronGeometry(1, 1), p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const k = rand(0.78, 1.18); p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); }
      geo.computeVertexNormals();
      g.add(new THREE.Mesh(geo, metal('#4a4458', 0.9)));
      g.scale.setScalar(size * 1.25);
    } else if (type === 'boss') {
      const core = new THREE.Mesh(new THREE.SphereGeometry(2.6, 24, 16), metal('#2a2238'));
      const eye = new THREE.Mesh(new THREE.SphereGeometry(1.2, 20, 14), emissive(c, 3)); eye.position.z = 2;
      const torus = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.5, 10, 48), metal('#3b3355')); g.userData.spin = torus;
      for (let i = 0; i < 4; i++) {
        const pod = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0), emissive('#ff9a3c', 2));
        pod.position.set(Math.cos(i * Math.PI / 2) * 5.2, Math.sin(i * Math.PI / 2) * 5.2, 0); torus.add(pod);
      }
      g.add(core, eye, torus, glow(c, 18));
    }
    g.traverse(o => { if (o.material && o.material.emissive) o.userData.baseEmissive = o.material.emissiveIntensity; });
    return g;
  }

  const enemies = [];
  function spawn(type, x, y, z = -240, opts = {}) {
    const t = TYPES[type], size = opts.size || 1, mesh = enemyMesh(type, size);
    const hpScale = 1 + (state.wave - 1) * 0.09;
    const e = {
      type, mesh, pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(0, 0, opts.vz ?? 30),
      hp: Math.ceil(t.hp * (type === 'rock' ? size * size : 1) * hpScale), r: t.r * size, mass: t.mass * size * size,
      score: Math.round(t.score * (type === 'rock' ? size : 1)), t: 0, phase: rand(0, 6.28), fireT: rand(1.2, 2.6), size,
      spin: new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(type === 'rock' ? 1.5 : 0), flash: 0,
      anchorX: x, anchorY: y, hold: rand(-42, -28),
    };
    if (type === 'rock') { e.vel.set(rand(-3, 3), rand(-2, 2), rand(16, 26)); }
    if (opts.vel) e.vel.copy(opts.vel);
    if (type !== 'rock') mesh.scale.setScalar(type === 'boss' ? 1.45 : 1.9);
    mesh.position.copy(e.pos); scene.add(mesh); enemies.push(e);
    if (type === 'boss') { state.boss = e; $('boss').hidden = false; sfx.alarm(); banner('Warning: dreadnought', 'Hit the orange pods, then the core', 2.6); }
    return e;
  }

  // ---------- state ----------
  const state = {
    running: false, paused: false, over: false, score: 0, best: store.get('best', 0), wave: 0, combo: 1, comboT: 0, kills: 0,
    hp: 100, shield: 0, bombs: 2, spreadT: 0, rapidT: 0, dashCd: 0, invuln: 0, fireT: 0, queue: [], breather: 0, shake: 0, slow: 1, boss: null,
    pos: new THREE.Vector3(0, -2, PLAYER_Z), vel: new THREE.Vector3(), autofire: store.get('autofire', true),
  };
  $('best').textContent = state.best.toLocaleString();

  // ---------- waves ----------
  const FORMATIONS = {
    vee: w => { const n = 5; for (let i = 0; i < n; i++) queue(i * 0.12, 'drone', (i - 2) * 3.4, 3 - Math.abs(i - 2) * 1.6); },
    line: w => { for (let i = 0; i < 6; i++) queue(i * 0.35, 'drone', rand(-12, 12), rand(-5, 6)); },
    rocks: w => { const n = 5 + Math.min(8, w); for (let i = 0; i < n; i++) queue(i * 0.4, 'rock', rand(-14, 14), rand(-7, 7), { size: rand(0.8, 1.7) }); },
    swarm: w => { const n = 3 + Math.min(6, Math.floor(w / 2)); for (let i = 0; i < n; i++) queue(i * 0.3, 'kamikaze', rand(-14, 14), rand(-7, 7)); },
    cruiser: w => { queue(0, 'cruiser', rand(-6, 6), rand(-1, 4)); queue(0.4, 'drone', -9, 2); queue(0.4, 'drone', 9, 2); },
  };
  function queue(t, type, x, y, opts) { state.queue.push({ t: state.clock + t + state.queueOffset, type, x, y, opts }); }
  function nextWave() {
    state.wave++;
    state.queue = []; state.queueOffset = 1.2;
    sfx.wave();
    sfx.intensity = Math.min(1, 0.15 + state.wave * 0.1);
    if (state.wave % 5 === 0) {
      banner(`Wave ${state.wave}`, 'Boss incoming', 2);
      queue(1.5, 'boss', 0, 2, { vz: 26 });
      return;
    }
    banner(`Wave ${state.wave}`, state.wave === 1 ? 'Move with WASD or the mouse. Shoot everything.' : ['Keep the chain going', 'Rocks split: watch the pieces', 'Kamikazes steer at you: dash', 'Cruisers fire in fans'][state.wave % 4], 1.8);
    const pool = ['vee', 'line', 'rocks'];
    if (state.wave >= 2) pool.push('swarm');
    if (state.wave >= 3) pool.push('cruiser');
    const groups = 2 + Math.floor(state.wave * 0.7);
    for (let g = 0; g < groups; g++) {
      FORMATIONS[pool[Math.floor(Math.random() * pool.length)]](state.wave);
      state.queueOffset += Math.max(1.8, 4.2 - state.wave * 0.18);
    }
  }

  // ---------- input ----------
  const keys = new Set();
  const pointer = { active: false, x: 0, y: 0, down: false };
  addEventListener('keydown', e => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    keys.add(e.code);
    if (e.repeat) return;
    if (!state.running) { if ((e.code === 'Enter' || e.code === 'Space') && !state.paused) startGame(); return; }
    if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
    if (state.paused) return;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyK') dash();
    if (e.code === 'KeyB' || e.code === 'KeyE') bomb();
    if (e.code === 'KeyF') { state.autofire = !state.autofire; store.set('autofire', state.autofire); toast(state.autofire ? 'Autofire on' : 'Autofire off: hold Space or click'); }
    if (e.code === 'KeyM') setMuted(!sfx.muted);
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) pointer.active = false;
  });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => { keys.clear(); pointer.down = false; });
  const stage = renderer.domElement;
  let touchStart = null, lastTap = 0;
  stage.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') {
      if (!touchStart) return;
      // relative steering: drag anywhere, the ship follows the finger's movement
      const k = 34 / Math.min(innerWidth, innerHeight);
      pointer.x = clamp(touchStart.sx + (e.clientX - touchStart.x) * k, -BOUNDS.x, BOUNDS.x);
      pointer.y = clamp(touchStart.sy - (e.clientY - touchStart.y) * k, -BOUNDS.y, BOUNDS.y);
    } else {
      pointer.x = ((e.clientX / innerWidth) * 2 - 1) * BOUNDS.x * 1.15;
      pointer.y = (-(e.clientY / innerHeight) * 2 + 1) * BOUNDS.y * 1.25 + 1;
    }
    pointer.active = true;
  });
  stage.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') {
      touchStart = { x: e.clientX, y: e.clientY, sx: state.pos.x, sy: state.pos.y };
      const now = performance.now(); if (now - lastTap < 280) bomb(); lastTap = now;
      pointer.x = state.pos.x; pointer.y = state.pos.y; pointer.active = true;
    } else pointer.down = true;
  });
  addEventListener('pointerup', e => { if (e.pointerType === 'touch') touchStart = null; else pointer.down = false; });
  $('dash-btn').addEventListener('pointerdown', e => { e.stopPropagation(); dash(); });
  $('bomb-btn').addEventListener('pointerdown', e => { e.stopPropagation(); bomb(); });

  // ---------- actions ----------
  const v3 = new THREE.Vector3();
  function fire() {
    const rapid = state.rapidT > 0, spread = state.spreadT > 0;
    state.fireT = rapid ? 0.065 : 0.11;
    // light aim assist: the main guns bend towards an enemy inside a narrow cone ahead
    let target = null, bestA = 0.16;
    for (const e of enemies) {
      const dz = state.pos.z - e.pos.z; if (dz < 12 || e.dead) continue;
      const a = Math.hypot(e.pos.x - state.pos.x, e.pos.y - state.pos.y) / dz;
      if (a < bestA) { bestA = a; target = e; }
    }
    const shots = [[-0.75, 0], [0.75, 0]];
    if (spread) shots.push([-1.6, -7], [1.6, 7], [0, 0]);
    for (const [dx, vx] of shots) {
      const m = lasers.get(); if (!m) break;
      m.position.set(state.pos.x + dx, state.pos.y, state.pos.z - 1.6);
      if (target && vx === 0) {
        const lead = target.pos.clone().addScaledVector(target.vel, (state.pos.z - target.pos.z) / 140);
        m.userData.v.copy(lead.sub(m.position)).normalize().multiplyScalar(140);
      } else m.userData.v.set(vx + state.vel.x * 0.2, state.vel.y * 0.2, -140);
      m.lookAt(m.position.clone().add(m.userData.v));
    }
    sfx.laser();
  }
  function enemyFire(e, aim = true, spreadN = 1, speed = 30) {
    for (let i = 0; i < spreadN; i++) {
      const m = orbs.get(); if (!m) return;
      m.position.copy(e.pos).add(v3.set(0, 0, e.r * 0.6));
      // aim where the ship will be, not where it is
      const target = state.pos.clone().addScaledVector(state.vel, aim ? clamp((state.pos.z - e.pos.z) / speed, 0, 2) * 0.6 : 0);
      const dir = target.sub(m.position).normalize();
      if (spreadN > 1) dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), (i - (spreadN - 1) / 2) * 0.13).applyAxisAngle(new THREE.Vector3(1, 0, 0), (Math.random() - 0.5) * 0.05);
      m.userData.v.copy(dir).multiplyScalar(speed * (1 + state.wave * 0.02));
    }
    sfx.enemyShot();
  }
  function dash() {
    if (!state.running || state.dashCd > 0) return;
    const dir = new THREE.Vector3(inputX(), inputY(), 0);
    if (dir.lengthSq() < 0.01) dir.set(Math.sign(state.vel.x) || 1, 0, 0);
    state.vel.addScaledVector(dir.normalize(), 46);
    state.dashCd = 1.1; state.invuln = Math.max(state.invuln, 0.4);
    emit(state.pos, 40, '#56d9ff', 10, 1.4, 0.4);
    camera.fov += 8; sfx.dash();
  }
  function bomb() {
    if (!state.running || state.bombs <= 0) return;
    state.bombs--; sfx.bomb(); state.shake = 1.2;
    ringAt(state.pos, '#ffc94d', 1.2, 70);
    for (const m of orbs.items) if (m.visible) { emit(m.position, 4, '#ff6fae', 6, 1, 0.4); m.visible = false; }
    for (const e of [...enemies]) damage(e, e.type === 'boss' ? 25 : 30, v3.copy(e.pos).sub(state.pos).normalize().multiplyScalar(30));
    grid.material.uniforms.pulse.value = 1;
  }

  function ringAt(pos, color, life, grow) {
    const r = rings.get(); if (!r) return;
    r.position.copy(pos); r.scale.setScalar(0.5); r.material.color.copy(lin(color)); r.material.opacity = 1;
    r.userData.life = r.userData.max = life; r.userData.grow = grow;
  }

  function damage(e, dmg, impulse) {
    if (e.dead) return;
    e.hp -= dmg; e.flash = 1;
    if (impulse) e.vel.addScaledVector(impulse, 1 / e.mass);
    if (e.hp <= 0) kill(e);
    else sfx.hit();
  }

  function kill(e) {
    e.dead = true;
    const big = e.type === 'boss' ? 4 : e.type === 'cruiser' ? 2 : e.size || 1;
    emit(e.pos, Math.round(50 * big), TYPES[e.type].color, 16 * Math.sqrt(big), 2.2 * big, 0.9);
    emit(e.pos, Math.round(25 * big), '#ffffff', 22, 1.2, 0.35);
    ringAt(e.pos, TYPES[e.type].color, 0.6, 9 * big);
    for (let i = 0; i < Math.round(5 * big); i++) {
      const d = debris.get(); if (!d) break;
      d.position.copy(e.pos); d.userData.v.copy(e.vel).multiplyScalar(0.4).add(v3.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(14 * Math.sqrt(big)));
      d.userData.w.set(rand(-8, 8), rand(-8, 8), rand(-8, 8)); d.userData.life = rand(1, 2); d.scale.setScalar(rand(0.6, 1.8) * Math.sqrt(big));
    }
    sfx.boom(Math.min(2, big));
    state.shake = Math.min(1.5, state.shake + 0.25 * big);
    // the chain: every kill within two seconds of the last raises the multiplier
    state.combo = Math.min(10, state.combo + (e.type === 'rock' && e.size < 0.9 ? 0.25 : 0.5));
    state.comboT = 2.2;
    const pts = Math.round(e.score * Math.floor(state.combo));
    state.score += pts; state.kills++;
    popup(e.pos, `+${pts}`, TYPES[e.type].color);
    // asteroids break into pieces that carry the momentum on
    if (e.type === 'rock' && e.size > 0.75) {
      for (let i = 0; i < 2 + (e.size > 1.3 ? 1 : 0); i++) {
        const side = v3.set(rand(-1, 1), rand(-1, 1), 0).normalize().multiplyScalar(rand(4, 9));
        spawn('rock', e.pos.x, e.pos.y, e.pos.z, { size: e.size * 0.58, vel: e.vel.clone().add(side) });
      }
    }
    const dropChance = { drone: 0.08, kamikaze: 0.06, cruiser: 0.7, rock: 0.04, boss: 1 }[e.type];
    if (Math.random() < dropChance) dropPickup(e.pos, e.type === 'boss' ? 3 : 1);
    if (e.type === 'boss') { state.boss = null; $('boss').hidden = true; state.slow = 0.25; banner('Dreadnought down', `+${pts.toLocaleString()}`, 2); state.bombs++; }
  }

  // ---------- pickups ----------
  const PICKUPS = {
    spread: { color: '#56d9ff', label: 'Spread shot' }, rapid: { color: '#ffc94d', label: 'Rapid fire' },
    shield: { color: '#8c7cff', label: 'Shield' }, repair: { color: '#74df9b', label: 'Hull repaired' }, bomb: { color: '#ff9a3c', label: '+1 bomb' },
  };
  const pickups = [];
  function dropPickup(pos, n) {
    for (let i = 0; i < n; i++) {
      const keysP = Object.keys(PICKUPS), kind = state.hp < 50 && Math.random() < 0.4 ? 'repair' : keysP[Math.floor(Math.random() * keysP.length)];
      const m = new THREE.Group();
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0), emissive(PICKUPS[kind].color, 2.4));
      m.add(gem, glow(PICKUPS[kind].color, 4)); m.position.copy(pos).add(v3.set(rand(-2, 2), rand(-2, 2), 0)); scene.add(m);
      pickups.push({ kind, mesh: m, vel: new THREE.Vector3(rand(-3, 3), rand(-3, 3), 14), t: 0 });
    }
  }
  function collect(p) {
    const k = p.kind; sfx.pickup(); toast(PICKUPS[k].label);
    if (k === 'spread') state.spreadT = 12;
    if (k === 'rapid') state.rapidT = 10;
    if (k === 'shield') state.shield = 100;
    if (k === 'repair') state.hp = Math.min(100, state.hp + 35);
    if (k === 'bomb') state.bombs = Math.min(5, state.bombs + 1);
    state.score += 50 * Math.floor(state.combo);
    emit(p.mesh.position, 30, PICKUPS[k].color, 8, 1.5, 0.5);
  }

  function hurt(dmg) {
    if (state.invuln > 0 || state.over) return;
    state.invuln = 0.7; state.shake = 1;
    if (state.shield > 0) {
      state.shield -= dmg * 1.6; sfx.hit();
      shipMesh.userData.shield.material.opacity = 0.8;
      if (state.shield < 0) { state.hp += state.shield / 1.6; state.shield = 0; }
    } else { state.hp -= dmg; sfx.hurt(); $('flash').classList.remove('on'); void $('flash').offsetWidth; $('flash').classList.add('on'); }
    state.combo = Math.max(1, Math.floor(state.combo / 2));
    if (state.hp <= 0) die();
  }

  function die() {
    state.over = true; state.hp = 0; shipMesh.visible = false;
    emit(state.pos, 220, '#56d9ff', 26, 2.6, 1.4); emit(state.pos, 120, '#ffffff', 34, 1.4, 0.6);
    ringAt(state.pos, '#8c7cff', 1.2, 40); sfx.boom(2.5); state.shake = 2; state.slow = 0.3;
    setTimeout(() => {
      state.running = false;
      const best = state.score > state.best; if (best) { state.best = state.score; store.set('best', state.best); $('best').textContent = state.best.toLocaleString(); }
      $('final-score').textContent = state.score.toLocaleString();
      $('final-best').textContent = state.best.toLocaleString();
      $('final-wave').textContent = state.wave;
      $('final-kills').textContent = state.kills;
      $('new-best').hidden = !best;
      $('over').hidden = false; document.body.classList.remove('playing');
      $('again').focus();
      sfx.intensity = 0;
    }, 1600);
  }

  // ---------- UI helpers ----------
  let toastTimer, bannerTimer;
  function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 1400); }
  function banner(title, sub, dur) {
    $('banner-title').textContent = title; $('banner-sub').textContent = sub || '';
    const el = $('banner'); el.style.setProperty('--d', dur + 's'); el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(bannerTimer); bannerTimer = setTimeout(() => el.classList.remove('show'), dur * 1000);
  }
  const popLayer = $('pops');
  function popup(pos, text, color) {
    const p = pos.clone().project(camera);
    if (p.z > 1) return;
    const el = document.createElement('span'); el.className = 'pop'; el.textContent = text; el.style.color = color;
    el.style.left = ((p.x + 1) / 2 * innerWidth) + 'px'; el.style.top = ((1 - p.y) / 2 * innerHeight) + 'px';
    popLayer.appendChild(el); setTimeout(() => el.remove(), 900);
  }
  function setMuted(m) { sfx.setMuted(m); store.set('muted', m); $('mute').setAttribute('aria-pressed', m); }
  function togglePause(force) {
    if (!state.running) return;
    state.paused = force ?? !state.paused; $('pause').hidden = !state.paused;
    if (state.paused) $('resume').focus();
  }

  function clearWorld() {
    for (const e of enemies) scene.remove(e.mesh); enemies.length = 0;
    for (const p of pickups) scene.remove(p.mesh); pickups.length = 0;
    for (const pl of [lasers, orbs, debris, rings]) pl.items.forEach(o => { o.visible = false; });
    pLife.fill(0);
  }

  function startGame() {
    clearWorld();
    Object.assign(state, { running: true, paused: false, over: false, score: 0, wave: 0, combo: 1, comboT: 0, kills: 0, hp: 100, shield: 0, bombs: 2,
      spreadT: 0, rapidT: 0, dashCd: 0, invuln: 1.5, fireT: 0, queue: [], breather: 0, shake: 0, slow: 1, boss: null, clock: 0, queueOffset: 0 });
    state.pos.set(0, -2, PLAYER_Z); state.vel.set(0, 0, 0);
    shipMesh.visible = true;
    $('intro').hidden = true; $('over').hidden = true; $('pause').hidden = true; $('boss').hidden = true;
    document.body.classList.add('playing');
    sfx.start(); sfx.setMuted(store.get('muted', false));
    nextWave();
  }
  $('play').addEventListener('click', startGame);
  $('again').addEventListener('click', startGame);
  $('resume').addEventListener('click', () => togglePause(false));
  $('quit').addEventListener('click', () => { state.running = false; state.paused = false; $('pause').hidden = true; clearWorld(); $('intro').hidden = false; document.body.classList.remove('playing'); sfx.intensity = 0; });
  $('mute').addEventListener('click', () => setMuted(!sfx.muted));
  $('pause-btn').addEventListener('click', () => togglePause(true));

  const inputX = () => (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  const inputY = () => (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);

  // ---------- simulation ----------
  const sfx = new Sfx();
  state.clock = 0;

  function updatePlayer(dt) {
    const ix = inputX(), iy = inputY();
    let ax = 0, ay = 0;
    if (ix || iy || !pointer.active) {
      const len = Math.hypot(ix, iy) || 1;
      ax = (ix / len) * 95; ay = (iy / len) * 95;
      state.vel.multiplyScalar(Math.exp(-dt * 3.6));                     // thrusters and drag
    } else {
      // a damped spring towards the pointer: quick, but it still has weight
      ax = (pointer.x - state.pos.x) * 55 - state.vel.x * 12;
      ay = (pointer.y - state.pos.y) * 55 - state.vel.y * 12;
    }
    state.vel.x += ax * dt; state.vel.y += ay * dt;
    const sp = Math.hypot(state.vel.x, state.vel.y), max = state.invuln > 0.3 && state.dashCd > 0.7 ? 60 : 26;
    if (sp > max) { state.vel.x *= max / sp; state.vel.y *= max / sp; }
    state.pos.x += state.vel.x * dt; state.pos.y += state.vel.y * dt;
    // soft walls
    if (Math.abs(state.pos.x) > BOUNDS.x) { state.pos.x = Math.sign(state.pos.x) * BOUNDS.x; state.vel.x *= -0.3; }
    if (Math.abs(state.pos.y) > BOUNDS.y) { state.pos.y = Math.sign(state.pos.y) * BOUNDS.y; state.vel.y *= -0.3; }

    shipMesh.position.copy(state.pos);
    shipMesh.rotation.set(clamp(state.vel.y * 0.025, -0.5, 0.5), clamp(-state.vel.x * 0.012, -0.25, 0.25), clamp(-state.vel.x * 0.045, -1.1, 1.1));
    if (state.invuln > 0 && !state.over) shipMesh.visible = Math.floor(state.invuln * 18) % 2 === 0 || state.dashCd > 0.7;
    const sh = shipMesh.userData.shield;
    sh.material.opacity += ((state.shield > 0 ? 0.12 + Math.sin(state.clock * 6) * 0.04 : 0) - sh.material.opacity) * Math.min(1, dt * 6);
    sh.rotation.y += dt;
    const thrust = 1.4 + Math.min(1, Math.hypot(ax, ay) / 95) * 0.9 + Math.random() * 0.25;
    shipMesh.userData.flame1.scale.setScalar(thrust); shipMesh.userData['flame-1'].scale.setScalar(thrust);
    shipLight.position.copy(state.pos).add(v3.set(0, 1, 2));
    if (Math.random() < 0.6) emit(v3.copy(state.pos).add(new THREE.Vector3(rand(-0.8, 0.8), 0, 2.1)), 1, '#56d9ff', 1, 0.9, 0.25);

    state.fireT -= dt;
    const wantFire = state.autofire || keys.has('Space') || keys.has('KeyJ') || pointer.down;
    if (wantFire && state.fireT <= 0 && !state.over) fire();
  }

  function updateEnemies(dt) {
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (e.dead) { scene.remove(e.mesh); enemies.splice(i, 1); continue; }
      e.t += dt;
      const wavek = 1 + state.wave * 0.05;
      if (e.type === 'drone') {
        if (e.pos.z < e.hold) e.vel.z += (48 - e.vel.z) * dt * 2;
        else {
          const tx = e.anchorX + Math.sin(e.t * 1.3 + e.phase) * 6, ty = e.anchorY + Math.cos(e.t * 1.7 + e.phase) * 2.5;
          e.vel.x += ((tx - e.pos.x) * 3 - e.vel.x) * dt * 2; e.vel.y += ((ty - e.pos.y) * 3 - e.vel.y) * dt * 2;
          e.vel.z += ((e.t > 16 ? 40 : 0) - e.vel.z) * dt * 2;
          e.fireT -= dt * wavek; if (e.fireT <= 0) { enemyFire(e); e.fireT = rand(1.6, 2.8); }
        }
        e.mesh.rotation.z = -e.vel.x * 0.05;
      } else if (e.type === 'kamikaze') {
        // steering behaviour: turn towards the ship with limited agility
        if (e.pos.z > -95) {
          const desired = v3.copy(state.pos).sub(e.pos).normalize().multiplyScalar(38 * wavek);
          e.vel.lerp(desired, Math.min(1, dt * (e.pos.z < -20 ? 1.8 : 0.3)));
        } else e.vel.z += (40 - e.vel.z) * dt;
        e.mesh.rotation.x += dt * 4; e.mesh.rotation.y += dt * 5;
      } else if (e.type === 'cruiser') {
        if (e.pos.z < -58) e.vel.z += (24 - e.vel.z) * dt;
        else {
          e.vel.z += ((e.t > 26 ? 20 : 0) - e.vel.z) * dt;
          e.vel.x += ((Math.sin(e.t * 0.5) * 8 - e.pos.x) * 0.6 - e.vel.x) * dt;
          e.fireT -= dt * wavek; if (e.fireT <= 0) { enemyFire(e, false, 5, 24); e.fireT = rand(2.2, 3); }
        }
      } else if (e.type === 'rock') {
        e.mesh.rotation.x += e.spin.x * dt; e.mesh.rotation.y += e.spin.y * dt; e.mesh.rotation.z += e.spin.z * dt;
      } else if (e.type === 'boss') {
        if (e.pos.z < -58) e.vel.z += (26 - e.vel.z) * dt;
        else {
          e.vel.z *= Math.exp(-dt * 3);
          e.vel.x += ((Math.sin(e.t * 0.45) * 8 - e.pos.x) * 0.8 - e.vel.x) * dt;
          e.vel.y += ((Math.sin(e.t * 0.7) * 3 + 2 - e.pos.y) * 0.8 - e.vel.y) * dt;
          e.fireT -= dt;
          if (e.fireT <= 0) {
            const phase = Math.floor(e.t / 6) % 3;
            if (phase === 0) { enemyFire(e, true, 7, 26); e.fireT = 1.4; }
            else if (phase === 1) {                                    // a spiral
              for (let k = 0; k < 2; k++) {
                const m = orbs.get(); if (!m) break;
                const a = e.t * 3 + k * Math.PI;
                m.position.copy(e.pos); m.userData.v.set(Math.cos(a) * 9, Math.sin(a) * 6, 26);
              }
              e.fireT = 0.09;
            } else { for (let k = 0; k < 3; k++) setTimeout(() => !e.dead && enemyFire(e, true, 1, 40), k * 120); e.fireT = 1.1; }
          }
        }
        e.mesh.userData.spin.rotation.z += dt * 0.8;
        $('boss-bar').style.transform = `scaleX(${Math.max(0, e.hp) / (TYPES.boss.hp * (1 + (state.wave - 1) * 0.09))})`;
      }
      e.pos.addScaledVector(e.vel, dt);
      e.mesh.position.copy(e.pos);
      if (e.flash > 0) {
        e.flash = Math.max(0, e.flash - dt * 6);
        e.mesh.traverse(o => { if (o.userData.baseEmissive !== undefined) o.material.emissiveIntensity = o.userData.baseEmissive + e.flash * 6; });
      }
      // out of the arena
      if (e.pos.z > 30 || Math.abs(e.pos.x) > 70 || Math.abs(e.pos.y) > 50) { scene.remove(e.mesh); enemies.splice(i, 1); continue; }
      // ram the ship
      if (!state.over && e.pos.distanceTo(state.pos) < e.r + 1.2) {
        hurt(e.type === 'boss' ? 40 : e.type === 'kamikaze' ? 28 : e.type === 'rock' ? 14 * e.size : 20);
        if (e.type !== 'boss') damage(e, 999);
        state.vel.addScaledVector(v3.copy(state.pos).sub(e.pos).normalize(), 20);
      }
    }
    // rocks shoulder each other apart: equal and opposite impulses by mass
    for (let a = 0; a < enemies.length; a++) for (let b = a + 1; b < enemies.length; b++) {
      const A = enemies[a], B = enemies[b];
      if (A.type !== 'rock' && B.type !== 'rock') continue;
      const d = v3.copy(B.pos).sub(A.pos), dist = d.length(), min = A.r + B.r;
      if (dist > 0 && dist < min) {
        d.divideScalar(dist);
        const rel = B.vel.clone().sub(A.vel).dot(d);
        if (rel < 0) { const j = -1.6 * rel / (1 / A.mass + 1 / B.mass); A.vel.addScaledVector(d, -j / A.mass); B.vel.addScaledVector(d, j / B.mass); }
        const push = (min - dist) / 2; A.pos.addScaledVector(d, -push); B.pos.addScaledVector(d, push);
      }
    }
  }

  const segA = new THREE.Vector3(), segD = new THREE.Vector3(), segP = new THREE.Vector3();
  function updateShots(dt) {
    for (const m of lasers.items) {
      if (!m.visible) continue;
      // swept test: lasers cover several metres a frame, so check the whole segment
      segA.copy(m.position);
      m.position.addScaledVector(m.userData.v, dt);
      if (m.position.z < -320) { m.visible = false; continue; }
      segD.copy(m.position).sub(segA);
      const segL2 = segD.lengthSq();
      for (const e of enemies) {
        if (e.dead || e.pos.z > segA.z + e.r + 1 || e.pos.z < m.position.z - e.r - 1) continue;
        const t = clamp(v3.copy(e.pos).sub(segA).dot(segD) / segL2, 0, 1);
        const hitPoint = segP.copy(segA).addScaledVector(segD, t);
        if (hitPoint.distanceTo(e.pos) < e.r + 0.4) {
          m.position.copy(hitPoint);
          // the boss core is shielded until the pods are gone
          let dmg = 1;
          if (e.type === 'boss') {
            const pods = e.mesh.userData.spin.children.filter(p => p.visible);
            const hitPod = pods.find(p => p.getWorldPosition(new THREE.Vector3()).distanceTo(m.position) < 1.8);
            if (hitPod) { hitPod.userData.hp = (hitPod.userData.hp ?? 14) - 1; dmg = 0.5; if (hitPod.userData.hp <= 0) { hitPod.visible = false; emit(m.position, 60, '#ff9a3c', 14, 2, 0.8); sfx.boom(1.2); state.score += 500 * Math.floor(state.combo); } }
            else if (pods.length) { dmg = 0.15; emit(m.position, 3, '#8c7cff', 6, 0.8, 0.2); }
            else dmg = 1.2;
          }
          damage(e, dmg, v3.set(0, 0, -6));
          emit(m.position, 6, '#56d9ff', 9, 0.9, 0.25);
          m.visible = false; break;
        }
      }
    }
    for (const m of orbs.items) {
      if (!m.visible) continue;
      segA.copy(m.position);
      m.position.addScaledVector(m.userData.v, dt);
      if (m.position.z > 25 || Math.abs(m.position.x) > 60 || Math.abs(m.position.y) > 40) { m.visible = false; continue; }
      segD.copy(m.position).sub(segA);
      const tt = clamp(v3.copy(state.pos).sub(segA).dot(segD) / segD.lengthSq(), 0, 1);
      if (!state.over && segP.copy(segA).addScaledVector(segD, tt).distanceTo(state.pos) < 1.15) { m.visible = false; hurt(12); emit(m.position, 16, '#ff6fae', 8, 1.2, 0.3); }
    }
  }

  function updateFx(dt) {
    for (let j = 0; j < P; j++) {
      if (pLife[j] <= 0) { if (pSize[j]) pSize[j] = 0; continue; }
      pLife[j] -= dt;
      const k = Math.max(0, pLife[j] / pMax[j]), drag = Math.exp(-dt * 2.2);
      pVel[j * 3] *= drag; pVel[j * 3 + 1] *= drag; pVel[j * 3 + 2] *= drag;
      pPos[j * 3] += pVel[j * 3] * dt; pPos[j * 3 + 1] += pVel[j * 3 + 1] * dt; pPos[j * 3 + 2] += (pVel[j * 3 + 2] + 8) * dt;
      pCol[j * 3] *= 0.985 + k * 0.015; pCol[j * 3 + 1] *= 0.975 + k * 0.025; pCol[j * 3 + 2] *= 0.985 + k * 0.015;
      if (pLife[j] <= 0) pSize[j] = 0;
    }
    pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true; pGeo.attributes.size.needsUpdate = true;
    for (const d of debris.items) {
      if (!d.visible) continue;
      const u = d.userData; u.life -= dt;
      u.v.multiplyScalar(Math.exp(-dt * 0.8)); u.v.z += 6 * dt;
      d.position.addScaledVector(u.v, dt);
      d.rotation.x += u.w.x * dt; d.rotation.y += u.w.y * dt; d.rotation.z += u.w.z * dt;
      if (u.life <= 0) d.visible = false; else if (u.life < 0.4) d.scale.multiplyScalar(0.92);
    }
    for (const r of rings.items) {
      if (!r.visible) continue;
      const u = r.userData; u.life -= dt;
      const k = 1 - u.life / u.max;
      r.scale.setScalar(0.5 + k * u.grow); r.material.opacity = Math.max(0, 1 - k) * 0.9;
      r.lookAt(camera.position);
      if (u.life <= 0) r.visible = false;
    }
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i]; p.t += dt;
      const d = v3.copy(state.pos).sub(p.mesh.position), dist = d.length();
      if (dist < 9 && !state.over) p.vel.addScaledVector(d.normalize(), 70 * dt);     // magnet
      p.vel.multiplyScalar(Math.exp(-dt * 0.8)); p.vel.z += 6 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.children[0].rotation.y += dt * 3; p.mesh.children[0].rotation.x += dt * 1.3;
      if (dist < 1.8 && !state.over) { collect(p); scene.remove(p.mesh); pickups.splice(i, 1); }
      else if (p.mesh.position.z > 25 || p.t > 14) { scene.remove(p.mesh); pickups.splice(i, 1); }
    }
  }

  // ---------- HUD ----------
  const hud = { score: $('score'), combo: $('combo'), wave: $('wave'), hp: $('hp'), shield: $('shield'), bombs: $('bombs'), dash: $('dash-fill'), pw: $('powers') };
  let hudT = 0, shownScore = 0;
  function updateHud(dt) {
    shownScore += (state.score - shownScore) * Math.min(1, dt * 10);
    hud.score.textContent = Math.round(shownScore).toLocaleString();
    hudT -= dt; if (hudT > 0) return; hudT = 0.05;
    const c = Math.floor(state.combo);
    hud.combo.textContent = `×${c}`;
    hud.combo.parentElement.classList.toggle('hot', c >= 4);
    hud.combo.parentElement.style.setProperty('--chain', Math.max(0, state.comboT / 2.2));
    hud.wave.textContent = state.wave;
    hud.hp.style.transform = `scaleX(${Math.max(0, state.hp) / 100})`;
    hud.hp.parentElement.classList.toggle('low', state.hp < 35);
    hud.shield.style.transform = `scaleX(${state.shield / 100})`;
    hud.bombs.textContent = '●'.repeat(state.bombs) || '–';
    hud.dash.style.transform = `scaleX(${1 - Math.max(0, state.dashCd) / 1.1})`;
    const pw = [];
    if (state.spreadT > 0) pw.push(`<span style="--c:#56d9ff">Spread ${Math.ceil(state.spreadT)}</span>`);
    if (state.rapidT > 0) pw.push(`<span style="--c:#ffc94d">Rapid ${Math.ceil(state.rapidT)}</span>`);
    hud.pw.innerHTML = pw.join('');
  }

  // ---------- loop ----------
  let last = performance.now(), camShake = new THREE.Vector3(), attract = 0;
  function frame(now) {
    const raw = Math.min(0.05, (now - last) / 1000); last = now;
    state.slow += (1 - state.slow) * Math.min(1, raw * 1.5);
    const dt = raw * state.slow;
    const playing = state.running && !state.paused;

    if (playing) {
      state.clock += dt;
      state.dashCd -= dt; state.invuln -= dt; state.spreadT -= dt; state.rapidT -= dt;
      state.comboT -= dt; if (state.comboT <= 0 && state.combo > 1) { state.combo = Math.max(1, state.combo - dt * 2); }
      if (!state.over) updatePlayer(dt);
      while (state.queue.length && state.queue[0].t <= state.clock) {
        const q = state.queue.shift(); spawn(q.type, q.x, q.y, -200, q.opts || {});
      }
      state.queue.sort((a, b) => a.t - b.t);
      updateEnemies(dt); updateShots(dt);
      if (!state.over && !state.queue.length && !enemies.some(e => e.type !== 'rock' || e.pos.z < -40)) {
        state.breather += dt;
        if (state.breather > 1.2) { state.breather = 0; state.hp = Math.min(100, state.hp + 8); nextWave(); }
      }
      updateHud(dt);
    } else if (!state.running) {
      // attract mode: the ship idles and drifts while the menu is up
      attract += raw;
      state.pos.set(Math.sin(attract * 0.6) * 4, -1.5 + Math.sin(attract * 0.9) * 1.2, PLAYER_Z);
      state.vel.set(Math.cos(attract * 0.6) * 2.4, Math.cos(attract * 0.9) * 1.1, 0);
      shipMesh.position.copy(state.pos);
      shipMesh.rotation.set(state.vel.y * 0.05, 0, -state.vel.x * 0.12);
      if (Math.random() < 0.6) emit(v3.copy(state.pos).add(new THREE.Vector3(rand(-0.8, 0.8), 0, 2.1)), 1, '#56d9ff', 1, 0.9, 0.25);
    }
    if (!state.paused) updateFx(state.running ? dt : raw);

    // backdrop moves at cruising speed, faster during a dash
    const speed = (state.running && state.dashCd > 0.7 ? 260 : 120) * (state.paused ? 0 : 1) * (state.running ? dt : raw);
    const sp = stars.geometry.attributes.position.array;
    for (let i = 2; i < sp.length; i += 3) { sp[i] += speed; if (sp[i] > -20) sp[i] -= 880; }
    stars.geometry.attributes.position.needsUpdate = true;
    grid.material.uniforms.t.value -= speed * 0.9;
    grid.material.uniforms.pulse.value *= Math.exp(-raw * 2);
    ring.rotation.z += raw * 0.01; planet.rotation.y += raw * 0.02;

    // camera: follows the ship loosely, shakes on impacts
    state.shake *= Math.exp(-raw * 5);
    camShake.set(rand(-1, 1), rand(-1, 1), 0).multiplyScalar(state.shake * 0.5);
    const cx = state.pos.x * 0.5, cy = 3.4 + state.pos.y * 0.55;
    camera.position.x += (cx - camera.position.x) * Math.min(1, raw * 4);
    camera.position.y += (cy - camera.position.y) * Math.min(1, raw * 4);
    camera.position.z = 15;
    camera.position.add(camShake);
    camera.lookAt(state.pos.x * 0.35, state.pos.y * 0.5 + 0.4, -30);
    camera.rotation.z += -state.vel.x * 0.002;
    const baseFov = camera.aspect < 1 ? 82 : 62;
    camera.fov += (baseFov - camera.fov) * Math.min(1, raw * 3); camera.updateProjectionMatrix();

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(t => { last = t; $('loading').hidden = true; frame(t); });
  $('mute').setAttribute('aria-pressed', store.get('muted', false));
  window.__sd = { state, enemies, spawn, startGame, fps: () => 0 };
})();
