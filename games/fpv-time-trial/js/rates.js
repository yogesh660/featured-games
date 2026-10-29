/**
 * FPV Flight Rates Engine - Betaflight Actual & Legacy Rates
 * Implements the authentic Betaflight mathematical rate models used in real FPV drones
 * and modern simulators.
 */

class RatesEngine {
  constructor() {
    this.model = 'ACTUAL'; // 'ACTUAL' or 'BETAFLIGHT'

    // Actual Rates defaults (Roll, Pitch, Yaw)
    this.actual = {
      roll:  { center: 80,  max: 670, expo: 0.52 },
      pitch: { center: 80,  max: 670, expo: 0.52 },
      yaw:   { center: 80,  max: 600, expo: 0.45 }
    };

    // Legacy Betaflight defaults (rcRate, superRate, expo)
    this.legacy = {
      roll:  { rcRate: 1.0, superRate: 0.70, expo: 0.20 },
      pitch: { rcRate: 1.0, superRate: 0.70, expo: 0.20 },
      yaw:   { rcRate: 1.0, superRate: 0.65, expo: 0.20 }
    };

    this.deadband = 0.04; // 4% center deadzone
  }

  /**
   * Apply stick deadband
   */
  applyDeadband(val) {
    const abs = Math.abs(val);
    if (abs <= this.deadband) return 0;
    const sign = Math.sign(val);
    return sign * ((abs - this.deadband) / (1.0 - this.deadband));
  }

  /**
   * Calculate turn rate in deg/sec using Betaflight Actual Rates formula
   * @param {number} stick - Normalized stick input (-1.0 to 1.0)
   * @param {number} center - Center sensitivity (deg/sec)
   * @param {number} max - Max rate at full deflection (deg/sec)
   * @param {number} expo - Expo factor (0.0 to 1.0)
   * @returns {number} Angular rate in deg/s
   */
  calculateActualRate(stick, center, max, expo) {
    const s = this.applyDeadband(stick);
    const absStick = Math.abs(s);
    if (absStick === 0) return 0;

    // Linear component
    const rcFactor = center * absStick;

    // Exponential component (Betaflight Actual formula)
    const expoFactor = absStick * (Math.pow(absStick, 4) * expo + absStick * (1.0 - expo));
    const additionalRate = Math.max(0, max - center) * expoFactor;

    const rate = rcFactor + additionalRate;
    return Math.sign(s) * Math.min(max, rate);
  }

  /**
   * Calculate turn rate in deg/sec using Legacy Betaflight formula
   */
  calculateLegacyRate(stick, rcRate, superRate, expo) {
    const s = this.applyDeadband(stick);
    const absStick = Math.abs(s);
    if (absStick === 0) return 0;

    // Expo transformation
    const rcCommand = s;
    const expoVal = rcCommand * Math.pow(absStick, 3) * expo + rcCommand * (1.0 - expo);

    // Super rate denominator clamp
    const srClamp = Math.min(0.99, absStick * superRate);
    const superFactor = 1.0 / (1.0 - srClamp);

    // Rate in deg/s (200 is base scale factor)
    const rate = 200.0 * rcRate * expoVal * superFactor;
    return rate;
  }

  /**
   * Get target angular rate for an axis (deg/sec)
   * @param {string} axis - 'roll', 'pitch', or 'yaw'
   * @param {number} stick - stick position -1 to 1
   */
  getRate(axis, stick) {
    if (this.model === 'ACTUAL') {
      const cfg = this.actual[axis] || this.actual.roll;
      return this.calculateActualRate(stick, cfg.center, cfg.max, cfg.expo);
    } else {
      const cfg = this.legacy[axis] || this.legacy.roll;
      return this.calculateLegacyRate(stick, cfg.rcRate, cfg.superRate, cfg.expo);
    }
  }

  /**
   * Generate points for live rate graph visualization (e.g. for canvas UI)
   */
  generateCurvePoints(axis, sampleCount = 40) {
    const points = [];
    for (let i = 0; i <= sampleCount; i++) {
      const stick = (i / sampleCount) * 2 - 1; // -1 to 1
      const rate = this.getRate(axis, stick);
      points.push({ stick, rate });
    }
    return points;
  }

  /**
   * Load presets
   */
  loadPreset(presetName) {
    switch (presetName) {
      case 'micro-indoor':
        // Liftoff: Micro Drones / Tinywhoop preset: very calm center, manageable max
        this.model = 'ACTUAL';
        this.actual.roll  = { center: 60, max: 540, expo: 0.58 };
        this.actual.pitch = { center: 60, max: 540, expo: 0.58 };
        this.actual.yaw   = { center: 70, max: 480, expo: 0.45 };
        break;

      case 'freestyle':
        // Modern freestyle (juicy flow)
        this.model = 'ACTUAL';
        this.actual.roll  = { center: 100, max: 720, expo: 0.52 };
        this.actual.pitch = { center: 100, max: 720, expo: 0.52 };
        this.actual.yaw   = { center: 90,  max: 640, expo: 0.48 };
        break;

      case 'race-fast':
        // High speed 5-inch racing: crisp center, high top speed
        this.model = 'ACTUAL';
        this.actual.roll  = { center: 120, max: 880, expo: 0.40 };
        this.actual.pitch = { center: 120, max: 880, expo: 0.40 };
        this.actual.yaw   = { center: 110, max: 750, expo: 0.35 };
        break;

      case 'beginner-stabilized':
      default:
        this.model = 'ACTUAL';
        this.actual.roll  = { center: 50, max: 400, expo: 0.60 };
        this.actual.pitch = { center: 50, max: 400, expo: 0.60 };
        this.actual.yaw   = { center: 60, max: 360, expo: 0.50 };
        break;
    }
  }
}

// Global instance
window.RatesEngine = RatesEngine;
