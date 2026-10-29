/**
 * 6-DOF FPV Quadcopter Aerodynamic & Flight Dynamics Physics Engine
 * Supports ACRO (Rate), ANGLE (Self-Level), and HORIZON flight modes.
 * Integrates Betaflight actual rate curves, motor spool latency, anisotropic aerodynamic drag,
 * prop wash turbulence, ground effect cushion, and collision response.
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
   * Sub-stepped for maximum numeric stability
   * 
   * @param {number} dt - frame time delta in seconds
   * @param {Object} inputs - { throttle: 0..1, roll: -1..1, pitch: -1..1, yaw: -1..1 }
   */
  update(dt, inputs) {
    if (dt <= 0) return;
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
      // ACRO / RATE MODE: Betaflight actual rates map stick input directly to target angular velocity (deg/s)
      const targetRollDeg = this.rates.getRate('roll', inputs.roll);
      const targetPitchDeg = this.rates.getRate('pitch', inputs.pitch);
      const targetYawDeg = this.rates.getRate('yaw', inputs.yaw);

      targetAngVel.set(
        -targetPitchDeg * DEG_TO_RAD,
        -targetYawDeg * DEG_TO_RAD,
         targetRollDeg * DEG_TO_RAD
      );

      const rotSnappiness = 28.0;
      this.angularVelocity.x += (targetAngVel.x - this.angularVelocity.x) * Math.min(1.0, rotSnappiness * dt);
      this.angularVelocity.y += (targetAngVel.y - this.angularVelocity.y) * Math.min(1.0, rotSnappiness * dt);
      this.angularVelocity.z += (targetAngVel.z - this.angularVelocity.z) * Math.min(1.0, rotSnappiness * dt);

    } else if (this.mode === 'ANGLE') {
      // ANGLE / LEVEL MODE: Sticks map to target attitude angles
      const maxAngleRad = (this.spec.maxTiltAngle || 45) * DEG_TO_RAD;
      const targetPitchAngle = -inputs.pitch * maxAngleRad;
      const targetRollAngle  =  inputs.roll  * maxAngleRad;

      this._euler.setFromQuaternion(this.quaternion, 'YXZ');

      const pGain = 9.0;
      const pitchError = targetPitchAngle - this._euler.x;
      const rollError  = targetRollAngle  - this._euler.z;

      targetAngVel.x = pitchError * pGain;
      targetAngVel.z = rollError  * pGain;
      targetAngVel.y = -this.rates.getRate('yaw', inputs.yaw) * DEG_TO_RAD;

      this.angularVelocity.x += (targetAngVel.x - this.angularVelocity.x) * Math.min(1.0, 20.0 * dt);
      this.angularVelocity.z += (targetAngVel.z - this.angularVelocity.z) * Math.min(1.0, 20.0 * dt);
      this.angularVelocity.y += (targetAngVel.y - this.angularVelocity.y) * Math.min(1.0, 20.0 * dt);

    } else if (this.mode === 'HORIZON') {
      // HORIZON MODE: Self-levels near center, acro flips when sticks pushed > 80%
      const stickMag = Math.sqrt(inputs.roll * inputs.roll + inputs.pitch * inputs.pitch);
      if (stickMag > 0.8) {
        const targetRollDeg = this.rates.getRate('roll', inputs.roll);
        const targetPitchDeg = this.rates.getRate('pitch', inputs.pitch);
        targetAngVel.set(
          -targetPitchDeg * DEG_TO_RAD,
          -this.rates.getRate('yaw', inputs.yaw) * DEG_TO_RAD,
           targetRollDeg * DEG_TO_RAD
        );
        this.angularVelocity.lerp(targetAngVel, Math.min(1.0, 25.0 * dt));
      } else {
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

    // Ground Effect Cushion: when hovering close to floor
    if (this.position.y < 0.40 && this.position.y > 0.05) {
      const geRatio = 1.0 + (0.24 * Math.max(0, 1.0 - (this.position.y / 0.40)));
      thrustMag *= geRatio;
    }

    // Angle mode tilt compensation
    if (this.mode === 'ANGLE' && localUp.y > 0.1) {
      thrustMag *= (1.0 + Math.max(0, 1.0 - localUp.y) * 0.55);
    }

    totalForce.addScaledVector(localUp, thrustMag);

    // 3. Aerodynamic Drag & Prop Wash
    const speed = this.velocity.length();
    if (speed > 1e-4) {
      const airDensity = 1.225; // kg/m^3
      const worldToBodyQ = this._tempQ1.copy(this.quaternion).invert();
      const localVel = this.velocity.clone().applyQuaternion(worldToBodyQ);

      const dragX = -0.5 * airDensity * (this.spec.transverseDragCoeff || 0.8) * localVel.x * Math.abs(localVel.x);
      const dragY = -0.5 * airDensity * (this.spec.axialDragCoeff || 0.3)      * localVel.y * Math.abs(localVel.y);
      const dragZ = -0.5 * airDensity * (this.spec.linearDragCoeff || 0.5)     * localVel.z * Math.abs(localVel.z);

      const localDrag = new this.THREE.Vector3(dragX, dragY, dragZ);
      const worldDrag = localDrag.applyQuaternion(this.quaternion);
      totalForce.add(worldDrag);

      // Prop Wash Turbulence: Vortex ring state oscillation when descending into dirty prop downwash
      if (localVel.y < -1.8 && this.currentThrustPercent > 0.18) {
        const washIntensity = Math.min(1.0, (-localVel.y - 1.8) * 0.25) * 0.85;
        const washFreq = 22.0;
        const washRoll = Math.sin(this.flightTimeSeconds * washFreq * 2 * Math.PI) * 0.035 * washIntensity;
        const washPitch = Math.cos(this.flightTimeSeconds * (washFreq + 3) * 2 * Math.PI) * 0.025 * washIntensity;
        this.angularVelocity.z += washRoll;
        this.angularVelocity.x += washPitch;
      }
    }

    // 4. Integrate Linear Acceleration and Velocity
    this.acceleration.copy(totalForce).divideScalar(this.spec.mass);
    this.velocity.addScaledVector(this.acceleration, dt);

    // Integrate Position
    this.position.addScaledVector(this.velocity, dt);
  }

  _handleCollisions(dt) {
    const r = this.boundingRadius;
    const impactSpeed = this.velocity.length();

    // 1. Floor Collision
    if (this.position.y <= r) {
      this.position.y = r;
      
      const upDot = this._tempV2.set(0, 1, 0).applyQuaternion(this.quaternion).y;
      if ((impactSpeed > 9.0 && upDot < 0.2) || upDot < -0.3) {
        this.isCrashed = true;
        this.velocity.set(0, 0, 0);
      } else {
        if (this.velocity.y < 0) {
          this.velocity.y = -this.velocity.y * 0.22;
        }
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
      const box = this.colliders[i];
      if (box.containsPoint(this.position) || box.distanceToPoint(this.position) < r) {
        const closest = box.clampPoint(this.position, this._tempV1);
        const normal = this._tempV2.subVectors(this.position, closest);
        const dist = normal.length();

        if (dist < 1e-4) {
          normal.copy(this.velocity).negate().normalize();
        } else {
          normal.normalize();
        }

        this.position.copy(closest).addScaledVector(normal, r + 0.01);

        if (impactSpeed > 14.0) {
          this.isCrashed = true;
          this.velocity.set(0, 0, 0);
          return;
        }

        const velDotNormal = this.velocity.dot(normal);
        if (velDotNormal < 0) {
          this.velocity.addScaledVector(normal, -1.35 * velDotNormal);
          this.velocity.multiplyScalar(0.75);
          this.angularVelocity.multiplyScalar(0.60);
        }
      }
    }
  }

  setColliders(box3Array) {
    this.colliders = box3Array || [];
  }
}

window.FpvPhysics = FpvPhysics;
