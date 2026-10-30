# Featured Games — Browser Gaming Collection

A collection of polished, responsive browser games hosted for free on GitHub Pages, designed to match the visual identity, tokens, and sleek dark aesthetic of [yogesh660.github.io](https://yogesh660.github.io).

---

## 🎮 Games Overview

| Title | Genre | Tech | Status | Path |
|---|---|---|---|---|
| **Open Road Racer** | 3D Scenic Mountain Driving & Time Trial | Three.js (r128), Web Audio API | **Playable Now** | [`games/open-road-racer/`](games/open-road-racer/index.html) |
| **Space Defender** | 3D Arcade Wave Shooter | Three.js, Web Audio | *Scheduled (Step 4–6)* | [`games/space-defender/`](games/space-defender/index.html) |
| **Neural Puzzle** | Logic & Pattern Circuit Routing | CSS Grid, Graph Traversal | *Scheduled (Step 7–9)* | [`games/neural-puzzle/`](games/neural-puzzle/index.html) |
| **FPV Time Trial** | Acrobatic Drone Racing Obstacle Course | Three.js 3D, Flight Physics | *Scheduled (Step 10–12)* | [`games/fpv-time-trial/`](games/fpv-time-trial/index.html) |

---

## 🧭 Part of the portfolio site

This hub is the **Play** section of the portfolio (nav: Work · Learn · Play · About · Contact).
`assets/site.css` and `assets/site.js` are verbatim copies of the portfolio's `src/site.css` and `src/site.js`;
do not edit them here, copy them over from yogesh660.github.io. Hub-only styles and the animated game art
live in `assets/games.css`. Links to the other sections are root-relative (`/work/`, `/ml-model-zoo/`).

---

## 🚀 Space Defender (3D)

Hold the line above a neon grid while waves come out of deep space. Built from scratch with Three.js; sound and music are synthesised with Web Audio.

* **Physics:** the ship has mass (thrust, drag, banking, a dash impulse); hits knock enemies back by their mass; asteroids tumble, collide with each other and split, carrying their momentum on; wrecks throw debris.
* **Enemies:** weaving drones that aim ahead of you, kamikazes that steer at you, cruisers that fire in fans, asteroids, and a dreadnought every fifth wave (shoot its four pods to open the core).
* **Scoring:** kills inside two seconds of each other raise a multiplier up to ×10; getting hit halves it. Best score is saved in the browser.
* **Power-ups:** spread shot, rapid fire, shield, hull repair, extra bomb; they drift to you when close.
* **Controls:** `WASD` or the mouse to fly, fire is automatic (`F` to switch to holding `Space`), `Shift` dash, `B` bomb, `Esc` pause, `M` mute. Touch: drag to fly, double-tap to bomb.

## 🏎️ Game 01: Open Road (Playable Now)

An endless, relaxed drive up the Sahyadri (Western Ghats), in the spirit of *slow roads* but built from scratch with our own look.
Every asset is made in code: there are no model, texture or audio files.

* **Endless road:** heading and height are sums of slow sine waves of the distance travelled, so the road is smooth and never repeats.
* **Ghat terrain:** a ribbon of ground either side of the road; one side climbs into a basalt cliff, the other drops to the valley behind a painted parapet. Laterite shoulders, rain trees, rocks, verge posts and kilometre stones counting down to hill stations.
* **Light and weather:** dawn, day, golden hour, night (headlights) or a slow day cycle; a monsoon mode with rain, haze and wet roads.
* **Driving:** arcade bicycle-model physics with a five-speed box, gravity on slopes, handbrake slides and three grip levels; autodrive keeps the left lane and slows for bends.
* **Sound:** engine, wind, road, tyre and rain noise synthesised live with the Web Audio API.
* **Controls:** `W/↑` throttle, `S/↓` brake and reverse, `A/D` steer, `Space` handbrake, `F` autodrive, `C` camera, `R` back on the road, `M` mute, `Esc` settings. Touch buttons on phones.
* **Code:** `games/open-road-racer/js/` holds `world.js` (road, terrain, scenery, sky, rain), `car.js` (model and physics), `audio.js` and `main.js` (loop, camera, light, UI).

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
