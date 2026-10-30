/* FPV: the quad. A rigid body with thrust along its own up axis, gravity, and drag that
   depends on which face meets the air. The sticks set target rotation rates through
   Betaflight Actual rates; motors chase that with a short lag, the way a tuned quad feels.
   Angle mode levels itself; Acro holds whatever attitude you leave it in. */
'use strict';

const QUADS = {
  whoop: {
    name: 'Tinywhoop 65 mm', mass: 0.028, twr: 3.4, radius: 0.045, drag1: 0.035, drag2: 0.012,
    response: 22, crash: 99, bounce: 0.45, uptilt: 12, motorHz: [340, 1300], props: 0.031, ducted: true,
  },
  freestyle: {
    name: '5" freestyle 6S', mass: 0.68, twr: 9, radius: 0.13, drag1: 0.08, drag2: 0.024,
    response: 30, crash: 11, bounce: 0.25, uptilt: 30, motorHz: [110, 560], props: 0.064, ducted: false,
  },
};

const RATE_PRESETS = {
  beginner: { name: 'Beginner', center: 120, max: 380, expo: 0.3 },
  betaflight: { name: 'Betaflight default', center: 70, max: 670, expo: 0.54 },
  freestyle: { name: 'Freestyle', center: 200, max: 850, expo: 0.45 },
};

/** Betaflight "Actual" rates: deg/s for a stick value in -1..1. */
function actualRate(x, r) {
  const ax = Math.abs(x);
  const expo = ax * (Math.pow(x, 5) * r.expo + x * (1 - r.expo));
  return x * r.center + Math.max(0, r.max - r.center) * expo;
}

class Drone {
  constructor(scene, kind) {
    this.scene = scene;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.q = new THREE.Quaternion(); this.w = new THREE.Vector3();      // body rates, rad/s
    this.mode = 'acro'; this.rates = RATE_PRESETS.betaflight;
    this.armed = false; this.crashed = false; this.throttleOut = 0;
    this.motor = [0, 0, 0, 0];
    this.setKind(kind);
  }

  setKind(kind) {
    this.kind = kind; this.spec = QUADS[kind];
    if (this.mesh) this.scene.remove(this.mesh);
    this.mesh = this.build(this.spec); this.scene.add(this.mesh);
  }

  build(s) {
    const g = new THREE.Group(), k = s.ducted ? 1 : 2.6;     // whoop parts are tiny, a 5" is bigger
    const carbon = new THREE.MeshStandardMaterial({ color: 0x1a1a1f, roughness: 0.5, metalness: 0.3 });
    const motorMat = new THREE.MeshStandardMaterial({ color: 0x8c7cff, roughness: 0.3, metalness: 0.8 });
    const propMat = new THREE.MeshBasicMaterial({ color: 0xb3abff, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide });
    const arm = 0.032 * k;
    if (s.ducted) {
      const duct = new THREE.MeshStandardMaterial({ color: 0x2b2b33, roughness: 0.6 });
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.006, 0.05), carbon));
      for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.012, 20, 1, true), duct);
        ring.position.set(x * arm * 0.85, 0, z * arm * 0.85); g.add(ring);
      }
      const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x56d9ff, roughness: 0.3, transparent: true, opacity: 0.85 }));
      canopy.position.y = 0.004; canopy.scale.set(1, 1, 1.3); g.add(canopy);
    } else {
      for (const r of [Math.PI / 4, -Math.PI / 4]) {
        const a = new THREE.Mesh(new THREE.BoxGeometry(0.018 * k / 2, 0.005 * k / 2, arm * 2.9), carbon); a.rotation.y = r; g.add(a);
      }
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.09), carbon); body.position.y = 0.02; g.add(body);
      const lipo = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.03, 0.075), new THREE.MeshStandardMaterial({ color: 0xffc94d, roughness: 0.5 }));
      lipo.position.y = 0.05; g.add(lipo);
      const cam = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.02), new THREE.MeshStandardMaterial({ color: 0x111111 })); cam.position.set(0, 0.022, -0.05); g.add(cam);
    }
    this.props = [];
    const offs = [[1, -1], [-1, -1], [1, 1], [-1, 1]];          // front right, front left, back right, back left
    for (const [x, z] of offs) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.004 * k, 0.004 * k, 0.008 * k, 10), motorMat);
      m.position.set(x * arm * 0.85, 0.006 * k, z * arm * 0.85); g.add(m);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(s.props, 24), propMat);
      disc.rotation.x = -Math.PI / 2; disc.position.set(m.position.x, 0.011 * k, m.position.z); g.add(disc);
      this.props.push(disc);
    }
    // a little LED strip at the back, so the quad is easy to spot in third person
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.03 * k, 0.003 * k, 0.003 * k), new THREE.MeshBasicMaterial({ color: 0x56d9ff }));
    led.position.set(0, 0.004 * k, arm * 0.9); g.add(led);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  }

  reset(pos, yaw) {
    this.pos.copy(pos); this.vel.set(0, 0, 0); this.w.set(0, 0, 0);
    this.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    this.armed = false; this.crashed = false; this.throttleOut = 0; this.impact = 0;
    this.mesh.position.copy(pos); this.mesh.quaternion.copy(this.q);
  }

  /** One physics step. sticks: throttle 0..1, yaw/pitch/roll -1..1. world.collide(drone) resolves contacts. */
  step(dt, sticks, world) {
    const s = this.spec, d2r = Math.PI / 180;
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.q);

    // ----- flight controller: target body rates
    let target;
    if (this.mode === 'angle') {
      // stick sets the tilt (up to 55 degrees); the controller turns that into rates
      const maxTilt = 55 * d2r;
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.q), right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.q);
      const pitchAngle = Math.asin(THREE.MathUtils.clamp(fwd.y, -1, 1));          // nose up is positive
      const rollAngle = Math.asin(THREE.MathUtils.clamp(right.y, -1, 1));         // right wing up is positive
      const kp = 7;
      target = new THREE.Vector3(
        kp * (-sticks.pitch * maxTilt - pitchAngle),
        -actualRate(sticks.yaw, this.rates) * d2r * 0.6,
        kp * (-sticks.roll * maxTilt - rollAngle),
      );
      if (up.y < 0.2) target.set(-pitchAngle * kp, 0, -rollAngle * kp * 1.5);      // flip back over if upside down
    } else {
      target = new THREE.Vector3(-actualRate(sticks.pitch, this.rates), -actualRate(sticks.yaw, this.rates), -actualRate(sticks.roll, this.rates)).multiplyScalar(d2r);
    }

    // throttle curve: a little expo around hover, and air mode keeps authority at zero throttle
    const thr = this.armed && !this.crashed ? sticks.throttle : 0;
    this.throttleOut += (thr - this.throttleOut) * Math.min(1, dt * s.response * 0.8);
    const control = this.armed && !this.crashed;
    if (control) this.w.lerp(target, Math.min(1, dt * s.response));
    else this.w.multiplyScalar(Math.exp(-dt * 1.5));

    // prop wash: dropping through your own wash at low throttle shakes the quad
    const sink = -this.vel.dot(up);
    if (control && sink > 2 && this.throttleOut > 0.15) {
      const k = Math.min(1, (sink - 2) / 6) * 6;
      this.w.x += (Math.random() - 0.5) * k * dt * 60; this.w.z += (Math.random() - 0.5) * k * dt * 60;
    }

    // integrate attitude in the body frame
    const angle = this.w.length() * dt;
    if (angle > 0) this.q.multiply(new THREE.Quaternion().setFromAxisAngle(this.w.clone().normalize(), angle)).normalize();

    // ----- forces
    const g = 9.81, thrust = s.twr * s.mass * g * Math.pow(this.throttleOut, 1.15);
    const acc = up.clone().multiplyScalar(thrust / s.mass);
    acc.y -= g;
    // drag: flat to the air is draggier than knife-edge
    const sp = this.vel.length();
    if (sp > 0.01) {
      const face = 1 + 1.8 * Math.abs(this.vel.clone().divideScalar(sp).dot(up));
      acc.addScaledVector(this.vel, -(s.drag1 + s.drag2 * sp) * face / s.mass * (s.ducted ? 0.6 : 1) * 0.35);
    }
    this.vel.addScaledVector(acc, dt);
    this.pos.addScaledVector(this.vel, dt);

    // ----- the world pushes back
    this.impact = 0;
    world.collide(this);
    if (this.impact > s.crash && this.armed) { this.crashed = true; this.armed = false; }

    // motor speeds for sound and the stick graph's motor bars
    const mix = [-this.w.x - this.w.z, -this.w.x + this.w.z, this.w.x - this.w.z, this.w.x + this.w.z];
    for (let i = 0; i < 4; i++) this.motor[i] = control ? THREE.MathUtils.clamp(this.throttleOut + mix[i] * 0.02 + (i % 2 ? 1 : -1) * this.w.y * 0.01, 0.04, 1) : 0;

    this.mesh.position.copy(this.pos); this.mesh.quaternion.copy(this.q);
    this.props.forEach((p, i) => { p.material.opacity = control ? 0.18 + this.motor[i] * 0.25 : 0.06; p.rotation.z += this.motor[i] * 3; });
  }

  get speed() { return this.vel.length(); }
}
