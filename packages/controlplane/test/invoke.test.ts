import { describe, expect, it } from 'vitest';
import { runEntrypoint } from '../src/invoke/index.js';

const nodeCommand = process.execPath;

describe('runEntrypoint failure handling', () => {
  it('terminates long-running processes on timeout', async () => {
    const result = await runEntrypoint(nodeCommand, ['-e', 'setTimeout(() => {}, 2000)'], {
      timeoutMs: 100,
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('redacts sensitive env values from output', async () => {
    const result = await runEntrypoint(nodeCommand, ['-e', 'console.log(process.env.SECRET_VALUE)'], {
      env: { SECRET_VALUE: 'super-secret' },
      redactEnvKeys: ['SECRET_VALUE'],
    });

    expect(result.stdout).toContain('***');
    expect(result.stdout).not.toContain('super-secret');
  });
});
