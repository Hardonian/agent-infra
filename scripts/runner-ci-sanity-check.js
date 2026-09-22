import { spawnSync } from 'node:child_process';

const commands = [
  ['pnpm', ['run', 'build:contracts']],
  ['pnpm', ['run', 'build:test-kit']],
  ['node', ['packages/contract-test-kit/dist/cli.js']],
  ['node', ['packages/contract-test-kit/dist/contract-sync.js']],
];

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage: node scripts/runner-ci-sanity-check.js');
  console.log('Runs the runner contract checks that CI executes first.');
  process.exit(0);
}

for (const [command, commandArgs] of commands) {
  const result = spawnSync(command, commandArgs, { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
