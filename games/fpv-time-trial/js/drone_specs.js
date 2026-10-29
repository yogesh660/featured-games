/**
 * Drone Specifications and Procedural 3D Visual Mesh Generator
 * Covers a full fleet from 65mm Tinywhoops (Liftoff Micro Drones style) to 5-inch 6S Racing Quads.
 */

const DRONE_SPECS = {
  tinywhoop65: {
    id: 'tinywhoop65',
    name: 'Nano Bee 65',
    subtitle: '65mm 1S Micro Brushless Whoop',
    category: 'Micro Drone',
    badge: 'Beginner & Indoor',
    description: 'Ultra-lightweight ducted indoor micro-drone. Floats gently, stops on a dime with high duct drag, and squeezes through tiny gaps under chairs and tables.',
    
    // Physics Parameters (Metric SI)
    mass: 0.028,             // 28 grams
    twr: 4.2,                // 4.2:1 thrust-to-weight ratio
    maxThrustN: 0.028 * 9.81 * 4.2, // ~1.15 N total max thrust
    
    linearDragCoeff: 0.85,   // High drag due to circular prop ducts
    axialDragCoeff: 0.35,    // Vertical drag through ducts
    transverseDragCoeff: 1.25, // Sideways drift resistance
    
    rotationalInertia: { x: 0.00015, y: 0.00018, z: 0.00022 },
    rotationalDamping: 0.82,
    
    motorResponseTau: 0.035, // 35ms motor latency (very snappy small 0802 motors)
    
    defaultCameraTilt: 20,   // degrees
    cameraFov: 115,          // wide FPV view
    maxTiltAngle: 45,        // Angle Mode limit (degrees)
    
    batteryCells: 1,         // 1S LiHV
    batteryVoltageNom: 4.35,
    batteryCapacityMah: 300,
    
    topSpeedKmh: 48,
    soundProfile: { baseFreq: 320, maxFreq: 1100, whineIntensity: 0.65 },
    
    themeColor: '#00ffcc',   // Cyan neon
    accentColor: '#10b981'
  },

  meteor75: {
    id: 'meteor75',
    name: 'Meteor 75 Pro',
    subtitle: '75mm 2S Brushless Power Whoop',
    category: 'Power Whoop',
    badge: 'Micro Racing Beast',
    description: 'Aggressive 75mm 2S micro whoop. Blends the safety of circular ducted props with 2S punch-out thrust for ripping fast living-room lines and outdoor garden gaps.',
    
    mass: 0.046,             // 46g
    twr: 6.8,                // 6.8:1
    maxThrustN: 0.046 * 9.81 * 6.8, // ~3.07 N
    
    linearDragCoeff: 0.72,
    axialDragCoeff: 0.30,
    transverseDragCoeff: 1.05,
    
    rotationalInertia: { x: 0.00024, y: 0.00028, z: 0.00036 },
    rotationalDamping: 0.80,
    
    motorResponseTau: 0.032,
    
    defaultCameraTilt: 28,
    cameraFov: 118,
    maxTiltAngle: 50,
    
    batteryCells: 2,         // 2S
    batteryVoltageNom: 8.70,
    batteryCapacityMah: 450,
    
    topSpeedKmh: 72,
    soundProfile: { baseFreq: 340, maxFreq: 1180, whineIntensity: 0.70 },
    
    themeColor: '#06b6d4',
    accentColor: '#3b82f6'
  },

  cinewhoop25: {
    id: 'cinewhoop25',
    name: 'CineBumble 2.5',
    subtitle: '2.5-Inch 4S Ducted Pusher',
    category: 'Cinewhoop',
    badge: 'Smooth & Stable',
    description: 'Foam-padded ducted drone engineered for smooth cinematic flying. Higher inertia gives it steady, floating lines through doorways and around obstacles.',
    
    mass: 0.170,             // 170g
    twr: 6.2,                // 6.2:1
    maxThrustN: 0.170 * 9.81 * 6.2, // ~10.3 N
    
    linearDragCoeff: 0.55,
    axialDragCoeff: 0.28,
    transverseDragCoeff: 0.75,
    
    rotationalInertia: { x: 0.0008, y: 0.0009, z: 0.0012 },
    rotationalDamping: 0.78,
    
    motorResponseTau: 0.050, // 50ms (1404 motors)
    
    defaultCameraTilt: 25,
    cameraFov: 120,
    maxTiltAngle: 50,
    
    batteryCells: 4,         // 4S
    batteryVoltageNom: 16.8,
    batteryCapacityMah: 650,
    
    topSpeedKmh: 85,
    soundProfile: { baseFreq: 240, maxFreq: 950, whineIntensity: 0.50 },
    
    themeColor: '#f59e0b',   // Amber
    accentColor: '#fbbf24'
  },

  toothpick3: {
    id: 'toothpick3',
    name: 'Ghost Toothpick 3',
    subtitle: '3-Inch 3S Ultralight Open-Prop',
    category: 'Ultralight Racer',
    badge: 'Ultra Agile',
    description: 'Un-ducted carbon toothpick with open props. Extremely nimble, razor-sharp response, and low drag for acrobatic freestyle in tight parks.',
    
    mass: 0.078,             // 78g
    twr: 8.8,                // 8.8:1
    maxThrustN: 0.078 * 9.81 * 8.8, // ~6.7 N
    
    linearDragCoeff: 0.38,
    axialDragCoeff: 0.18,
    transverseDragCoeff: 0.45,
    
    rotationalInertia: { x: 0.00035, y: 0.00040, z: 0.00055 },
    rotationalDamping: 0.75,
    
    motorResponseTau: 0.028,
    
    defaultCameraTilt: 32,
    cameraFov: 125,
    maxTiltAngle: 55,
    
    batteryCells: 3,         // 3S
    batteryVoltageNom: 12.6,
    batteryCapacityMah: 450,
    
    topSpeedKmh: 110,
    soundProfile: { baseFreq: 280, maxFreq: 1250, whineIntensity: 0.70 },
    
    themeColor: '#ec4899',   // Pink / Fuchsia
    accentColor: '#f43f5e'
  },

  phantom35: {
    id: 'phantom35',
    name: 'Phantom Micro 3.5',
    subtitle: '3.5-Inch 4S Sub-250g Freestyle Quad',
    category: 'Freestyle Micro',
    badge: 'Modern Sweet Spot',
    description: 'The modern gold standard of freestyle agility and silence. Featherweight sub-250g frame carries high momentum through gaps with near-silent high-efficiency triblades.',
    
    mass: 0.210,             // 210g
    twr: 10.5,               // 10.5:1
    maxThrustN: 0.210 * 9.81 * 10.5, // ~21.6 N
    
    linearDragCoeff: 0.32,
    axialDragCoeff: 0.15,
    transverseDragCoeff: 0.38,
    
    rotationalInertia: { x: 0.0012, y: 0.0015, z: 0.0020 },
    rotationalDamping: 0.74,
    
    motorResponseTau: 0.034,
    
    defaultCameraTilt: 35,
    cameraFov: 125,
    maxTiltAngle: 58,
    
    batteryCells: 4,         // 4S
    batteryVoltageNom: 16.8,
    batteryCapacityMah: 850,
    
    topSpeedKmh: 135,
    soundProfile: { baseFreq: 220, maxFreq: 1280, whineIntensity: 0.78 },
    
    themeColor: '#10b981',   // Emerald
    accentColor: '#059669'
  },

  apex5racer: {
    id: 'apex5racer',
    name: 'Apex Predator 5',
    subtitle: '5-Inch 6S Competition Freestyle & Racer',
    category: '5-Inch Pro Quad',
    badge: 'Maximum Speed & Power',
    description: 'The heavyweight king of FPV. Immense 14:1 thrust gives rocket-like acceleration up to 160+ km/h. Carries tremendous kinetic momentum on split-S dives and powerloops.',
    
    mass: 0.660,             // 660g with 6S battery + action cam
    twr: 13.8,               // 13.8:1
    maxThrustN: 0.660 * 9.81 * 13.8, // ~89.3 N max thrust!
    
    linearDragCoeff: 0.28,   // Low aerodynamic drag
    axialDragCoeff: 0.12,
    transverseDragCoeff: 0.32,
    
    rotationalInertia: { x: 0.0035, y: 0.0042, z: 0.0062 }, // Higher inertia = carries flips
    rotationalDamping: 0.72,
    
    motorResponseTau: 0.040, // 2207 brushless motors
    
    defaultCameraTilt: 45,   // Aggressive forward tilt
    cameraFov: 130,
    maxTiltAngle: 60,
    
    batteryCells: 6,         // 6S
    batteryVoltageNom: 25.2,
    batteryCapacityMah: 1300,
    
    topSpeedKmh: 165,
    soundProfile: { baseFreq: 180, maxFreq: 1380, whineIntensity: 0.85 },
    
    themeColor: '#8b5cf6',   // Purple neon
    accentColor: '#6366f1'
  }
};

/**
 * 3D Procedural Mesh Builder for Three.js
 */
class DroneModelBuilder {
  /**
   * Build an authentic 3D drone mesh for the given spec
   * @param {THREE} THREE
   * @param {Object} spec
   * @returns {THREE.Group}
   */
  static createDroneMesh(THREE, spec) {
    const droneGroup = new THREE.Group();
    droneGroup.name = `drone_${spec.id}`;

    // Common Materials
    const carbonMat = new THREE.MeshStandardMaterial({
      color: 0x18181c,
      roughness: 0.45,
      metalness: 0.85
    });

    const canopyMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(spec.themeColor),
      roughness: 0.2,
      metalness: 0.6,
      emissive: new THREE.Color(spec.themeColor),
      emissiveIntensity: 0.15
    });

    const propMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.65,
      roughness: 0.3
    });

    const ledRed = new THREE.MeshBasicMaterial({ color: 0xff2244 });
    const ledGreen = new THREE.MeshBasicMaterial({ color: 0x22ff66 });
    const ledCyan = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const lensMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.1, metalness: 0.95 });

    const propsList = [];

    if (spec.id === 'tinywhoop65' || spec.id === 'meteor75') {
      // 65mm or 75mm Micro Whoop Geometry
      const is75 = spec.id === 'meteor75';
      const ductRadius = is75 ? 0.027 : 0.022;
      const ductSpread = is75 ? 0.036 : 0.030;

      // Center Pod
      const podGeo = new THREE.CylinderGeometry(is75 ? 0.024 : 0.022, is75 ? 0.028 : 0.026, 0.016, 12);
      const pod = new THREE.Mesh(podGeo, canopyMat);
      pod.position.y = 0.008;
      droneGroup.add(pod);

      // Camera Lens tilted
      const camGeo = new THREE.CylinderGeometry(0.006, 0.007, 0.012, 12);
      const cam = new THREE.Mesh(camGeo, lensMat);
      cam.rotation.x = Math.PI / 2 - (spec.defaultCameraTilt * Math.PI / 180);
      cam.position.set(0, 0.014, 0.018);
      droneGroup.add(cam);

      // 4 Ducts with Props
      const ductOffsets = [
        { x:  ductSpread, z:  ductSpread },
        { x: -ductSpread, z:  ductSpread },
        { x: -ductSpread, z: -ductSpread },
        { x:  ductSpread, z: -ductSpread }
      ];

      const ductGeo = new THREE.TorusGeometry(ductRadius, 0.0035, 8, 20);
      ductOffsets.forEach((pos, idx) => {
        // Strut arm
        const armGeo = new THREE.CylinderGeometry(0.002, 0.002, ductSpread * 1.4, 6);
        const arm = new THREE.Mesh(armGeo, carbonMat);
        arm.rotation.z = Math.PI / 2;
        arm.rotation.y = (idx % 2 === 0 ? 1 : -1) * Math.PI / 4;
        arm.position.set(pos.x * 0.5, 0.002, pos.z * 0.5);
        droneGroup.add(arm);

        // Circular Duct Ring
        const duct = new THREE.Mesh(ductGeo, canopyMat);
        duct.rotation.x = Math.PI / 2;
        duct.position.set(pos.x, 0.005, pos.z);
        droneGroup.add(duct);

        // Propeller Disc
        const propGeo = new THREE.CylinderGeometry(ductRadius * 0.88, ductRadius * 0.88, 0.0015, 12);
        const prop = new THREE.Mesh(propGeo, propMat);
        prop.position.set(pos.x, 0.006, pos.z);
        droneGroup.add(prop);
        propsList.push(prop);
      });

      // Rear Status LED
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.004, 8, 8), is75 ? ledCyan : ledRed);
      led.position.set(0, 0.006, -0.025);
      droneGroup.add(led);

    } else if (spec.id === 'cinewhoop25') {
      // 2.5-Inch Cinewhoop Geometry
      // Carbon Main Plate
      const plateGeo = new THREE.BoxGeometry(0.06, 0.004, 0.09);
      const plate = new THREE.Mesh(plateGeo, carbonMat);
      plate.position.y = 0.006;
      droneGroup.add(plate);

      // Foam Bumper Guards
      const ductOffsets = [
        { x:  0.052, z:  0.050 },
        { x: -0.052, z:  0.050 },
        { x: -0.052, z: -0.050 },
        { x:  0.052, z: -0.050 }
      ];
      const ductGeo = new THREE.TorusGeometry(0.038, 0.006, 10, 24);
      const bumperMat = new THREE.MeshStandardMaterial({ color: 0x222226, roughness: 0.7 });

      ductOffsets.forEach((pos) => {
        const duct = new THREE.Mesh(ductGeo, bumperMat);
        duct.rotation.x = Math.PI / 2;
        duct.position.set(pos.x, 0.008, pos.z);
        droneGroup.add(duct);

        // Prop
        const propGeo = new THREE.CylinderGeometry(0.033, 0.033, 0.002, 12);
        const prop = new THREE.Mesh(propGeo, propMat);
        prop.position.set(pos.x, 0.010, pos.z);
        droneGroup.add(prop);
        propsList.push(prop);
      });

      // HD Cam & FPV Cam
      const hdCam = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.024, 0.020), canopyMat);
      hdCam.position.set(0, 0.022, 0.028);
      hdCam.rotation.x = -(spec.defaultCameraTilt * Math.PI / 180);
      droneGroup.add(hdCam);

    } else if (spec.id === 'toothpick3' || spec.id === 'phantom35') {
      // 3-inch Toothpick or 3.5-inch Freestyle (X-frame)
      const is35 = spec.id === 'phantom35';
      const armSpan = is35 ? 0.16 : 0.12;
      const propRadius = is35 ? 0.048 : 0.040;
      const spread = is35 ? 0.058 : 0.045;

      const armGeo = new THREE.BoxGeometry(armSpan, 0.0035, 0.009);
      const arm1 = new THREE.Mesh(armGeo, carbonMat);
      arm1.rotation.y = Math.PI / 4;
      const arm2 = new THREE.Mesh(armGeo, carbonMat);
      arm2.rotation.y = -Math.PI / 4;
      droneGroup.add(arm1);
      droneGroup.add(arm2);

      // Center Canopy
      const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.026, 8), canopyMat);
      canopy.rotation.x = Math.PI / 2;
      canopy.position.set(0, 0.012, 0);
      droneGroup.add(canopy);

      // Open Props on motor stubs
      const motorOffsets = [
        { x:  spread, z:  spread },
        { x: -spread, z:  spread },
        { x: -spread, z: -spread },
        { x:  spread, z: -spread }
      ];
      motorOffsets.forEach((pos) => {
        const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.009, 10), carbonMat);
        motor.position.set(pos.x, 0.006, pos.z);
        droneGroup.add(motor);

        const prop = new THREE.Mesh(new THREE.CylinderGeometry(propRadius, propRadius, 0.0018, 14), propMat);
        prop.position.set(pos.x, 0.012, pos.z);
        droneGroup.add(prop);
        propsList.push(prop);
      });

    } else {
      // 5-Inch Apex Freestyle Quad (Apex Predator 5)
      // Main Carbon Bottom Plate
      const bottomPlate = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.004, 0.16), carbonMat);
      bottomPlate.position.y = 0.004;
      droneGroup.add(bottomPlate);

      // Top Plate + Standoffs
      const topPlate = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.003, 0.14), carbonMat);
      topPlate.position.y = 0.028;
      droneGroup.add(topPlate);

      // Battery pack on top
      const lipoMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 });
      const battery = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.028, 0.08), lipoMat);
      battery.position.set(0, 0.044, -0.01);
      droneGroup.add(battery);

      // Battery strap
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.040, 0.030, 0.014), canopyMat);
      strap.position.set(0, 0.044, -0.01);
      droneGroup.add(strap);

      // 4 Heavy Carbon Arms (True-X)
      const armThickness = 0.005;
      const armLength = 0.12;
      const armOffsets = [
        { x:  0.08, z:  0.075, rot:  0.65 },
        { x: -0.08, z:  0.075, rot: -0.65 },
        { x: -0.08, z: -0.075, rot:  2.49 },
        { x:  0.08, z: -0.075, rot: -2.49 }
      ];

      armOffsets.forEach((pos) => {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.014, armThickness, armLength), carbonMat);
        arm.position.set(pos.x * 0.5, 0.004, pos.z * 0.5);
        arm.rotation.y = pos.rot;
        droneGroup.add(arm);

        // 2207 Brushless Motor
        const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.016, 12), carbonMat);
        motor.position.set(pos.x, 0.014, pos.z);
        droneGroup.add(motor);

        // 5.1-inch Propeller
        const prop = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.002, 16), propMat);
        prop.position.set(pos.x, 0.024, pos.z);
        droneGroup.add(prop);
        propsList.push(prop);
      });

      // Front FPV & HD Action Cam (GoPro style)
      const gopro = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.028, 0.024), canopyMat);
      gopro.position.set(0, 0.045, 0.055);
      gopro.rotation.x = -(spec.defaultCameraTilt * Math.PI / 180);
      droneGroup.add(gopro);

      const gpLens = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.006, 12), lensMat);
      gpLens.rotation.x = Math.PI / 2;
      gpLens.position.set(0.008, 0, 0.014);
      gopro.add(gpLens);

      // Rear VTX Lollipop Antenna
      const antMat = new THREE.MeshStandardMaterial({ color: 0xff3366 });
      const antMast = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.045, 6), carbonMat);
      antMast.rotation.x = -Math.PI / 4;
      antMast.position.set(0, 0.040, -0.075);
      droneGroup.add(antMast);

      const antHead = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 10), antMat);
      antHead.position.set(0, 0.055, -0.090);
      droneGroup.add(antHead);

      // Tail LEDs
      const ledL = new THREE.Mesh(new THREE.SphereGeometry(0.005, 8, 8), ledGreen);
      ledL.position.set(-0.02, 0.008, -0.082);
      droneGroup.add(ledL);
      const ledR = new THREE.Mesh(new THREE.SphereGeometry(0.005, 8, 8), ledRed);
      ledR.position.set(0.02, 0.008, -0.082);
      droneGroup.add(ledR);
    }

    // Attach reference to spinning propellers for animation loop
    droneGroup.userData.props = propsList;
    droneGroup.userData.spec = spec;

    return droneGroup;
  }
}

window.DRONE_SPECS = DRONE_SPECS;
window.DroneModelBuilder = DroneModelBuilder;
