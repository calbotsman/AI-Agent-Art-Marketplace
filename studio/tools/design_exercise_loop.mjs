#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
const DEFAULT_ROOT = path.join(WORKSPACE_ROOT, 'projects', 'design-exercises');

function usage() {
  console.log(`Design Exercise Loop

Usage:
  node studio/tools/design_exercise_loop.mjs <command> [flags]

Commands:
  init --brand <name> --exercise <name> [--objective <text>] [--root <dir>]
  attach-output --exercise-dir <dir> --round <n> --manifest <path> [--notes <text>]
  feedback --exercise-dir <dir> --round <n> --decision REVISE|SHIP --summary <text> [--focus <text>] [--by <name>]
  status --exercise-dir <dir>

Examples:
  node studio/tools/design_exercise_loop.mjs init --brand "Sun Daughter" --exercise "Nocturne Label v1"
  node studio/tools/design_exercise_loop.mjs attach-output --exercise-dir /Users/calbotsman/clawd/projects/design-exercises/sun-daughter/nocturne-label-v1 --round 1 --manifest /Users/calbotsman/clawd/output/supplement-design/sun-daughter-nocturne-01/20260220-163219/manifest.json
  node studio/tools/design_exercise_loop.mjs feedback --exercise-dir /Users/calbotsman/clawd/projects/design-exercises/sun-daughter/nocturne-label-v1 --round 1 --decision REVISE --summary "Typography is still too quiet" --focus "Increase brand weight, simplify board copy"
`);
}

function parseFlags(args) {
  const parsed = { _: [] };

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (!token.startsWith('--')) {
      parsed._.push(token);
      continue;
    }

    const key = token.slice(2);
    const next = args[i + 1];

    if (!next || next.startsWith('--')) {
      parsed[key] = true;
      continue;
    }

    parsed[key] = next;
    i += 1;
  }

  return parsed;
}

function requireFlag(flags, key) {
  const value = flags[key];
  if (value === undefined || value === true || value === '') {
    throw new Error(`Missing required --${key}`);
  }
  return String(value);
}

function maybeFlag(flags, key, fallback = '') {
  const value = flags[key];
  if (value === undefined || value === true) {
    return fallback;
  }
  return String(value);
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function nowIso() {
  return new Date().toISOString();
}

function nowLocal() {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function roundId(roundNumber) {
  return String(roundNumber).padStart(2, '0');
}

function resolvePath(input) {
  if (!input) {
    return input;
  }
  if (path.isAbsolute(input)) {
    return input;
  }
  return path.resolve(process.cwd(), input);
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function createRoundSkeleton(exerciseDir, roundNumber, handoffText = '') {
  const rid = roundId(roundNumber);
  const roundDir = path.join(exerciseDir, 'iterations', rid);
  await fs.mkdir(roundDir, { recursive: true });

  const iterationFile = path.join(roundDir, 'iteration.md');
  const feedbackFile = path.join(roundDir, 'feedback.md');
  const assetsFile = path.join(roundDir, 'assets.md');
  const actionsFile = path.join(roundDir, 'next-actions.md');

  if (!(await fileExists(iterationFile))) {
    const iterationBody = `# Iteration ${rid}\n\n## Goal\n- \n\n## Direction\n- \n\n## Constraints\n- Keep Cyborg rails locked (1650x600, 1fr 300px 1fr, <=8 ingredients).\n\n## Handoff\n- ${handoffText || 'Initial direction setup.'}\n`;
    await fs.writeFile(iterationFile, iterationBody, 'utf8');
  }

  if (!(await fileExists(feedbackFile))) {
    const feedbackBody = `# Feedback - Iteration ${rid}\n\n## Summary\n- Pending feedback\n\n## Decision\n- REVISE | SHIP\n\n## Focus for Next Round\n- \n`;
    await fs.writeFile(feedbackFile, feedbackBody, 'utf8');
  }

  if (!(await fileExists(assetsFile))) {
    const assetsBody = `# Assets - Iteration ${rid}\n\n- manifest: \n- label: \n- mock: \n- board: \n- recraft scene: \n- recraft mood: \n`;
    await fs.writeFile(assetsFile, assetsBody, 'utf8');
  }

  if (!(await fileExists(actionsFile))) {
    const actionsBody = `# Next Actions - Iteration ${rid}\n\n- [ ] Run render\n- [ ] Review output\n- [ ] Capture feedback\n`;
    await fs.writeFile(actionsFile, actionsBody, 'utf8');
  }
}

async function initExercise(flags) {
  const brand = requireFlag(flags, 'brand');
  const exercise = requireFlag(flags, 'exercise');
  const objective = maybeFlag(flags, 'objective', 'Run iterative design exploration with structured feedback loops.');
  const root = resolvePath(maybeFlag(flags, 'root', DEFAULT_ROOT));

  const brandSlug = slugify(brand);
  const exerciseSlug = slugify(exercise);

  if (!brandSlug || !exerciseSlug) {
    throw new Error('brand/exercise slugs are empty after normalization');
  }

  const exerciseDir = path.join(root, brandSlug, exerciseSlug);
  if (await fileExists(exerciseDir)) {
    throw new Error(`Exercise already exists: ${exerciseDir}`);
  }

  await fs.mkdir(path.join(exerciseDir, 'iterations'), { recursive: true });

  const state = {
    brand,
    exercise,
    objective,
    status: 'ACTIVE',
    currentRound: 1,
    latestDecision: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  await writeJson(path.join(exerciseDir, 'state.json'), state);

  const readme = `# ${brand} - ${exercise}\n\n## Objective\n${objective}\n\n## Workflow\n1. Run an iteration render.\n2. Attach output manifest to the round.\n3. Capture human feedback with decision (REVISE or SHIP).\n4. If REVISE, next round is auto-created.\n\n## Commands\n\`\`\`bash\n# attach generated outputs to round 1\nnode /Users/calbotsman/clawd/studio/tools/design_exercise_loop.mjs attach-output \\\n  --exercise-dir ${exerciseDir} \\\n  --round 1 \\\n  --manifest /absolute/path/to/manifest.json\n\n# capture feedback and auto-open next round if needed\nnode /Users/calbotsman/clawd/studio/tools/design_exercise_loop.mjs feedback \\\n  --exercise-dir ${exerciseDir} \\\n  --round 1 \\\n  --decision REVISE \\\n  --summary "Your concise critique" \\\n  --focus "What to change next"\n\`\`\`\n\n## Structure\n- \`brief.md\`\n- \`feedback-log.md\`\n- \`state.json\`\n- \`iterations/01..NN/\`\n`;
  await fs.writeFile(path.join(exerciseDir, 'README.md'), readme, 'utf8');

  const brief = `# Brief\n\n## Brand\n${brand}\n\n## Exercise\n${exercise}\n\n## Objective\n${objective}\n\n## Non-Negotiables\n- Keep supplement label constraints locked.\n- Avoid generic style drift.\n- Keep typography and spacing intentional.\n\n## Success Criteria\n- Clear hierarchy and production readability.\n- Feedback on each round is concretely addressed in the next round.\n- Round reaches SHIP decision.\n`;
  await fs.writeFile(path.join(exerciseDir, 'brief.md'), brief, 'utf8');

  const feedbackLog = `# Feedback Log\n\n`; 
  await fs.writeFile(path.join(exerciseDir, 'feedback-log.md'), feedbackLog, 'utf8');

  await createRoundSkeleton(exerciseDir, 1, 'Initial exploration.');

  console.log('Design exercise initialized:');
  console.log(`- exercise dir: ${exerciseDir}`);
  console.log(`- round: ${roundId(1)}`);
}

async function attachOutput(flags) {
  const exerciseDir = resolvePath(requireFlag(flags, 'exercise-dir'));
  const round = Number.parseInt(requireFlag(flags, 'round'), 10);
  const manifestPath = resolvePath(requireFlag(flags, 'manifest'));
  const notes = maybeFlag(flags, 'notes', '');

  if (!Number.isInteger(round) || round < 1) {
    throw new Error('round must be a positive integer');
  }

  const statePath = path.join(exerciseDir, 'state.json');
  if (!(await fileExists(statePath))) {
    throw new Error(`Missing state.json at ${statePath}`);
  }
  if (!(await fileExists(manifestPath))) {
    throw new Error(`Manifest does not exist: ${manifestPath}`);
  }

  const manifest = await readJson(manifestPath);
  await createRoundSkeleton(exerciseDir, round, 'Round skeleton created during output attach.');

  const rid = roundId(round);
  const assetsPath = path.join(exerciseDir, 'iterations', rid, 'assets.md');

  const lines = [
    `# Assets - Iteration ${rid}`,
    '',
    `- attached at: ${nowLocal()}`,
    `- manifest: ${manifestPath}`,
    `- label png: ${manifest?.outputs?.label?.png || ''}`,
    `- label pdf: ${manifest?.outputs?.label?.pdf || ''}`,
    `- mock png: ${manifest?.outputs?.productMock?.png || ''}`,
    `- board png: ${manifest?.outputs?.brandBoard?.png || ''}`,
    `- recraft scene: ${manifest?.pipeline?.recraft?.scenePng || ''}`,
    `- recraft mood: ${manifest?.pipeline?.recraft?.moodPng || ''}`,
    `- recraft used: ${manifest?.checks?.recraftV4Used === true ? 'true' : 'false'}`,
  ];

  if (notes) {
    lines.push(`- notes: ${notes}`);
  }

  await fs.writeFile(assetsPath, `${lines.join('\n')}\n`, 'utf8');

  const state = await readJson(statePath);
  state.updatedAt = nowIso();
  await writeJson(statePath, state);

  console.log('Output attached to round:');
  console.log(`- exercise dir: ${exerciseDir}`);
  console.log(`- round: ${rid}`);
  console.log(`- assets file: ${assetsPath}`);
}

async function feedback(flags) {
  const exerciseDir = resolvePath(requireFlag(flags, 'exercise-dir'));
  const round = Number.parseInt(requireFlag(flags, 'round'), 10);
  const decisionRaw = requireFlag(flags, 'decision').toUpperCase();
  const summary = requireFlag(flags, 'summary');
  const focus = maybeFlag(flags, 'focus', '');
  const by = maybeFlag(flags, 'by', 'human');

  if (!Number.isInteger(round) || round < 1) {
    throw new Error('round must be a positive integer');
  }

  if (!['REVISE', 'SHIP'].includes(decisionRaw)) {
    throw new Error('decision must be REVISE or SHIP');
  }

  const statePath = path.join(exerciseDir, 'state.json');
  const feedbackLogPath = path.join(exerciseDir, 'feedback-log.md');
  if (!(await fileExists(statePath))) {
    throw new Error(`Missing state.json at ${statePath}`);
  }

  await createRoundSkeleton(exerciseDir, round, 'Round skeleton created during feedback capture.');
  const rid = roundId(round);

  const entry = [
    `## ${nowLocal()} - Round ${rid} - ${decisionRaw}`,
    `- by: ${by}`,
    `- summary: ${summary}`,
    `- focus next: ${focus || '(none)'}`,
    '',
  ].join('\n');

  let feedbackLog = '';
  if (await fileExists(feedbackLogPath)) {
    feedbackLog = await fs.readFile(feedbackLogPath, 'utf8');
  } else {
    feedbackLog = '# Feedback Log\n\n';
  }
  feedbackLog += entry;
  await fs.writeFile(feedbackLogPath, feedbackLog, 'utf8');

  const roundFeedbackPath = path.join(exerciseDir, 'iterations', rid, 'feedback.md');
  const roundFeedback = [
    `# Feedback - Iteration ${rid}`,
    '',
    `## Decision`,
    `- ${decisionRaw}`,
    '',
    `## Summary`,
    `- ${summary}`,
    '',
    `## Focus for Next Round`,
    `- ${focus || '(none)'}`,
    '',
    `## Captured`,
    `- at: ${nowLocal()}`,
    `- by: ${by}`,
    '',
  ].join('\n');
  await fs.writeFile(roundFeedbackPath, roundFeedback, 'utf8');

  const state = await readJson(statePath);
  state.latestDecision = decisionRaw;
  state.updatedAt = nowIso();

  if (decisionRaw === 'SHIP') {
    state.status = 'SHIPPED';
    state.currentRound = round;
    await writeJson(statePath, state);

    console.log('Feedback captured: SHIP');
    console.log(`- exercise dir: ${exerciseDir}`);
    console.log(`- final round: ${rid}`);
    return;
  }

  state.status = 'ACTIVE';
  const nextRound = round + 1;
  state.currentRound = Math.max(nextRound, Number(state.currentRound) || 1);
  await writeJson(statePath, state);

  await createRoundSkeleton(
    exerciseDir,
    nextRound,
    `Carry forward from round ${rid}: ${summary}${focus ? ` | focus: ${focus}` : ''}`
  );

  console.log('Feedback captured: REVISE');
  console.log(`- exercise dir: ${exerciseDir}`);
  console.log(`- next round opened: ${roundId(nextRound)}`);
}

async function status(flags) {
  const exerciseDir = resolvePath(requireFlag(flags, 'exercise-dir'));
  const statePath = path.join(exerciseDir, 'state.json');
  if (!(await fileExists(statePath))) {
    throw new Error(`Missing state.json at ${statePath}`);
  }

  const state = await readJson(statePath);
  const currentRoundPath = path.join(exerciseDir, 'iterations', roundId(state.currentRound), 'iteration.md');

  console.log('Design exercise status:');
  console.log(`- brand: ${state.brand}`);
  console.log(`- exercise: ${state.exercise}`);
  console.log(`- status: ${state.status}`);
  console.log(`- current round: ${roundId(state.currentRound)}`);
  console.log(`- latest decision: ${state.latestDecision || '(none)'}`);
  console.log(`- objective: ${state.objective}`);
  console.log(`- updated at: ${state.updatedAt}`);
  console.log(`- current iteration file: ${currentRoundPath}`);
}

async function main() {
  const command = process.argv[2];
  const flags = parseFlags(process.argv.slice(3));

  if (!command || command === '--help' || command === '-h') {
    usage();
    return;
  }

  if (command === 'init') {
    await initExercise(flags);
    return;
  }

  if (command === 'attach-output') {
    await attachOutput(flags);
    return;
  }

  if (command === 'feedback') {
    await feedback(flags);
    return;
  }

  if (command === 'status') {
    await status(flags);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(`Failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
