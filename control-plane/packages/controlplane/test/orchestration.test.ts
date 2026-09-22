import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(__dirname, '../../..');

/**
 * Integration tests that prove real end-to-end execution through ControlPlane.
 *
 * These tests are NOT mocked — they invoke real runners via the adapter,
 * validate inputs before dispatch, check exit codes, and validate both
 * report and evidence output against declared schemas.
 */
describe('ControlPlane Orchestration', () => {
  // ── Contracts ────────────────────────────────────────────────────────
  describe('Runner Input Contract', () => {
    it('rejects input missing required fields', async () => {
      const { validateRunnerInput } = await import('../src/contracts.js');

      const result = validateRunnerInput({ foo: 'bar' });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('requestId'))).toBe(true);
      expect(result.errors.some((e) => e.includes('timestamp'))).toBe(true);
      expect(result.errors.some((e) => e.includes('payload'))).toBe(true);
    });

    it('rejects non-object input', async () => {
      const { validateRunnerInput } = await import('../src/contracts.js');

      expect(validateRunnerInput(null).valid).toBe(false);
      expect(validateRunnerInput('string').valid).toBe(false);
      expect(validateRunnerInput(42).valid).toBe(false);
    });

    it('rejects invalid timestamp', async () => {
      const { validateRunnerInput } = await import('../src/contracts.js');

      const result = validateRunnerInput({
        requestId: 'test-001',
        timestamp: 'not-a-date',
        payload: {},
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('ISO-8601'))).toBe(true);
    });

    it('accepts valid input and returns coerced value', async () => {
      const { validateRunnerInput } = await import('../src/contracts.js');

      const input = {
        requestId: 'test-001',
        timestamp: '2026-01-01T00:00:00.000Z',
        payload: { action: 'test' },
      };
      const result = validateRunnerInput(input);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.coerced).toEqual(input);
    });
  });

  // ── Execution Registry ───────────────────────────────────────────────
  describe('Execution Registry', () => {
    it('discovers all expected runners with pre-flight checks', async () => {
      const { buildExecutionRegistry } = await import(
        '../src/registry/execution-registry.js'
      );

      const registry = buildExecutionRegistry();

      expect(registry.runners.length).toBeGreaterThan(0);
      expect(registry.timestamp).toBeDefined();

      const expectedRunners = [
        'truthcore',
        'jobforge',
        'ops-autopilot',
        'finops-autopilot',
        'growth-autopilot',
        'support-autopilot',
      ];

      const runnerNames = registry.runners.map((r) => r.name);
      for (const expected of expectedRunners) {
        expect(runnerNames).toContain(expected);
      }
    });

    it('all required runners pass pre-flight checks', async () => {
      const { buildExecutionRegistry } = await import(
        '../src/registry/execution-registry.js'
      );

      const registry = buildExecutionRegistry();
      const requiredRunners = [
        'truthcore',
        'jobforge',
        'ops-autopilot',
        'finops-autopilot',
        'growth-autopilot',
        'support-autopilot',
      ];

      for (const name of requiredRunners) {
        const entry = registry.runners.find((r) => r.name === name);
        expect(entry, `Runner ${name} should be in registry`).toBeDefined();
        expect(
          entry!.executable,
          `Runner ${name} should be executable. Failures: ${
            !entry!.executable ? (entry as { reason: string }).reason : 'none'
          }`
        ).toBe(true);
      }
    });

    it('resolveExecutableRunner fails fast for unknown runner', async () => {
      const { resolveExecutableRunner } = await import(
        '../src/registry/execution-registry.js'
      );

      expect(() => resolveExecutableRunner('nonexistent-runner')).toThrow(
        /not found/
      );
    });
  });

  // ── End-to-End Execution ─────────────────────────────────────────────
  describe('End-to-End Runner Execution', () => {
    const goldenInput = {
      requestId: 'e2e-test-001',
      timestamp: '2026-01-01T00:00:00.000Z',
      payload: {
        action: 'dry-run',
        target: 'controlplane',
        notes: 'Integration test fixture',
      },
    };

    it('executes truthcore end-to-end with full contract enforcement', async () => {
      const { executeRunner } = await import('../src/index.js');

      const result = await executeRunner('truthcore', goldenInput, {
        timeoutMs: 30_000,
      });

      // Report is valid
      expect(result.reportValid).toBe(true);
      expect(result.report.status).toBe('success');
      expect(result.report.runner.name).toBe('truthcore');
      expect(result.report.startedAt).toBeDefined();
      expect(result.report.finishedAt).toBeDefined();
      expect(result.report.summary).toBeDefined();

      // Evidence was collected and validated
      expect(result.evidenceValid).toBe(true);
      expect(result.evidence).not.toBeNull();
      expect(result.evidence!.runner).toBe('truthcore');
      expect(result.evidence!.hash).toBeDefined();
      expect(result.evidence!.hash.length).toBe(64); // SHA-256 hex
      expect(result.evidence!.items.length).toBeGreaterThan(0);
      expect(result.evidence!.decision).toBeDefined();
      expect(result.evidence!.decision!.outcome).toBe('pass');
      expect(result.evidence!.decision!.confidence).toBeGreaterThan(0);

      // Duration was measured
      expect(result.durationMs).toBeGreaterThan(0);
    }, 30_000);

    it('executes JobForge end-to-end', async () => {
      const { executeRunner } = await import('../src/index.js');

      const result = await executeRunner('jobforge', goldenInput, {
        timeoutMs: 30_000,
      });

      expect(result.reportValid).toBe(true);
      expect(result.report.runner.name).toBe('jobforge');
      expect(result.evidenceValid).toBe(true);
      expect(result.durationMs).toBeGreaterThan(0);
    }, 30_000);

    it('executes all 6 required runners successfully', async () => {
      const { executeRunner } = await import('../src/index.js');

      const runners = [
        'truthcore',
        'jobforge',
        'ops-autopilot',
        'finops-autopilot',
        'growth-autopilot',
        'support-autopilot',
      ];

      for (const name of runners) {
        const result = await executeRunner(name, goldenInput, {
          timeoutMs: 30_000,
        });

        expect(result.reportValid, `${name} report should be valid`).toBe(true);
        expect(result.report.status, `${name} should succeed`).toBe('success');
        expect(result.evidenceValid, `${name} evidence should be valid`).toBe(true);
        expect(result.durationMs, `${name} should have measured duration`).toBeGreaterThan(0);
      }
    }, 120_000);

    it('rejects invalid input before dispatch', async () => {
      const { runRunner } = await import('../src/index.js');

      await expect(
        runRunner({
          runner: 'truthcore',
          input: { bad: 'input' },
        })
      ).rejects.toThrow(/Validation failed/);
    });
  });

  // ── Runner Manifest Contract Guard ───────────────────────────────────
  describe('Runner Contract Drift Guard', () => {
    const REQUIRED_RUNNERS = [
      'truthcore',
      'jobforge',
      'ops-autopilot',
      'finops-autopilot',
      'growth-autopilot',
      'support-autopilot',
    ];

    it('all required runners have valid manifest files', async () => {
      const { validateRunnerManifest } = await import('@controlplane/contract-kit');

      for (const name of REQUIRED_RUNNERS) {
        const manifestPath = resolve(repoRoot, 'runners', name, 'runner.manifest.json');
        expect(existsSync(manifestPath), `Manifest must exist: ${manifestPath}`).toBe(true);

        const content = readFileSync(manifestPath, 'utf-8');
        const manifest = JSON.parse(content);
        const result = validateRunnerManifest(manifest);

        expect(
          result.valid,
          `${name} manifest is invalid: ${result.errors.join(', ')}`
        ).toBe(true);
      }
    });

    it('all manifests reference the universal adapter entrypoint', () => {
      for (const name of REQUIRED_RUNNERS) {
        const manifestPath = resolve(repoRoot, 'runners', name, 'runner.manifest.json');
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

        expect(manifest.entrypoint.command).toBe('node');
        expect(manifest.entrypoint.args[0]).toBe('scripts/adapters/runner-adapter.mjs');
        expect(manifest.entrypoint.args).toContain('--runner');
        expect(manifest.entrypoint.args).toContain(name);
      }
    });

    it('universal adapter script exists', () => {
      const adapterPath = resolve(repoRoot, 'scripts/adapters/runner-adapter.mjs');
      expect(existsSync(adapterPath)).toBe(true);
    });

    it('adapter has logic for all required runners', () => {
      const adapterPath = resolve(repoRoot, 'scripts/adapters/runner-adapter.mjs');
      const content = readFileSync(adapterPath, 'utf-8');

      for (const name of REQUIRED_RUNNERS) {
        // Each runner should have a key in the runnerLogic object
        // truthcore uses 'truthcore', JobForge uses 'JobForge', etc.
        const pattern = name.includes('-') ? `'${name}'` : `${name}:`;
        expect(
          content.includes(`'${name}'`) || content.includes(`${name}:`),
          `Adapter must have logic for runner "${name}" (looked for ${pattern})`
        ).toBe(true);
      }
    });
  });
});
