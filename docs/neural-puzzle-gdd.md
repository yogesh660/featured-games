# Neural Puzzle — Game Design Document
**Version:** 1.0 · **Genre:** Logic / pattern puzzle · **Platform:** Browser · **Target:** Free GitHub Pages

## 1. High concept
A clean, approachable logic game about routing signals through a grid of nodes. Players rotate or swap tiles to connect a source to a target while respecting energy, direction or move constraints. “Neural” is a fictional visual theme, not a claim to model real brains or AI.

## 2. Design pillars
- Puzzles are understandable at a glance.
- Difficulty comes from planning, not hidden rules.
- Every action gives immediate visual feedback.
- A hint system teaches the rule without solving everything automatically.

## 3. Core loop
Select a puzzle → inspect source, target and tiles → rotate/swap tiles → test the signal path → solve within constraints → earn stars or a score → unlock the next challenge.

## 4. Puzzle mechanics
- Grid contains straight, corner, splitter and blocked tiles.
- Rotate tiles to create a continuous route from source to target.
- Optional advanced rules: limited moves, energy budget, multiple targets and one-way tiles.
- Tutorial introduces one rule at a time.
- Hints can highlight the next useful tile; avoid penalizing players for using accessibility features.
- Include a reset button and clear success state.

## 5. Controls and accessibility
Mouse/touch tap rotates a tile; keyboard arrows or WASD may move selection, Enter/Space rotates, R resets, H requests a hint, Esc pauses. Ensure keyboard focus is visible, colour is not the only signal, tile icons have text/shape differences, and motion can be reduced.

## 6. Progression
- Tutorial: 5 small puzzles.
- Core pack: 20 curated puzzles across easy, medium and hard.
- Daily puzzle can be generated deterministically from a date seed, but should remain optional.
- Stars based on moves/time are a bonus, not a barrier to progression.
- A level editor is a stretch goal.

## 7. Visual/audio direction
Dark slate or light neutral board options, luminous signal paths, geometric tile glyphs, restrained gradients and subtle completion animation. Use sound sparingly for rotate, invalid path, hint and solve. Include mute and reduced-motion settings.

## 8. Technical architecture
Use semantic HTML for menus and controls, CSS Grid for the board, and plain JavaScript for puzzle state and validation. Represent each tile as a type plus rotation; represent connector directions as bitmasks or direction sets. A path traversal validates whether the target is reachable and detects loops. Keep level definitions as JSON data. Store progress and settings in LocalStorage.

## 9. Launch scope
Tutorial, 20 authored levels, tile rotation, validation, reset, hints, completion state, keyboard/touch support, progress saving and responsive layout. Procedural puzzle generation and user-created levels are stretch goals; authored levels should be validated before release.

## 10. Success criteria
Rules can be learned without external instructions; all levels are solvable; path validation handles loops and boundaries; keyboard and touch are equally usable; progress survives refresh on the same browser.

## 11. Milestones
1. Board and tile rotation.
2. Signal traversal and win validation.
3. Tutorial and level data.
4. Hints, reset and progression.
5. Accessibility and responsive design.
6. Level solvability QA and polish.
7. README and GitHub Pages deployment.

## 12. Deployment
Static GitHub Pages is sufficient. Use local storage for progress; no account or server is required. A daily puzzle may be generated locally from a date seed without sending player data anywhere.
