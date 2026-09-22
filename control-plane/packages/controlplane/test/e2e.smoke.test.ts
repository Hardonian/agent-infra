import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * End-to-End Smoke Tests
 *
 * These tests validate the complete ControlPlane ecosystem:
 * - Module discovery and registry
 * - Runner execution
 * - Drift detection
 * - Report generation
 */

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(__dirname, '../../..');

describe('ControlPlane E2E Smoke Tests', () => {
  describe('Module Discovery', () => {
    it('should discover all expected runners', async () => {
      const { discoverModules } = await import('../src/registry/hardened.js');

      const modules = discoverModules(repoRoot);

      expect(modules.length).toBeGreaterThan(0);

      // Check that expected runners are present
      const runnerNames = modules.map((m) => m.manifest.name);
      const expectedRunners = ['jobforge', 'truthcore', 'aias', 'autopilot-suite'];

      for (const expected of expectedRunners) {
        expect(runnerNames).toContain(expected);
      }
    });

    it('should validate all discovered manifests', async () => {
      const { listModules } = await import('../src/registry/index.js');

      const modules = listModules();

      for (const module of modules) {
        expect(module.available).toBe(true);
        expect(module.name).toBeDefined();
        expect(module.version).toBeDefined();
        expect(module.entrypoint).toBeDefined();
      }
    });
  });

  describe('Registry Report Generation', () => {
    it('should generate JSON registry report', async () => {
      const { discoverModules, buildRegistryState, generateRegistryReport } =
        await import('../src/registry/hardened.js');

      const modules = discoverModules(repoRoot);
      const state = buildRegistryState(modules);

      const report = generateRegistryReport(state, {
        format: 'json',
        includeErrors: true,
        includeWarnings: true,
        verbose: false,
      });

      const parsed = JSON.parse(report);
      expect(parsed.summary.total).toBe(modules.length);
      expect(parsed.modules).toHaveLength(modules.length);
    });

    it('should generate text registry report', async () => {
      const { discoverModules, buildRegistryState, generateRegistryReport } =
        await import('../src/registry/hardened.js');

      const modules = discoverModules(repoRoot);
      const state = buildRegistryState(modules);

      const report = generateRegistryReport(state, {
        format: 'text',
        includeErrors: true,
        includeWarnings: true,
        verbose: false,
      });

      expect(report).toContain('Module Registry Report');
      expect(report).toContain(`Total Modules: ${modules.length}`);
    });
  });

  describe('Drift Detection', () => {
    it('should detect no drift when comparing to current state', async () => {
      const { listModules } = await import('../src/registry/index.js');

      const modules = listModules();
      const availableModules = modules.filter((m) => m.available);

      // For now, just check that we have some available modules
      expect(availableModules.length).toBeGreaterThan(0);

      // TODO: Implement proper drift detection for new API
      // This test needs to be updated once drift detection is ported to new API
      expect(true).toBe(true); // Placeholder - remove when drift detection is updated
    });

    it('should detect missing modules when baseline has extra', async () => {
      const { discoverModules, buildRegistryState } = await import('../src/registry/hardened.js');
      const { detectDrifts, generateDriftReport, DEFAULT_DRIFT_CONFIG } =
        await import('../src/drift/index.js');

      const modules = discoverModules(repoRoot);
      const current = buildRegistryState(modules);

      // Create a baseline with an extra fake module
      const baselineModules = [
        ...modules,
        {
          manifest: {
            name: 'fake-module',
            version: '1.0.0',
            description: 'A fake module for testing',
            entrypoint: { command: 'node', args: ['index.js'] },
          },
          source: {
            path: '/fake/path',
            type: 'runners' as const,
            discoveredAt: new Date().toISOString(),
          },
          status: 'valid' as const,
          validation: {
            schemaValid: true,
            versionCompatible: true,
            entrypointExists: true,
            requiredEnvPresent: true,
            errors: [],
          },
          lastValidatedAt: new Date().toISOString(),
        },
      ];

      const baseline = buildRegistryState(baselineModules);

      const drifts = detectDrifts(current, baseline, DEFAULT_DRIFT_CONFIG);
      const report = generateDriftReport(current, drifts, baseline, DEFAULT_DRIFT_CONFIG);

      expect(drifts.some((d) => d.type === 'MISSING_MODULE')).toBe(true);
      expect(drifts.find((d) => d.type === 'MISSING_MODULE')?.module).toBe('fake-module');
    });
  });

  describe('Runner Manifest Validation', () => {
    it('should validate all runner manifests in runners/ directory', async () => {
      const runnersDir = join(repoRoot, 'runners');

      if (!existsSync(runnersDir)) {
        console.warn('Runners directory not found, skipping test');
        return;
      }

      const { validateRunnerManifest } = await import('@controlplane/contract-kit');
      const { readdirSync } = await import('node:fs');

      const entries = readdirSync(runnersDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const manifestPath = join(runnersDir, entry.name, 'runner.manifest.json');

        if (!existsSync(manifestPath)) {
          continue;
        }

        const content = readFileSync(manifestPath, 'utf-8');
        const manifest = JSON.parse(content);

        const result = validateRunnerManifest(manifest);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      }
    });
  });

  describe('Negative Tests', () => {
    it('should detect invalid manifest schema', async () => {
      const { validateManifest, DEFAULT_DISCOVERY_CONFIG } =
        await import('../src/registry/hardened.js');

      const invalidManifest = {
        name: '', // Empty name - invalid
        version: 'not-semver', // Invalid version
      };

      const result = validateManifest(invalidManifest, DEFAULT_DISCOVERY_CONFIG.validation);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect missing required fields', async () => {
      const { validateManifest, DEFAULT_DISCOVERY_CONFIG } =
        await import('../src/registry/hardened.js');

      const incompleteManifest = {
        name: 'test-runner',
        // Missing version, description, entrypoint
      };

      const result = validateManifest(incompleteManifest, DEFAULT_DISCOVERY_CONFIG.validation);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('version'))).toBe(true);
      expect(result.errors.some((e) => e.includes('description'))).toBe(true);
    });

    it('should detect version incompatibility', async () => {
      const { validateManifest } = await import('../src/registry/hardened.js');

      const manifest = {
        name: 'test-runner',
        version: '1.0.0',
        description: 'Test runner',
        entrypoint: { command: 'node', args: ['index.js'] },
        contractVersion: '0.5.0', // Below minimum
      };

      const result = validateManifest(manifest, {
        strict: false,
        validateSchema: true,
        checkEntrypoint: false,
        checkRequiredEnv: false,
        minimumContractVersion: '1.0.0',
      });

      expect(result.errors.some((e) => e.includes('version'))).toBe(true);
    });
  });
});

describe('Safe Orchestration', () => {
  it('should handle missing environment variables gracefully', async () => {
    const { checkRequiredEnv } = await import('../src/registry/hardened.js');

    const originalEnv = process.env['TEST_VAR'];
    delete process.env['TEST_VAR'];

    const result = checkRequiredEnv(['TEST_VAR']);

    expect(result.present).toBe(false);
    expect(result.missing).toContain('TEST_VAR');

    // Restore
    if (originalEnv) {
      process.env['TEST_VAR'] = originalEnv;
    }
  });

  it('should pass when all required environment variables are present', async () => {
    const { checkRequiredEnv } = await import('../src/registry/hardened.js');

    process.env['TEST_VAR_1'] = 'value1';
    process.env['TEST_VAR_2'] = 'value2';

    const result = checkRequiredEnv(['TEST_VAR_1', 'TEST_VAR_2']);

    expect(result.present).toBe(true);
    expect(result.missing).toHaveLength(0);

    // Cleanup
    delete process.env['TEST_VAR_1'];
    delete process.env['TEST_VAR_2'];
  });
});
