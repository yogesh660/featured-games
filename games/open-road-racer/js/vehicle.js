/**
 * Open Road Racer - Vehicle Physics & Multi-Vehicle Engine
 * Authentic physics, grip modeling, and multi-vehicle catalogue ported from Slow Roads (Anslo / TheGreatMaximus98)
 * Features:
 *   - 3 distinct authentic vehicles: Roadster, Coach (Bus), Superbike
 *   - Genuine tire grip: firm, planted road contact without involuntary drifting or self-steering
 *   - Speed-sensitive soft-steering curve with halfLerp damping
 *   - Authoritative showroom-new materials (invisible shadow hulls, crisp metallic rims, glowing brake lights)
 *   - Dynamic cockpit & multi-camera system (Chase, Far Chase, Cockpit with animated steering wheel, Hood)
 *   - Full off-road 3D freedom across mountains, shoulders, and valleys
 */

class Vehicle {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;

    // Vehicle catalogue specifications ported directly from Slow Roads
    this.VEHICLE_DEFS = {
      roadster: {
        id: 'roadster',
        name: 'Roadster',
        category: 'Sports Roadster',
        description: 'Agile 2-seat lightweight mountain sports car',
        mass: 700,
        accel: 9.0,
        reverse: 5.0,
        jerk: 64.0,
        brake: 8.0,
        maxSteer: 0.68,
        steerSpeed: 1.57,
        steerSpeedFactor: 0.65,
        steerInterval: 1.0,
        topSpeed: 45.0,     // 162 km/h (100 mph)
        wheelLength: 2.75,  // Wheelbase
        wheelWidth: 1.36,   // Track width
        wheelRadius: 0.342665,
        axleHeight: 0.342665,
        rollResistance: 0.06,
        drag: 0.001,
        cameras: {
          chase:    { distance: 5.2, height: 1.55, fov: 62, pitch: 0.08 },
          chaseFar: { distance: 8.5, height: 2.80, fov: 65, pitch: 0.12 },
          cockpit:  { offset: new THREE.Vector3(0.32, 0.74, 0.10), fov: 72 },
          hood:     { offset: new THREE.Vector3(0.00, 0.68, 1.35), fov: 70 }
        }
      },
      coach: {
        id: 'coach',
        name: 'Coach',
        category: 'Heavy Touring Bus',
        description: 'Heavy 40-passenger luxury tour coach with panoramic views',
        mass: 1400,
        accel: 6.0,
        reverse: 5.0,
        jerk: 12.0,
        brake: 5.0,
        maxSteer: 0.62,
        steerSpeed: 0.50,
        steerSpeedFactor: 0.70,
        steerInterval: 2.0,
        topSpeed: 32.0,     // 115 km/h (72 mph)
        wheelLength: 5.47,  // Extended wheelbase
        wheelWidth: 2.24,   // Wide commercial bus track
        wheelRadius: 0.3955,
        axleHeight: 0.3955,
        rollResistance: 0.03,
        drag: 0.002,
        cameras: {
          chase:    { distance: 11.5, height: 3.8, fov: 64, pitch: 0.10 },
          chaseFar: { distance: 17.0, height: 5.8, fov: 68, pitch: 0.14 },
          cockpit:  { offset: new THREE.Vector3(0.65, 1.85, 3.8), fov: 75 },
          hood:     { offset: new THREE.Vector3(0.00, 1.40, 4.8), fov: 70 }
        }
      },
      bike: {
        id: 'bike',
        name: 'Superbike',
        category: '1000cc Racing Bike',
        description: 'High-revving superbike with extreme acceleration & dynamic lean',
        mass: 350,
        accel: 12.0,
        reverse: 4.0,
        jerk: 48.0,
        brake: 9.0,
        maxSteer: 0.40,
        steerSpeed: 1.80,
        steerSpeedFactor: 0.55,
        steerInterval: 1.8,
        topSpeed: 53.0,     // 190 km/h (120 mph)
        wheelLength: 1.95,  // Compact motorcycle wheelbase
        wheelWidth: 0.0,    // Single inline track
        wheelRadius: 0.26,
        axleHeight: 0.26,
        rollResistance: 0.04,
        drag: 0.001,
        cameras: {
          chase:    { distance: 4.2, height: 1.35, fov: 62, pitch: 0.07 },
          chaseFar: { distance: 7.2, height: 2.20, fov: 65, pitch: 0.10 },
          cockpit:  { offset: new THREE.Vector3(0.00, 0.88, 0.15), fov: 72 },
          hood:     { offset: new THREE.Vector3(0.00, 0.72, 0.80), fov: 70 }
        }
      }
    };

    // Active vehicle selection
    this.currentVehicleType = 'roadster';
    this.metrics = this.VEHICLE_DEFS[this.currentVehicleType];

    // Core Root 3D Container
    this.carGroup = new THREE.Group();
    this.scene.add(this.carGroup);

    // Visual Mesh Hierarchy
    this.bodyContainer = new THREE.Group();
    this.carGroup.add(this.bodyContainer);

    this.wheels = [];
    this.brakeLights = [];
    this.headlights = [];
    this.steeringWheelMesh = null;
    this.dashboardMesh = null;

    // Simulation Dynamic State
    this.speed = 0.0;           // Forward velocity in m/s
    this.speedKmh = 0.0;
    this.drive = 0.0;           // Normalized throttle drive (0..1)
    this.steerAngle = 0.0;      // Current wheel steering angle (rad)
    this.steerL = 0.0;
    this.steerR = 0.0;
    this.yawRate = 0.0;         // Angular yaw rate (rad/s)
    this.headingAngle = 0.0;    // Car yaw relative to road tangent (rad)
    this.bikeLean = 0.0;        // Dynamic roll banking for motorcycle (rad)

    // Spatial Spline State
    this.progressU = 0.0;       // Spline progress parameter [0.0, 1.0]
    this.lateralOffset = 0.0;   // Displacement across road (+ = right, - = left)
    this.isOffRoad = false;
    this.isDrifting = false;

    // Soft-Steer Damping State (Slow Roads halfLerp algorithm)
    this.softTimer = 0.0;
    this.softStartPoint = 0.0;
    this.softInterval = 0.2;
    this.softTurning = false;
    this.softTurningDir = 0;

    // Engine, RPM & Transmission Simulation
    this.gear = 1;
    this.rpm = 900;
    this.rpmNorm = 0.1;
    this.gearRatios = [3.8, 2.4, 1.7, 1.25, 0.95, 0.78];

    // Camera modes: 'chase' | 'chaseFar' | 'cockpit' | 'hood'
    this.cameraMode = 'chase';
    this.cameraSmoothPos = new THREE.Vector3();
    this.cameraSmoothLook = new THREE.Vector3();
    this.cameraInitialized = false;

    // Particle FX
    this.dustParticles = null;
    this.dustCount = 140;
    this.dustData = [];
    this.buildDustSystem();

    // Cache Authored Assets
    this.cachedAssets = {
      carObj: null,
      wheelObj: null,
      carMapTex: null,
      steerObj: null,
      dashObj: null
    };

    this.loadAuthoredModels();
  }

  /* -------------------------------------------------------------
   * Asset Loading & Showroom Materials (Matching Slow Roads)
   * ------------------------------------------------------------- */
  loadAuthoredModels() {
    if (typeof THREE.OBJLoader === 'undefined') {
      this.rebuildCurrentVehicle();
      return;
    }

    const objLoader = new THREE.OBJLoader();
    const texLoader = new THREE.TextureLoader();

    // Load Roadster authored texture
    texLoader.load('assets/textures/car_map.jpg', (tex) => {
      tex.generateMipmaps = true;
      this.cachedAssets.carMapTex = tex;

      // Load Roadster body
      objLoader.load('assets/models/car.obj', (bodyObj) => {
        this.cachedAssets.carObj = bodyObj;

        // Load Roadster wheel
        objLoader.load('assets/models/wheel.obj', (wheelObj) => {
          this.cachedAssets.wheelObj = wheelObj;

          // Load optional interior steering wheel & dashboard
          objLoader.load('assets/models/steering_wheel.obj', (steerObj) => {
            this.cachedAssets.steerObj = steerObj;
          });
          objLoader.load('assets/models/dashboard.obj', (dashObj) => {
            this.cachedAssets.dashObj = dashObj;
          });

          // Build default Roadster
          this.buildRoadster();
        }, undefined, () => this.rebuildCurrentVehicle());
      }, undefined, () => this.rebuildCurrentVehicle());
    }, undefined, () => this.rebuildCurrentVehicle());
  }

  /* -------------------------------------------------------------
   * Vehicle Switching & Lifecycle Management
   * ------------------------------------------------------------- */
  setVehicle(typeId) {
    if (!this.VEHICLE_DEFS[typeId]) return;
    this.currentVehicleType = typeId;
    this.metrics = this.VEHICLE_DEFS[typeId];
    this.rebuildCurrentVehicle();
  }

  cycleVehicle() {
    const types = ['roadster', 'coach', 'bike'];
    const curIdx = types.indexOf(this.currentVehicleType);
    const nextIdx = (curIdx + 1) % types.length;
    this.setVehicle(types[nextIdx]);
  }

  rebuildCurrentVehicle() {
    // Clear existing body & wheel hierarchy
    while (this.bodyContainer.children.length > 0) {
      this.bodyContainer.remove(this.bodyContainer.children[0]);
    }
    this.wheels = [];
    this.brakeLights = [];
    this.headlights = [];
    this.steeringWheelMesh = null;
    this.dashboardMesh = null;

    if (this.currentVehicleType === 'roadster') {
      this.buildRoadster();
    } else if (this.currentVehicleType === 'coach') {
      this.buildCoach();
    } else if (this.currentVehicleType === 'bike') {
      this.buildSuperbike();
    }
  }

  /* -------------------------------------------------------------
   * Vehicle 1: Roadster (Authored Slow Roads 3D Meshes & Materials)
   * ------------------------------------------------------------- */
  buildRoadster() {
    const { carObj, wheelObj, carMapTex, steerObj, dashObj } = this.cachedAssets;

    if (!carObj || !wheelObj) {
      this.buildProceduralRoadster();
      return;
    }

    // Material definitions ported directly from Slow Roads _d palette:
    const bodyMat = new THREE.MeshStandardMaterial({
      map: carMapTex,
      color: 0xffffff,
      roughness: 0.32,
      metalness: 0.40
    });

    // Invisible dynamic shadow hull (Slow Roads r.C: colorWrite: false, depthWrite: false)
    // Completely eliminates jagged black shadow proxy polygons cutting into the body!
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      colorWrite: false,
      depthWrite: false
    });

    const headlightMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfffae0,
      emissiveIntensity: 1.5,
      roughness: 0.2
    });

    const brakeMat = new THREE.MeshStandardMaterial({
      color: 0x660204,
      emissive: 0xff0011,
      emissiveIntensity: 0.8,
      roughness: 0.5
    });

    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x202228,
      roughness: 0.86,
      metalness: 0.05
    });

    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.22,
      metalness: 0.88
    });

    const interiorMat = new THREE.MeshStandardMaterial({
      color: 0x22242a,
      roughness: 0.75,
      metalness: 0.15
    });

    // 1. Car Body & Interior
    const carClone = carObj.clone();
    carClone.traverse((child) => {
      if (child.isMesh) {
        const partType = child.name.split('_')[1] || '';
        if (partType === 'shadow' || child.name.includes('shadow')) {
          child.material = shadowMat;
          child.castShadow = true;
          child.receiveShadow = false;
        } else if (partType === 'headlight' || child.name.includes('headlight')) {
          child.material = headlightMat;
          this.headlights.push(child);
        } else if (partType === 'redlight' || partType === 'rearlight' || child.name.includes('redlight')) {
          child.material = brakeMat;
          this.brakeLights.push(child);
        } else if (partType === 'interior' || child.name.includes('interior')) {
          child.material = interiorMat;
          child.castShadow = true;
          child.receiveShadow = true;
        } else {
          child.material = bodyMat;
          child.castShadow = true;
          child.receiveShadow = true;
        }
      }
    });

    // Mounting offset: car.obj has front bumper along +X, wheelbase 2.75m, axle height 0.343m
    carClone.rotation.y = -Math.PI / 2;
    carClone.position.set(0, -this.metrics.axleHeight, -this.metrics.wheelLength / 2);
    this.bodyContainer.add(carClone);

    // Optional Steering Wheel & Dashboard for Cockpit View
    if (steerObj) {
      const swClone = steerObj.clone();
      swClone.traverse((ch) => {
        if (ch.isMesh) ch.material = interiorMat;
      });
      swClone.rotation.order = 'YZX';
      swClone.rotation.y = -Math.PI / 2;
      swClone.rotation.z = -0.30;
      swClone.position.set(0.32, 0.82 - this.metrics.axleHeight, 1.75 - this.metrics.wheelLength / 2);
      this.steeringWheelMesh = swClone;
      this.bodyContainer.add(swClone);
    }

    if (dashObj) {
      const dClone = dashObj.clone();
      dClone.traverse((ch) => {
        if (ch.isMesh) ch.material = interiorMat;
      });
      dClone.rotation.y = -Math.PI / 2;
      dClone.position.set(0.32, 0.82 - this.metrics.axleHeight, 1.75 - this.metrics.wheelLength / 2);
      this.dashboardMesh = dClone;
      this.bodyContainer.add(dClone);
    }

    // 2. Authored 4-Wheel Hierarchy (Track 1.36m, Wheelbase 2.75m)
    const halfW = this.metrics.wheelWidth / 2;    // 0.68m
    const halfL = this.metrics.wheelLength / 2;   // 1.375m

    const wheelConfigs = [
      { name: 'FL', x: -halfW, z:  halfL, isFront: true,  isLeft: true },
      { name: 'FR', x:  halfW, z:  halfL, isFront: true,  isLeft: false },
      { name: 'RL', x: -halfW, z: -halfL, isFront: false, isLeft: true },
      { name: 'RR', x:  halfW, z: -halfL, isFront: false, isLeft: false }
    ];

    wheelConfigs.forEach(wc => {
      const steerGroup = new THREE.Group();
      steerGroup.position.set(wc.x, 0, wc.z);

      const spinGroup = new THREE.Group();
      steerGroup.add(spinGroup);

      const orientGroup = new THREE.Group();
      orientGroup.rotation.y = wc.isLeft ? -Math.PI / 2 : Math.PI / 2;
      spinGroup.add(orientGroup);

      const wClone = wheelObj.clone();
      wClone.traverse((child) => {
        if (child.isMesh) {
          const partType = child.name.split('_')[1] || '';
          if (partType === 'shadow' || child.name.includes('shadow')) {
            child.material = shadowMat;
            child.castShadow = true;
          } else if (partType === 'metal' || child.name.includes('metal')) {
            child.material = rimMat;
            child.castShadow = true;
          } else {
            child.material = tireMat;
            child.castShadow = true;
          }
        }
      });

      orientGroup.add(wClone);
      this.bodyContainer.add(steerGroup);

      this.wheels.push({
        steerGroup,
        spinGroup,
        isFront: wc.isFront,
        isLeft: wc.isLeft
      });
    });
  }

  /* -------------------------------------------------------------
   * Vehicle 2: Coach / Bus (Heavy Luxury Tour Coach)
   * ------------------------------------------------------------- */
  buildCoach() {
    const coachGroup = new THREE.Group();

    // Body dimensions: length 10.5m, width 2.45m, height 3.2m
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x3b66d4, // Royal sapphire touring coach
      roughness: 0.28,
      metalness: 0.45
    });

    const roofMat = new THREE.MeshStandardMaterial({
      color: 0xedf0f5,
      roughness: 0.35,
      metalness: 0.20
    });

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x111624,
      roughness: 0.08,
      metalness: 0.12,
      transmission: 0.70,
      transparent: true
    });

    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x181a20,
      roughness: 0.80,
      metalness: 0.10
    });

    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.15,
      metalness: 0.92
    });

    const headlightMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfffaea,
      emissiveIntensity: 1.8
    });

    const brakeMat = new THREE.MeshStandardMaterial({
      color: 0x660204,
      emissive: 0xff0011,
      emissiveIntensity: 0.8
    });

    // Lower chassis & skirts
    const skirtGeom = new THREE.BoxGeometry(2.40, 1.10, 10.2);
    const skirt = new THREE.Mesh(skirtGeom, bodyMat);
    skirt.position.set(0, 0.40, 0);
    skirt.castShadow = true;
    coachGroup.add(skirt);

    // Aerodynamic upper passenger cabin
    const cabinGeom = new THREE.BoxGeometry(2.42, 1.70, 9.8);
    const cabin = new THREE.Mesh(cabinGeom, bodyMat);
    cabin.position.set(0, 1.70, -0.15);
    cabin.castShadow = true;
    coachGroup.add(cabin);

    // Panoramic side windows (continuous aerodynamic dark glazing)
    const winLGeom = new THREE.BoxGeometry(0.06, 1.15, 8.8);
    const winL = new THREE.Mesh(winLGeom, glassMat);
    winL.position.set(-1.22, 1.75, -0.2);
    coachGroup.add(winL);

    const winR = new THREE.Mesh(winLGeom, glassMat);
    winR.position.set(1.22, 1.75, -0.2);
    coachGroup.add(winR);

    // Large sweeping front windscreen
    const windGeom = new THREE.BoxGeometry(2.36, 1.45, 0.1);
    const wind = new THREE.Mesh(windGeom, glassMat);
    wind.position.set(0, 1.70, 4.80);
    wind.rotation.x = -0.22;
    coachGroup.add(wind);

    // Sleek roof panel with air conditioning unit
    const roofGeom = new THREE.BoxGeometry(2.44, 0.25, 9.6);
    const roof = new THREE.Mesh(roofGeom, roofMat);
    roof.position.set(0, 2.65, -0.15);
    coachGroup.add(roof);

    const acGeom = new THREE.BoxGeometry(1.4, 0.35, 2.4);
    const acUnit = new THREE.Mesh(acGeom, trimMat);
    acUnit.position.set(0, 2.85, -0.5);
    coachGroup.add(acUnit);

    // Front headlights
    const hlGeom = new THREE.BoxGeometry(0.35, 0.18, 0.08);
    const hlL = new THREE.Mesh(hlGeom, headlightMat);
    hlL.position.set(-0.85, 0.65, 5.12);
    const hlR = new THREE.Mesh(hlGeom, headlightMat);
    hlR.position.set(0.85, 0.65, 5.12);
    coachGroup.add(hlL);
    coachGroup.add(hlR);
    this.headlights.push(hlL, hlR);

    // Rear brake light strip
    const blGeom = new THREE.BoxGeometry(0.32, 0.65, 0.06);
    const blL = new THREE.Mesh(blGeom, brakeMat);
    blL.position.set(-0.95, 1.10, -5.12);
    const blR = new THREE.Mesh(blGeom, brakeMat);
    blR.position.set(0.95, 1.10, -5.12);
    coachGroup.add(blL);
    coachGroup.add(blR);
    this.brakeLights.push(blL, blR);

    // Commercial Coach Wheels: 6 wheels (2 Front steerable, 4 Rear dual-axle)
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x1e2026, roughness: 0.88 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xd8dde4, roughness: 0.22, metalness: 0.85 });

    const createCoachWheel = () => {
      const wGroup = new THREE.Group();
      const tGeom = new THREE.CylinderGeometry(this.metrics.wheelRadius, this.metrics.wheelRadius, 0.26, 24);
      tGeom.rotateZ(Math.PI / 2);
      const tMesh = new THREE.Mesh(tGeom, tireMat);
      tMesh.castShadow = true;
      wGroup.add(tMesh);

      const rGeom = new THREE.CylinderGeometry(this.metrics.wheelRadius * 0.58, this.metrics.wheelRadius * 0.58, 0.27, 18);
      rGeom.rotateZ(Math.PI / 2);
      const rMesh = new THREE.Mesh(rGeom, rimMat);
      wGroup.add(rMesh);
      return wGroup;
    };

    const halfW = this.metrics.wheelWidth / 2; // 1.12m
    const frontZ = this.metrics.wheelLength / 2; // 2.735m
    const rearZ1 = -frontZ;
    const rearZ2 = -frontZ + 1.35; // Second tandem axle

    const coachWheelConfigs = [
      { x: -halfW, z: frontZ, isFront: true },
      { x:  halfW, z: frontZ, isFront: true },
      { x: -halfW, z: rearZ1, isFront: false },
      { x:  halfW, z: rearZ1, isFront: false },
      { x: -halfW, z: rearZ2, isFront: false },
      { x:  halfW, z: rearZ2, isFront: false }
    ];

    coachWheelConfigs.forEach(cfg => {
      const steerGroup = new THREE.Group();
      steerGroup.position.set(cfg.x, 0, cfg.z);

      const spinGroup = new THREE.Group();
      steerGroup.add(spinGroup);

      const wMesh = createCoachWheel();
      spinGroup.add(wMesh);

      this.bodyContainer.add(steerGroup);
      this.wheels.push({
        steerGroup,
        spinGroup,
        isFront: cfg.isFront
      });
    });

    this.bodyContainer.add(coachGroup);
  }

  /* -------------------------------------------------------------
   * Vehicle 3: Superbike (1000cc Racing Motorcycle)
   * ------------------------------------------------------------- */
  buildSuperbike() {
    const bikeGroup = new THREE.Group();

    const fairingMat = new THREE.MeshStandardMaterial({
      color: 0xd91424, // Ducati Rosso racing scarlet
      roughness: 0.25,
      metalness: 0.40
    });

    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x1f2127,
      roughness: 0.50,
      metalness: 0.70
    });

    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.12,
      metalness: 0.95
    });

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x111624,
      roughness: 0.1,
      transmission: 0.8,
      transparent: true
    });

    const headlightMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfffaea,
      emissiveIntensity: 2.0
    });

    const brakeMat = new THREE.MeshStandardMaterial({
      color: 0x660204,
      emissive: 0xff0011,
      emissiveIntensity: 0.8
    });

    // Sculptured fuel tank & trellis frame
    const tankGeom = new THREE.BoxGeometry(0.44, 0.38, 0.85);
    const tank = new THREE.Mesh(tankGeom, fairingMat);
    tank.position.set(0, 0.76, 0.25);
    tank.castShadow = true;
    bikeGroup.add(tank);

    // Front aerodynamic cowl & windscreen
    const cowlGeom = new THREE.BoxGeometry(0.46, 0.45, 0.65);
    const cowl = new THREE.Mesh(cowlGeom, fairingMat);
    cowl.position.set(0, 0.82, 0.85);
    cowl.castShadow = true;
    bikeGroup.add(cowl);

    const screenGeom = new THREE.BoxGeometry(0.36, 0.35, 0.05);
    const screen = new THREE.Mesh(screenGeom, glassMat);
    screen.position.set(0, 1.05, 0.95);
    screen.rotation.x = -0.45;
    bikeGroup.add(screen);

    // Twin aggressive projector headlights
    const hlGeom = new THREE.BoxGeometry(0.12, 0.08, 0.04);
    const hlL = new THREE.Mesh(hlGeom, headlightMat);
    hlL.position.set(-0.14, 0.78, 1.18);
    const hlR = new THREE.Mesh(hlGeom, headlightMat);
    hlR.position.set(0.14, 0.78, 1.18);
    bikeGroup.add(hlL);
    bikeGroup.add(hlR);
    this.headlights.push(hlL, hlR);

    // Rider seat & racing tail cowl
    const seatGeom = new THREE.BoxGeometry(0.32, 0.12, 0.55);
    const seat = new THREE.Mesh(seatGeom, frameMat);
    seat.position.set(0, 0.65, -0.28);
    bikeGroup.add(seat);

    const tailGeom = new THREE.BoxGeometry(0.28, 0.22, 0.60);
    const tail = new THREE.Mesh(tailGeom, fairingMat);
    tail.position.set(0, 0.72, -0.65);
    tail.castShadow = true;
    bikeGroup.add(tail);

    // Slim LED tail brake light
    const blGeom = new THREE.BoxGeometry(0.18, 0.06, 0.03);
    const bl = new THREE.Mesh(blGeom, brakeMat);
    bl.position.set(0, 0.74, -0.96);
    bikeGroup.add(bl);
    this.brakeLights.push(bl);

    // Exhaust pipe & chrome muffler
    const exGeom = new THREE.CylinderGeometry(0.06, 0.08, 0.85, 12);
    exGeom.rotateX(Math.PI / 2);
    const exhaust = new THREE.Mesh(exGeom, chromeMat);
    exhaust.position.set(0.24, 0.35, -0.45);
    exhaust.rotation.y = -0.15;
    bikeGroup.add(exhaust);

    // Motorcycle Wheels: Front (steerable) & Rear (driven), single inline track
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x1e2026, roughness: 0.88 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xe0e5ed, roughness: 0.18, metalness: 0.88 });

    const createBikeWheel = () => {
      const wGroup = new THREE.Group();
      const tGeom = new THREE.CylinderGeometry(this.metrics.wheelRadius, this.metrics.wheelRadius, 0.12, 24);
      tGeom.rotateZ(Math.PI / 2);
      const tMesh = new THREE.Mesh(tGeom, tireMat);
      tMesh.castShadow = true;
      wGroup.add(tMesh);

      const rGeom = new THREE.CylinderGeometry(this.metrics.wheelRadius * 0.65, this.metrics.wheelRadius * 0.65, 0.13, 16);
      rGeom.rotateZ(Math.PI / 2);
      const rMesh = new THREE.Mesh(rGeom, rimMat);
      wGroup.add(rMesh);
      return wGroup;
    };

    const halfL = this.metrics.wheelLength / 2; // 0.975m

    // Front Wheel
    const fSteerGroup = new THREE.Group();
    fSteerGroup.position.set(0, 0, halfL);
    const fSpinGroup = new THREE.Group();
    fSteerGroup.add(fSpinGroup);
    fSpinGroup.add(createBikeWheel());
    this.bodyContainer.add(fSteerGroup);
    this.wheels.push({ steerGroup: fSteerGroup, spinGroup: fSpinGroup, isFront: true });

    // Rear Wheel
    const rSteerGroup = new THREE.Group();
    rSteerGroup.position.set(0, 0, -halfL);
    const rSpinGroup = new THREE.Group();
    rSteerGroup.add(rSpinGroup);
    rSpinGroup.add(createBikeWheel());
    this.bodyContainer.add(rSteerGroup);
    this.wheels.push({ steerGroup: rSteerGroup, spinGroup: rSpinGroup, isFront: false });

    this.bodyContainer.add(bikeGroup);
  }

  /* -------------------------------------------------------------
   * Dust & Tire Smoke Particle System
   * ------------------------------------------------------------- */
  buildDustSystem() {
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(this.dustCount * 3);
    const colors = new Float32Array(this.dustCount * 3);

    for (let i = 0; i < this.dustCount; i++) {
      positions[i * 3]     = 0;
      positions[i * 3 + 1] = -100;
      positions[i * 3 + 2] = 0;

      colors[i * 3]     = 0.88;
      colors[i * 3 + 1] = 0.86;
      colors[i * 3 + 2] = 0.82;

      this.dustData.push({
        active: false,
        life: 0,
        maxLife: 1.0,
        vx: 0, vy: 0, vz: 0
      });
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 1.4,
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      depthWrite: false
    });

    this.dustParticles = new THREE.Points(geom, mat);
    this.scene.add(this.dustParticles);
  }

  emitDust(pos, isSmoke = false) {
    for (let i = 0; i < this.dustCount; i++) {
      const p = this.dustData[i];
      if (!p.active) {
        p.active = true;
        p.life = 0;
        p.maxLife = 0.6 + Math.random() * 0.4;
        p.vx = (Math.random() - 0.5) * 1.5;
        p.vy = 0.8 + Math.random() * 1.2;
        p.vz = (Math.random() - 0.5) * 1.5;

        const positions = this.dustParticles.geometry.attributes.position.array;
        positions[i * 3]     = pos.x + (Math.random() - 0.5) * 0.6;
        positions[i * 3 + 1] = pos.y + 0.15;
        positions[i * 3 + 2] = pos.z + (Math.random() - 0.5) * 0.6;

        const colors = this.dustParticles.geometry.attributes.color.array;
        if (isSmoke) {
          // Grayish tire friction smoke
          colors[i * 3] = 0.85; colors[i * 3 + 1] = 0.85; colors[i * 3 + 2] = 0.90;
        } else {
          // Warm mountain laterite dust
          colors[i * 3] = 0.78; colors[i * 3 + 1] = 0.65; colors[i * 3 + 2] = 0.52;
        }
        break;
      }
    }
  }

  updateDust(dt) {
    if (!this.dustParticles) return;
    const positions = this.dustParticles.geometry.attributes.position.array;

    for (let i = 0; i < this.dustCount; i++) {
      const p = this.dustData[i];
      if (p.active) {
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.active = false;
          positions[i * 3 + 1] = -100;
        } else {
          positions[i * 3]     += p.vx * dt;
          positions[i * 3 + 1] += p.vy * dt;
          positions[i * 3 + 2] += p.vz * dt;
        }
      }
    }
    this.dustParticles.geometry.attributes.position.needsUpdate = true;
  }

  /* -------------------------------------------------------------
   * Position Reset to Road Center
   * ------------------------------------------------------------- */
  resetPosition() {
    this.speed = 0.0;
    this.lateralOffset = 0.0;
    this.headingAngle = 0.0;
    this.steerAngle = 0.0;
    this.yawRate = 0.0;
    this.drive = 0.0;
    this.bikeLean = 0.0;
  }

  /* -------------------------------------------------------------
   * Authentic Slow Roads Steering Physics (HalfLerp S-Curve)
   * ------------------------------------------------------------- */
  updateSteeringInput(dt, rawSteerInput) {
    const speedLerp = Math.min(1.0, Math.abs(this.speed) / this.metrics.topSpeed);

    // Speed-dependent maximum steering limit: high-speed highway stability
    const softSteerFactor = 1.0 - speedLerp * this.metrics.steerSpeedFactor;
    const maxSteer = this.metrics.maxSteer * softSteerFactor;

    // rawSteerInput: -1.0 for Left ('A'), +1.0 for Right ('D'), 0.0 for none
    const steerTarget = rawSteerInput * maxSteer;

    if (Math.abs(rawSteerInput) > 0.01) {
      if (!this.softTurning || this.softTurningDir !== rawSteerInput) {
        this.softTimer = 0.0;
        this.softStartPoint = this.steerAngle;
        const delta = Math.abs(steerTarget - this.steerAngle) / Math.max(0.001, maxSteer);
        this.softInterval = this.metrics.steerInterval / Math.max(0.01, delta) / this.metrics.steerSpeed;
        this.softTurning = true;
        this.softTurningDir = rawSteerInput;
      }
    } else if (this.softTurning) {
      this.softTurning = false;
      const delta = Math.abs(this.steerAngle) / (maxSteer * 2.0);
      this.softInterval = this.metrics.steerInterval * Math.max(0.05, delta) / 1.5;
      this.softTimer = 0.0;
      this.softStartPoint = this.steerAngle;
      this.softTurningDir = 0;
    }

    const timeFactor = 1.0 + 0.5 * speedLerp;
    this.softTimer += dt / Math.max(0.01, timeFactor);
    let lerp = Math.min(1.0, this.softTimer / Math.max(0.01, this.softInterval));

    // Slow Roads halfLerp S-curve: 2 * ((3 - 2 * (e / 2 + 0.5)) * (e / 2 + 0.5)^2 - 0.5)
    const eHalf = lerp * 0.5 + 0.5;
    lerp = 2.0 * ((3.0 - 2.0 * eHalf) * eHalf * eHalf - 0.5);
    lerp = Math.max(0.0, Math.min(1.0, lerp));

    this.steerAngle = this.softStartPoint * (1.0 - lerp) + steerTarget * lerp;

    // Ackermann geometry for multi-wheel steering
    const sinS = Math.sin(this.steerAngle);
    const cosS = Math.cos(this.steerAngle) * this.metrics.wheelLength * 2.0;
    const num = 2.0 * this.metrics.wheelLength * sinS;
    const leftDenom = cosS - this.metrics.wheelWidth * sinS;
    const rightDenom = cosS + this.metrics.wheelWidth * sinS;
    this.steerL = Math.atan(num / (Math.abs(leftDenom) > 0.001 ? leftDenom : 0.001));
    this.steerR = Math.atan(num / (Math.abs(rightDenom) > 0.001 ? rightDenom : 0.001));
  }

  /* -------------------------------------------------------------
   * Core Simulation Frame Update
   * ------------------------------------------------------------- */
  update(dt, input) {
    const isThrottle = !!input.keys.throttle;
    const isBraking = !!input.keys.brake;
    const isHandbrake = !!input.keys.handbrake;
    const rawSteer = input.keys.steer || 0.0;

    const halfRoad = this.world.roadWidth / 2; // 3.2m
    this.isOffRoad = Math.abs(this.lateralOffset) > halfRoad;

    // 1. Throttle / Drive state with Jerk Limiting
    const targetDrive = isThrottle ? 1.0 : 0.0;
    if (this.drive < targetDrive) {
      this.drive += (this.metrics.jerk / this.metrics.accel) * dt;
      if (this.drive > targetDrive) this.drive = targetDrive;
    } else if (this.drive > targetDrive) {
      this.drive -= (this.metrics.jerk / this.metrics.accel) * dt;
      if (this.drive < targetDrive) this.drive = targetDrive;
    }

    // 2. Longitudinal Velocity Integration
    const currentTopSpeed = this.isOffRoad ? (this.metrics.topSpeed * 0.65) : this.metrics.topSpeed;

    if (this.drive > 0) {
      if (this.speed < currentTopSpeed) {
        this.speed += this.drive * this.metrics.accel * dt;
        if (this.speed > currentTopSpeed) this.speed = currentTopSpeed;
      }
    } else if (isBraking) {
      if (this.speed > 0.1) {
        this.speed -= this.metrics.brake * dt;
        if (this.speed < 0) this.speed = 0;
      } else {
        // Reverse gear
        this.speed -= this.metrics.reverse * dt;
        if (this.speed < -8.5) this.speed = -8.5; // -30 km/h reverse limit
      }
    } else {
      // Natural rolling resistance & aerodynamic drag
      const rollingDecel = (this.isOffRoad ? 2.5 : 0.6) + (this.metrics.rollResistance * 9.81);
      const dragDecel = this.metrics.drag * this.speed * Math.abs(this.speed);
      const totalDecel = (rollingDecel + dragDecel) * Math.sign(this.speed);
      const prevSign = Math.sign(this.speed);
      this.speed -= totalDecel * dt;
      if (Math.sign(this.speed) !== prevSign) this.speed = 0;
    }

    this.speedKmh = this.speed * 3.6;

    // Dynamic brake lights
    const brakeColor = isBraking ? 0xff0011 : 0xee0018;
    const brakeEmit = isBraking ? 3.5 : 0.8;
    this.brakeLights.forEach(bl => {
      if (bl.material && bl.material.emissive) {
        bl.material.emissive.setHex(brakeColor);
        bl.material.emissiveIntensity = brakeEmit;
      }
    });

    // 3. Transmission & RPM Simulation
    this.updateTransmission();

    // 4. Authentic Steering Angle Calculation
    this.updateSteeringInput(dt, rawSteer);

    // 5. Wheels Animation (Steering & Concentric Roll)
    const rollRate = (this.speed / this.metrics.wheelRadius);
    this.wheels.forEach(w => {
      if (w.isFront) {
        const angle = w.isLeft ? -this.steerL : -this.steerR;
        w.steerGroup.rotation.y = angle;
      }
      w.spinGroup.rotation.x += rollRate * dt;
    });

    // Animate Cockpit Steering Wheel (if Roadster)
    if (this.steeringWheelMesh) {
      this.steeringWheelMesh.rotation.z = -0.30 - (this.steerAngle * 3.5);
    }

    // 6. GENUINE TIRE GRIP & DIRECTION OF MOTION (Slow Roads Model)
    // Drift state triggered strictly by handbrake at speed
    this.isDrifting = isHandbrake && Math.abs(this.speedKmh) > 24;

    // Yaw Angular Rate: Kinematic bicycle turning moment
    // When the driver turns the wheel, yaw rate turns the vehicle body!
    // When the wheel is centered (steerAngle == 0), targetYawRate is 0! The vehicle DOES NOT TURN!
    const targetYawRate = (this.speed / this.metrics.wheelLength) * Math.sin(this.steerAngle);
    const yawResponsiveness = this.isDrifting ? 12.0 : 8.5;
    this.yawRate += (targetYawRate - this.yawRate) * Math.min(1.0, yawResponsiveness * dt);

    if (Math.abs(rawSteer) < 0.01 && !this.isDrifting) {
      // Firm road tracking: car maintains its course without hunting or spinning
      this.yawRate *= Math.exp(-6.0 * dt);
    }

    // Integrate relative heading: vehicle heading relative to the road frame
    this.headingAngle += this.yawRate * dt;

    // Motorcycle Dynamic Banking Lean into corners
    if (this.metrics.type === 'bike') {
      const speedLerp = Math.min(1.0, Math.abs(this.speed) / this.metrics.topSpeed);
      const targetLean = -this.steerAngle * 1.25 * speedLerp;
      this.bikeLean += (targetLean - this.bikeLean) * Math.min(1.0, 10.0 * dt);
    } else {
      this.bikeLean = 0.0;
    }

    // Forward and lateral velocities in road tangent coordinates
    // When not drifting, tires have COMPLETE SOLID LATERAL GRIP (vLateral = v * sin(heading))
    // No artificial centrifugal drift added!
    const vTangent = this.speed * Math.cos(this.headingAngle);
    const vLateral = this.speed * Math.sin(this.headingAngle);

    // Advance longitudinal spline progress
    const roadLen = this.world.totalLength || 3200;
    const deltaU = (vTangent * dt) / roadLen;
    this.progressU = ((this.progressU + deltaU) % 1.0 + 1.0) % 1.0;

    // Advance lateral offset across road
    this.lateralOffset += vLateral * dt;

    // 7. 3D Terrain Height & Surface Alignment (Full Off-Road Freedom)
    const { point, tangent, right, normal } = this.world.getRoadFrameAt(this.progressU);
    const groundElevation = this.world.getGroundHeightAt(this.progressU, this.lateralOffset);

    // Compute vehicle world 3D position
    const worldPos = point.clone()
      .addScaledVector(right, this.lateralOffset)
      .addScaledVector(normal, groundElevation + this.metrics.axleHeight);

    this.carGroup.position.copy(worldPos);

    // Compute car orientation basis
    // Forward heading vector in 3D:
    const forwardVec = tangent.clone().multiplyScalar(Math.cos(this.headingAngle))
      .addScaledVector(right, Math.sin(this.headingAngle)).normalize();

    const normalVec = normal.clone();
    const rightVec = new THREE.Vector3().crossVectors(forwardVec, normalVec).normalize();

    // Construct orthonormal rotation matrix
    const rotMat = new THREE.Matrix4().makeBasis(rightVec, normalVec, forwardVec);
    this.carGroup.quaternion.setFromRotationMatrix(rotMat);

    // Apply motorcycle banking lean or sports car body roll
    if (this.metrics.type === 'bike') {
      this.bodyContainer.rotation.z = this.bikeLean;
    } else {
      // Subtle suspension roll into corners
      const bodyRoll = -this.yawRate * (this.speed / this.metrics.topSpeed) * 0.045;
      this.bodyContainer.rotation.z = bodyRoll;
    }

    // 8. Particle FX (Tire smoke on drift, laterite dust on off-road)
    if (this.isDrifting) {
      this.emitDust(worldPos, true);
    } else if (this.isOffRoad && Math.abs(this.speedKmh) > 15) {
      this.emitDust(worldPos, false);
    }
    this.updateDust(dt);

    // 9. Telemetry snapshot for HUD and Audio Engine
    return {
      speedKmh: this.speedKmh,
      speedMs: this.speed,
      gear: this.gear,
      rpm: this.rpm,
      rpmNorm: this.rpmNorm,
      isSkidding: this.isDrifting,
      isBraking: isBraking,
      isOffRoad: this.isOffRoad,
      lateralOffset: this.lateralOffset,
      progressU: this.progressU,
      vehicleName: this.metrics.name,
      vehicleType: this.currentVehicleType
    };
  }

  /* -------------------------------------------------------------
   * Transmission & RPM Synthesizer
   * ------------------------------------------------------------- */
  updateTransmission() {
    const absSpeed = Math.abs(this.speed);
    const top = this.metrics.topSpeed;

    if (absSpeed < top * 0.18) this.gear = 1;
    else if (absSpeed < top * 0.36) this.gear = 2;
    else if (absSpeed < top * 0.55) this.gear = 3;
    else if (absSpeed < top * 0.74) this.gear = 4;
    else if (absSpeed < top * 0.90) this.gear = 5;
    else this.gear = 6;

    const gearRatio = this.gearRatios[this.gear - 1] || 1.0;
    const speedRatio = absSpeed / Math.max(1.0, top);
    this.rpmNorm = THREE.MathUtils.clamp(speedRatio * gearRatio * 1.45, 0.12, 1.0);
    this.rpm = Math.floor(900 + this.rpmNorm * 6800);
  }

  getForwardVector() {
    return new THREE.Vector3(0, 0, 1).applyQuaternion(this.carGroup.quaternion);
  }

  /* -------------------------------------------------------------
   * Dynamic Camera Controller (Chase, ChaseFar, Cockpit, Hood)
   * ------------------------------------------------------------- */
  toggleCamera() {
    const modes = ['chase', 'chaseFar', 'cockpit', 'hood'];
    const curIdx = modes.indexOf(this.cameraMode);
    this.cameraMode = modes[(curIdx + 1) % modes.length];
  }

  updateCamera(camera, dt) {
    if (!camera) return;

    const carPos = this.carGroup.position;
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.carGroup.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.carGroup.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.carGroup.quaternion);

    const camPreset = this.metrics.cameras[this.cameraMode] || this.metrics.cameras.chase;
    let targetCamPos = new THREE.Vector3();
    let targetLookAt = new THREE.Vector3();

    if (this.cameraMode === 'chase' || this.cameraMode === 'chaseFar') {
      const dist = camPreset.distance;
      const height = camPreset.height;
      targetCamPos.copy(carPos)
        .addScaledVector(forward, -dist)
        .addScaledVector(up, height);

      targetLookAt.copy(carPos)
        .addScaledVector(forward, 8.0)
        .addScaledVector(up, 0.4);
    } else if (this.cameraMode === 'cockpit') {
      // Driver cockpit view
      const off = camPreset.offset;
      targetCamPos.copy(carPos)
        .addScaledVector(right, off.x)
        .addScaledVector(up, off.y)
        .addScaledVector(forward, off.z);

      targetLookAt.copy(targetCamPos)
        .addScaledVector(forward, 25.0);
    } else if (this.cameraMode === 'hood') {
      // Bonnet / Hood view
      const off = camPreset.offset;
      targetCamPos.copy(carPos)
        .addScaledVector(right, off.x)
        .addScaledVector(up, off.y)
        .addScaledVector(forward, off.z);

      targetLookAt.copy(targetCamPos)
        .addScaledVector(forward, 30.0);
    }

    if (!this.cameraInitialized) {
      this.cameraSmoothPos.copy(targetCamPos);
      this.cameraSmoothLook.copy(targetLookAt);
      this.cameraInitialized = true;
    } else {
      const posLerp = (this.cameraMode === 'cockpit' || this.cameraMode === 'hood') ? 0.45 : 0.18;
      const lookLerp = (this.cameraMode === 'cockpit' || this.cameraMode === 'hood') ? 0.45 : 0.22;
      this.cameraSmoothPos.lerp(targetCamPos, Math.min(1.0, posLerp * (dt / 0.016)));
      this.cameraSmoothLook.lerp(targetLookAt, Math.min(1.0, lookLerp * (dt / 0.016)));
    }

    camera.position.copy(this.cameraSmoothPos);
    camera.lookAt(this.cameraSmoothLook);
  }
}

window.Vehicle = Vehicle;
