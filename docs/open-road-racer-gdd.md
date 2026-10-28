# Open Road Racer — Game Design Document
**Version:** 1.0 · **Genre:** 3D scenic driving / arcade time trial · **Platform:** Desktop and mobile web · **Target:** Free GitHub Pages hosting

## 1. High concept
A relaxing, replayable 3D driving experience on winding roads through India's Sahyadri / Western Ghats. Players cruise for the scenery or chase personal bests on time-trial routes. The mood is expansive and atmospheric rather than a licensed motorsport simulation.

**Design pillars**
- The road is the experience: curves, elevation, viewpoints, tunnels and changing scenery.
- Easy to start: no account, install, backend or paid assets required.
- Responsive driving: speed, grip and road position should feel readable and rewarding.
- Respect the setting: use original, stylized interpretations of basalt cliffs, monsoon greenery, plateaus and ghats.

## 2. Target audience and session
Casual driving fans, browser-game players, and people who enjoy scenic exploration. Free Drive sessions can last 2–15 minutes; Time Trial runs should be short enough to retry immediately.

## 3. Core loop
Choose a mode and camera → drive the road → discover scenery or improve a time → receive a result / personal-best update → retry or continue cruising.

## 4. Modes
- **Free Drive:** no finish pressure; enjoy the route. Optional reset and camera switching.
- **Time Trial:** start gate, timer, checkpoints and finish line. Missing a checkpoint should invalidate the run or add a clear penalty—choose one behavior and communicate it.
- **Future:** ghost replay, route variants, weather presets and daily challenge seed. These are stretch goals, not launch blockers.

## 5. Controls
| Action | Keyboard | Touch |
|---|---|---|
| Accelerate | W / ↑ | Hold accelerator |
| Brake / reverse | S / ↓ | Hold brake |
| Steer | A / D or ← / → | Left/right steering buttons or virtual steering |
| Handbrake | Space | Handbrake button |
| Camera | C | Camera button |
| Reset vehicle | R | Reset button |
| Pause / menu | Esc | Pause button |

Controls must be remappable only if scope permits; keyboard and touch parity are launch requirements. Gamepad support is a stretch goal.

## 6. Driving model
Use an approachable arcade model: acceleration curve, capped top speed, steering sensitivity that decreases at high speed, mild yaw/roll feedback, braking, drag and off-road slowdown. Keep the car aligned with the road tangent while allowing controlled lateral movement. Avoid pretending this is a physically accurate simulator.

## 7. World and art direction
- **Environment:** layered Western Ghats ridgelines, basalt escarpments, roadside grass, trees, boulders, guardrails, signposts, viewpoints and occasional small structures.
- **Road:** two-lane asphalt with edge lines, dashed centre line, shoulders and readable curvature.
- **Palette:** monsoon greens, laterite/basalt charcoal, warm earth, misty blue-grey distance and a bright but restrained sky.
- **Style:** low-poly / stylized realism, coherent lighting, fog and depth rather than high-detail assets.
- **Cultural specificity:** original fictional routes inspired by the region; do not imply exact real-world road safety or mapping.

## 8. Camera, audio and UI
- Chase camera: default, smooth follow with look-ahead.
- Cockpit camera: low interior viewpoint; steering wheel / dashboard can be simplified.
- Optional hood camera later.
- HUD: speed (km/h), mode, elapsed time, checkpoint state and personal best. Keep controls unobtrusive.
- Audio: original or properly licensed engine loop, tyre/road ambience, wind and UI feedback. Include mute/volume controls.

## 9. Accessibility and usability
Readable high-contrast HUD, scalable UI, pause at any time, no flashing effects, touch targets suitable for phones, and reduced-motion option for camera smoothing. Avoid relying on colour alone for checkpoints.

## 10. Technical architecture
- Static HTML/CSS/JavaScript app with Three.js ES module imported from a pinned CDN version.
- Procedural road mesh and roadside placement seeded by route parameters.
- Separate modules/functions for input, vehicle, road/world generation, camera, HUD and game state.
- `requestAnimationFrame` render loop; delta time clamped after tab suspension.
- LocalStorage for preferences and best times; no account or server.
- Performance: device pixel ratio cap, instancing or merged geometry for repeated trees/rocks, pooled roadside objects, conservative shadow settings and a quality toggle.
- Graceful error panel if WebGL or CDN access fails.

## 11. Scope
**Launch:** one polished car, one looping mountain route, two cameras, Free Drive, Time Trial, keyboard/touch controls, speedometer, timer, reset, local best time, pause and responsive layout.

**Stretch:** multiple cars, ghost replay, weather/time-of-day, route selector, gamepad, photo mode, online leaderboards (requires backend; not in free static scope).

## 12. Success criteria
- Loads without build tools on a modern desktop browser and a modern mobile browser with WebGL.
- Core driving works at a stable playable frame rate on mid-range devices.
- Every control is discoverable and functional.
- Time Trial starts, checkpoints and finishes reliably.
- Best time persists locally and does not claim to be a global leaderboard.
- No copyrighted music, logos, vehicle designs or unlicensed assets.

## 13. Milestones
1. **Playable prototype:** road, car, steering, acceleration, chase camera.
2. **Driving pass:** braking, off-road response, reset and stable collision/road bounds.
3. **World pass:** Sahyadri scenery, road markings, fog, props and horizon.
4. **Modes/UI:** Free Drive, Time Trial, HUD, checkpoints and local best.
5. **Mobile/accessibility:** touch controls, responsive HUD, pause and quality settings.
6. **QA and optimization:** test multiple browsers, small screens, slow devices and tab resume.
7. **Release:** README, license/asset attributions, GitHub Pages workflow and live URL verification.

## 14. Free deployment
Host static files on GitHub Pages using GitHub Actions. Keep game assets in the repository, pin the Three.js CDN version, and use relative asset paths. Configure repository **Settings → Pages → Build and deployment → Source: GitHub Actions**. A workflow should deploy the feature branch for preview first; after merge, deployment from `main` can replace the same Pages URL. GitHub Pages is static hosting and does not provide a backend.
