/* Open Road: the car. A low-poly coupe built from code, and arcade physics that are easy to
   drive: a bicycle model for yaw, a simple engine and gearbox, gravity along the slope, and a
   handbrake that lets the tail step out. Everything is in metres and seconds. */

'use strict';

const CAR_COLOURS = {
  laterite: '#c4582f',
  monsoon: '#2f7d86',
  violet: '#7a68e6',
  pearl: '#e9e6df',
  basalt: '#2a2a30',
};

class Car {
  constructor(scene, world) {
    this.world = world;
    this.road = world.road;
    this.mesh = this.buildMesh();
    scene.add(this.mesh);

    // headlights: one spot is enough for the road ahead
    this.lamp = new THREE.SpotLight(0xfff1d6, 0, 90, 0.5, 0.55, 1.2);
    this.lamp.position.set(0, 0.8, 1.9);
    this.lamp.target.position.set(0, 0, 25);
    this.mesh.add(this.lamp, this.lamp.target);

    this.gears = [0, 13, 22, 31, 40];   // m/s where each gear starts
    this.maxSpeed = 47;                 // about 170 km/h
    this.difficulty = 'normal';
    this.reset(20);
  }

  buildMesh() {
    const car = new THREE.Group();
    const body = new THREE.Group(); car.add(body); this.body = body;

    this.paint = new THREE.MeshStandardMaterial({ color: CAR_COLOURS.laterite, roughness: 0.32, metalness: 0.35 });
    const dark = new THREE.MeshStandardMaterial({ color: '#141418', roughness: 0.6 });
    const glass = new THREE.MeshStandardMaterial({ color: '#10141c', roughness: 0.08, metalness: 0.6 });
    const rubber = new THREE.MeshStandardMaterial({ color: '#151515', roughness: 0.95 });
    const rimMat = new THREE.MeshStandardMaterial({ color: '#b8b8c0', roughness: 0.3, metalness: 0.8 });
    this.headMat = new THREE.MeshStandardMaterial({ color: '#fffaf0', emissive: '#fff4d8', emissiveIntensity: 0.2 });
    this.tailMat = new THREE.MeshStandardMaterial({ color: '#5a0d0d', emissive: '#ff2a2a', emissiveIntensity: 0.25 });

    // side profile of the lower body, nose towards +x, extruded across the car's width
    const side = (pts, depth, bevel) => {
      const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
      const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 8 });
      g.translate(0, 0, -depth / 2);
      g.rotateY(-Math.PI / 2);          // nose now points along +z
      return g;
    };
    const lower = side([[-2.12, 0.3], [-2.16, 0.66], [-1.8, 0.86], [-0.9, 0.9], [0.9, 0.9], [1.75, 0.8], [2.14, 0.62], [2.16, 0.36], [1.95, 0.3]], 1.66, 0.08);
    const cabin = side([[-1.55, 0.88], [-0.7, 1.24], [0.25, 1.27], [0.98, 0.9]], 1.38, 0.06);
    const roof = side([[-0.62, 1.24], [0.22, 1.27], [0.3, 1.31], [-0.6, 1.29]], 1.3, 0.03);

    const add = (geo, mat, cast = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; body.add(m); return m; };
    add(lower, this.paint);
    add(cabin, glass);
    add(roof, this.paint);
    add(new THREE.BoxGeometry(1.7, 0.14, 4.0).translate(0, 0.31, 0), dark);                  // sill and floor
    add(new THREE.BoxGeometry(1.5, 0.08, 0.32).translate(0, 0.98, -2.0), dark);              // ducktail spoiler
    add(new THREE.BoxGeometry(0.38, 0.1, 0.05).translate(-0.58, 0.68, 2.2), this.headMat, false);
    add(new THREE.BoxGeometry(0.38, 0.1, 0.05).translate(0.58, 0.68, 2.2), this.headMat, false);
    add(new THREE.BoxGeometry(1.5, 0.08, 0.05).translate(0, 0.74, -2.22), this.tailMat, false);
    add(new THREE.BoxGeometry(0.9, 0.16, 0.05).translate(0, 0.42, 2.2), dark, false);        // grille
    for (const x of [-0.92, 0.92]) add(new THREE.BoxGeometry(0.08, 0.06, 0.2).translate(x, 0.98, 0.95), dark); // mirrors

    // wheels, the front pair on steering knuckles
    const tyre = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 20).rotateZ(Math.PI / 2);
    const rim = new THREE.CylinderGeometry(0.22, 0.22, 0.25, 10).rotateZ(Math.PI / 2);
    this.wheels = [];
    for (const [x, z, front] of [[-0.78, 1.32, 1], [0.78, 1.32, 1], [-0.78, -1.3, 0], [0.78, -1.3, 0]]) {
      const knuckle = new THREE.Group(); knuckle.position.set(x, 0.34, z);
      const spin = new THREE.Group();
      const t = new THREE.Mesh(tyre, rubber), r = new THREE.Mesh(rim, rimMat);
      t.castShadow = true;
      spin.add(t, r);
      // spokes so the rotation reads
      for (let i = 0; i < 5; i++) {
        const sp = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.04), rimMat);
        sp.position.x = Math.sign(x) * 0.13; sp.rotation.x = (i / 5) * Math.PI * 2;
        const holder = new THREE.Group(); holder.rotation.x = (i / 5) * Math.PI * 2; holder.add(sp); spin.add(holder);
      }
      knuckle.add(spin);
      car.add(knuckle);
      this.wheels.push({ knuckle, spin, front });
    }

    // a soft contact shadow so the car sits on the road even without shadow maps
    const blob = document.createElement('canvas'); blob.width = blob.height = 64;
    const g = blob.getContext('2d'), grd = g.createRadialGradient(32, 32, 4, 32, 32, 32);
    grd.addColorStop(0, 'rgba(0,0,0,.55)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 5.2).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(blob), transparent: true, depthWrite: false }));
    shadow.position.y = 0.03;
    car.traverse(o => { if (o.material && o.material.color && o.material !== shadow.material) o.material.color.convertSRGBToLinear(); });
    for (const m of [this.headMat, this.tailMat]) m.emissive.convertSRGBToLinear();
    car.add(shadow);
    return car;
  }

  setColour(key) { this.paint.color.set(CAR_COLOURS[key] || key).convertSRGBToLinear(); }

  /** Put the car back in the left lane at distance s, facing down the road. */
  reset(s) {
    const f = this.road.frame(s, {});
    this.x = f.x + f.rx * ROAD.lane; this.z = f.z + f.rz * ROAD.lane;
    this.y = f.h;
    this.yaw = Math.atan2(f.tx, f.tz);
    this.s = s; this.d = ROAD.lane;
    this.v = 0; this.yawRate = 0; this.slip = 0; this.steer = 0;
    this.pitch = 0; this.roll = 0; this.rpm = 900; this.gear = 1;
    this.throttle = 0; this.brake = 0;
    this.odometer = this.odometer || 0;
    this.offroad = false;
  }

  // keep s (distance along the road) and d (offset from the centre) in step with x, z
  track() {
    const f = {};
    for (let i = 0; i < 3; i++) {
      this.road.frame(this.s, f);
      this.s = Math.max(0, this.s + (this.x - f.x) * f.tx + (this.z - f.z) * f.tz);
    }
    this.road.frame(this.s, f);
    this.d = (this.x - f.x) * f.rx + (this.z - f.z) * f.rz;
    return f;
  }

  /** Steering and pedals for autodrive: hold the left lane, slow down for bends. */
  autopilot(cruise) {
    const look = 9 + this.v * 0.85, f = this.road.frame(this.s + look, {});
    const tx = f.x + f.rx * ROAD.lane - this.x, tz = f.z + f.rz * ROAD.lane - this.z;
    let err = Math.atan2(tx, tz) - this.yaw;
    err = Math.atan2(Math.sin(err), Math.cos(err));
    let k = 0;
    for (let a = 10; a <= 110; a += 20) k = Math.max(k, Math.abs(this.road.curvature(this.s + a)));
    const target = Math.min(cruise, Math.sqrt(3.2 / Math.max(k, 1e-4)));
    const dv = target - this.v;
    return { steer: THREE.MathUtils.clamp(-err * 2.4, -1, 1), throttle: THREE.MathUtils.clamp(dv * 0.35, 0, 1), brake: THREE.MathUtils.clamp(-dv * 0.25, 0, 1), handbrake: false };
  }

  update(dt, input) {
    const L = 2.62;
    const grip = { casual: 1.25, normal: 1, hard: 0.8 }[this.difficulty] || 1;

    // steering: smoothed, and less lock at speed so it stays calm on the highway
    const rate = input.steer === 0 ? 5 : 3.2;
    this.steer += (input.steer - this.steer) * Math.min(1, dt * rate);
    const maxSteer = 0.52 / (1 + Math.abs(this.v) / 16);
    const steerAngle = this.steer * maxSteer;

    // longitudinal
    this.throttle += (input.throttle - this.throttle) * Math.min(1, dt * 6);
    this.brake = input.brake;
    let a = 0;
    if (this.brake > 0 && this.v > 0.5) a -= 10 * this.brake;
    else if (this.brake > 0 && this.v <= 0.5) a -= this.v > -6 ? 4 * this.brake : 0;   // reverse
    if (this.throttle > 0 && this.v < this.maxSpeed) {
      const g = this.gear, pull = [0, 8.6, 6.6, 5.1, 4.1, 3.3][g];
      a += this.throttle * pull * (this.v < -0.5 ? 2 : 1);
    }
    a -= 0.0011 * this.v * Math.abs(this.v) + 0.12 * Math.sign(this.v);               // drag and rolling
    if (this.offroad) a -= 1.4 * Math.sign(this.v) + 0.02 * this.v * Math.abs(this.v);
    if (input.handbrake) a -= 3.5 * Math.sign(this.v);

    // gravity along the slope
    const ahead = this.groundAt(1.4, 0), behind = this.groundAt(-1.4, 0);
    const slope = (ahead - behind) / 2.8;
    a -= 9.81 * slope;
    this.v += a * dt;
    if (Math.abs(this.v) < 0.05 && input.throttle === 0) this.v = 0;

    // yaw: bicycle model, eased towards the target so it feels weighty
    const targetYaw = -this.v * Math.tan(steerAngle) / L;
    const settle = (input.handbrake ? 2.2 : 7.5) * grip;
    this.yawRate += (targetYaw * (input.handbrake ? 1.35 : 1) - this.yawRate) * Math.min(1, dt * settle);
    this.yaw += this.yawRate * dt;

    // slip angle: only the handbrake (or too much speed in a bend) lets the tail out
    const lateralG = Math.abs(this.v * this.yawRate) / 9.81;
    const slipTarget = input.handbrake && this.v > 8 ? -this.steer * 0.45 : lateralG > 0.95 * grip ? -Math.sign(this.yawRate) * (lateralG - 0.95 * grip) * 0.4 : 0;
    this.slip += (slipTarget - this.slip) * Math.min(1, dt * 3);
    this.v *= 1 - Math.abs(this.slip) * 0.5 * dt;

    const dir = this.yaw - this.slip * 0.6;
    this.x += Math.sin(dir) * this.v * dt;
    this.z += Math.cos(dir) * this.v * dt;

    const f = this.track();
    const ad = Math.abs(this.d);
    this.offroad = ad > ROAD.edge + 0.3;
    // a soft wall at the edge of the world, and no climbing the cliff
    const limit = ROAD.ribbon - 12;
    if (ad > limit) {
      const push = ad - limit;
      this.x -= f.rx * Math.sign(this.d) * push; this.z -= f.rz * Math.sign(this.d) * push;
      this.v *= 1 - Math.min(1, dt * 2);
    }

    this.odometer += Math.abs(this.v) * dt;

    // gearbox and revs (also drive the engine sound)
    let g = 1;
    for (let i = 1; i < this.gears.length; i++) if (this.v >= this.gears[i]) g = i + 1;
    this.gear = Math.min(g, 5);
    const lo = this.gears[this.gear - 1], hi = this.gears[this.gear] || this.maxSpeed;
    const targetRpm = 950 + THREE.MathUtils.clamp((Math.abs(this.v) - lo) / (hi - lo), 0, 1.15) * 5400 + this.throttle * 400;
    this.rpm += (targetRpm - this.rpm) * Math.min(1, dt * 8);

    // place the body: average of four ground samples, pitch and roll from the slope, a little lean
    const fl = this.groundAt(1.3, -0.8), fr = this.groundAt(1.3, 0.8), bl = this.groundAt(-1.3, -0.8), br = this.groundAt(-1.3, 0.8);
    this.y = (fl + fr + bl + br) / 4;
    const pitchT = Math.atan2((fl + fr) - (bl + br), 2 * 2.6) + THREE.MathUtils.clamp(-a * 0.004, -0.04, 0.04);
    const rollT = Math.atan2((fl + bl) - (fr + br), 2 * 1.6) + THREE.MathUtils.clamp(this.v * this.yawRate * 0.006, -0.06, 0.06);
    this.pitch += (pitchT - this.pitch) * Math.min(1, dt * 10);
    this.roll += (rollT - this.roll) * Math.min(1, dt * 10);

    const m = this.mesh;
    m.position.set(this.x, this.y, this.z);
    m.rotation.set(0, 0, 0);
    m.rotateY(this.yaw); m.rotateX(-this.pitch); m.rotateZ(this.roll);
    for (const w of this.wheels) {
      w.spin.rotation.x += (this.v * dt) / 0.34;
      if (w.front) w.knuckle.rotation.y = -steerAngle;
    }
    this.tailMat.emissiveIntensity = this.brake > 0 && this.v > 0 ? 2.2 : this.lightsOn ? 0.9 : 0.25;
  }

  /** Ground height under a point given in the car's own frame (forward, right). */
  groundAt(fwd, right) {
    const sx = Math.sin(this.yaw), cz = Math.cos(this.yaw);
    const px = this.x + sx * fwd - cz * right, pz = this.z + cz * fwd + sx * right;
    const f = this.road.frame(this.s, {});
    const ds = (px - f.x) * f.tx + (pz - f.z) * f.tz;
    const s = Math.max(0, this.s + ds), f2 = this.road.frame(s, {});
    const d = (px - f2.x) * f2.rx + (pz - f2.z) * f2.rz;
    return this.road.ground(s, d, f2);
  }

  setLights(on) {
    this.lightsOn = on;
    this.lamp.intensity = on ? 2.4 : 0;
    this.headMat.emissiveIntensity = on ? 3 : 0.2;
  }

  get kmh() { return Math.abs(this.v) * 3.6; }
  get slipAmount() { return Math.min(1, Math.abs(this.slip) * 3 + (this.brake > 0.5 && this.v > 10 ? 0.3 : 0)); }
}
