import { test, expect } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

test('contract-test CLI reports success in JSON mode', async () => {
  await execFileAsync('pnpm', ['--filter', '@controlplane/contract-test-kit', 'build'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      FORCE_COLOR: '0',
    },
  });

  const { stdout } = await execFileAsync(
    'node',
    ['packages/contract-test-kit/dist/cli.js', '--json'],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        FORCE_COLOR: '0',
      },
    }
  );

  const payload = JSON.parse(stdout.trim()) as {
    success: boolean;
    failed: number;
    passed: number;
    total: number;
  };

  expect(payload.success).toBe(true);
  expect(payload.failed).toBe(0);
  expect(payload.total).toBeGreaterThan(0);
  expect(payload.passed).toBe(payload.total);
});
