#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

const forwardArgs = [];
for (const arg of args) {
  forwardArgs.push(arg);
}

try {
  execFileSync('node', [path.join(repoRoot, 'scripts/demo-reset.mjs')], {
    stdio: 'inherit',
  });
  execFileSync('node', [path.join(repoRoot, 'scripts/demo-setup.mjs'), ...forwardArgs], {
    stdio: 'inherit',
  });
} catch (error) {
  process.exit(1);
}

console.log('✅ Demo mode ready.');
console.log('   - Run `pnpm run demo:reset` to reset demo state.');
console.log('   - Artifacts live under the demo/ directory.');
