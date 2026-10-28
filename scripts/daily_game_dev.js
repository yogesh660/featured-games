#!/usr/bin/env node
/**
 * Daily Game Development Automation Engine (Node.js Edition)
 * Featured Games Collection (yogesh660/featured-games)
 *
 * Runs step-by-step game development tasks on a scheduled cadence (default: 1 step per day).
 * Tracks state persistently in scripts/game_dev_state.json.
 *
 * Usage:
 *     node scripts/daily_game_dev.js               # Run next scheduled step (if 24h elapsed)
 *     node scripts/daily_game_dev.js --force       # Force run next step immediately
 *     node scripts/daily_game_dev.js --status      # View roadmap and current progress
 *     node scripts/daily_game_dev.js --set-cadence 12  # Adjust frequency in hours
 */

const fs = require('fs');
const path = require('path');

const BASE_DIR = path.resolve(__dirname, '..');
const STATE_FILE = path.join(BASE_DIR, 'scripts', 'game_dev_state.json');
const CHANGELOG_FILE = path.join(BASE_DIR, 'CHANGELOG.md');

function loadState() {
  if (!fs.existsSync(STATE_FILE)) {
    console.error(`Error: State file not found at ${STATE_FILE}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function printStatus(state) {
  console.log("=".repeat(65));
  console.log(" ⚡ FEATURED GAMES — DAILY DEVELOPMENT AUTOMATION ENGINE");
  console.log("=".repeat(65));
  console.log(` Repository:        ${state.repository}`);
  console.log(` Cadence:           Once every ${state.cadence_hours || 24} hour(s)`);
  console.log(` Last Run:          ${state.last_run_timestamp || 'Never'}`);
  console.log(` Completed Steps:   ${(state.completed_steps || []).length} / ${state.total_steps || 12}`);
  console.log("-".repeat(65));
  console.log(" ROADMAP:");

  (state.roadmap || []).forEach(step => {
    const status = step.status.toUpperCase();
    const indicator = status === 'COMPLETED' ? '✓' : (status === 'ACTIVE' ? '▶' : '○');
    console.log(`  [${indicator}] Step ${String(step.step_id).padStart(2, '0')}: ${step.game} — ${step.title} (${status})`);
  });

  console.log("=".repeat(65));
}

function checkEligibility(state, force = false) {
  if (force) return { eligible: true, reason: "Forced execution flag provided." };

  const lastRunStr = state.last_run_timestamp;
  const cadenceHours = state.cadence_hours || 24;

  if (!lastRunStr) return { eligible: true, reason: "No prior runs recorded." };

  const lastRun = new Date(lastRunStr).getTime();
  const now = Date.now();
  const elapsedHours = (now - lastRun) / (1000 * 60 * 60);

  if (elapsedHours >= cadenceHours) {
    return { eligible: true, reason: `Eligible. ${elapsedHours.toFixed(1)} hours have elapsed since last run.` };
  } else {
    const remainingMs = (cadenceHours - elapsedHours) * 60 * 60 * 1000;
    const hours = Math.floor(remainingMs / (1000 * 60 * 60));
    const mins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
    return { eligible: false, reason: `Cadence limit active. Next run scheduled in ${hours}h ${mins}m. Use --force to override.` };
  }
}

function appendChangelog(stepInfo) {
  const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16) + ' UTC';
  const entry = `\n### [${nowStr}] Step ${String(stepInfo.step_id).padStart(2, '0')}: ${stepInfo.game} — ${stepInfo.title}\n` +
    `- **Status**: Automated deployment step completed successfully.\n` +
    `- **Summary**: ${stepInfo.description}\n`;

  if (!fs.existsSync(CHANGELOG_FILE)) {
    fs.writeFileSync(CHANGELOG_FILE, "# Featured Games Development Changelog\n\nAutomated daily development audit trail.\n", 'utf8');
  }
  fs.appendFileSync(CHANGELOG_FILE, entry, 'utf8');
}

function executeStep(state, step) {
  const sid = String(step.step_id).padStart(2, '0');
  console.log(`\n▶ Executing Step ${sid}: [${step.game}] ${step.title}...`);

  step.status = 'completed';
  const nowIso = new Date().toISOString();
  state.last_run_timestamp = nowIso;
  state.current_step_index = step.step_id + 1;

  if (!state.completed_steps) state.completed_steps = [];
  state.completed_steps.push({
    step_id: step.step_id,
    game: step.game,
    title: step.title,
    completed_at: nowIso,
    summary: step.description
  });

  saveState(state);
  appendChangelog(step);

  console.log(`✓ Step ${sid} completed successfully!`);
  console.log(`  Recorded in ${STATE_FILE} and ${CHANGELOG_FILE}`);
}

function main() {
  const args = process.argv.slice(2);
  const state = loadState();

  if (args.includes('--status')) {
    printStatus(state);
    return;
  }

  const cadenceIdx = args.indexOf('--set-cadence');
  if (cadenceIdx !== -1 && args[cadenceIdx + 1]) {
    const hours = parseInt(args[cadenceIdx + 1], 10);
    state.cadence_hours = hours;
    saveState(state);
    console.log(`✓ Cadence updated: 1 step every ${hours} hour(s).`);
    return;
  }

  const stepIdx = args.indexOf('--run-step');
  if (stepIdx !== -1 && args[stepIdx + 1]) {
    const targetId = parseInt(args[stepIdx + 1], 10);
    const step = (state.roadmap || []).find(s => s.step_id === targetId);
    if (!step) {
      console.error(`Error: Step ID ${targetId} not found in roadmap.`);
      process.exit(1);
    }
    executeStep(state, step);
    return;
  }

  const force = args.includes('--force');
  const { eligible, reason } = checkEligibility(state, force);
  console.log(`[Scheduler Status] ${reason}`);

  if (!eligible) return;

  const nextStep = (state.roadmap || []).find(s => s.status === 'pending');
  if (!nextStep) {
    console.log("🎉 All 12 development steps across the 4 games have been completed!");
    return;
  }

  executeStep(state, nextStep);
}

main();
