/**
 * Open Road Racer - Vehicle Model & Driving Physics
 * Includes procedural low-poly coupe, 5-speed transmission simulation, suspension dynamics & dual cameras.
 */

class Vehicle {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;

    // Transformation & Spline Progress
    this.progressU = 0.005; // Spline parameter t (0.0 to 1.0)
    this.lateralOffset = 0.0; // Offset from road center (-roadWidth/2 to +roadWidth/2)
    this.headingAngle = 0.0; // Local yaw offset

    // Physical state
    this.speedKmh = 0.0;
    this.maxSpeedKmh = 175.0;
    this.accelRate = 48.0;     // km/h per sec
    this.brakeRate = 95.0;     // km/h per sec
    this.frictionRate = 18.0;  // drag
    this.steerAngle = 0.0;
    this.maxSteerAngle = 0.65; // radians

    // Off-road handling
    this.isOffRoad = false;

    // Suspension dynamics
    this.pitch = 0.0;
    this.roll = 0.0;

    // Transmission & RPM simulation
    this.gear = 1;
    this.rpmNorm = 0.0; // 0.0 to 1.0
    this.gearRatios = [35, 68, 105, 142, 175];

    // Camera modes: 'chase' or 'cockpit'
    this.cameraMode = 'chase';
    this.cameraOffset = new THREE.Vector3(0, 3.2, -6.8);
    this.lookAheadOffset = new THREE.Vector3(0, 1.4, 8.0);

    // 3D Meshes
    this.carGroup = new THREE.Group();
    this.bodyMesh = null;
    this.wheels = [];
    this.brakeLights = [];
    this.headlights = [];

    this.buildModel();
  }

  buildModel() {
    // Stylized Grand Tourer Coupe
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x181a24,
      metalness: 0.85,
      roughness: 0.25
    });

    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x8c7cff, // Violet accent
      metalness: 0.6,
      roughness: 0.3
    });

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x111625,
      roughness: 0.1,
      metalness: 0.95
    });

    // Lower chassis
    const chassisGeom = new THREE.BoxGeometry(2.1, 0.65, 4.4);
    const chassis = new THREE.Mesh(chassisGeom, bodyMat);
    chassis.position.y = 0.55;
    chassis.castShadow = true;
    this.carGroup.add(chassis);

    // Aerodynamic cabin / canopy
    const cabinGeom = new THREE.BoxGeometry(1.65, 0.55, 2.3);
    const cabin = new THREE.Mesh(cabinGeom, glassMat);
    cabin.position.set(0, 1.05, -0.2);
    cabin.castShadow = true;
    this.carGroup.add(cabin);

    // Violet racing stripe / spoiler
    const spoilerGeom = new THREE.BoxGeometry(1.9, 0.08, 0.35);
    const spoiler = new THREE.Mesh(spoilerGeom, trimMat);
    spoiler.position.set(0, 1.05, -2.1);
    this.carGroup.add(spoiler);

    // Headlights (Cyan glow)
    const hlGeom = new THREE.BoxGeometry(0.35, 0.15, 0.1);
    const hlMat = new THREE.MeshBasicMaterial({ color: 0x56d9ff });
    const hlLeft = new THREE.Mesh(hlGeom, hlMat);
    hlLeft.position.set(-0.75, 0.55, 2.22);
    const hlRight = hlLeft.clone();
    hlRight.position.x = 0.75;
    this.carGroup.add(hlLeft);
    this.carGroup.add(hlRight);

    // Taillights / Brake lights (Red emissive)
    const tlGeom = new THREE.BoxGeometry(0.4, 0.12, 0.1);
    const tlMat = new THREE.MeshStandardMaterial({
      color: 0x330000,
      emissive: 0x990000,
      emissiveIntensity: 0.6
    });
    const tlLeft = new THREE.Mesh(tlGeom, tlMat);
    tlLeft.position.set(-0.75, 0.55, -2.22);
    const tlRight = tlLeft.clone();
    tlRight.position.x = 0.75;
    this.carGroup.add(tlLeft);
    this.carGroup.add(tlRight);
    this.brakeLights.push(tlLeft, tlRight);

    // 4 Wheels
    const wheelGeom = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 16);
    wheelGeom.rotateZ(Math.PI / 2);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x121316, roughness: 0.8 });
    const rimGeom = new THREE.CylinderGeometry(0.24, 0.24, 0.3, 8);
    rimGeom.rotateZ(Math.PI / 2);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x9a9aa5, metalness: 0.8, roughness: 0.2 });

    const wheelPositions = [
      { x: -1.05, y: 0.38, z: 1.35, isFront: true },
      { x: 1.05, y: 0.38, z: 1.35, isFront: true },
      { x: -1.05, y: 0.38, z: -1.35, isFront: false },
      { x: 1.05, y: 0.38, z: -1.35, isFront: false }
    ];

    wheelPositions.forEach((pos) => {
      const wGroup = new THREE.Group();
      wGroup.position.set(pos.x, pos.y, pos.z);

      const tire = new THREE.Mesh(wheelGeom, tireMat);
      const rim = new THREE.Mesh(rimGeom, rimMat);
      wGroup.add(tire);
      wGroup.add(rim);

      this.carGroup.add(wGroup);
      this.wheels.push({ mesh: wGroup, isFront: pos.isFront, baseY: pos.y });
    });

    this.scene.add(this.carGroup);
  }

  update(dt, input) {
    // 1. Throttle & Braking Dynamics
    let isBraking = false;
    let accel = 0;

    if (input.keys.throttle > 0) {
      // Acceleration efficiency tapers near top speed
      const topSpeedCap = this.isOffRoad ? 65.0 : this.maxSpeedKmh;
      const speedRatio = Math.min(1.0, this.speedKmh / topSpeedCap);
      accel = this.accelRate * (1.0 - speedRatio * 0.75);
      this.speedKmh += accel * dt;
    } else if (input.keys.brake > 0) {
      if (this.speedKmh > 1.0) {
        this.speedKmh -= this.brakeRate * dt;
        isBraking = true;
      } else {
        // Reverse
        this.speedKmh = Math.max(-25.0, this.speedKmh - 15.0 * dt);
      }
    } else {
      // Engine drag & rolling friction
      const drag = this.isOffRoad ? this.frictionRate * 3.5 : this.frictionRate;
      if (this.speedKmh > 0) {
        this.speedKmh = Math.max(0, this.speedKmh - drag * dt);
      } else if (this.speedKmh < 0) {
        this.speedKmh = Math.min(0, this.speedKmh + drag * dt);
      }
    }

    // Handbrake
    if (input.keys.handbrake && this.speedKmh > 0) {
      this.speedKmh = Math.max(0, this.speedKmh - this.brakeRate * 1.5 * dt);
      isBraking = true;
    }

    // Clamp speed
    const maxAllowed = this.isOffRoad ? 65.0 : this.maxSpeedKmh;
    this.speedKmh = Math.max(-25.0, Math.min(maxAllowed, this.speedKmh));

    // Update Brake Lights Emissive
    const brakeColor = isBraking ? 0xff1e38 : 0x440005;
    const brakeIntensity = isBraking ? 2.5 : 0.4;
    this.brakeLights.forEach(bl => {
      bl.material.emissive.setHex(brakeColor);
      bl.material.emissiveIntensity = brakeIntensity;
    });

    // 2. Transmission & Simulated RPM
    this.updateGears();

    // 3. Steering dynamics
    // Steering sensitivity decreases at high speed to maintain smooth control
    const speedFactor = Math.max(0.25, 1.0 - (Math.abs(this.speedKmh) / 220.0));
    const targetSteer = input.keys.steer * this.maxSteerAngle * speedFactor;
    this.steerAngle += (targetSteer - this.steerAngle) * Math.min(1.0, 8.0 * dt);

    // Front wheels visual steering
    this.wheels.forEach(w => {
      if (w.isFront) {
        w.mesh.rotation.y = -this.steerAngle;
      }
      // Wheel spin based on distance traveled
      const rollRate = (this.speedKmh / 3.6) / 0.38;
      w.mesh.rotation.x += rollRate * dt;
    });

    // 4. Progress along road spline
    const speedMs = this.speedKmh / 3.6;
    const roadLen = this.world.totalLength || 2500;
    const deltaU = (speedMs * dt) / roadLen;

    this.progressU = (this.progressU + deltaU + 1.0) % 1.0;

    // Lateral movement across road width
    const lateralSpeed = this.steerAngle * Math.abs(speedMs) * 1.8;
    this.lateralOffset += lateralSpeed * dt;

    // Check if off-road
    const halfRoad = this.world.roadWidth / 2;
    this.isOffRoad = Math.abs(this.lateralOffset) > (halfRoad + 0.5);

    // Clamp lateral bounds so vehicle doesn't fall off mountain entirely
    const maxLateral = halfRoad + 4.5;
    if (this.lateralOffset > maxLateral) this.lateralOffset = maxLateral;
    if (this.lateralOffset < -maxLateral) this.lateralOffset = -maxLateral;

    // 5. Place Vehicle on Spline with Pitch & Roll
    const roadInfo = this.world.getRoadInfoAtProgress(this.progressU);
    const carPos = roadInfo.point.clone().addScaledVector(roadInfo.binormal, this.lateralOffset);

    this.carGroup.position.copy(carPos);

    // Orient car with road tangent + lateral yaw
    const forwardVec = roadInfo.tangent.clone();
    forwardVec.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.steerAngle * 0.4);
    const targetQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), forwardVec);

    // Suspension pitch (dip nose on brake, squat on accel)
    const targetPitch = isBraking ? -0.06 : (input.keys.throttle > 0 ? 0.04 : 0);
    this.pitch += (targetPitch - this.pitch) * 10 * dt;

    // Suspension body roll on sharp turns
    const targetRoll = -this.steerAngle * (this.speedKmh / 160) * 0.12;
    this.roll += (targetRoll - this.roll) * 10 * dt;

    this.carGroup.quaternion.copy(targetQuat);
    this.carGroup.rotateX(this.pitch);
    this.carGroup.rotateZ(this.roll);

    // Camera toggle action
    if (input.consumeAction('changeCamera')) {
      this.toggleCamera();
    }

    // Reset action
    if (input.consumeAction('reset')) {
      this.resetPosition();
    }

    return {
      speedKmh: Math.round(this.speedKmh),
      rpmNorm: this.rpmNorm,
      isSkidding: Math.abs(this.steerAngle) > 0.4 && this.speedKmh > 50,
      isBraking: isBraking,
      isOffRoad: this.isOffRoad,
      gear: this.gear
    };
  }

  updateGears() {
    const spd = Math.max(0, this.speedKmh);
    let g = 1;
    for (let i = 0; i < this.gearRatios.length; i++) {
      if (spd > this.gearRatios[i]) {
        g = i + 2;
      } else {
        break;
      }
    }
    this.gear = Math.min(5, g);

    const prevRatio = this.gear === 1 ? 0 : this.gearRatios[this.gear - 2];
    const nextRatio = this.gearRatios[this.gear - 1];
    this.rpmNorm = Math.min(1.0, Math.max(0.1, (spd - prevRatio) / (nextRatio - prevRatio)));
  }

  toggleCamera() {
    this.cameraMode = this.cameraMode === 'chase' ? 'cockpit' : 'chase';
  }

  updateCamera(camera, dt) {
    if (this.cameraMode === 'chase') {
      // Dynamic chase camera with speed-dependent distance and FOV
      const speedRatio = Math.min(1.0, this.speedKmh / 160);
      const dist = 6.8 + speedRatio * 1.5;
      const height = 3.2 + speedRatio * 0.4;

      const targetPos = this.carGroup.position.clone()
        .addScaledVector(this.getForwardVector(), -dist);
      targetPos.y += height;

      camera.position.lerp(targetPos, Math.min(1.0, 12 * dt));

      const lookTarget = this.carGroup.position.clone()
        .addScaledVector(this.getForwardVector(), 8.0);
      lookTarget.y += 1.2;

      camera.lookAt(lookTarget);

      // Dynamic FOV for sense of speed
      camera.fov = 60 + speedRatio * 14;
      camera.updateProjectionMatrix();

    } else {
      // Cockpit / Hood Camera
      const hoodPos = this.carGroup.position.clone()
        .addScaledVector(this.getForwardVector(), 0.5);
      hoodPos.y += 1.25;

      camera.position.copy(hoodPos);
      const lookTarget = this.carGroup.position.clone()
        .addScaledVector(this.getForwardVector(), 25.0);
      lookTarget.y += 1.1;

      camera.lookAt(lookTarget);
      camera.fov = 72;
      camera.updateProjectionMatrix();
    }
  }

  getForwardVector() {
    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(this.carGroup.quaternion);
    return forward;
  }

  resetPosition() {
    this.lateralOffset = 0.0;
    this.speedKmh = 0.0;
    this.steerAngle = 0.0;
    this.pitch = 0;
    this.roll = 0;
  }
}

window.Vehicle = Vehicle;
