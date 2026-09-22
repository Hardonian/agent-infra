import { test, expect } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const demoDir = path.join(repoRoot, 'demo');
const nodeCommand = process.execPath;

const runDemoScript = async (script: string, args: string[] = []) =>
  execFileAsync(nodeCommand, [path.join(repoRoot, script), ...args], {
    env: {
      ...process.env,
      CONTROLPLANE_DEMO_TIME: '2026-01-01T00:00:00.000Z',
    },
  });

test.describe('@demo Demo mode', () => {
  test('generates deterministic demo artifacts', async () => {
    await runDemoScript('scripts/demo-reset.mjs');
    await runDemoScript('scripts/demo-start.mjs');

    const report = JSON.parse(readFileSync(path.join(demoDir, 'report.json'), 'utf-8')) as unknown;
    const evidence = JSON.parse(readFileSync(path.join(demoDir, 'evidence.json'), 'utf-8')) as unknown;

    const reportRecord = report as Record<string, unknown>;
    const evidenceRecord = evidence as Record<string, unknown>;

    expect(reportRecord.runner).toBeDefined();
    expect(reportRecord.status).toBeDefined();
    expect(reportRecord.startedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(Array.isArray(reportRecord.artifacts)).toBe(true);

    expect(evidenceRecord.runner).toBeDefined();
    expect(evidenceRecord.timestamp).toBeDefined();
    expect(Array.isArray(evidenceRecord.items)).toBe(true);
    expect((report as { startedAt?: string }).startedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  test('fails cleanly with invalid input', async () => {
    let failed = false;
    try {
      await runDemoScript('scripts/demo-setup.mjs', ['--input', '{invalid-json}']);
    } catch (error) {
      failed = true;
      const message = error instanceof Error ? error.message : String(error);
      expect(message.length).toBeGreaterThan(0);
    }

    expect(failed).toBe(true);
  });
});
