#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const WORKSPACE_ROOT = '/Users/calbotsman/clawd';
const GENERATOR_PATH = path.join(WORKSPACE_ROOT, 'studio', 'tools', 'generate_supplement_design_set_recraft_v4.mjs');
const QA_PATH = path.join(WORKSPACE_ROOT, 'scripts', 'validate_supplement_design.mjs');
const DEFAULT_OUT_ROOT = path.join(WORKSPACE_ROOT, 'output', 'supplement-design');

function usage() {
  console.log(`Usage:
  node scripts/design_supplement_with_cyborg_qa.mjs --config <concept.json> [--out-dir <dir>] [other generator args]
`);
}

function parseArgs(rawArgs) {
  const args = {
    argv: [...rawArgs],
    outDir: DEFAULT_OUT_ROOT,
    configPath: '',
  };

  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];
    if (arg === '--config' && rawArgs[i + 1]) {
      args.configPath = rawArgs[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--out-dir' && rawArgs[i + 1]) {
      args.outDir = rawArgs[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    }
    if (!arg.startsWith('-')) {
      continue;
    }
  }

  if (!args.configPath) {
    throw new Error('Missing required --config argument');
  }
  return args;
}

function parseManifestFromOutput(stdout) {
  const manifestMatch = /- manifest:\s+(.+manifest\.json)/m.exec(stdout);
  if (manifestMatch && manifestMatch[1]) {
    return path.resolve(manifestMatch[1].trim());
  }

  const summaryMatch = /- summary:\s+(.+workflow-summary\.json)/m.exec(stdout);
  if (summaryMatch && summaryMatch[1]) {
    return path.resolve(summaryMatch[1]).replace(/workflow-summary\.json$/, 'manifest.json');
  }

  return '';
}

async function findLatestManifest(outRoot) {
  const manifests = [];
  const stack = [outRoot];

  while (stack.length > 0) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && entry.name === 'manifest.json') {
        const stat = await fs.stat(full);
        manifests.push({ path: full, mtimeMs: stat.mtimeMs });
      }
    }
  }

  manifests.sort((a, b) => b.mtimeMs - a.mtimeMs);
  if (!manifests.length) {
    return '';
  }
  return manifests[0].path;
}

async function ensureManifestPath(parsedArgs, generatedStdout) {
  const manifestPath = parseManifestFromOutput(generatedStdout);
  if (manifestPath) {
    return manifestPath;
  }

  return findLatestManifest(path.resolve(parsedArgs.outDir));
}

function runValidator(manifestPath) {
  const result = spawnSync(process.execPath, [QA_PATH, '--manifest', manifestPath, '--strict'], {
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    return false;
  }
  return true;
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));

  const generated = spawnSync(process.execPath, [GENERATOR_PATH, ...parsed.argv], {
    encoding: 'utf8',
    stdio: 'pipe',
  });

  if (generated.stdout) {
    process.stdout.write(generated.stdout);
  }
  if (generated.stderr) {
    process.stderr.write(generated.stderr);
  }

  if (generated.status !== 0) {
    process.exit(generated.status ?? 1);
  }

  const manifestPath = await ensureManifestPath(parsed, generated.stdout || '');
  if (!manifestPath) {
    throw new Error('Could not determine manifest path from generator output.');
  }

  if (!runValidator(manifestPath)) {
    throw new Error(`Cyborg QA failed for ${manifestPath}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
