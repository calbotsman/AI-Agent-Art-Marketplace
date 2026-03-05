#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';

const now = new Date();
const reportDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  .toISOString()
  .slice(0, 10);
const outputRoot = process.env.GTM_REPORT_DIR || path.join(process.cwd(), 'reports', 'gtm');
const outputDir = path.join(outputRoot, reportDate);
const loopReportPath = path.join(outputDir, 'gtm-keep-going-log.json');
const runLogPath = path.join(process.cwd(), 'docs', 'gtm', 'GTM_RUN_LOG.md');

const loopIntervalMs = parseIntEnv('GTM_KEEP_GOING_INTERVAL_MS', 15 * 60_000, 60_000, 24 * 60 * 60_000);
const maxRuns = parseIntEnv('GTM_KEEP_GOING_MAX_RUNS', 0, 0, 100_000);
const socialExecute = process.env.GTM_KEEP_GOING_SOCIAL_EXECUTE !== 'false';
const runXTraction = process.env.GTM_KEEP_GOING_RUN_X_TRACTION !== 'false';
const runFirstSale = process.env.GTM_KEEP_GOING_RUN_FIRST_SALE !== 'false';
const runMonitor = process.env.GTM_KEEP_GOING_RUN_MONITOR !== 'false';
const continueOnFailure = process.env.GTM_KEEP_GOING_CONTINUE_ON_FAILURE !== 'false';

let cancelled = false;

process.on('SIGINT', () => {
  cancelled = true;
  console.log('\nReceived SIGINT. Finishing current run and exiting...');
});

process.on('SIGTERM', () => {
  cancelled = true;
  console.log('\nReceived SIGTERM. Finishing current run and exiting...');
});

function parseIntEnv(name, fallback, min, max) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runCommand(command, args, extraEnv = {}) {
  return new Promise((resolve) => {
    const startedAt = new Date();
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: false,
      env: {
        ...process.env,
        ...extraEnv,
      },
    });

    child.on('close', (code, signal) => {
      resolve({
        command: [command, ...args].join(' '),
        started_at: startedAt.toISOString(),
        finished_at: new Date().toISOString(),
        code: code ?? null,
        signal: signal ?? null,
        ok: code === 0,
      });
    });
  });
}

function toDurationSeconds(startIso, endIso) {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return Math.max(0, Math.round((end - start) / 1000));
}

async function appendRunLog(entry) {
  const lines = [];
  lines.push('');
  lines.push(`### ${entry.started_at}`);
  lines.push(`- Keep-going run: ${entry.run_index}`);
  lines.push(`- Result: ${entry.ok ? 'OK' : 'FAILED'}`);
  lines.push(`- Duration: ${entry.duration_seconds}s`);

  for (const step of entry.steps) {
    lines.push(`- Step: \`${step.command}\` -> ${step.ok ? 'OK' : `FAIL(code=${step.code ?? 'null'})`}`);
  }

  if (entry.failure_reasons.length > 0) {
    lines.push(`- Failures: ${entry.failure_reasons.join('; ')}`);
  }

  await fs.appendFile(runLogPath, `\n${lines.join('\n')}\n`, 'utf8');
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });

  const runs = [];
  let runIndex = 0;

  console.log('Starting GTM keep-going loop...');
  console.log(`interval_ms=${loopIntervalMs}`);
  console.log(`max_runs=${maxRuns === 0 ? 'unbounded' : maxRuns}`);
  console.log(`social_execute=${socialExecute}`);
  console.log(`run_x_traction=${runXTraction}`);
  console.log(`run_first_sale=${runFirstSale}`);
  console.log(`run_monitor=${runMonitor}`);

  while (!cancelled) {
    runIndex += 1;
    const runStart = new Date().toISOString();

    const steps = [];
    const gtm = await runCommand('npm', ['run', 'gtm:autonomous']);
    steps.push(gtm);

    const social = await runCommand('npm', ['run', 'social:autonomous'], {
      SOCIAL_AUTONOMOUS_EXECUTE: socialExecute ? 'true' : 'false',
    });
    steps.push(social);

    if (runXTraction) {
      const xTraction = await runCommand('npm', ['run', 'x:traction'], {
        X_TRACTION_EXECUTE: socialExecute ? 'true' : 'false',
      });
      steps.push(xTraction);
    }

    if (runFirstSale) {
      const firstSale = await runCommand('npm', ['run', 'first-sale:sprint'], {
        FIRST_SALE_EXECUTE: socialExecute ? 'true' : 'false',
      });
      steps.push(firstSale);
    }

    if (runMonitor) {
      const monitor = await runCommand('npm', ['run', 'monitor:prod']);
      steps.push(monitor);
    }

    const failureReasons = steps.filter((step) => !step.ok).map((step) => step.command);
    const runEnd = new Date().toISOString();
    const runRecord = {
      run_index: runIndex,
      started_at: runStart,
      finished_at: runEnd,
      duration_seconds: toDurationSeconds(runStart, runEnd),
      ok: failureReasons.length === 0,
      steps,
      failure_reasons: failureReasons,
    };

    runs.push(runRecord);

    await fs.writeFile(
      loopReportPath,
      JSON.stringify(
        {
          generated_at: new Date().toISOString(),
          report_date: reportDate,
          config: {
            interval_ms: loopIntervalMs,
            max_runs: maxRuns,
            social_execute: socialExecute,
            run_x_traction: runXTraction,
            run_first_sale: runFirstSale,
            run_monitor: runMonitor,
            continue_on_failure: continueOnFailure,
          },
          runs,
        },
        null,
        2,
      ),
      'utf8',
    );

    await appendRunLog(runRecord);

    if (!runRecord.ok && !continueOnFailure) {
      console.error('Stopping due to failure (continue_on_failure=false).');
      process.exit(1);
    }

    if (maxRuns > 0 && runIndex >= maxRuns) {
      console.log(`Reached max runs (${maxRuns}). Exiting.`);
      break;
    }

    if (cancelled) {
      break;
    }

    console.log(`Run ${runIndex} complete. Waiting ${loopIntervalMs}ms before next cycle...`);
    await delay(loopIntervalMs);
  }

  console.log('GTM keep-going loop finished.');
  console.log(`Log file: ${loopReportPath}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('gtm-keep-going failed:', message);
  process.exit(1);
});
