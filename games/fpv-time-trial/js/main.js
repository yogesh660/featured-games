/* FPV: game loop, cameras, OSD, stick graphs, laps and menus. */
'use strict';

(() => {
  const $ = id => document.getElementById(id);
  const store = {
    get(k, d) { try { const v = localStorage.getItem('fpv.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('fpv.' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  const cfg = {
    track: store.get('track', 'living'), quad: store.get('quad', 'whoop'), mode: store.get('mode', 'angle'),
    rates: store.get('rates', 'betaflight'), tilt: store.get('tilt', null), fov: store.get('fov', 118), view: 'fpv', sticks: store.get('sticks', true),
  };

  // ---------- three.js ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  $('stage').appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(90, 1, 0.01, 2000);
  const world = new World(scene);
  const drone = new Drone(scene, cfg.quad);
  const input = new Input();
  const sound = new QuadSound();

  function resize() { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; applyFov(); }
  function applyFov() {
    if (cfg.view === 'fpv') {
      // the setting is the horizontal FOV, like an FPV camera lens; convert to three.js's vertical FOV
      const h = cfg.fov * Math.PI / 180;
      camera.fov = Math.min(110, 2 * Math.atan(Math.tan(h / 2) / camera.aspect) * 180 / Math.PI);
    } else camera.fov = cfg.view === 'los' ? 45 : 75;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);

  // ---------- state ----------
  const st = {
    playing: false, paused: false, lapStart: null, lapTime: 0, best: null, next: 0, lastSplit: 0, laps: 0,
    prevSide: [], crashT: 0, flight: 0, battery: 1, lastArmSwitch: null, lastModeSwitch: null,
  };
  const bestKey = () => `best.${cfg.track}.${cfg.quad}`;

  function loadTrack() {
    if (cfg.track === 'living') world.buildLivingRoom(); else world.buildBando();
    drone.setKind(cfg.quad);
    drone.mode = cfg.mode; drone.rates = RATE_PRESETS[cfg.rates];
    st.best = store.get(bestKey(), null);
    resetDrone();
  }

  function resetDrone() {
    drone.reset(world.spawn.pos, world.spawn.yaw);
    st.lapStart = null; st.lapTime = 0; st.next = 0; st.laps = 0; st.crashT = 0; st.battery = 1;
    world.setGateState(0);
    st.prevSide = world.gates.map(g => world.gateSide(g, drone.pos).d);
    input.kb.throttle = 0;
    camPos.copy(drone.pos).add(new THREE.Vector3(0, 0.5, 1.5));
    updateOsd(true);
  }

  // ---------- arming, modes, views ----------
  function arm(on) {
    if (on === drone.armed || drone.crashed && on) return;
    if (on && input.sticks.throttle > 0.08) { osdMsg('Throttle down to arm', 1.4); sound.beep(400, 0.25); return; }
    drone.armed = on; sound.beep(on ? 1400 : 700, on ? 0.12 : 0.2);
    osdMsg(on ? 'Armed' : 'Disarmed', 0.9);
  }
  function setMode(m) { cfg.mode = drone.mode = m; store.set('mode', m); osdMsg(m === 'acro' ? 'Acro: no self-levelling' : 'Angle: self-levelling', 1.4); }
  function cycleView() {
    cfg.view = { fpv: 'chase', chase: 'los', los: 'fpv' }[cfg.view];
    applyFov(); osdMsg({ fpv: 'FPV camera', chase: 'Chase camera', los: 'Line of sight' }[cfg.view], 1);
    document.body.classList.toggle('third', cfg.view !== 'fpv');
  }

  input.on('key', code => {
    if (!st.playing) return;
    if (code === 'Escape') return pause(!st.paused);
    if (st.paused) return;
    if (code === 'Space' && input.armSwitch === null) arm(!drone.armed);
    if (code === 'KeyR') resetDrone();
    if (code === 'KeyC') cycleView();
    if (code === 'KeyM' && !input.modeSwitch) setMode(drone.mode === 'acro' ? 'angle' : 'acro');
    if (code === 'KeyH') { cfg.sticks = !cfg.sticks; store.set('sticks', cfg.sticks); $('sticks').hidden = !cfg.sticks; }
  });
  input.on('pad', p => { $('pad-status').textContent = p ? `Connected: ${p.id.slice(0, 48)}` : 'No controller: keyboard'; if (p) osdMsg('Controller connected', 1.6); });

  // standard gamepads: A arm, Y reset, X camera, B mode
  let lastButtons = [];
  function padButtons() {
    const pad = input.pad(); if (!pad || input.source !== 'gamepad') return;
    const pressed = i => pad.buttons[i]?.pressed && !lastButtons[i];
    if (pressed(0)) arm(!drone.armed);
    if (pressed(3)) resetDrone();
    if (pressed(2)) cycleView();
    if (pressed(1)) setMode(drone.mode === 'acro' ? 'angle' : 'acro');
    if (pressed(9)) pause(!st.paused);
    lastButtons = pad.buttons.map(b => b.pressed);
  }
  function radioSwitches() {
    if (input.source !== 'radio') return;
    if (input.armSwitch !== null && input.armSwitch !== st.lastArmSwitch) { arm(input.armSwitch); st.lastArmSwitch = input.armSwitch; }
    if (input.modeSwitch && input.modeSwitch !== st.lastModeSwitch) { if (st.lastModeSwitch !== null) setMode(input.modeSwitch); else drone.mode = input.modeSwitch; st.lastModeSwitch = input.modeSwitch; }
  }

  // ---------- laps ----------
  function checkGates() {
    world.gates.forEach((g, i) => {
      const { d, inside } = world.gateSide(g, drone.pos);
      if (i === st.next && Math.sign(d) !== Math.sign(st.prevSide[i]) && inside) passGate(i);
      st.prevSide[i] = d;
    });
  }
  function passGate(i) {
    const now = st.flight;
    if (i === 0) {
      if (st.lapStart !== null && st.lapReady) {
        const lap = now - st.lapStart; st.laps++;
        const isBest = st.best === null || lap < st.best;
        if (isBest) { st.best = lap; store.set(bestKey(), lap); }
        osdMsg(`Lap ${fmt(lap)}${isBest ? '  best!' : ''}`, 2.4, isBest);
        sound.beep(1800, 0.12); setTimeout(() => sound.beep(2200, 0.18), 120);
      } else osdMsg('Go!', 0.8);
      st.lapStart = now; st.lapReady = false;
    } else { sound.beep(1500, 0.06); if (i === world.gates.length - 1) st.lapReady = true; }
    st.next = (i + 1) % world.gates.length;
    world.setGateState(st.next);
  }
  const fmt = t => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;

  // ---------- OSD ----------
  let msgTimer;
  function osdMsg(text, dur, gold) {
    const el = $('osd-msg'); el.textContent = text; el.classList.toggle('gold', !!gold); el.classList.add('show');
    clearTimeout(msgTimer); msgTimer = setTimeout(() => el.classList.remove('show'), dur * 1000);
  }
  let osdT = 0;
  function updateOsd(force) {
    osdT -= 1 / 60; if (osdT > 0 && !force) return; osdT = 0.05;
    const s = drone.spec, cells = s.ducted ? 1 : 6;
    const v = cells * (3.35 + 0.85 * st.battery - drone.throttleOut * (s.ducted ? 0.45 : 0.35) * 1);
    $('o-thr').textContent = `${Math.round(input.sticks.throttle * 100)}%`;
    $('o-spd').textContent = `${Math.round(drone.speed * 3.6)}`;
    $('o-alt').textContent = `${(drone.pos.y - world.floor).toFixed(1)}`;
    $('o-bat').textContent = `${v.toFixed(2)}V`;
    $('o-bat').classList.toggle('low', v / cells < 3.5);
    $('o-mode').textContent = drone.mode.toUpperCase();
    $('o-quad').textContent = s.ducted ? 'WHOOP' : '5" 6S';
    $('o-src').textContent = input.source === 'radio' ? 'RADIO' : input.source === 'gamepad' ? 'PAD' : 'KEYS';
    $('o-lap').textContent = st.lapStart === null ? '0:00.00' : fmt(st.flight - st.lapStart);
    $('o-best').textContent = st.best === null ? '–' : fmt(st.best);
    $('o-gate').textContent = `${st.next + 1}/${world.gates.length}`;
    $('o-flight').textContent = fmt(st.flight).slice(0, -3);
    const status = $('o-status');
    if (drone.crashed) { status.textContent = 'CRASHED · R to reset'; status.className = 'status bad'; }
    else if (!drone.armed) { status.textContent = input.source === 'radio' && input.armSwitch !== null ? 'DISARMED · throttle down, flip arm switch' : 'DISARMED · throttle down, press Space'; status.className = 'status'; }
    else status.className = 'status hide';
  }

  // ---------- stick graphs (Liftoff-style) ----------
  const sc = $('sticks'), sg = sc.getContext('2d');
  const trails = [[], []];
  function drawSticks() {
    if (!cfg.sticks) return;
    const dpr = Math.min(devicePixelRatio, 2), W = 260, H = 118;
    if (sc.width !== W * dpr) { sc.width = W * dpr; sc.height = H * dpr; }
    sg.setTransform(dpr, 0, 0, dpr, 0, 0); sg.clearRect(0, 0, W, H);
    const s = input.sticks;
    const pts = [[s.yaw, s.throttle * 2 - 1], [s.roll, s.pitch]];
    pts.forEach(([x, y], i) => {
      const ox = 6 + i * 130, oy = 6, size = 106;
      sg.fillStyle = 'rgba(8,8,14,.45)'; sg.fillRect(ox, oy, size, size);
      sg.strokeStyle = 'rgba(255,255,255,.35)'; sg.lineWidth = 1; sg.strokeRect(ox + 0.5, oy + 0.5, size - 1, size - 1);
      sg.strokeStyle = 'rgba(255,255,255,.15)';
      sg.beginPath(); sg.moveTo(ox + size / 2, oy); sg.lineTo(ox + size / 2, oy + size); sg.moveTo(ox, oy + size / 2); sg.lineTo(ox + size, oy + size / 2); sg.stroke();
      const px = ox + size / 2 + x * (size / 2 - 6), py = oy + size / 2 - y * (size / 2 - 6);
      const tr = trails[i]; tr.push([px, py]); if (tr.length > 14) tr.shift();
      sg.strokeStyle = 'rgba(86,217,255,.5)'; sg.lineWidth = 2; sg.beginPath(); tr.forEach(([a, b], k) => (k ? sg.lineTo(a, b) : sg.moveTo(a, b))); sg.stroke();
      sg.fillStyle = '#56d9ff'; sg.shadowColor = '#56d9ff'; sg.shadowBlur = 10;
      sg.beginPath(); sg.arc(px, py, 5, 0, 7); sg.fill(); sg.shadowBlur = 0;
      sg.fillStyle = 'rgba(255,255,255,.75)'; sg.font = '9px "DM Mono", monospace';
      sg.fillText(i ? 'ROLL · PITCH' : 'YAW · THR', ox + 4, oy + size - 5);
    });
    // throttle and motor bars between the boxes
    sg.fillStyle = 'rgba(255,255,255,.12)'; sg.fillRect(116, 6, 8, 106);
    sg.fillStyle = drone.armed ? '#74df9b' : '#888'; const th = drone.throttleOut * 106; sg.fillRect(116, 112 - th, 8, th);
  }

  // ---------- cameras ----------
  const camPos = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tilt = new THREE.Quaternion();
  function updateCamera(dt) {
    if (cfg.view === 'fpv') {
      const t = (cfg.tilt ?? drone.spec.uptilt) * Math.PI / 180;
      tilt.setFromAxisAngle(new THREE.Vector3(1, 0, 0), t);             // the camera points up from the frame
      const offset = new THREE.Vector3(0, drone.spec.ducted ? 0.012 : 0.035, drone.spec.ducted ? -0.012 : -0.05).applyQuaternion(drone.q);
      camera.position.copy(drone.pos).add(offset);
      camera.quaternion.copy(drone.q).multiply(tilt);
      camera.near = drone.spec.ducted ? 0.01 : 0.03;
      drone.mesh.visible = false;                                         // you don't see your own frame in the goggles
    } else if (cfg.view === 'chase') {
      const yaw = new THREE.Vector3(0, 0, -1).applyQuaternion(drone.q); yaw.y = 0;
      if (yaw.lengthSq() < 1e-4) yaw.set(0, 0, -1); yaw.normalize();
      const k = drone.spec.ducted ? 0.32 : 1.1;
      const want = drone.pos.clone().addScaledVector(yaw, -k * 1.6).add(new THREE.Vector3(0, k * 0.7, 0));
      camPos.lerp(want, Math.min(1, dt * 6));
      camera.position.copy(camPos); camera.lookAt(drone.pos.clone().addScaledVector(yaw, k * 0.6));
      camera.near = 0.02; drone.mesh.visible = true;
    } else {
      const spot = world.spawn.pos.clone().add(new THREE.Vector3(drone.spec.ducted ? 1.2 : 6, drone.spec.ducted ? 1.5 : 1.7, drone.spec.ducted ? 1.5 : 10));
      camera.position.copy(spot); camera.lookAt(drone.pos); camera.near = 0.02; drone.mesh.visible = true;
    }
    camera.updateProjectionMatrix();
  }

  // ---------- menus ----------
  function syncMenu() {
    document.querySelectorAll('[data-opt]').forEach(group => {
      const key = group.dataset.opt;
      group.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.value === cfg[key]));
    });
    $('tilt').value = cfg.tilt ?? QUADS[cfg.quad].uptilt; $('tilt-v').textContent = `${$('tilt').value}°`;
    $('fov').value = cfg.fov; $('fov-v').textContent = `${cfg.fov}°`;
    const r = RATE_PRESETS[cfg.rates];
    $('rates-note').textContent = `Center ${r.center}°/s · max ${r.max}°/s · expo ${r.expo}`;
  }
  document.querySelectorAll('[data-opt]').forEach(group => group.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const key = group.dataset.opt; cfg[key] = b.dataset.value; store.set(key, cfg[key]);
    if (key === 'track') { cfg.quad = cfg.track === 'living' ? 'whoop' : 'freestyle'; store.set('quad', cfg.quad); cfg.tilt = null; store.set('tilt', null); }
    if (key === 'quad') { cfg.tilt = null; store.set('tilt', null); }
    syncMenu();
  }));
  $('tilt').addEventListener('input', e => { cfg.tilt = +e.target.value; store.set('tilt', cfg.tilt); $('tilt-v').textContent = `${cfg.tilt}°`; });
  $('fov').addEventListener('input', e => { cfg.fov = +e.target.value; store.set('fov', cfg.fov); $('fov-v').textContent = `${cfg.fov}°`; applyFov(); });

  function play() {
    sound.start();
    loadTrack(); applyFov();
    st.playing = true; st.paused = false; st.flight = 0;
    $('menu').hidden = true; document.body.classList.add('flying');
    osdMsg(input.source === 'radio' ? 'Throttle down, flip the arm switch' : 'Throttle down, Space to arm', 2.5);
  }
  function pause(on) {
    st.paused = on; $('menu').hidden = !on; document.body.classList.toggle('flying', !on);
    $('fly').textContent = on ? 'Back to flying' : 'Fly';
    if (on) syncMenu();
  }
  $('fly').addEventListener('click', () => {
    if (st.playing && st.paused) {
      const need = cfg.track !== world.trackId || cfg.quad !== drone.kind;
      if (need) return play();
      drone.mode = cfg.mode; drone.rates = RATE_PRESETS[cfg.rates]; applyFov(); pause(false);
    } else play();
  });

  // radio setup wizard
  const wiz = new RadioWizard(input, {
    say: (t, bad) => { $('wiz-note').textContent = t; $('wiz-note').classList.toggle('bad', !!bad); },
    step: (i, n, text, optional) => { $('wiz-step').textContent = `Step ${i} of ${n}`; $('wiz-text').textContent = text; $('wiz-skip').hidden = !optional; $('wiz-found').textContent = ''; },
    live: axes => { $('wiz-axes').innerHTML = axes.map((a, i) => `<span><b>${i + 1}</b><i style="--v:${(a + 1) / 2}"></i></span>`).join(''); },
    found: t => { $('wiz-found').textContent = t; },
    done: m => {
      $('wizard').hidden = true;
      $('pad-status').textContent = `Radio set up: throttle axis ${m.throttle.axis + 1}, yaw ${m.yaw.axis + 1}, pitch ${m.pitch.axis + 1}, roll ${m.roll.axis + 1}${m.arm ? ', arm switch' : ''}`;
    },
  });
  $('radio-setup').addEventListener('click', () => { $('wizard').hidden = false; if (!wiz.start()) $('wiz-step').textContent = 'Waiting for a controller'; });
  $('wiz-next').addEventListener('click', () => { if (wiz.timer) wiz.next(); else wiz.start(); });
  $('wiz-skip').addEventListener('click', () => wiz.skip());
  $('wiz-cancel').addEventListener('click', () => { wiz.cancel(); $('wizard').hidden = true; });

  // track build keeps its own id so the menu knows when a rebuild is needed
  const origLiving = world.buildLivingRoom.bind(world), origBando = world.buildBando.bind(world);
  world.buildLivingRoom = () => { origLiving(); world.trackId = 'living'; };
  world.buildBando = () => { origBando(); world.trackId = 'bando'; };

  // ---------- loop ----------
  resize(); syncMenu(); loadTrack();
  if (input.map) $('pad-status').textContent = 'Radio profile saved. Move a stick to use it.';
  let last = performance.now(), idle = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    input.update(dt); padButtons(); radioSwitches();
    if (st.playing && !st.paused) {
      const steps = Math.ceil(dt * 240);
      const wasCrashed = drone.crashed;
      for (let i = 0; i < steps; i++) { drone.step(dt / steps, input.sticks, world); checkGates(); }
      if (drone.crashed && !wasCrashed) { sound.crash(); osdMsg('Crashed', 1.4); }
      if (drone.armed) { st.flight += dt; st.battery = Math.max(0, st.battery - dt * (0.002 + drone.throttleOut * 0.006)); }
      if (drone.crashed) { st.crashT += dt; if (st.crashT > 2.2) resetDrone(); }
      updateOsd(); drawSticks();
    } else if (!st.playing) {
      // behind the menu, the quad hovers and slowly turns so the scene is alive
      idle += dt;
      drone.pos.copy(world.spawn.pos).add(new THREE.Vector3(Math.sin(idle * 0.4) * 0.3, (drone.spec.ducted ? 0.6 : 1.6) + Math.sin(idle) * 0.05, Math.cos(idle * 0.4) * 0.3));
      drone.q.setFromEuler(new THREE.Euler(Math.sin(idle * 0.7) * 0.08, world.spawn.yaw + idle * 0.15, Math.sin(idle * 0.5) * 0.08, 'YXZ'));
      drone.mesh.position.copy(drone.pos); drone.mesh.quaternion.copy(drone.q);
    }
    if (!st.playing) {
      const k = drone.spec.ducted ? 0.6 : 3.2;
      camera.position.copy(drone.pos).add(new THREE.Vector3(Math.sin(idle * 0.2) * k, k * 0.35, Math.cos(idle * 0.2) * k));
      camera.lookAt(drone.pos); drone.mesh.visible = true; camera.fov = 50; camera.near = 0.01; camera.updateProjectionMatrix();
    } else updateCamera(dt);
    sound.update(drone, !st.playing || st.paused);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(t => { last = t; $('loading').hidden = true; frame(t); });
  window.__fpv = { drone, world, input, st, cfg, play };
})();
