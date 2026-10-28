/**
 * Open Road Racer - Vehicle Dynamics & 3D Model (Overhauled)
 * Sleek modern sports coupe, realistic arcade physics, wheel contact & dual dynamic cameras.
 */

class Vehicle {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;

    // Spline parameter & Road offset
    this.progressU = 0.002;
    this.lateralOffset = 0.0; // Lateral position in meters (-5.5 to +5.5 is inside road)
    this.steerAngle = 0.0;
    this.maxSteerAngle = 0.60;

    // Dynamics
    this.speedKmh = 0.0;
    this.maxSpeedKmh = 185.0;
    this.accelRate = 54.0;      // km/h per sec
    this.brakeRate = 110.0;     // km/h per sec
    this.dragRate = 16.0;

    this.isOffRoad = false;
    this.isDrifting = false;

    // Suspension
    this.pitch = 0.0;
    this.roll = 0.0;

    // Transmission & RPM simulation
    this.gear = 1;
    this.rpmNorm = 0.15;
    this.gearRatios = [38, 72, 112, 150, 185];

    // Cameras
    this.cameraMode = 'chase'; // 'chase' or 'cockpit'
    this.chaseCamPos = new THREE.Vector3();
    this.chaseLookTarget = new THREE.Vector3();

    // 3D Objects
    this.carGroup = new THREE.Group();
    this.wheels = [];
    this.brakeLights = [];
    this.headlights = [];
    this.dustParticles = null;

    this.buildStylizedSportsCar();
    this.buildDustSystem();
  }

  buildStylizedSportsCar() {
    // Premium Metallic Paint (Signature Vibrant Violet with Metallic Sheen)
    const paintMat = new THREE.MeshStandardMaterial({
      color: 0x6854ee,
      roughness: 0.28,
      metalness: 0.75
    });

    const accentMat = new THREE.MeshStandardMaterial({
      color: 0xb4a9ff, // Lighter violet trim
      roughness: 0.2,
      metalness: 0.8
    });

    const carbonMat = new THREE.MeshStandardMaterial({
      color: 0x14151a,
      roughness: 0.65,
      metalness: 0.3
    });

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x151b28,
      roughness: 0.05,
      metalness: 0.95
    });

    // 1. Lower Sculpted Chassis
    const chassisGeom = new THREE.BoxGeometry(2.1, 0.58, 4.3);
    const chassis = new THREE.Mesh(chassisGeom, paintMat);
    chassis.position.y = 0.48;
    chassis.castShadow = true;
    this.carGroup.add(chassis);

    // Front Bumper Splitter & Diffuser
    const splitterGeom = new THREE.BoxGeometry(2.16, 0.1, 0.4);
    const splitter = new THREE.Mesh(splitterGeom, carbonMat);
    splitter.position.set(0, 0.24, 2.15);
    this.carGroup.add(splitter);

    const diffuserGeom = new THREE.BoxGeometry(2.1, 0.16, 0.35);
    const diffuser = new THREE.Mesh(diffuserGeom, carbonMat);
    diffuser.position.set(0, 0.26, -2.15);
    this.carGroup.add(diffuser);

    // 2. Aerodynamic Tapered Cockpit Canopy
    const cabinGeom = new THREE.BoxGeometry(1.68, 0.54, 2.3);
    const cabin = new THREE.Mesh(cabinGeom, paintMat);
    cabin.position.set(0, 0.98, -0.15);
    cabin.castShadow = true;
    this.carGroup.add(cabin);

    // Front Windshield
    const windshieldGeom = new THREE.BoxGeometry(1.62, 0.48, 0.08);
    const windshield = new THREE.Mesh(windshieldGeom, glassMat);
    windshield.position.set(0, 0.98, 0.98);
    windshield.rotation.x = -0.32;
    this.carGroup.add(windshield);

    // Rear Window
    const rearGlassGeom = new THREE.BoxGeometry(1.58, 0.44, 0.08);
    const rearGlass = new THREE.Mesh(rearGlassGeom, glassMat);
    rearGlass.position.set(0, 0.96, -1.28);
    rearGlass.rotation.x = 0.35;
    this.carGroup.add(rearGlass);

    // Violet GT Spoiler
    const wingGeom = new THREE.BoxGeometry(1.95, 0.06, 0.32);
    const wing = new THREE.Mesh(wingGeom, accentMat);
    wing.position.set(0, 1.05, -2.05);
    this.carGroup.add(wing);

    // Side Mirrors
    const mirrorGeom = new THREE.BoxGeometry(0.24, 0.12, 0.16);
    const leftMirror = new THREE.Mesh(mirrorGeom, paintMat);
    leftMirror.position.set(-1.08, 0.88, 0.55);
    const rightMirror = leftMirror.clone();
    rightMirror.position.x = 1.08;
    this.carGroup.add(leftMirror);
    this.carGroup.add(rightMirror);

    // Twin Chrome Exhaust Pipes
    const exhaustGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.25, 8);
    exhaustGeom.rotateX(Math.PI / 2);
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xdde2ea, metalness: 0.95, roughness: 0.15 });
    const exLeft = new THREE.Mesh(exhaustGeom, chromeMat);
    exLeft.position.set(-0.55, 0.22, -2.25);
    const exRight = exLeft.clone();
    exRight.position.x = 0.55;
    this.carGroup.add(exLeft);
    this.carGroup.add(exRight);

    // Contact Ambient Shadow beneath car (Soft realistic road grounding)
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const sCtx = shadowCanvas.getContext('2d');
    const grad = sCtx.createRadialGradient(64, 64, 10, 64, 64, 60);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
    grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.35)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    sCtx.fillStyle = grad;
    sCtx.fillRect(0, 0, 128, 128);
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);

    const shadowPlaneGeom = new THREE.PlaneGeometry(2.8, 5.0);
    shadowPlaneGeom.rotateX(-Math.PI / 2);
    const shadowPlaneMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });
    const shadowMesh = new THREE.Mesh(shadowPlaneGeom, shadowPlaneMat);
    shadowMesh.position.y = 0.04;
    this.carGroup.add(shadowMesh);

    // 3. LED Headlight Strips (Cyan Glow)
    const hlGeom = new THREE.BoxGeometry(0.42, 0.1, 0.08);
    const hlMat = new THREE.MeshBasicMaterial({ color: 0x56d9ff });
    const hlLeft = new THREE.Mesh(hlGeom, hlMat);
    hlLeft.position.set(-0.76, 0.52, 2.16);
    const hlRight = hlLeft.clone();
    hlRight.position.x = 0.76;
    this.carGroup.add(hlLeft);
    this.carGroup.add(hlRight);

    // 4. LED Taillight Bar (Red Glowing Strip)
    const tlGeom = new THREE.BoxGeometry(1.88, 0.1, 0.08);
    const tlMat = new THREE.MeshStandardMaterial({
      color: 0x550005,
      emissive: 0xaa0010,
      emissiveIntensity: 0.8
    });
    const tlBar = new THREE.Mesh(tlGeom, tlMat);
    tlBar.position.set(0, 0.54, -2.16);
    this.carGroup.add(tlBar);
    this.brakeLights.push(tlBar);

    // 5. 4 Wheels with Silver Star Rims & Rubber Tires
    const wheelGeom = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 18);
    wheelGeom.rotateZ(Math.PI / 2);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x16171b, roughness: 0.88 });

    const rimGeom = new THREE.CylinderGeometry(0.25, 0.25, 0.32, 10);
    rimGeom.rotateZ(Math.PI / 2);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xc4cbd4, metalness: 0.85, roughness: 0.2 });

    const wheelPos = [
      { x: -1.06, z: 1.35, isFront: true },
      { x: 1.06, z: 1.35, isFront: true },
      { x: -1.06, z: -1.35, isFront: false },
      { x: 1.06, z: -1.35, isFront: false }
    ];

    wheelPos.forEach((p) => {
      const wGroup = new THREE.Group();
      wGroup.position.set(p.x, 0.38, p.z);

      const tire = new THREE.Mesh(wheelGeom, tireMat);
      tire.castShadow = true;
      const rim = new THREE.Mesh(rimGeom, rimMat);
      wGroup.add(tire);
      wGroup.add(rim);

      this.carGroup.add(wGroup);
      this.wheels.push({ mesh: wGroup, isFront: p.isFront });
    });

    this.scene.add(this.carGroup);
  }

  buildDustSystem() {
    const pCount = 45;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount * 3; i++) positions[i] = 0;

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const pMat = new THREE.PointsMaterial({
      color: 0x8b5a44,
      size: 0.5,
      transparent: true,
      opacity: 0.0
    });

    this.dustParticles = new THREE.Points(geom, pMat);
    this.scene.add(this.dustParticles);
  }

  update(dt, input) {
    let isBraking = false;

    // 1. Throttle / Acceleration & Braking Dynamics
    if (input.keys.throttle > 0) {
      const topCap = this.isOffRoad ? 70.0 : this.maxSpeedKmh;
      const efficiency = Math.max(0.2, 1.0 - (this.speedKmh / topCap));
      this.speedKmh += this.accelRate * efficiency * dt;
    } else if (input.keys.brake > 0) {
      if (this.speedKmh > 1.5) {
        this.speedKmh -= this.brakeRate * dt;
        isBraking = true;
      } else {
        // Reverse
        this.speedKmh = Math.max(-28.0, this.speedKmh - 18.0 * dt);
      }
    } else {
      // Natural rolling drag
      const drag = this.isOffRoad ? this.dragRate * 4.0 : this.dragRate;
      if (this.speedKmh > 0) {
        this.speedKmh = Math.max(0, this.speedKmh - drag * dt);
      } else if (this.speedKmh < 0) {
        this.speedKmh = Math.min(0, this.speedKmh + drag * dt);
      }
    }

    // Handbrake / Drift
    this.isDrifting = false;
    if (input.keys.handbrake && Math.abs(this.speedKmh) > 20) {
      this.isDrifting = true;
      this.speedKmh = Math.max(0, this.speedKmh - this.brakeRate * 0.7 * dt);
      isBraking = true;
    }

    const topAllowed = this.isOffRoad ? 70.0 : this.maxSpeedKmh;
    this.speedKmh = Math.max(-28.0, Math.min(topAllowed, this.speedKmh));

    // Dynamic Taillight Brightness
    const brakeColor = isBraking ? 0xff1e32 : 0x66000c;
    const brakeEmit = isBraking ? 2.8 : 0.8;
    this.brakeLights.forEach(bl => {
      bl.material.emissive.setHex(brakeColor);
      bl.material.emissiveIntensity = brakeEmit;
    });

    // 2. Transmission & Simulated RPM
    this.updateTransmission();

    // 3. Progressive Steering with Speed Dampening
    const speedFactor = THREE.MathUtils.clamp(1.0 - (Math.abs(this.speedKmh) / 240.0), 0.28, 1.0);
    const targetSteer = input.keys.steer * this.maxSteerAngle * speedFactor;
    this.steerAngle += (targetSteer - this.steerAngle) * Math.min(1.0, 9.0 * dt);

    // Wheel visual rotation and steering
    const rollRate = (this.speedKmh / 3.6) / 0.38;
    this.wheels.forEach(w => {
      if (w.isFront) {
        w.mesh.rotation.y = -this.steerAngle * 1.1;
      }
      w.mesh.rotation.x += rollRate * dt;
    });

    // 4. Spline Progress
    const speedMs = this.speedKmh / 3.6;
    const roadLen = this.world.totalLength || 3500;
    const deltaU = (speedMs * dt) / roadLen;

    this.progressU = ((this.progressU + deltaU) % 1.0 + 1.0) % 1.0;

    // Lateral movement across road width
    const driftMultiplier = this.isDrifting ? 2.4 : 1.0;
    const lateralSpeed = this.steerAngle * Math.abs(speedMs) * 1.65 * driftMultiplier;
    this.lateralOffset += lateralSpeed * dt;

    // Check if car is outside the road lanes (past curb)
    const halfRoad = this.world.roadWidth / 2;
    this.isOffRoad = Math.abs(this.lateralOffset) > halfRoad;

    // Clamp lateral bounds so car cannot fall off the world entirely
    const maxLateral = halfRoad + this.world.shoulderWidth + 1.2;
    this.lateralOffset = THREE.MathUtils.clamp(this.lateralOffset, -maxLateral, maxLateral);

    // 5. Position & Orient Vehicle on Spline
    const { point, tangent, right, normal } = this.world.getRoadFrameAt(this.progressU);

    const carPos = point.clone().addScaledVector(right, this.lateralOffset);
    // Ground car precisely on road surface
    carPos.addScaledVector(normal, 0.05);
    this.carGroup.position.copy(carPos);

    // Vehicle heading: road tangent rotated by current steering/drift angle
    const headingTangent = tangent.clone();
    headingTangent.applyAxisAngle(normal, this.steerAngle * (this.isDrifting ? 0.75 : 0.45));

    // Stable look-at orientation aligned with road normal
    const rotMat = new THREE.Matrix4();
    const carRight = new THREE.Vector3().crossVectors(normal, headingTangent).normalize();
    rotMat.makeBasis(carRight, normal, headingTangent);
    this.carGroup.quaternion.setFromRotationMatrix(rotMat);

    // Suspension dynamics: nose dips on brake, squats on accel, banks on turns
    const targetPitch = isBraking ? -0.05 : (input.keys.throttle > 0 ? 0.035 : 0.0);
    this.pitch += (targetPitch - this.pitch) * 12 * dt;

    const targetRoll = -this.steerAngle * (Math.abs(this.speedKmh) / 180) * 0.12;
    this.roll += (targetRoll - this.roll) * 12 * dt;

    this.carGroup.rotateX(this.pitch);
    this.carGroup.rotateZ(this.roll);

    // Handle single-action commands
    if (input.consumeAction('changeCamera')) {
      this.toggleCamera();
    }
    if (input.consumeAction('reset')) {
      this.resetPosition();
    }

    return {
      speedKmh: Math.round(this.speedKmh),
      rpmNorm: this.rpmNorm,
      isSkidding: this.isDrifting || (Math.abs(this.steerAngle) > 0.35 && this.speedKmh > 55),
      isBraking: isBraking,
      isOffRoad: this.isOffRoad,
      gear: this.gear
    };
  }

  updateTransmission() {
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
    this.rpmNorm = THREE.MathUtils.clamp((spd - prevRatio) / (nextRatio - prevRatio), 0.15, 1.0);
  }

  toggleCamera() {
    this.cameraMode = (this.cameraMode === 'chase') ? 'cockpit' : 'chase';
  }

  updateCamera(camera, dt) {
    const forward = this.getForwardVector();

    if (this.cameraMode === 'chase') {
      // Smooth dynamic follow camera (Slow Roads feel)
      const speedNorm = Math.min(1.0, Math.abs(this.speedKmh) / 180);
      const dist = 7.4 + speedNorm * 1.8;
      const height = 2.9 + speedNorm * 0.4;

      const idealPos = this.carGroup.position.clone().addScaledVector(forward, -dist);
      idealPos.y += height;

      if (this.chaseCamPos.lengthSq() < 1) {
        this.chaseCamPos.copy(idealPos);
      } else {
        this.chaseCamPos.lerp(idealPos, Math.min(1.0, 10.0 * dt));
      }
      camera.position.copy(this.chaseCamPos);

      const lookAhead = this.carGroup.position.clone().addScaledVector(forward, 12.0);
      lookAhead.y += 1.6;

      if (this.chaseLookTarget.lengthSq() < 1) {
        this.chaseLookTarget.copy(lookAhead);
      } else {
        this.chaseLookTarget.lerp(lookAhead, Math.min(1.0, 12.0 * dt));
      }
      camera.lookAt(this.chaseLookTarget);

      camera.fov = 60 + speedNorm * 12;
      camera.updateProjectionMatrix();

    } else {
      // Cockpit / Hood View
      const hoodPos = this.carGroup.position.clone().addScaledVector(forward, 0.45);
      hoodPos.y += 1.12;

      camera.position.copy(hoodPos);

      const lookTarget = this.carGroup.position.clone().addScaledVector(forward, 28.0);
      lookTarget.y += 0.95;

      camera.lookAt(lookTarget);
      camera.fov = 72;
      camera.updateProjectionMatrix();
    }
  }

  getForwardVector() {
    const f = new THREE.Vector3(0, 0, 1);
    f.applyQuaternion(this.carGroup.quaternion);
    return f;
  }

  resetPosition() {
    this.lateralOffset = 0.0;
    this.speedKmh = 0.0;
    this.steerAngle = 0.0;
    this.pitch = 0.0;
    this.roll = 0.0;
  }
}

window.Vehicle = Vehicle;
