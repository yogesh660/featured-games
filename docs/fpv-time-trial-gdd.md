# FPV Time Trial — Game Design Document
**Version:** 1.0 · **Genre:** FPV drone racing / skill course · **Platform:** Browser · **Target:** Free GitHub Pages

## 1. High concept
A compact first-person drone course where players fly through gates, hit checkpoints and improve their best time. The game is an arcade introduction to FPV timing and spatial control, not a substitute for a real flight simulator or safety training.

## 2. Design pillars
- Clear course lines and readable gates.
- A satisfying sense of momentum with forgiving early handling.
- Fast retries and transparent timing.
- Optional assist settings for newcomers, with more demanding manual control as a challenge.

## 3. Core loop
Choose a course and handling preset → launch → fly through gates in order → finish → see time, penalties and personal best → retry for a cleaner line.

## 4. Flight and course
- First-person camera with slight, configurable banking.
- Throttle, pitch, roll and yaw map to an arcade flight model.
- Courses include wide beginner gates, slalom sections and elevated checkpoints.
- Missing a gate should trigger a clear checkpoint warning and require returning through it, or apply a consistent penalty. Avoid silent timing exploits.
- Crash/reset returns the drone to the last checkpoint or start, with an explicit time penalty.
- Ghost replay is a stretch goal.

## 5. Controls
Keyboard defaults: W/S throttle or pitch depending on selected preset; A/D roll; Q/E yaw; arrow keys pitch/roll; Space brake/hover assist; R reset; Esc pause. Because keyboard mapping can be awkward for four-axis flight, provide an on-screen control diagram and a simpler “Arcade” preset. Gamepad support is a stretch goal. Mobile touch controls should be offered only if they can remain precise enough for gate navigation.

## 6. Camera and HUD
HUD: timer, checkpoint count, speed estimate, lap status and reset prompt. Use a stable horizon, adjustable field of view and camera shake. Add a motion-reduction option. Use a brief ghost/arrow cue for the next gate without obscuring the flight path.

## 7. Visual direction
Original stylized courses: training warehouse, forest clearing and rocky ridge. Gates should contrast with background; avoid visually noisy foliage. Use simple drone geometry, clear gate materials, soft shadows and distance fog. Do not use manufacturer logos or copy a commercial simulator's proprietary tracks.

## 8. Technical architecture
Three.js is suitable for a 3D first-person course. Separate flight model, input mapping, course/checkpoint validation, camera, HUD and timing. Use raycasts or simple trigger volumes for gate detection. Clamp delta time, pool repeated geometry and offer low/medium/high quality. LocalStorage stores best times per course and settings.

## 9. Launch scope
One course, one drone, first-person camera, arcade and assisted handling presets, ordered checkpoints, timer, penalties, reset, local best time and keyboard controls. Additional tracks, ghost racing, gamepad and online leaderboards are stretch goals.

## 10. Safety and messaging
Clearly label the experience as a game, not real-world flight instruction. Avoid implying that in-game performance certifies real drone skill. If real drone references are used, keep branding and product compatibility claims out of scope.

## 11. Milestones
1. First-person camera and basic movement.
2. Flight tuning and input diagram.
3. Gate trigger volumes and checkpoint order.
4. Timer, penalties and reset.
5. Course art, sound and HUD.
6. Accessibility, mobile assessment and performance QA.
7. README and GitHub Pages deployment.

## 12. Deployment
Static GitHub Pages is enough for gameplay and local best times. Use a GitHub Actions workflow, keep assets in the repository and pin external library versions. Online rankings would require a backend and are not part of the free static launch.
