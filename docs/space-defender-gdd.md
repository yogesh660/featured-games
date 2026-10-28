# Space Defender — Game Design Document
**Version:** 1.0 · **Genre:** Arcade wave shooter · **Platform:** Browser · **Target:** Free GitHub Pages

## 1. High concept
A fast, readable arcade game where the player pilots a small spacecraft, dodges enemy fire and protects a space outpost through escalating waves. The focus is satisfying movement, clear patterns and short repeatable runs.

## 2. Design pillars
- Immediate action with one-button start and quick restart.
- Enemy patterns that are learnable, not random noise.
- Strong feedback: impacts, screen shake used sparingly, particles and score callouts.
- Short runs with a meaningful high-score chase.

## 3. Core loop
Move and fire → defeat enemy formations → collect occasional power-ups → survive the wave → face a tougher pattern → lose or win → review score and replay.

## 4. Gameplay
- Player has lateral movement and a primary weapon.
- Enemies enter in formations and use distinct movement / attack patterns.
- Obstacles and projectiles are clearly differentiated from collectibles.
- Power-ups may include rapid fire, spread shot and a temporary shield.
- Lives or shield meter make failure legible. Difficulty ramps by wave, not by unfair surprise.
- Boss encounters are optional after the core loop is stable.

## 5. Controls
| Action | Keyboard | Touch |
|---|---|---|
| Move | A/D or ←/→; optional W/S | Drag ship or on-screen left/right |
| Fire | Space / hold mouse | Fire button or auto-fire toggle |
| Pause | Esc / P | Pause button |
| Restart | R after game over | Restart button |

## 6. Visual direction
Original stylized sci-fi: deep navy space, layered stars, planet silhouettes, bright projectile colors, high-contrast enemies and restrained glow. Use procedural shapes or original assets; avoid recognizable franchise ships and logos. Provide reduced-flash settings.

## 7. Audio and UI
HUD includes score, wave, lives/shield and pause. Sound design includes laser, hit, explosion, power-up and wave-clear cues. All audio must be original or licensed, with mute and volume controls.

## 8. Technical design
Canvas 2D is recommended for a lightweight first version; Three.js is unnecessary unless 3D is a defining requirement. Use a fixed-step update loop with delta clamping, object pools for bullets/particles, seeded wave patterns and collision checks between simple shapes. Store best score and settings in LocalStorage.

## 9. Launch scope
One arena, one ship, three enemy types, three power-ups, escalating waves, score/high score, pause, restart, keyboard and touch controls. Bosses, campaign, upgrades and unlock trees are stretch goals.

## 10. Success criteria
A new player understands movement and firing within seconds; projectiles remain readable on small screens; difficulty ramps consistently; pause/restart work at all times; no network service is needed after the static files load.

## 11. Milestones
1. Ship movement and shooting.
2. Enemy waves and collision / damage.
3. Scoring, lives and game-over loop.
4. Power-ups, particles and audio.
5. Touch support, responsive UI and accessibility.
6. Performance and browser QA.
7. README, attribution and GitHub Pages deployment.

## 12. Deployment
Use static GitHub Pages with a GitHub Actions workflow. No backend is required for local high scores. Online scoreboards and accounts are explicitly out of scope unless a separate service is added.
