#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const demoDir = path.join(repoRoot, 'demo');
const args = process.argv.slice(2);
const getArg = (flag) => {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  return args[index + 1];
};

const inputPath = getArg('--input') || path.join(demoDir, 'input.json');
const outputDir = getArg('--output-dir') || demoDir;
const runner = getArg('--runner') || 'truthcore';
const fixedTime = process.env.CONTROLPLANE_DEMO_TIME || '2026-01-01T00:00:00.000Z';

const reportPath = path.join(outputDir, 'report.json');
const evidencePath = path.join(outputDir, 'evidence.json');

mkdirSync(outputDir, { recursive: true });

try {
  execFileSync(
    'node',
    [
      path.join(repoRoot, 'scripts/adapters/runner-adapter.mjs'),
      '--runner',
      runner,
      '--input',
      inputPath,
      '--out',
      reportPath,
      '--format',
      'json',
      '--evidence-out',
      evidencePath,
    ],
    {
      stdio: 'pipe',
      env: {
        ...process.env,
        CONTROLPLANE_DEMO_TIME: fixedTime,
      },
    }
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Demo setup failed: ${message}`);
  process.exit(1);
}

const manifest = {
  mode: 'demo',
  runner,
  inputPath,
  reportPath,
  evidencePath,
  fixedTime,
  generatedAt: fixedTime,
};

writeFileSync(path.join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

console.log(`✅ Demo artifacts written to ${outputDir}`);
