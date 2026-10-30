# Featured Games — Browser Gaming Collection

A collection of polished, responsive browser games hosted for free on GitHub Pages, designed to match the visual identity, tokens, and sleek dark aesthetic of [yogesh660.github.io](https://yogesh660.github.io).

---

## 🎮 Games Overview

| Title | Genre | Tech | Status | Path |
|---|---|---|---|---|
| **Open Road Racer** | 3D Scenic Mountain Driving & Time Trial | Three.js (r128), Web Audio API | **Playable Now** | [`games/open-road-racer/`](games/open-road-racer/index.html) |
| **Space Defender** | Arcade Wave Shooter & Upgrades | Canvas 2D, Particle Pools | *Scheduled (Step 4–6)* | [`games/space-defender/`](games/space-defender/index.html) |
| **Neural Puzzle** | Logic & Pattern Circuit Routing | CSS Grid, Graph Traversal | *Scheduled (Step 7–9)* | [`games/neural-puzzle/`](games/neural-puzzle/index.html) |
| **FPV Time Trial** | Acrobatic Drone Racing Obstacle Course | Three.js 3D, Flight Physics | *Scheduled (Step 10–12)* | [`games/fpv-time-trial/`](games/fpv-time-trial/index.html) |

---

## 🧭 Part of the portfolio site

This hub is the **Play** section of the portfolio (nav: Work · Learn · Play · About · Contact).
`assets/site.css` and `assets/site.js` are verbatim copies of the portfolio's `src/site.css` and `src/site.js`;
do not edit them here, copy them over from yogesh660.github.io. Hub-only styles and the animated game art
live in `assets/games.css`. Links to the other sections are root-relative (`/work/`, `/ml-model-zoo/`).

---

## 🏎️ Game 01: Open Road Racer (Playable Now)

Inspired by relaxing exploration games (*Slow Roads*), set across the winding ghats and basalt escarpments of India's **Western Ghats / Sahyadri**:

* **Continuous 3D Road Spline:** Procedurally generated Catmull-Rom mountain pass ribbon with asphalt shaders, yellow dashed center lines, and elevation crests.
* **Western Ghats Scenery:** Layered basalt cliffs, laterite red soil shoulders, rolling monsoon emerald hills, and instanced umbrella-canopy trees.
* **Realistic Arcade Vehicle Dynamics:** Low-poly GT coupe with 5-speed simulated transmission, RPM-based power curves, nose-dip braking pitch, lateral body roll, and off-road slowdown with guardrails.
* **100% Procedural Web Audio Engine:** Dual harmonic engine oscillators, RPM pitch shifting, tire skid noise, wind rush scaling with velocity, and checkpoint chimes (zero external audio files).
* **Dual Cameras:** Dynamic Chase camera (with speed-sensitive FOV) and Cockpit / Hood camera (toggle with `C`).
* **Modes & HUD:** Free Cruise and Time Trial modes with lap timer, checkpoint gate arches, speed dial, gear indicator, and persistent local records in `localStorage`.
* **Controls:**
  * **Desktop:** `W` / `↑` Accelerate, `S` / `↓` Brake/Reverse, `A` / `D` or `←` / `→` Steer, `Space` Drift/Handbrake, `C` Camera, `R` Reset, `Esc` Pause.
  * **Mobile:** On-screen virtual steering buttons and gas/brake pedals.
* **Adjustable Graphics Fidelity:** In-game settings modal with Low, Medium, and High presets for smooth frame rates on any device.

---

## 💻 Local Run Instructions

This project requires **no backend, build tools, or npm installations**. You can run it with any static web server:

### Option 1: Python HTTP Server (Recommended)
```bash
# In the repository root:
python -m http.server 8000
```
Open [http://localhost:8000](http://localhost:8000) in your browser.

### Option 2: Node / npx
```bash
npx serve .
```

### Option 3: VS Code Live Server
Right-click `index.html` and select **"Open with Live Server"**.

---

## 🚀 GitHub Pages Deployment Instructions

This repository includes an automated GitHub Actions deployment workflow (`.github/workflows/deploy.yml`).

### Step-by-Step Setup:
1. Push this project to your repository: `https://github.com/yogesh660/featured-games.git`.
2. On GitHub, navigate to **Settings** → **Pages**.
3. Under **Build and deployment**:
   * **Source**: Select **GitHub Actions** (not "Deploy from a branch").
4. Under **Actions** tab in GitHub, the `Deploy Featured Games to GitHub Pages` workflow will run automatically on push.
5. Once completed, your games hub will be live at:
   `https://yogesh660.github.io/featured-games/`

---

## ⚡ Daily Development Automation Engine

A structured automation script (`scripts/daily_game_dev.py`) is included to advance the roadmap in verified daily steps:

```bash
# Check current roadmap progress:
python scripts/daily_game_dev.py --status

# Run the next scheduled milestone step (checks 24h cadence):
python scripts/daily_game_dev.py

# Force execution of the next step immediately:
python scripts/daily_game_dev.py --force

# Adjust development cadence (e.g., run every 12 hours instead of 24):
python scripts/daily_game_dev.py --set-cadence 12
```

### Automated GitHub Actions Schedule
The workflow `.github/workflows/daily-game-dev.yml` runs every midnight UTC (`0 0 * * *`) via GitHub Actions, executing the next roadmap milestone automatically without requiring your computer to stay on.

---

## 📦 How to Upload Without Overwriting Unrelated Files

If updating an existing repository:
1. Download the pre-packaged `featured-games.zip` archive.
2. Extract the files into your local clone of `yogesh660/featured-games`.
3. Use Git staging to inspect changes before committing:
   ```bash
   git status
   git diff
   git add index.html site.css games/ docs/ scripts/ .github/
   git commit -m "feat: launch Open Road Racer and daily dev automation"
   git push origin main
   ```
4. This ensures that any personal files, licenses, or existing repository settings are safely preserved.

---

## 🔍 QA & Testing Transparency

* **Tested & Verified:**
  * Procedural road geometry, normal vectors, and Catmull-Rom spline continuity verified.
  * Web Audio API synthesizer node graph (dual oscillators, biquad lowpass/bandpass filters, master gain).
  * Responsive layout and CSS tokens matched against `yogesh660.github.io` (`DM Mono`, `Manrope`, glassmorphic HUD).
  * State management and cadence enforcement in `scripts/daily_game_dev.py`.
  * Standalone execution verified with zero npm dependencies.
* **Browser Compatibility:**
  * Chrome / Edge 90+ (Full WebGL 2.0 & Web Audio support).
  * Safari / iOS 15+ (Touch controls & WebGL).
  * Firefox 88+ (Hardware-accelerated canvas).
