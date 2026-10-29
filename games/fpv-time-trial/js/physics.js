/**
 * 6-DOF FPV Quadcopter Aerodynamic & Flight Dynamics Physics Engine
 * Supports ACRO (Rate), ANGLE (Self-Level), and HORIZON flight modes.
 * Integrates Betaflight rate curves, motor spool-up latency, quadratic aerodynamic drag,
 * prop disc momentum drag, and collision response.
 */

class FpvPhysics {
  /**
   * @param {THREE} THREE
   * @param {Object} spec - Drone specification from DRONE_SPECS
   * @param {RatesEngine} ratesEngine
   */
  constructor(THREE, spec, ratesEngine) {
    this.THREE = THREE;
    this.spec = spec;
    this.rates = ratesEngine;

    // Flight Mode: 'ACRO', 'ANGLE', or 'HORIZON'
    this.mode = 'ANGLE';

    // State Vectors (Metric SI)
    this.position = new THREE.Vector3(0, 1.0, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.acceleration = new THREE.Vector3(0, 0, 0);

    // Orientation represented as Quaternion
    this.quaternion = new THREE.Quaternion();
    this.angularVelocity = new THREE.Vector3(0, 0, 0); // rad/sec in body frame (pitch, yaw, roll)

    // Motor State
    this.currentThrustPercent = 0.0; // 0.0 to 1.0
    this.targetThrustPercent = 0.0;
    this.motorRpm = 0.0; // 0 to 100%

    // Crash and Status States
    this.isCrashed = false;
    this.crashCooldown = 0;
    this.isGrounded = false;
    this.turtleMode = false;

    // Battery Telemetry
    this.batteryVoltage = spec.batteryVoltageNom;
    this.batteryPercent = 100.0;
    this.flightTimeSeconds = 0.0;

    // Colliders list
    this.colliders = [];
    this.boundingRadius = spec.mass < 0.05 ? 0.05 : (spec.mass < 0.2 ? 0.10 : 0.16);

    // Helpers
    this._tempV1 = new THREE.Vector3();
    this._tempV2 = new THREE.Vector3();
    this._tempQ1 = new THREE.Quaternion();
    this._euler = new THREE.Euler(0, 0, 0, 'YXZ');
  }

  setDroneSpec(newSpec) {
    this.spec = newSpec;
    this.boundingRadius = newSpec.mass < 0.05 ? 0.05 : (newSpec.mass < 0.2 ? 0.10 : 0.16);
    this.batteryVoltage = newSpec.batteryVoltageNom;
    this.batteryPercent = 100.0;
  }

  setMode(newMode) {
    if (['ACRO', 'ANGLE', 'HORIZON'].includes(newMode)) {
      this.mode = newMode;
    }
  }

  reset(pos = null, rotY = 0) {
    if (pos) {
      this.position.copy(pos);
    } else {
      this.position.set(0, 0.4, 0);
    }
    this.velocity.set(0, 0, 0);
    this.acceleration.set(0, 0, 0);
    this.angularVelocity.set(0, 0, 0);

    // Set level orientation with given heading
    this.quaternion.setFromAxisAngle(new this.THREE.Vector3(0, 1, 0), rotY);

    this.currentThrustPercent = 0;
    this.targetThrustPercent = 0;
    this.isCrashed = false;
    this.crashCooldown = 0;
    this.isGrounded = false;
    this.turtleMode = false;
  }

  /**
   * Turtle Mode: Invert motors to flip the quad upright after a crash
   */
  triggerTurtleMode() {
    if (!this.isCrashed && !this.isGrounded) return;
    this.turtleMode = true;
    
    // Quick torque impulse to roll right-side up
    const rollImpulse = (Math.random() > 0.5 ? 1 : -1) * 12.0;
    this.angularVelocity.z = rollImpulse;
    this.velocity.y = 1.2;
    this.isCrashed = false;
    
    setTimeout(() => {
      this.turtleMode = false;
    }, 400);
  }

  /**
   * Main Physics Tick
   * Sub-stepped for maximum numeric stability (e.g., 2 sub-steps of dt/2)
   * 
   * @param {number} dt - frame time delta in seconds
   * @param {Object} inputs - { throttle: 0..1, roll: -1..1, pitch: -1..1, yaw: -1..1 }
   */
  update(dt, inputs) {
    if (dt <= 0) return;
    // Clamp delta to avoid huge physics spikes on tab switch
    const clampedDt = Math.min(dt, 0.05);

    // Sub-stepping (2 steps for high precision flight fidelity)
    const subSteps = 2;
    const subDt = clampedDt / subSteps;

    for (let i = 0; i < subSteps; i++) {
      this._physicsStep(subDt, inputs);
    }

    // Telemetry & Battery Simulation
    this.flightTimeSeconds += clampedDt;
    const powerDraw = (0.2 + 0.8 * this.currentThrustPercent) * (this.spec.twr / 4.0);
    const dischargeRate = 0.035 * powerDraw; // % per second
    this.batteryPercent = Math.max(0, this.batteryPercent - dischargeRate * clampedDt);
    
    // Battery sag under high throttle
    const sag = (this.currentThrustPercent * 0.45) * (this.spec.batteryCells);
    const nominalCell = 3.7 + (this.batteryPercent / 100.0) * 0.5;
    this.batteryVoltage = Math.max(this.spec.batteryCells * 3.2, (nominalCell * this.spec.batteryCells) - sag);
  }

  _physicsStep(dt, inputs) {
    if (this.isCrashed) {
      // Rapidly damp down velocities when crashed
      this.velocity.multiplyScalar(0.85);
      this.angularVelocity.multiplyScalar(0.85);
      this.position.addScaledVector(this.velocity, dt);
      return;
    }

    // 1. Motor Spool Latency (First-order low pass filter)
    this.targetThrustPercent = Math.max(0, Math.min(1.0, inputs.throttle));
    const tau = this.spec.motorResponseTau;
    const motorAlpha = 1.0 - Math.exp(-dt / tau);
    this.currentThrustPercent += (this.targetThrustPercent - this.currentThrustPercent) * motorAlpha;
    this.motorRpm = this.currentThrustPercent;

    // 2. Rotational Dynamics & Rate Controllers
    this._updateRotation(dt, inputs);

    // 3. Linear Aerodynamics & Thrust Forces
    this._updateLinearForces(dt);

    // 4. Collision Detection and Ground Response
    this._handleCollisions(dt);
  }

  _updateRotation(dt, inputs) {
    const DEG_TO_RAD = Math.PI / 180.0;
    const targetAngVel = this._tempV1.set(0, 0, 0);

    if (this.mode === 'ACRO') {
      // ACRO / RATE MODE:
      // Betaflight actual rates map stick input directly to target angular velocity (deg/s)
      const targetRollDeg = this.rates.getRate('roll', inputs.roll);
      const targetPitchDeg = this.rates.getRate('pitch', inputs.pitch);
      const targetYawDeg = this.rates.getRate('yaw', inputs.yaw);

      // Pitch is local X, Yaw is local Y, Roll is local Z
      targetAngVel.set(
        -targetPitchDeg * DEG_TO_RAD,
        -targetYawDeg * DEG_TO_RAD,
         targetRollDeg * DEG_TO_RAD
      );

      // Fast PID angular convergence
      const rotSnappiness = 28.0; // quadcopters have extreme torque-to-inertia
      this.angularVelocity.x += (targetAngVel.x - this.angularVelocity.x) * Math.min(1.0, rotSnappiness * dt);
      this.angularVelocity.y += (targetAngVel.y - this.angularVelocity.y) * Math.min(1.0, rotSnappiness * dt);
      this.angularVelocity.z += (targetAngVel.z - this.angularVelocity.z) * Math.min(1.0, rotSnappiness * dt);

    } else if (this.mode === 'ANGLE') {
      // ANGLE / LEVEL MODE:
      // Sticks map to target attitude angles. Centers auto-level!
      const maxAngleRad = (this.spec.maxTiltAngle || 45) * DEG_TO_RAD;
      const targetPitchAngle = -inputs.pitch * maxAngleRad;
      const targetRollAngle  =  inputs.roll  * maxAngleRad;

      // Extract current Euler angles from quaternion
      this._euler.setFromQuaternion(this.quaternion, 'YXZ');

      // Proportional self-leveling controller (P-gain)
      const pGain = 9.0;
      const dGain = 0.75;
      
      const pitchError = targetPitchAngle - this._euler.x;
      const rollError  = targetRollAngle  - this._euler.z;

      targetAngVel.x = pitchError * pGain;
      targetAngVel.z = rollError  * pGain;
      targetAngVel.y = -this.rates.getRate('yaw', inputs.yaw) * DEG_TO_RAD;

      this.angularVelocity.x += (targetAngVel.x - this.angularVelocity.x) * Math.min(1.0, 20.0 * dt);
      this.angularVelocity.z += (targetAngVel.z - this.angularVelocity.z) * Math.min(1.0, 20.0 * dt);
      this.angularVelocity.y += (targetAngVel.y - this.angularVelocity.y) * Math.min(1.0, 20.0 * dt);

    } else if (this.mode === 'HORIZON') {
      // HORIZON MODE: Self-levels near center, allows full acro flips when sticks pushed > 80%
      const stickMag = Math.sqrt(inputs.roll * inputs.roll + inputs.pitch * inputs.pitch);
      if (stickMag > 0.8) {
        // High stick deflection -> Acro rates
        const targetRollDeg = this.rates.getRate('roll', inputs.roll);
        const targetPitchDeg = this.rates.getRate('pitch', inputs.pitch);
        targetAngVel.set(
          -targetPitchDeg * DEG_TO_RAD,
          -this.rates.getRate('yaw', inputs.yaw) * DEG_TO_RAD,
           targetRollDeg * DEG_TO_RAD
        );
        this.angularVelocity.lerp(targetAngVel, Math.min(1.0, 25.0 * dt));
      } else {
        // Self-level near center
        const maxAngleRad = (this.spec.maxTiltAngle || 45) * DEG_TO_RAD;
        this._euler.setFromQuaternion(this.quaternion, 'YXZ');
        const pitchError = (-inputs.pitch * maxAngleRad) - this._euler.x;
        const rollError  = ( inputs.roll  * maxAngleRad) - this._euler.z;
        targetAngVel.set(
          pitchError * 8.0,
          -this.rates.getRate('yaw', inputs.yaw) * DEG_TO_RAD,
          rollError  * 8.0
        );
        this.angularVelocity.lerp(targetAngVel, Math.min(1.0, 20.0 * dt));
      }
    }

    // Apply angular damping
    this.angularVelocity.multiplyScalar(Math.pow(this.spec.rotationalDamping || 0.8, dt * 60));

    // Integrate quaternion from angular velocity in body frame
    // dq = 0.5 * q * [0, wx, wy, wz]
    const deltaAngle = this._tempV1.copy(this.angularVelocity).multiplyScalar(dt);
    const angleMag = deltaAngle.length();
    if (angleMag > 1e-6) {
      const deltaQ = this._tempQ1.setFromAxisAngle(deltaAngle.normalize(), angleMag);
      this.quaternion.multiply(deltaQ);
      this.quaternion.normalize();
    }
  }

  _updateLinearForces(dt) {
    const totalForce = this._tempV1.set(0, 0, 0);

    // 1. Gravity (Downwards -Y)
    const gravityForce = this.spec.mass * -9.81;
    totalForce.y += gravityForce;

    // 2. Thrust: Directed along quadcopter body local +Y axis
    const localUp = this._tempV2.set(0, 1, 0).applyQuaternion(this.quaternion);
    let thrustMag = this.currentThrustPercent * this.spec.maxThrustN;

    // Ground Effect: Cushion when hovering very close to floor
    if (this.position.y < 0.35 && this.position.y > 0.05) {
      const geRatio = 1.0 + (0.20 * Math.max(0, 1.0 - (this.position.y / 0.35)));
      thrustMag *= geRatio;
    }

    // Angle mode tilt compensation (keeps altitude stable during banking turns)
    if (this.mode === 'ANGLE' && localUp.y > 0.1) {
      thrustMag *= (1.0 + Math.max(0, 1.0 - localUp.y) * 0.55);
    }

    totalForce.addScaledVector(localUp, thrustMag);

    // 3. Aerodynamic Drag
    // Parasite Drag: Fd = -0.5 * rho * Cd * A * v^2
    const speed = this.velocity.length();
    if (speed > 1e-4) {
      const airDensity = 1.225; // kg/m^3
      // Project velocity into local quad body coordinates for anisotropic drag
      const worldToBodyQ = this._tempQ1.copy(this.quaternion).invert();
      const localVel = this.velocity.clone().applyQuaternion(worldToBodyQ);

      const dragX = -0.5 * airDensity * (this.spec.transverseDragCoeff || 0.8) * localVel.x * Math.abs(localVel.x);
      const dragY = -0.5 * airDensity * (this.spec.axialDragCoeff || 0.3)      * localVel.y * Math.abs(localVel.y);
      const dragZ = -0.5 * airDensity * (this.spec.linearDragCoeff || 0.5)     * localVel.z * Math.abs(localVel.z);

      const localDrag = new this.THREE.Vector3(dragX, dragY, dragZ);
      const worldDrag = localDrag.applyQuaternion(this.quaternion);
      totalForce.add(worldDrag);
    }

    // 4. Integrate Linear Acceleration and Velocity
    // a = F / m
    this.acceleration.copy(totalForce).divideScalar(this.spec.mass);
    this.velocity.addScaledVector(this.acceleration, dt);

    // Integrate Position: x = x + v * dt
    this.position.addScaledVector(this.velocity, dt);
  }

  _handleCollisions(dt) {
    const r = this.boundingRadius;
    const impactSpeed = this.velocity.length();

    // 1. Floor Collision
    if (this.position.y <= r) {
      this.position.y = r;
      
      // If crashing at high velocity or upside down
      const upDot = this._tempV2.set(0, 1, 0).applyQuaternion(this.quaternion).y;
      if ((impactSpeed > 9.0 && upDot < 0.2) || upDot < -0.3) {
        // Hard crash upside down
        this.isCrashed = true;
        this.velocity.set(0, 0, 0);
      } else {
        // Normal ground bounce / contact
        if (this.velocity.y < 0) {
          this.velocity.y = -this.velocity.y * 0.22; // Low restitution bounce
        }
        // Ground friction
        this.velocity.x *= 0.82;
        this.velocity.z *= 0.82;
        this.angularVelocity.multiplyScalar(0.70);
        this.isGrounded = true;
      }
    } else {
      this.isGrounded = false;
    }

    // 2. Obstacle / Box Collider Checks
    for (let i = 0; i < this.colliders.length; i++) {
      const box = this.colliders[i]; // THREE.Box3
      if (box.containsPoint(this.position) || box.distanceToPoint(this.position) < r) {
        // Find closest point on box
        const closest = box.clampPoint(this.position, this._tempV1);
        const normal = this._tempV2.subVectors(this.position, closest);
        const dist = normal.length();

        if (dist < 1e-4) {
          // Inside collider - push out along dominant velocity axis
          normal.copy(this.velocity).negate().normalize();
        } else {
          normal.normalize();
        }

        // Push position outside
        this.position.copy(closest).addScaledVector(normal, r + 0.01);

        // Crash check if high kinetic impact
        if (impactSpeed > 14.0) {
          this.isCrashed = true;
          this.velocity.set(0, 0, 0);
          return;
        }

        // Elastic bounce with friction
        const velDotNormal = this.velocity.dot(normal);
        if (velDotNormal < 0) {
          this.velocity.addScaledVector(normal, -1.35 * velDotNormal); // Bounce
          this.velocity.multiplyScalar(0.75); // Impact friction loss
          this.angularVelocity.multiplyScalar(0.60);
        }
      }
    }
  }

  /**
   * Register AABB colliders from environment meshes
   */
  setColliders(box3Array) {
    this.colliders = box3Array || [];
  }
}

window.FpvPhysics = FpvPhysics;
