/**
 * Open Road Racer - Modern Exotic Roadster Dynamics & Model
 * Features:
 *  - High-fidelity 3D roadster loaded from authored OBJ assets with procedural supercar fallback.
 *  - Mathematically decoupled two-tier wheel hierarchy (steerGroup + spinGroup = ZERO wobble).
 *  - Intuitive responsive steering & arcade physics (steer right turns right, steer left turns left).
 *  - Elevated Slow Roads chase camera ensuring the road ahead and lane markings are always clearly visible.
 *  - Dynamic brake lights & ground contact shadow.
 */

class Vehicle {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;

    // Spline parameter & Road offset
    this.progressU = 0.005;
    this.lateralOffset = 0.0; // Lateral position in meters (-5.0 to +5.0 is inside road)
    this.steerAngle = 0.0;
    this.maxSteerAngle = 0.58;

    // Dynamics
    this.speedKmh = 0.0;
    this.maxSpeedKmh = 195.0;
    this.accelRate = 58.0;      // km/h per sec
    this.brakeRate = 120.0;     // km/h per sec
    this.dragRate = 16.0;

    this.isOffRoad = false;
    this.isSkidding = false;
    this.isDrifting = false;

    // Suspension body roll & pitch
    this.pitch = 0.0;
    this.roll = 0.0;

    // Transmission & RPM simulation
    this.gear = 1;
    this.rpmNorm = 0.15;
    this.gearRatios = [40, 78, 120, 160, 195];

    // Cameras
    this.cameraMode = 'chase'; // 'chase' or 'cockpit'
    this.chaseCamPos = new THREE.Vector3();
    this.chaseLookTarget = new THREE.Vector3();

    // 3D Nodes
    this.carGroup = new THREE.Group();
    this.scene.add(this.carGroup);

    this.wheels = [];
    this.brakeLights = [];
    this.objModelLoaded = false;
    this.proceduralBody = null;

    // Build procedural supercar first so car is immediately rendered
    this.buildProceduralSupercar();
    this.buildDustSystem();

    // Load authored 3D models asynchronously
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

    // Materials
    const bodyMat = new THREE.MeshStandardMaterial({
      map: carMapTex,
      color: 0x5544ee, // Deep metallic sapphire-violet sheen
      roughness: 0.22,
      metalness: 0.78
    });

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0c101a, // Smoked aerodynamic canopy glass
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

    // Transform car body geometry to: +Z forward, +X right, +Y up, centered at axle height
    const carContainer = new THREE.Group();

    carObj.traverse((child) => {
      if (child.isMesh) {
        // Column-major transform: x_car = z_obj, y_car = y_obj - 0.344, z_car = x_obj - 1.355
        const pos = child.geometry.attributes.position.array;
        for (let i = 0; i < pos.length; i += 3) {
          const xo = pos[i], yo = pos[i+1], zo = pos[i+2];
          pos[i]   = zo;                  // X (lateral)
          pos[i+1] = yo - 0.344;          // Y (vertical)
          pos[i+2] = xo - 1.355;          // Z (forward)
        }
        child.geometry.computeVertexNormals();
        child.castShadow = true;

        if (child.name.includes('map')) {
          child.material = bodyMat;
        } else if (child.name.includes('shadow')) {
          child.material = glassMat;
        } else if (child.name.includes('headlight')) {
          child.material = headlightMat;
        } else if (child.name.includes('redlight') || child.name.includes('rearlight')) {
          child.material = brakeMat;
          this.brakeLights.push(child);
        } else {
          child.material = shadowMat;
        }
      }
    });

    carContainer.add(carObj);
    this.carGroup.add(carContainer);

    // Build wheels from wheel.obj
    // Wheelbase: front axle Z = +1.58, rear axle Z = -1.58; track width X = +-0.70; axle Y = 0.0
    const wheelPositions = [
      { name: 'FL', x: -0.70, y: 0.0, z:  1.58, isFront: true,  isLeft: true },
      { name: 'FR', x:  0.70, y: 0.0, z:  1.58, isFront: true,  isLeft: false },
      { name: 'RL', x: -0.70, y: 0.0, z: -1.58, isFront: false, isLeft: true },
      { name: 'RR', x:  0.70, y: 0.0, z: -1.58, isFront: false, isLeft: false }
    ];

    wheelPositions.forEach(wp => {
      const steerGroup = new THREE.Group();
      steerGroup.position.set(wp.x, wp.y, wp.z);

      const spinGroup = new THREE.Group();
      steerGroup.add(spinGroup);

      const wheelOrient = new THREE.Group();
      if (wp.isLeft) {
        wheelOrient.rotation.y = Math.PI; // Invert to face left wheel rim outward
      }
      spinGroup.add(wheelOrient);

      const wheelClone = wheelObj.clone();
      wheelClone.traverse((child) => {
        if (child.isMesh) {
          const geom = child.geometry.clone();
          const pos = geom.attributes.position.array;
          for (let i = 0; i < pos.length; i += 3) {
            const xo = pos[i], yo = pos[i+1], zo = pos[i+2];
            pos[i]   = zo - 0.108; // X (lateral)
            pos[i+1] = yo;         // Y (vertical)
            pos[i+2] = -xo;        // Z (longitudinal)
          }
          geom.computeVertexNormals();
          child.geometry = geom;
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

      wheelOrient.add(wheelClone);
      this.carGroup.add(steerGroup);

      this.wheels.push({
        steerGroup: steerGroup,
        spinGroup: spinGroup,
        isFront: wp.isFront,
        isLeft: wp.isLeft
      });
    });

    this.objModelLoaded = true;
  }

  buildProceduralSupercar() {
    this.proceduralBody = new THREE.Group();

    const bodyPaintMat = new THREE.MeshStandardMaterial({
      color: 0x5a48ee,
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
    const lowerChassisGeom = new THREE.BoxGeometry(1.88, 0.42, 4.3);
    const lowerChassis = new THREE.Mesh(lowerChassisGeom, bodyPaintMat);
    lowerChassis.position.y = 0.24;
    lowerChassis.castShadow = true;
    this.proceduralBody.add(lowerChassis);

    // Front Bumper Splitter
    const splitterGeom = new THREE.BoxGeometry(1.94, 0.08, 0.55);
    const splitter = new THREE.Mesh(splitterGeom, carbonMat);
    splitter.position.set(0, 0.06, 2.15);
    this.proceduralBody.add(splitter);

    // Rear Aero Diffuser
    const diffuserGeom = new THREE.BoxGeometry(1.86, 0.16, 0.45);
    const diffuser = new THREE.Mesh(diffuserGeom, carbonMat);
    diffuser.position.set(0, 0.10, -2.15);
    this.proceduralBody.add(diffuser);

    // 2. Sculpted Fastback Canopy
    const canopyGeom = new THREE.BoxGeometry(1.42, 0.46, 2.3);
    const canopy = new THREE.Mesh(canopyGeom, glassMat);
    canopy.position.set(0, 0.65, -0.15);
    canopy.castShadow = true;
    this.proceduralBody.add(canopy);

    // 3. Headlights
    const hlGeom = new THREE.BoxGeometry(0.35, 0.10, 0.06);
    const hlLeft = new THREE.Mesh(hlGeom, headlightMat);
    hlLeft.position.set(-0.65, 0.32, 2.16);
    const hlRight = new THREE.Mesh(hlGeom, headlightMat);
    hlRight.position.set(0.65, 0.32, 2.16);
    this.proceduralBody.add(hlLeft);
    this.proceduralBody.add(hlRight);

    // 4. Rear Light Blade
    const brakeBladeGeom = new THREE.BoxGeometry(1.68, 0.09, 0.06);
    const brakeBlade = new THREE.Mesh(brakeBladeGeom, brakeMat);
    brakeBlade.position.set(0, 0.38, -2.16);
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
    const shadowPlaneGeom = new THREE.PlaneGeometry(2.6, 5.0);
    shadowPlaneGeom.rotateX(-Math.PI / 2);
    const shadowPlaneMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false
    });
    const shadowMesh = new THREE.Mesh(shadowPlaneGeom, shadowPlaneMat);
    shadowMesh.position.y = 0.02;
    this.proceduralBody.add(shadowMesh);

    this.carGroup.add(this.proceduralBody);

    // Procedural Wheels
    const wheelPositions = [
      { name: 'FL', x: -0.92, y: 0.0, z:  1.38, isFront: true },
      { name: 'FR', x:  0.92, y: 0.0, z:  1.38, isFront: true },
      { name: 'RL', x: -0.92, y: 0.0, z: -1.38, isFront: false },
      { name: 'RR', x:  0.92, y: 0.0, z: -1.38, isFront: false }
    ];

    const tireGeom = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 18);
    tireGeom.rotateZ(Math.PI / 2);
    const rimGeom = new THREE.CylinderGeometry(0.24, 0.24, 0.25, 12);
    rimGeom.rotateZ(Math.PI / 2);

    const tireMat = new THREE.MeshStandardMaterial({ color: 0x1a1c22, roughness: 0.9 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xc4cdd5, roughness: 0.25, metalness: 0.85 });

    wheelPositions.forEach(wp => {
      const steerGroup = new THREE.Group();
      steerGroup.position.set(wp.x, wp.y, wp.z);

      const spinGroup = new THREE.Group();
      steerGroup.add(spinGroup);

      const tireMesh = new THREE.Mesh(tireGeom, tireMat);
      tireMesh.castShadow = true;
      const rimMesh = new THREE.Mesh(rimGeom, rimMat);

      spinGroup.add(tireMesh);
      spinGroup.add(rimMesh);

      this.carGroup.add(steerGroup);

      this.wheels.push({
        steerGroup: steerGroup,
        spinGroup: spinGroup,
        isFront: wp.isFront
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
    this.speedKmh = 0.0;
    this.lateralOffset = 0.0;
    this.steerAngle = 0.0;
    this.gear = 1;
    this.rpmNorm = 0.15;
    this.pitch = 0.0;
    this.roll = 0.0;
  }

  update(dt, input) {
    // 1. Acceleration / Braking
    const isBraking = input.keys.brake;
    const isDrifting = input.keys.drift;

    if (input.keys.throttle) {
      const topSpeed = this.isOffRoad ? (this.maxSpeedKmh * 0.45) : this.maxSpeedKmh;
      if (this.speedKmh < topSpeed) {
        this.speedKmh += this.accelRate * dt;
      }
    } else if (isBraking) {
      if (this.speedKmh > 2.0) {
        this.speedKmh -= this.brakeRate * dt;
        if (this.speedKmh < 0) this.speedKmh = 0;
      } else {
        // Reverse
        this.speedKmh -= 22.0 * dt;
        if (this.speedKmh < -35.0) this.speedKmh = -35.0;
      }
    } else {
      // Natural rolling drag
      if (this.speedKmh > 0) {
        this.speedKmh -= this.dragRate * dt;
        if (this.speedKmh < 0) this.speedKmh = 0;
      } else if (this.speedKmh < 0) {
        this.speedKmh += this.dragRate * dt;
        if (this.speedKmh > 0) this.speedKmh = 0;
      }
    }

    // Dynamic brake lights
    const brakeColor = isBraking ? 0xff0018 : 0xee0018;
    const brakeEmit = isBraking ? 3.2 : 0.9;
    this.brakeLights.forEach(bl => {
      if (bl.material && bl.material.emissive) {
        bl.material.emissive.setHex(brakeColor);
        bl.material.emissiveIntensity = brakeEmit;
      }
    });

    // 2. Transmission & Simulated RPM
    this.updateTransmission();

    // 3. Progressive Steering with Speed Dampening (Intuitive direction)
    // input.keys.steer: +1 for Right, -1 for Left
    const speedFactor = THREE.MathUtils.clamp(1.0 - (Math.abs(this.speedKmh) / 240.0), 0.30, 1.0);
    const targetSteer = input.keys.steer * this.maxSteerAngle * speedFactor;
    this.steerAngle += (targetSteer - this.steerAngle) * Math.min(1.0, 9.5 * dt);

    // Front wheels steer cleanly around local Y; all wheels spin purely around local axle X (Zero wobble)
    const rollRate = (this.speedKmh / 3.6) / 0.34; // rad/s
    this.wheels.forEach(w => {
      if (w.isFront) {
        w.steerGroup.rotation.y = -this.steerAngle;
      }
      const dir = w.isLeft ? -1 : 1;
      w.spinGroup.rotation.x += dir * rollRate * dt;
    });

    // 4. Spline Progress
    const speedMs = this.speedKmh / 3.6;
    const roadLen = this.world.totalLength || 3200;
    const deltaU = (speedMs * dt) / roadLen;

    this.progressU = ((this.progressU + deltaU) % 1.0 + 1.0) % 1.0;

    // 5. Lateral Displacement: Steer right moves car to right lane (+lateralOffset)
    const driftMultiplier = (isDrifting && Math.abs(this.speedKmh) > 35) ? 1.6 : 1.0;
    const lateralSpeed = (this.speedKmh / 3.6) * Math.tan(this.steerAngle) * 0.95 * driftMultiplier;
    this.lateralOffset += lateralSpeed * dt;

    // Check if off-road
    const halfRoad = this.world.roadWidth / 2;
    this.isOffRoad = Math.abs(this.lateralOffset) > halfRoad;

    // Clamp lateral bounds so car cannot fall off the world
    const maxLateral = halfRoad + this.world.shoulderWidth + 1.2;
    this.lateralOffset = THREE.MathUtils.clamp(this.lateralOffset, -maxLateral, maxLateral);

    // 6. 3D Position & Orientation on Road Frame
    const { point, tangent, right, normal } = this.world.getRoadFrameAt(this.progressU);

    const carPos = point.clone().addScaledVector(right, this.lateralOffset);
    // Ground car precisely on road surface datum
    carPos.addScaledVector(normal, 0.344);
    this.carGroup.position.copy(carPos);

    // Vehicle heading: combines road tangent with steering yaw
    const yawAngle = -this.steerAngle * 0.55;
    const headingTangent = tangent.clone().applyAxisAngle(normal, yawAngle).normalize();
    const carRight = new THREE.Vector3().crossVectors(normal, headingTangent).normalize();

    const rotMat = new THREE.Matrix4();
    rotMat.makeBasis(carRight, normal, headingTangent);
    this.carGroup.quaternion.setFromRotationMatrix(rotMat);

    // Suspension dynamics: nose dips on brake, squats on accel, banks into turns
    const targetPitch = isBraking ? -0.045 : (input.keys.throttle > 0 ? 0.03 : 0.0);
    this.pitch += (targetPitch - this.pitch) * 12 * dt;

    const targetRoll = -this.steerAngle * (Math.abs(this.speedKmh) / 180) * 0.10;
    this.roll += (targetRoll - this.roll) * 12 * dt;

    this.carGroup.rotateX(this.pitch);
    this.carGroup.rotateZ(this.roll);

    // 7. Skid detection
    this.isSkidding = isDrifting || (Math.abs(this.steerAngle) > 0.35 && Math.abs(this.speedKmh) > 65);

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

    if (this.cameraMode === 'chase') {
      // Elevated Slow Roads Chase Camera:
      // High vantage point looking down along road vector ensuring road is always prominent
      const speedNorm = Math.min(1.0, Math.abs(this.speedKmh) / 195);
      const dist = 7.8 + speedNorm * 1.8;
      const height = 3.3 + speedNorm * 0.4;

      const idealPos = this.carGroup.position.clone().addScaledVector(forward, -dist);
      idealPos.y += height;

      // Camera position smoothing
      if (this.chaseCamPos.lengthSq() < 1) {
        this.chaseCamPos.copy(idealPos);
      } else {
        this.chaseCamPos.lerp(idealPos, Math.min(1.0, 9.0 * dt));
      }
      camera.position.copy(this.chaseCamPos);

      // Look 24m ahead down the road slightly below the horizon so road surface is prominently framed
      const lookAhead = this.carGroup.position.clone().addScaledVector(forward, 24.0);
      lookAhead.y += 0.85;

      if (this.chaseLookTarget.lengthSq() < 1) {
        this.chaseLookTarget.copy(lookAhead);
      } else {
        this.chaseLookTarget.lerp(lookAhead, Math.min(1.0, 12.0 * dt));
      }
      camera.lookAt(this.chaseLookTarget);

      camera.fov = 62 + speedNorm * 12;
      camera.updateProjectionMatrix();

    } else {
      // First-person Cockpit / Low Hood View
      const hoodPos = this.carGroup.position.clone().addScaledVector(forward, 0.45);
      hoodPos.y += 0.78;

      camera.position.copy(hoodPos);

      const lookTarget = this.carGroup.position.clone().addScaledVector(forward, 32.0);
      lookTarget.y += 0.70;

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
