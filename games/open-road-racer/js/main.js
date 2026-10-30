/* Open Road: game loop, camera, light and weather, input and the small amount of UI. */

'use strict';

(function () {
  const $ = id => document.getElementById(id);
  const store = {
    get(k, d) { try { const v = localStorage.getItem('openroad.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('openroad.' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };

  const settings = {
    time: store.get('time', 'golden'), weather: store.get('weather', 'clear'), colour: store.get('colour', 'laterite'),
    quality: store.get('quality', matchMedia('(pointer: coarse)').matches ? 'low' : 'high'),
    difficulty: store.get('difficulty', 'normal'), muted: store.get('muted', false),
  };

  // ---------- three.js setup ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  $('stage').appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xb9c8d4, 60, 700);
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 2400);

  const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x2a2418, 0.8);
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 220 });
  sun.shadow.bias = -0.0006;
  scene.add(hemi, sun, sun.target);

  const sky = new Sky(scene);
  const rain = new Rain(scene);
  const world = new World(scene);
  const car = new Car(scene, world);
  const sound = new Sound();
  car.odometer = store.get('odometer', 0);

  // ---------- time of day and weather ----------
  const KEYS = [   // sun elevation -> palette
    { e: -0.25, top: '#060a16', hor: '#121a2c', fog: '#0c1120', sun: '#8796b8', sunI: 0.2, hemiI: 0.4, hemiSky: '#3a4a70', exp: 1.4 },
    { e: -0.04, top: '#1c2350', hor: '#c46a52', fog: '#5a4658', sun: '#ff9a6a', sunI: 0.5, hemiI: 0.4, hemiSky: '#8a7aa8', exp: 1.15 },
    { e: 0.13, top: '#38589a', hor: '#f0b07c', fog: '#c89a80', sun: '#ffc48a', sunI: 2.0, hemiI: 0.65, hemiSky: '#bfc6e6', exp: 1.05 },
    { e: 0.5, top: '#2c6cc0', hor: '#b8d2e6', fog: '#a8c2d4', sun: '#fff4e2', sunI: 2.6, hemiI: 0.85, hemiSky: '#cfe3ff', exp: 1 },
  ].map(k => ({ ...k, top: lin(k.top), hor: lin(k.hor), fog: lin(k.fog), sun: lin(k.sun), hemiSky: lin(k.hemiSky) }));
  const TIMES = { dawn: 0.256, day: 0.42, golden: 0.728, night: 0.02 };
  const grey = lin('#7f8a93');
  let tod = TIMES[settings.time] ?? TIMES.golden;
  let wet = settings.weather === 'monsoon' ? 1 : 0, wetShown = wet;
  const tmp = { top: new THREE.Color(), hor: new THREE.Color(), fog: new THREE.Color(), sun: new THREE.Color(), hemiSky: new THREE.Color() };
  const sunDir = new THREE.Vector3();

  function applyLight() {
    const e = Math.sin((tod - 0.25) * Math.PI * 2), az = (tod - 0.25) * Math.PI * 2;
    sunDir.set(Math.cos(az) * 0.8, e, Math.sin(az) * 0.6 + 0.3).normalize();
    let i = 0; while (i < KEYS.length - 2 && e > KEYS[i + 1].e) i++;
    const a = KEYS[i], b = KEYS[i + 1], t = THREE.MathUtils.clamp((e - a.e) / (b.e - a.e), 0, 1);
    for (const k of ['top', 'hor', 'fog', 'sun', 'hemiSky']) tmp[k].copy(a[k]).lerp(b[k], t);
    let sunI = THREE.MathUtils.lerp(a.sunI, b.sunI, t), hemiI = THREE.MathUtils.lerp(a.hemiI, b.hemiI, t);
    const exp = THREE.MathUtils.lerp(a.exp, b.exp, t);
    const night = THREE.MathUtils.clamp((0.02 - e) * 5, 0, 1);
    // the monsoon greys everything out and pulls the fog in
    const w = wetShown;
    const g = grey.clone().multiplyScalar(THREE.MathUtils.lerp(1, 0.18, night));
    tmp.top.lerp(g, w * 0.85); tmp.hor.lerp(g, w * 0.7); tmp.fog.lerp(g, w * 0.75);
    sunI *= 1 - w * 0.7; hemiI *= 1 + w * 0.1;

    sky.uniforms.top.value.copy(tmp.top); sky.uniforms.horizon.value.copy(tmp.hor);
    sky.uniforms.sunDir.value.copy(e > -0.1 ? sunDir : sunDir.clone().negate());    // the moon when it is dark
    sky.uniforms.sunColor.value.copy(tmp.sun).multiplyScalar(e > -0.1 ? 1 : 0.25);
    sky.uniforms.haze.value = w * 0.85;
    for (const r of sky.ridges) r.material.color.copy(tmp.fog).lerp(tmp.hor, 0.35).multiplyScalar(0.88);
    scene.fog.color.copy(tmp.fog);
    scene.fog.near = THREE.MathUtils.lerp(70, 18, w);
    scene.fog.far = THREE.MathUtils.lerp(settings.quality === 'low' ? 520 : 760, 230, w);
    sun.color.copy(tmp.sun); sun.intensity = sunI;
    hemi.color.copy(tmp.hemiSky); hemi.groundColor.copy(lin('#2a2418')).multiplyScalar(1 - night * 0.8); hemi.intensity = hemiI;
    renderer.toneMappingExposure = exp;
    renderer.setClearColor(tmp.fog.clone().convertLinearToSRGB());
    car.setLights(e < 0.06 || w > 0.6);
    return e;
  }

  // ---------- quality ----------
  function applyQuality() {
    const low = settings.quality === 'low';
    renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1 : 1.75));
    renderer.shadowMap.enabled = !low;
    sun.castShadow = !low;
    world.treeDensity = low ? 0.55 : 1;
    world.ahead = low ? 6 : 9;
    world.rebuildAll();
    resize();
  }

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);

  // ---------- input ----------
  const keys = new Set();
  const touch = { left: 0, right: 0, gas: 0, brake: 0 };
  let autodrive = true, started = false, paused = false;
  const CONTROL_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];

  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (CONTROL_KEYS.includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    keys.add(e.code);
    if (!started) return;
    if (e.code === 'Escape') return togglePause();
    if (paused) return;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && autodrive) setAuto(false);
    if (e.code === 'KeyF') setAuto(!autodrive);
    if (e.code === 'KeyC') cycleCamera();
    if (e.code === 'KeyR') { car.reset(car.s); toast('Back on the road'); }
    if (e.code === 'KeyM') setMuted(!settings.muted);
  });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  document.querySelectorAll('[data-touch]').forEach(btn => {
    const k = btn.dataset.touch;
    const on = e => { e.preventDefault(); touch[k] = 1; btn.classList.add('on'); if (autodrive && started) setAuto(false); };
    const off = e => { e.preventDefault(); touch[k] = 0; btn.classList.remove('on'); };
    btn.addEventListener('pointerdown', on); btn.addEventListener('pointerup', off);
    btn.addEventListener('pointercancel', off); btn.addEventListener('pointerleave', off);
  });

  function readInput() {
    const k = c => keys.has(c);
    return {
      throttle: k('KeyW') || k('ArrowUp') || touch.gas ? 1 : 0,
      brake: k('KeyS') || k('ArrowDown') || touch.brake ? 1 : 0,
      steer: (k('KeyD') || k('ArrowRight') || touch.right ? 1 : 0) - (k('KeyA') || k('ArrowLeft') || touch.left ? 1 : 0),
      handbrake: k('Space'),
    };
  }

  // ---------- camera ----------
  const CAMS = ['chase', 'far', 'hood', 'cinematic'];
  let camMode = 'chase', camAngle = 0;
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), v3 = new THREE.Vector3();
  function cycleCamera() {
    camMode = CAMS[(CAMS.indexOf(camMode) + 1) % CAMS.length];
    toast({ chase: 'Chase camera', far: 'Wide chase camera', hood: 'Bonnet camera', cinematic: 'Cinematic camera' }[camMode]);
  }

  function updateCamera(dt, snap) {
    const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
    const base = new THREE.Vector3(car.x, car.y, car.z);
    let want, look, lerp = 1 - Math.exp(-dt * 5);
    if (camMode === 'hood') {
      want = base.clone().add(v3.set(fx * 0.9, 1.3, fz * 0.9));
      want.y = car.mesh.position.y + 1.3 + car.pitch * 0.9;
      look = base.clone().add(v3.set(fx * 30, 0.9, fz * 30));
      lerp = 1;
    } else if (camMode === 'cinematic') {
      camAngle += dt * 0.12;
      const r = 11 + Math.sin(camAngle * 0.7) * 3;
      want = base.clone().add(v3.set(Math.sin(camAngle) * r, 2.2 + Math.sin(camAngle * 0.5) * 1.2, Math.cos(camAngle) * r));
      want.y = Math.max(want.y, world.road.ground(car.s, car.d) + 1.2);
      look = base.clone().add(v3.set(0, 0.8, 0));
      lerp = 1 - Math.exp(-dt * 3);
    } else {
      const far = camMode === 'far', tall = camera.aspect < 1 ? 1.45 : 1;   // portrait phones need more room
      const back = ((far ? 10.5 : 6.4) + car.v * 0.03) * tall, up = (far ? 3.6 : 2.15) * tall;
      want = base.clone().add(v3.set(-fx * back, up, -fz * back));
      look = base.clone().add(v3.set(fx * 5, 1.05, fz * 5));
      // never let the camera sink into the ground on a crest
      const behind = world.road.ground(Math.max(0, car.s - back), car.d);
      want.y = Math.max(want.y, behind + 1.2);
    }
    if (snap) { camPos.copy(want); camLook.copy(look); }
    camPos.lerp(want, lerp); camLook.lerp(look, camMode === 'hood' ? 1 : 1 - Math.exp(-dt * 8));
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    const fov = (camMode === 'hood' ? 70 : 60) + Math.min(14, car.kmh * 0.07);
    camera.fov += (fov - camera.fov) * Math.min(1, dt * 2);
    camera.updateProjectionMatrix();
  }

  // ---------- UI ----------
  let toastTimer;
  function toast(text) {
    const el = $('toast'); el.textContent = text; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
  }

  function setAuto(on) {
    autodrive = on;
    $('auto').classList.toggle('on', on);
    $('auto').setAttribute('aria-pressed', on);
    if (started) toast(on ? 'Autodrive on: sit back' : 'You are driving');
  }

  function setMuted(m) {
    settings.muted = m; store.set('muted', m); sound.setMuted(m);
    $('mute').classList.toggle('on', m); $('mute').setAttribute('aria-pressed', m);
  }

  function togglePause(force) {
    paused = force ?? !paused;
    $('menu').hidden = !paused;
    document.body.classList.toggle('paused', paused);
    if (paused) $('resume').focus();
  }

  function bindChoice(name, apply) {
    const group = document.querySelector(`[data-setting="${name}"]`);
    const mark = () => group.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.value === settings[name]));
    group.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      settings[name] = b.dataset.value; store.set(name, settings[name]); mark(); apply(settings[name]);
    });
    mark();
  }
  bindChoice('time', v => { if (v !== 'cycle') tod = TIMES[v]; });
  bindChoice('weather', v => { wet = v === 'monsoon' ? 1 : 0; rain.mesh.visible = !!wet && settings.quality !== 'low'; world.setWet(wet); world.rebuildAll(); });
  bindChoice('colour', v => car.setColour(v));
  bindChoice('quality', () => applyQuality());
  bindChoice('difficulty', v => { car.difficulty = v; });

  $('resume').addEventListener('click', () => togglePause(false));
  $('menu-btn').addEventListener('click', () => togglePause(true));
  $('auto').addEventListener('click', () => setAuto(!autodrive));
  $('cam').addEventListener('click', cycleCamera);
  $('mute').addEventListener('click', () => setMuted(!settings.muted));
  $('reset').addEventListener('click', () => { car.reset(car.s); togglePause(false); });

  function begin(auto) {
    started = true;
    sound.start(); sound.setMuted(settings.muted);
    document.body.classList.add('driving');
    $('intro').classList.add('gone');
    setAuto(auto);
    if (!auto) car.v = Math.max(car.v, 8);
    renderer.domElement.focus();
  }
  $('drive').addEventListener('click', () => begin(false));
  $('cruise').addEventListener('click', () => begin(true));

  // ---------- loop ----------
  car.setColour(settings.colour);
  car.difficulty = settings.difficulty;
  world.setWet(wet);
  rain.mesh.visible = !!wet && settings.quality !== 'low';
  setMuted(settings.muted);
  applyQuality();
  // build the first stretch of road before the first frame
  for (let i = 0; i < 12; i++) world.update(car.s);
  car.update(0.016, { throttle: 0, brake: 0, steer: 0, handbrake: false });
  updateCamera(0.016, true);

  let last = performance.now(), lastKm = Math.floor(car.s / 1000), saveTimer = 0, fpsAvg = 60, hudTimer = 0;
  const hud = { speed: $('speed'), gear: $('gear'), dist: $('dist'), total: $('total') };

  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    fpsAvg += (1 / Math.max(dt, 1e-3) - fpsAvg) * 0.02;

    if (!paused) {
      if (settings.time === 'cycle') tod = (tod + dt / 720) % 1;      // a day lasts twelve minutes
      // fixed physics steps, so a slow frame never turns into slow motion
      const steps = Math.ceil(dt / (1 / 60));
      for (let i = 0; i < steps; i++) {
        const input = autodrive || !started ? car.autopilot(started ? 24 : 17) : readInput();
        car.update(dt / steps, input);
      }
      world.update(car.s);
      const km = Math.floor(car.s / 1000);
      if (km > lastKm) { lastKm = km; sound.chime(); }
    }
    wetShown += (wet - wetShown) * Math.min(1, dt * 0.8);
    const e = applyLight();

    updateCamera(dt);
    sky.follow(camera);
    sun.position.set(car.x, car.y, car.z).addScaledVector(e > -0.1 ? sunDir : sunDir.clone().negate(), 90);
    sun.target.position.set(car.x, car.y, car.z);
    rain.update(dt, camera, { x: Math.sin(car.yaw) * car.v, z: Math.cos(car.yaw) * car.v });
    sound.update(car, wet > 0.5, paused || !started);

    hudTimer += dt;
    if (hudTimer > 0.1) {
      hudTimer = 0;
      hud.speed.textContent = Math.round(car.kmh);
      hud.gear.textContent = car.v < -0.3 ? 'R' : car.gear;
      hud.dist.textContent = (car.s / 1000).toFixed(1);
      hud.total.textContent = (car.odometer / 1000).toFixed(0);
    }
    saveTimer += dt;
    if (saveTimer > 5) { saveTimer = 0; store.set('odometer', car.odometer); }

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(t => { last = t; $('loading').hidden = true; frame(t); });
  addEventListener('pagehide', () => store.set('odometer', car.odometer));
  window.__openroad = { snap: () => updateCamera(0.016, true), car, world, settings, camera, renderer, fps: () => fpsAvg };
})();
