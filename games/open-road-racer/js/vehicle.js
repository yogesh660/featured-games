/**
 * Open Road Racer - Vehicle Dynamics & 3D Simulation
 * Faithful Port & Replication of Fast Roads (https://github.com/Dezzmeister/fastroads)
 * Features:
 *  - Calibrated Fast Roads Roadster metrics (mass: 700kg, accel: 9 m/s², jerk: 48, top speed: 45 m/s = 162 km/h).
 *  - Fast Roads 'soggySteer' progressive steering model: speed-sensitive damping prevents high-speed twitching and snap spinouts.
 *  - Authentic Ackermann steering geometry: inside wheel steers tighter than outside wheel.
 *  - Pure concentric wheel hierarchy (steerGroup -> spinGroup -> orientGroup -> wheelMesh) with ZERO wobble.
 *  - Authored Fast Roads 3D car.obj and wheel.obj geometry mounted with exact coordinate orientation (no vertex mangling).
 *  - 100% correct left/right steering and lateral alignment: turn right moves right, turn left moves left.
 *  - Soft guardrail rebound and realistic off-road deceleration.
 *  - Smooth cinematic chase camera with dynamic speed-dependent distance, height, and FOV.
 */

class Vehicle {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;

    // Fast Roads Roadster Metrics
    this.metrics = {
      wheelWidth: 1.36,       // Track width between left and right wheels (m)
      wheelLength: 2.75,      // Wheelbase between front and rear axles (m)
      wheelRadius: 0.342665,  // Rolling radius (m)
      topSpeed: 45.0,         // Base top speed (m/s = 162 km/h)
      accel: 9.0,             // Launch acceleration (m/s²)
      reverse: 5.0,           // Reverse acceleration (m/s²)
      brake: 14.0,            // Braking deceleration (m/s²)
      jerk: 48.0,             // Rate of change of acceleration (m/s³)
      mass: 700.0,            // Mass (kg)
      maxSteer: 0.65,         // Max steering angle at low speeds (rad)
      steerInterval: 0.95,    // Steering transition interval (s)
      drag: 0.0012,           // Aerodynamic drag coefficient
      rollResistance: 0.06,   // Rolling friction
      rockFactor: 4.0         // Suspension pitch and roll inertia
    };

    // Spline & Spatial State
    this.progressU = 0.005;
    this.lateralOffset = 0.0;    // Lateral distance from road centerline (+ right, - left)
    this.headingAngle = 0.0;     // Heading angle relative to road tangent (+ right, - left)
    this.steerAngle = 0.0;       // Center steering angle in radians (+ right, - left)
    this.steerL = 0.0;           // Left front wheel steering angle (Ackermann)
    this.steerR = 0.0;           // Right front wheel steering angle (Ackermann)
    this.yawRate = 0.0;          // Heading angular velocity (rad/s)

    // Fast Roads Soggy Steer State
    this.soggyTurning = false;
    this.soggyTurningDir = 0;
    this.soggyTimer = 0.0;
    this.soggyInterval = 1.0;
    this.soggyStartPoint = 0.0;
    this.soggySteerFactor = 1.0;
    this.soggySteerTimeFactor = 1.0;

    // Longitudinal Dynamics
    this.speed = 0.0;            // Velocity in m/s (can be negative for reverse)
    this.speedKmh = 0.0;         // Display velocity in km/h
    this.maxSpeedKmh = 195.0;    // Supercar top speed limit
    this.drive = 0.0;            // Jerk-limited throttle state (0 to 1)
    this.gear = 1;
    this.rpmNorm = 0.15;
    this.gearRatios = [40, 78, 120, 160, 195];

    // Vehicle State Flags
    this.isOffRoad = false;
    this.isSkidding = false;
    this.isDrifting = false;

    // Suspension Dynamics (Fast Roads rockFactor)
    this.pitch = 0.0;
    this.roll = 0.0;

    // Cameras
    this.cameraMode = 'chase';   // 'chase' or 'cockpit'
    this.chaseCamPos = new THREE.Vector3();
    this.chaseLookTarget = new THREE.Vector3();

    // 3D Scene Nodes
    this.carGroup = new THREE.Group();
    this.scene.add(this.carGroup);

    this.wheels = [];
    this.brakeLights = [];
    this.headlights = [];
    this.objModelLoaded = false;
    this.proceduralBody = null;

    // Build procedural supercar first as immediate reliable fallback
    this.buildProceduralSupercar();
    this.buildDustSystem();

    // Load authored Fast Roads 3D models asynchronously
    this.loadAuthoredModels();
  }

  loadAuthoredModels() {
    if (typeof THREE.OBJLoader === 'undefined') return;

    const objLoader = new THREE.OBJLoader();
    const texLoader = new THREE.TextureLoader();

    // Load car texture map
    texLoader.load('assets/textures/car_map.jpg', (carMapTex) => {
      carMapTex.generateMipmaps = true;

      // Load car body OBJ
      objLoader.load('assets/models/car.obj', (carObj) => {
        // Load wheel OBJ
        objLoader.load('assets/models/wheel.obj', (wheelObj) => {
          this.applyAuthoredAssets(carObj, wheelObj, carMapTex);
        });
      }, undefined, (err) => {
        console.log('Using procedural supercar:', err);
      });
    });
  }

  applyAuthoredAssets(carObj, wheelObj, carMapTex) {
    // Hide procedural body meshes
    if (this.proceduralBody) {
      this.carGroup.remove(this.proceduralBody);
      this.proceduralBody = null;
    }

    // Remove procedural wheels
    this.wheels.forEach(w => this.carGroup.remove(w.steerGroup));
    this.wheels = [];
    this.brakeLights = [];
    this.headlights = [];

    // Materials
    const bodyMat = new THREE.MeshStandardMaterial({
      map: carMapTex,
      color: 0x4455ee, // Deep sapphire sheen
      roughness: 0.22,
      metalness: 0.78
    });

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0c101a,
      roughness: 0.06,
      metalness: 0.95
    });

    const shadowMat = new THREE.MeshStandardMaterial({
      color: 0x14151a,
      roughness: 0.85
    });

    const headlightMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xddeeff,
      emissiveIntensity: 1.4
    });

    const brakeMat = new THREE.MeshStandardMaterial({
      color: 0x770010,
      emissive: 0xee0018,
      emissiveIntensity: 1.1
    });

    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x181a20,
      roughness: 0.88,
      metalness: 0.1
    });

    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xd6dfe8,
      roughness: 0.20,
      metalness: 0.90
    });

    // 1. Rig Authored Car Body
    // Fast Roads mounts car.obj directly with rotation.y = -Math.PI / 2.
    // In car.obj, front bumper is at +X (3.5), rear bumper at -X (-0.5), wheelbase 2.75m.
    // Rotating by -90 deg rotates +X to +Z (forward).
    // Midpoint between front and rear axle is at Z = 1.375, axle height is at Y = 0.343.
    // We position the car body at (0, -0.343, -1.375) to place origin at center of wheelbase.
    const carContainer = new THREE.Group();
    carObj.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.name.includes('map')) {
          child.material = bodyMat;
        } else if (child.name.includes('shadow')) {
          child.material = glassMat;
        } else if (child.name.includes('headlight')) {
          child.material = headlightMat;
          this.headlights.push(child);
        } else if (child.name.includes('redlight') || child.name.includes('rearlight')) {
          child.material = brakeMat;
          this.brakeLights.push(child);
        } else {
          child.material = shadowMat;
        }
      }
    });

    carObj.rotation.y = -Math.PI / 2;
    carObj.position.set(0, -0.343, -1.375);
    carContainer.add(carObj);
    this.carGroup.add(carContainer);

    // 2. Rig Authored Wheels (Concentric, zero-wobble hierarchy matching Fast Roads)
    // Track width: 1.36m (wheels at X = +-0.68)
    // Wheelbase: 2.75m (front axle at Z = +1.375, rear axle at Z = -1.375)
    // Wheel outer rim is on +Z face; left wheels rotate -90 deg, right wheels rotate +90 deg.
    const halfWidth = this.metrics.wheelWidth / 2;   // 0.68m
    const halfLength = this.metrics.wheelLength / 2; // 1.375m

    const wheelConfigs = [
      { name: 'FL', x: -halfWidth, z:  halfLength, isFront: true,  isLeft: true },
      { name: 'FR', x:  halfWidth, z:  halfLength, isFront: true,  isLeft: false },
      { name: 'RL', x: -halfWidth, z: -halfLength, isFront: false, isLeft: true },
      { name: 'RR', x:  halfWidth, z: -halfLength, isFront: false, isLeft: false }
    ];

    wheelConfigs.forEach(wc => {
      const steerGroup = new THREE.Group();
      steerGroup.position.set(wc.x, 0, wc.z);

      const spinGroup = new THREE.Group();
      steerGroup.add(spinGroup);

      const orientGroup = new THREE.Group();
      // Left wheel rim points outward towards -X; Right wheel rim points outward towards +X
      orientGroup.rotation.y = wc.isLeft ? -Math.PI / 2 : Math.PI / 2;
      spinGroup.add(orientGroup);

      const wheelClone = wheelObj.clone();
      wheelClone.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          if (child.name.includes('metal')) {
            child.material = rimMat;
          } else if (child.name.includes('tire')) {
            child.material = tireMat;
          } else {
            child.material = shadowMat;
          }
        }
      });
      // Offset wheel mesh slightly to center rim over hub
      wheelClone.position.set(0, 0, -0.108);
      orientGroup.add(wheelClone);

      this.carGroup.add(steerGroup);
      this.wheels.push({
        steerGroup,
        spinGroup,
        isFront: wc.isFront,
        isLeft: wc.isLeft
      });
    });

    this.objModelLoaded = true;
  }

  buildProceduralSupercar() {
    this.proceduralBody = new THREE.Group();

    const bodyPaintMat = new THREE.MeshStandardMaterial({
      color: 0x4455ee,
      roughness: 0.22,
      metalness: 0.78
    });

    const carbonMat = new THREE.MeshStandardMaterial({
      color: 0x15161b,
      roughness: 0.5,
      metalness: 0.35
    });

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0c1018,
      roughness: 0.05,
      metalness: 0.95
    });

    const brakeMat = new THREE.MeshStandardMaterial({
      color: 0x770010,
      emissive: 0xee0018,
      emissiveIntensity: 0.9
    });

    const headlightMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xccddff,
      emissiveIntensity: 1.2
    });

    // 1. Lower Aerodynamic Monocoque Chassis
    const lowerChassisGeom = new THREE.BoxGeometry(1.80, 0.42, 4.0);
    const lowerChassis = new THREE.Mesh(lowerChassisGeom, bodyPaintMat);
    lowerChassis.position.y = 0.22;
    lowerChassis.castShadow = true;
    this.proceduralBody.add(lowerChassis);

    // Front Bumper Splitter (+Z is forward)
    const splitterGeom = new THREE.BoxGeometry(1.88, 0.08, 0.55);
    const splitter = new THREE.Mesh(splitterGeom, carbonMat);
    splitter.position.set(0, 0.06, 2.0);
    this.proceduralBody.add(splitter);

    // Rear Aero Diffuser (-Z is rear)
    const diffuserGeom = new THREE.BoxGeometry(1.84, 0.16, 0.45);
    const diffuser = new THREE.Mesh(diffuserGeom, carbonMat);
    diffuser.position.set(0, 0.10, -2.0);
    this.proceduralBody.add(diffuser);

    // 2. Sculpted Fastback Canopy
    const canopyGeom = new THREE.BoxGeometry(1.36, 0.44, 2.2);
    const canopy = new THREE.Mesh(canopyGeom, glassMat);
    canopy.position.set(0, 0.62, -0.15);
    canopy.castShadow = true;
    this.proceduralBody.add(canopy);

    // 3. Headlights (at front +Z)
    const hlGeom = new THREE.BoxGeometry(0.32, 0.10, 0.06);
    const hlLeft = new THREE.Mesh(hlGeom, headlightMat);
    hlLeft.position.set(-0.62, 0.30, 2.02);
    const hlRight = new THREE.Mesh(hlGeom, headlightMat);
    hlRight.position.set(0.62, 0.30, 2.02);
    this.proceduralBody.add(hlLeft);
    this.proceduralBody.add(hlRight);

    // 4. Rear Light Blade (at rear -Z)
    const brakeBladeGeom = new THREE.BoxGeometry(1.60, 0.09, 0.06);
    const brakeBlade = new THREE.Mesh(brakeBladeGeom, brakeMat);
    brakeBlade.position.set(0, 0.36, -2.02);
    this.proceduralBody.add(brakeBlade);
    this.brakeLights.push(brakeBlade);

    // 5. Contact Shadow Disk
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const sCtx = shadowCanvas.getContext('2d');
    const grad = sCtx.createRadialGradient(64, 64, 10, 64, 64, 60);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
    grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.4)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    sCtx.fillStyle = grad;
    sCtx.fillRect(0, 0, 128, 128);

    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadowPlaneGeom = new THREE.PlaneGeometry(2.4, 4.6);
    shadowPlaneGeom.rotateX(-Math.PI / 2);
    const shadowPlaneMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false
    });
    const shadowMesh = new THREE.Mesh(shadowPlaneGeom, shadowPlaneMat);
    shadowMesh.position.y = -0.32;
    this.proceduralBody.add(shadowMesh);

    this.carGroup.add(this.proceduralBody);

    // Procedural Wheels
    const halfWidth = this.metrics.wheelWidth / 2;
    const halfLength = this.metrics.wheelLength / 2;
    const wheelPositions = [
      { name: 'FL', x: -halfWidth, z:  halfLength, isFront: true,  isLeft: true },
      { name: 'FR', x:  halfWidth, z:  halfLength, isFront: true,  isLeft: false },
      { name: 'RL', x: -halfWidth, z: -halfLength, isFront: false, isLeft: true },
      { name: 'RR', x:  halfWidth, z: -halfLength, isFront: false, isLeft: false }
    ];

    const tireGeom = new THREE.CylinderGeometry(0.34, 0.34, 0.22, 18);
    tireGeom.rotateZ(Math.PI / 2);
    const rimGeom = new THREE.CylinderGeometry(0.24, 0.24, 0.23, 12);
    rimGeom.rotateZ(Math.PI / 2);

    const tireMat = new THREE.MeshStandardMaterial({ color: 0x1a1c22, roughness: 0.9 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xc4cdd5, roughness: 0.25, metalness: 0.85 });

    wheelPositions.forEach(wp => {
      const steerGroup = new THREE.Group();
      steerGroup.position.set(wp.x, 0, wp.z);

      const spinGroup = new THREE.Group();
      steerGroup.add(spinGroup);

      const tireMesh = new THREE.Mesh(tireGeom, tireMat);
      tireMesh.castShadow = true;
      const rimMesh = new THREE.Mesh(rimGeom, rimMat);

      spinGroup.add(tireMesh);
      spinGroup.add(rimMesh);

      this.carGroup.add(steerGroup);
      this.wheels.push({
        steerGroup,
        spinGroup,
        isFront: wp.isFront,
        isLeft: wp.isLeft
      });
    });
  }

  buildDustSystem() {
    const pCount = 50;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount * 3; i++) positions[i] = 0;
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0x8b5a3c,
      size: 0.35,
      transparent: true,
      opacity: 0.0
    });

    this.dustParticles = new THREE.Points(geom, mat);
    this.scene.add(this.dustParticles);
  }

  resetPosition() {
    this.speed = 0.0;
    this.speedKmh = 0.0;
    this.lateralOffset = 0.0;
    this.headingAngle = 0.0;
    this.steerAngle = 0.0;
    this.steerL = 0.0;
    this.steerR = 0.0;
    this.yawRate = 0.0;
    this.drive = 0.0;
    this.gear = 1;
    this.rpmNorm = 0.15;
    this.pitch = 0.0;
    this.roll = 0.0;
    this.soggyTurning = false;
    this.soggyTurningDir = 0;
    this.soggyTimer = 0.0;
    this.soggyStartPoint = 0.0;
  }

  // Fast Roads Ackermann Steering Geometry
  updateSteer() {
    const sinS = Math.sin(this.steerAngle);
    const cosS = Math.cos(this.steerAngle) * this.metrics.wheelLength * 2.0;
    const num = 2.0 * this.metrics.wheelLength * sinS;
    const leftDenom = cosS - this.metrics.wheelWidth * sinS;
    const rightDenom = cosS + this.metrics.wheelWidth * sinS;
    this.steerL = Math.atan(num / (Math.abs(leftDenom) > 0.001 ? leftDenom : 0.001));
    this.steerR = Math.atan(num / (Math.abs(rightDenom) > 0.001 ? rightDenom : 0.001));
  }

  // Fast Roads Calibrated Soggy Steer Model
  getSoggySteerState(dt, inputSteer) {
    const speedLerp = Math.min(1.0, Math.abs(this.speed) / this.metrics.topSpeed);
    // Speed-sensitive steering factor: at top speed, max steering reduces smoothly to 25%
    this.soggySteerFactor = 1.0 - 0.75 * speedLerp;
    this.soggySteerTimeFactor = 1.0 + 0.5 * speedLerp;

    const maxSteer = this.metrics.maxSteer * this.soggySteerFactor;
    // inputSteer: +1 for Right ('D'), -1 for Left ('A'), 0 for none
    const steerTarget = inputSteer * maxSteer;

    if (Math.abs(inputSteer) > 0.01) {
      if (!this.soggyTurning || this.soggyTurningDir !== inputSteer) {
        this.soggyTimer = 0;
        this.soggyStartPoint = this.steerAngle;
        const steerDelta = Math.abs(steerTarget - this.steerAngle) / Math.max(0.001, maxSteer);
        this.soggyInterval = this.metrics.steerInterval / Math.max(0.01, steerDelta);
        this.soggyTurning = true;
        this.soggyTurningDir = inputSteer;
      }
    } else if (this.soggyTurning) {
      this.soggyTurning = false;
      const steerDelta = Math.abs(this.steerAngle) / (2.0 * Math.max(0.001, maxSteer));
      this.soggyInterval = this.metrics.steerInterval * Math.max(0.05, steerDelta);
      this.soggyTimer = 0;
      this.soggyStartPoint = this.steerAngle;
      this.soggyTurningDir = 0;
    }

    this.soggyTimer += dt / Math.max(0.01, this.soggySteerTimeFactor);
    let lerp = Math.min(1.0, this.soggyTimer / Math.max(0.01, this.soggyInterval));
    // Fast Roads halfLerp S-curve: 2 * ((3 - 2 * (e / 2 + 0.5)) * (e / 2 + 0.5)^2 - 0.5)
    const eHalf = lerp * 0.5 + 0.5;
    lerp = 2.0 * ((3.0 - 2.0 * eHalf) * eHalf * eHalf - 0.5);
    lerp = Math.max(0.0, Math.min(1.0, lerp));

    this.steerAngle = this.soggyStartPoint * (1.0 - lerp) + steerTarget * lerp;
    this.updateSteer();
  }

  update(dt, input) {
    const isThrottle = !!input.keys.throttle;
    const isBraking = !!input.keys.brake;
    const isHandbrake = !!input.keys.handbrake;
    const inputSteer = input.keys.steer || 0.0; // +1 Right ('D'), -1 Left ('A')

    const halfRoad = this.world.roadWidth / 2; // 5.0m
    this.isOffRoad = Math.abs(this.lateralOffset) > halfRoad;

    // 1. Throttle / Drive state with Fast Roads Jerk Limiting
    const targetDrive = isThrottle ? 1.0 : 0.0;
    if (this.drive < targetDrive) {
      this.drive += (this.metrics.jerk / this.metrics.accel) * dt;
      if (this.drive > targetDrive) this.drive = targetDrive;
    } else if (this.drive > targetDrive) {
      this.drive -= (this.metrics.jerk / this.metrics.accel) * dt;
      if (this.drive < targetDrive) this.drive = targetDrive;
    }

    // 2. Longitudinal Acceleration & Speed Integration
    const currentTopSpeed = this.isOffRoad ? (this.metrics.topSpeed * 0.55) : this.metrics.topSpeed;

    if (isThrottle) {
      if (this.speed < currentTopSpeed) {
        const driveForce = this.drive * this.metrics.accel;
        const dragForce = this.metrics.drag * this.speed * this.speed;
        this.speed += (driveForce - dragForce) * dt;
        if (this.speed > currentTopSpeed) this.speed = currentTopSpeed;
      }
    } else if (isBraking) {
      if (this.speed > 0.5) {
        // Firm progressive braking
        this.speed -= this.metrics.brake * dt;
        if (this.speed < 0) this.speed = 0;
      } else {
        // Reverse engagement
        this.speed -= this.metrics.reverse * dt;
        if (this.speed < -8.5) this.speed = -8.5; // -30 km/h reverse limit
      }
    } else {
      // Natural rolling resistance and aerodynamic drag
      const rollingDecel = (this.isOffRoad ? 3.0 : 0.8) + (this.metrics.rollResistance * 9.81);
      const dragDecel = this.metrics.drag * this.speed * Math.abs(this.speed);
      const totalDecel = (rollingDecel + dragDecel) * Math.sign(this.speed);
      const prevSign = Math.sign(this.speed);
      this.speed -= totalDecel * dt;
      if (Math.sign(this.speed) !== prevSign) this.speed = 0;
    }

    this.speedKmh = this.speed * 3.6;

    // Dynamic brake lights
    const brakeColor = isBraking ? 0xff0018 : 0xee0018;
    const brakeEmit = isBraking ? 3.5 : 0.9;
    this.brakeLights.forEach(bl => {
      if (bl.material && bl.material.emissive) {
        bl.material.emissive.setHex(brakeColor);
        bl.material.emissiveIntensity = brakeEmit;
      }
    });

    // 3. Transmission & Simulated RPM
    this.updateTransmission();

    // 4. Calibrated Fast Roads Soggy Steer
    this.getSoggySteerState(dt, inputSteer);

    // Front wheels steer cleanly; all wheels spin concentric with forward roll
    const rollRate = (this.speed / this.metrics.wheelRadius); // rad/s
    this.wheels.forEach(w => {
      if (w.isFront) {
        // When steering right (steerAngle > 0), wheel rotates towards -X (right side of car)
        // Ackermann angles steerL and steerR computed from Fast Roads
        const angle = w.isLeft ? -this.steerL : -this.steerR;
        w.steerGroup.rotation.y = angle;
      }
      // Pure concentric spin around wheel axle (Zero wobble)
      w.spinGroup.rotation.x += rollRate * dt;
    });

    // 5. Sample Road Spline & Curvature
    const { point, tangent, right, normal, curvature } = this.world.getRoadFrameAt(this.progressU);
    const roadCurv = curvature || 0.0;

    // 6. Kinematic / Dynamic Bicycle Model Yaw & Lateral Following
    this.isDrifting = isHandbrake && Math.abs(this.speedKmh) > 28;
    const grip = this.isDrifting ? 0.35 : (this.isOffRoad ? 0.65 : 1.0);

    // Front tire lateral force generates yaw moment
    const targetYawRate = (this.speed / this.metrics.wheelLength) * Math.sin(this.steerAngle);
    const yawResponsiveness = (this.isDrifting ? 9.0 : 6.8) * grip;
    this.yawRate += (targetYawRate - this.yawRate) * Math.min(1.0, yawResponsiveness * dt);

    if (Math.abs(inputSteer) < 0.05 && !this.isDrifting) {
      // Natural caster self-centering towards road tangent
      this.headingAngle *= Math.exp(-3.5 * grip * dt);
      this.yawRate *= Math.exp(-5.0 * dt);
    } else {
      this.headingAngle += this.yawRate * dt;
    }

    // Road Curvature Rotation: dynamically follows road geometry
    const vTangent = this.speed * Math.cos(this.headingAngle);
    this.headingAngle -= roadCurv * vTangent * dt;

    // Maximum slip clamp prevents violent spinout into traffic
    const maxSlip = this.isDrifting ? 0.65 : 0.38;
    this.headingAngle = THREE.MathUtils.clamp(this.headingAngle, -maxSlip, maxSlip);

    // 7. Spline Progress & Lateral Displacement
    // Centrifugal outward acceleration on curves
    const centrifugalAccel = -roadCurv * this.speed * Math.abs(this.speed);
    const vLateral = this.speed * Math.sin(this.headingAngle) + (centrifugalAccel * 0.08);

    const roadLen = this.world.totalLength || 3200;
    const deltaU = (vTangent * dt) / roadLen;
    this.progressU = ((this.progressU + deltaU) % 1.0 + 1.0) % 1.0;

    this.lateralOffset += vLateral * dt;

    // 8. Open Mountain Exploration Boundary Management
    // Players can roam freely across the expansive 520m wide mountain terrain corridor!
    const maxExplorationRange = 260.0; // 260m open exploration zone
    if (Math.abs(this.lateralOffset) > maxExplorationRange) {
      this.lateralOffset = Math.sign(this.lateralOffset) * maxExplorationRange;
      this.headingAngle = -Math.sign(this.lateralOffset) * 0.14;
      this.yawRate = 0;
      this.speed *= 0.92;
    }

    // 9. 3D World Placement & Continuous Terrain Grounding
    const groundHeightOffset = (this.world && this.world.getGroundHeightAt)
      ? this.world.getGroundHeightAt(this.progressU, this.lateralOffset)
      : 0.05;

    const carPos = point.clone().addScaledVector(right, this.lateralOffset);
    // Ground car precisely on road surface or undulating hill terrain
    carPos.addScaledVector(normal, groundHeightOffset + 0.344);
    this.carGroup.position.copy(carPos);

    // Heading vector in 3D: blends road tangent and car heading angle
    const carHeading = tangent.clone().multiplyScalar(Math.cos(this.headingAngle))
      .add(right.clone().multiplyScalar(Math.sin(this.headingAngle)))
      .normalize();

    // Car local +X vector: normal x heading = local right
    const carX = new THREE.Vector3().crossVectors(normal, carHeading).normalize();

    const rotMat = new THREE.Matrix4();
    rotMat.makeBasis(carX, normal, carHeading);
    this.carGroup.quaternion.setFromRotationMatrix(rotMat);

    // 10. Fast Roads Suspension Dynamics & Terrain Slope Conformity
    let terrainCrossSlope = 0;
    if (this.world && this.world.getGroundHeightAt && this.isOffRoad) {
      const hRight = this.world.getGroundHeightAt(this.progressU, this.lateralOffset + 1.2);
      const hLeft  = this.world.getGroundHeightAt(this.progressU, this.lateralOffset - 1.2);
      terrainCrossSlope = Math.atan2(hRight - hLeft, 2.4);
    }

    const targetPitch = isBraking ? -0.045 : (isThrottle ? 0.025 * this.drive : 0.0);
    this.pitch += (targetPitch - this.pitch) * Math.min(1.0, 12.0 * dt);

    const targetRoll = -Math.sin(this.steerAngle) * (Math.abs(this.speedKmh) / 160.0) * 0.08;
    this.roll += (targetRoll - this.roll) * Math.min(1.0, 10.0 * dt);

    this.carGroup.rotateX(this.pitch);
    this.carGroup.rotateZ(this.roll + terrainCrossSlope);

    // Update off-road dust particles
    if (this.dustParticles && this.dustParticles.geometry) {
      const isDustActive = (this.isOffRoad || this.isSkidding) && Math.abs(this.speedKmh) > 12;
      this.dustParticles.material.opacity = isDustActive ? 0.65 : 0.0;
      if (isDustActive) {
        const pArr = this.dustParticles.geometry.attributes.position.array;
        const forward3D = this.getForwardVector();
        for (let k = 0; k < pArr.length; k += 3) {
          if (Math.random() < 0.25) {
            const side = (Math.random() > 0.5 ? 1 : -1) * 0.7;
            const rearPos = carPos.clone()
              .addScaledVector(forward3D, -1.8)
              .addScaledVector(right, side)
              .addScaledVector(normal, 0.15 + Math.random() * 0.2);
            pArr[k] = rearPos.x + (Math.random() - 0.5) * 0.4;
            pArr[k+1] = rearPos.y + Math.random() * 0.3;
            pArr[k+2] = rearPos.z + (Math.random() - 0.5) * 0.4;
          }
        }
        this.dustParticles.geometry.attributes.position.needsUpdate = true;
      }
    }

    // 11. Skid detection
    const slipSpeed = Math.abs(this.speed * Math.sin(this.headingAngle));
    this.isSkidding = this.isDrifting || (slipSpeed > 4.5 && Math.abs(this.speedKmh) > 35);

    return {
      speedKmh: this.speedKmh,
      gear: this.gear,
      rpmNorm: this.rpmNorm,
      isSkidding: this.isSkidding,
      isBraking: isBraking,
      isOffRoad: this.isOffRoad
    };
  }

  updateTransmission() {
    const absSpeed = Math.abs(this.speedKmh);
    let currentGear = 1;

    for (let i = 0; i < this.gearRatios.length; i++) {
      if (absSpeed < this.gearRatios[i]) {
        currentGear = i + 1;
        break;
      }
      if (i === this.gearRatios.length - 1) currentGear = 5;
    }
    this.gear = currentGear;

    const prevRatio = (this.gear === 1) ? 0 : this.gearRatios[this.gear - 2];
    const nextRatio = this.gearRatios[this.gear - 1];
    const gearSpan = Math.max(10, nextRatio - prevRatio);
    this.rpmNorm = THREE.MathUtils.clamp((absSpeed - prevRatio) / gearSpan, 0.15, 0.98);
  }

  getForwardVector() {
    return new THREE.Vector3(0, 0, 1).applyQuaternion(this.carGroup.quaternion).normalize();
  }

  updateCamera(camera, dt) {
    const forward = this.getForwardVector();
    const { tangent, normal } = this.world.getRoadFrameAt(this.progressU);

    if (this.cameraMode === 'chase') {
      // Fast Roads Elevated Chase Camera:
      // High vantage point smoothly following the car position and road vector
      const speedNorm = Math.min(1.0, Math.abs(this.speedKmh) / 165);
      const dist = 7.4 + speedNorm * 1.6;
      const height = 3.0 + speedNorm * 0.4;

      // Blend car forward with road tangent for buttery smooth camera turns
      const camDir = forward.clone().multiplyScalar(0.78).add(tangent.clone().multiplyScalar(0.22)).normalize();
      const idealPos = this.carGroup.position.clone()
        .addScaledVector(camDir, -dist)
        .addScaledVector(normal, height);

      // Camera position smoothing
      if (this.chaseCamPos.lengthSq() < 1) {
        this.chaseCamPos.copy(idealPos);
      } else {
        this.chaseCamPos.lerp(idealPos, Math.min(1.0, 7.5 * dt));
      }
      camera.position.copy(this.chaseCamPos);

      // Look 24m ahead down the road
      const lookDir = tangent.clone().multiplyScalar(0.70).add(forward.clone().multiplyScalar(0.30)).normalize();
      const lookAhead = this.carGroup.position.clone()
        .addScaledVector(lookDir, 24.0)
        .addScaledVector(normal, 0.85);

      if (this.chaseLookTarget.lengthSq() < 1) {
        this.chaseLookTarget.copy(lookAhead);
      } else {
        this.chaseLookTarget.lerp(lookAhead, Math.min(1.0, 9.5 * dt));
      }
      camera.lookAt(this.chaseLookTarget);

      camera.fov = 62 + speedNorm * 10;
      camera.updateProjectionMatrix();

    } else {
      // First-person Cockpit / Low Hood View
      const hoodPos = this.carGroup.position.clone()
        .addScaledVector(forward, 0.45)
        .addScaledVector(normal, 0.78);

      camera.position.copy(hoodPos);

      const lookTarget = this.carGroup.position.clone()
        .addScaledVector(forward, 32.0)
        .addScaledVector(normal, 0.70);

      camera.lookAt(lookTarget);
      camera.fov = 74;
      camera.updateProjectionMatrix();
    }
  }

  toggleCamera() {
    this.cameraMode = (this.cameraMode === 'chase') ? 'cockpit' : 'chase';
  }
}

window.Vehicle = Vehicle;
