# FPV Drone Physics & Liftoff Micro Drones Reverse Engineering Architecture

## 1. Executive Summary & Top Open-Source Repositories

To build a high-fidelity browser-based replica of **Liftoff: Micro Drones** (Lugus Studios, Steam) running on client-side WebGL (Three.js), we researched top open-source quadcopter simulators, flight controller repositories, and reverse-engineering frameworks.

### Top-Tier Reference Repositories
1. **`morluto/rea` (Reverse Engineer Anything)**:
   - Framework leveraging AI coding agents to probe and analyze binary targets, protocols, and internal physics engines.
   - Applied to Unity game disassembly (`Assembly-CSharp.dll` via ILSpy / dnSpy) to inspect Liftoff's flight controller math, PID update loops, and quadratic drag matrices.
2. **`laanwj/drone-swarm-rs`**:
   - Contains `liftoff-simstate-bridge`, an open-source BepInEx telemetry plugin that hooks into *Liftoff: Micro Drones* runtime to extract live telemetry: per-motor RPM, per-cell battery sag curves, thrust vectors, and propeller damage states.
3. **`Mathew-Harvey/WebFPVSimulator`**:
   - Compiles actual Betaflight firmware flight loop and physical plant models down to WebAssembly (WASM), providing the benchmark for browser-based flight controller accuracy.
4. **`AristidesAI/FPV.Sim` & `Betaflight-Actual-Rates-Simulator`**:
   - Reference JavaScript implementation of Betaflight **Actual Rates** math (Center Sensitivity, Max Rate, Expo) mapped to HTML5 Gamepad API.
5. **`ntnu-arl/aerial_gym_simulator` & `microsoft/AirSim`**:
   - High-performance multirotor aerodynamic physics, including prop wash turbulence, anisotropic drag, and ground effect equations.

---

## 2. Mathematical Flight Dynamics & Physics Architecture

### A. Betaflight Actual Rates Mapping
Rather than raw linear stick deflection, professional FPV pilots rely on Betaflight Actual Rates to balance fine center micro-corrections with rapid acrobatic rotations:

$$\text{RC Rate} = \frac{\text{CenterSens}}{100}$$

$$\text{Super Rate} = \text{MaxRate} - \text{CenterSens}$$

$$\text{Stick Curve} = \text{Stick} \cdot (1 - \text{Expo}) + \text{Stick}^5 \cdot \text{Expo}$$

$$\text{Rate} (\text{deg/s}) = (\text{Stick} \cdot \text{CenterSens}) + (\text{Stick Curve} \cdot \text{Super Rate})$$

### B. 6-DOF Rigid-Body Dynamics
- **Orientation**: Maintained as a unit quaternion $\mathbf{q}$ integrated via angular velocity $\boldsymbol{\omega} = [\omega_x, \omega_y, \omega_z]$:
  $$\Delta \mathbf{q} = \frac{1}{2} \mathbf{q} \otimes [0, \boldsymbol{\omega}] \, \Delta t$$
- **Motor Spool Latency**: Modeled as a first-order low-pass exponential filter:
  $$\text{Thrust}(t) = \text{Thrust}(t - \Delta t) + (\text{TargetThrust} - \text{Thrust}(t - \Delta t)) \cdot (1 - e^{-\Delta t / \tau})$$
  *(where $\tau = 28\text{ms}$ to $50\text{ms}$ depending on brushless motor stator size)*.
- **Anisotropic Aerodynamic Drag**:
  Ducts and propellers present drastically different drag profiles depending on the quadcopter's velocity vector relative to its body frame:
  $$\mathbf{F}_{D,\text{body}} = -\frac{1}{2} \rho \begin{bmatrix} C_{D,\text{transverse}} \cdot v_x |v_x| \\ C_{D,\text{axial}} \cdot v_y |v_y| \\ C_{D,\text{linear}} \cdot v_z |v_z| \end{bmatrix}$$
- **Prop Wash Turbulence (Vortex Ring State)**:
  When descending vertically through its own turbulent propeller slipstream ($v_{y,\text{body}} < -1.8\text{ m/s}$ with active throttle), high-frequency roll/pitch perturbation ($22\text{ Hz}$) is injected, creating authentic FPV wash wobble.
- **Ground Effect Cushion**:
  When hovering within $0.40\text{m}$ of the floor, induced downwash velocity decreases, generating up to $24\%$ additional effective lift.
- **Battery Voltage Sag**:
  Simulates chemical internal resistance of LiPo / LiHV battery packs under punch-out throttle load:
  $$V_{\text{terminal}} = V_{\text{cell}} \cdot N_{\text{cells}} - (\text{Thrust} \cdot 0.45 \cdot N_{\text{cells}})$$

---

## 3. Fleet Specifications Matrix: Micro Whoops to 5-Inch Beasts

| Model | Category | Battery | Mass | TWR | Max Speed | Duct / Prop Type | Best Suited For |
|---|---|---|---|---|---|---|---|
| **Nano Bee 65** | Micro Whoop | 1S LiHV (300mAh) | 28g | 4.2:1 | 48 km/h | 31mm Circular Ducts | Cozy living rooms, under-chair slalom |
| **Meteor 75 Pro** | Power Whoop | 2S LiHV (450mAh) | 46g | 6.8:1 | 72 km/h | 40mm Ducted Pusher | Aggressive indoor/garden micro racing |
| **CineBumble 2.5** | Cinewhoop | 4S LiPo (650mAh) | 170g | 6.2:1 | 85 km/h | 2.5" Foam Padded Ducts | Ultra-smooth cinematic lines & doorways |
| **Ghost Toothpick 3** | Ultralight | 3S LiPo (450mAh) | 78g | 8.8:1 | 110 km/h | 3" Open Tri-Blades | Acrobatic freestyle in tight parks |
| **Phantom Micro 3.5** | Freestyle Micro | 4S LiPo (850mAh) | 210g | 10.5:1 | 135 km/h | 3.5" High-Efficiency Blades | Sub-250g high-momentum gap diving |
| **Apex Predator 5** | Pro Racer / Freestyle | 6S LiPo (1300mAh) | 660g | 13.8:1 | 165 km/h | 5.1" Pitch Tri-Blades | Massive powerloops, split-S, open speedways |

---

## 4. Multi-Environment Generation Strategy

Procedural 3D environments are dynamically built and cached with collision AABBs (`THREE.Box3`) and ambient audio filters:

1. **The Cozy Loft (Liftoff: Micro Drones Tribute)**:
   - Living room with sectional sofa, coffee table with diveable clearance, open bookshelf cubby tunnels, dining table & chairs slalom, 2nd floor mezzanine, and a spinning ceiling fan obstacle.
2. **Neon Hangar (Industrial Freestyle Playground)**:
   - Multi-tiered warehouse with stacked shipping container canyons, structural steel ceiling trusses for high-altitude powerloops, and illuminated catwalks.
3. **Neon City Rooftops (Cyberpunk Skyscraper Course)**:
   - Skyscraper roofs at variable elevations connected by glass skybridges, AC ventilation duct dive tunnels, and illuminated communications antennas.
4. **Sunset Ridge (Outdoor High-Speed Canyon Speedway)**:
   - Deformed vertex terrain with towering rock formations and a central 32m dive tower engineered for 5-inch 6S vertical dives.

---

## 5. Input & RC Transmitter Hardware Integration

- **HTML5 Gamepad API Auto-Detection**:
  - Automatically recognizes USB / Bluetooth RC transmitters (RadioMaster TX16S / Boxer / Pocket, TBS Tango 2, FrSky, BetaFPV LiteRadio) and game controllers (Xbox, DualShock, DualSense).
  - Configured for **Mode 2** (Standard FPV Transmitter):
    - Left Stick: Throttle (Y) + Yaw (X)
    - Right Stick: Pitch (Y) + Roll (X)
- **Keyboard Fallback**:
  - Space / W: Throttle Up
  - Ctrl / S: Throttle Down
  - Arrow Keys / IJKL: Pitch & Roll
  - Q / E: Yaw Rotation
  - M: Toggle Acro / Angle Mode
  - T: Turtle Mode (Crash Flip)
  - R: Fast Reset
