import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { validateRunnerManifest } from '@controlplane/contract-kit';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);

const loadManifests = () => {
  const runnersRoot = path.join(repoRoot, 'runners');
  return readdirSync(runnersRoot).map((entry) => {
    const manifestPath = path.join(runnersRoot, entry, 'runner.manifest.json');
    const raw = readFileSync(manifestPath, 'utf-8');
    return { manifestPath, payload: JSON.parse(raw) as unknown };
  });
};

describe('runner manifests', () => {
  it('validate against runner manifest schema', () => {
    const manifests = loadManifests();
    for (const manifest of manifests) {
      const result = validateRunnerManifest(manifest.payload);
      expect(result.valid).toBe(true);
    }
  });
});

describe('controlplane CLI', () => {
  it('lists runners via CLI', () => {
    const cliPath = path.join(
      repoRoot,
      'packages/controlplane/dist/cli.js'
    );
    const output = execFileSync('node', [cliPath, 'list'], {
      encoding: 'utf-8'
    });
    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
  });
});

describe('controlplane SDK', () => {
  it('imports ControlPlaneClient and lists runners', async () => {
    const module = await import('@controlplane/controlplane');
    const client = new module.ControlPlaneClient();
    const runners = client.listRunners();
    expect(runners.length).toBeGreaterThan(0);
  });
});

describe('workflows', () => {
  it('exposes verify-integrations workflow with workflow_call', () => {
    const workflowPath = path.join(
      repoRoot,
      '.github/workflows/verify-integrations.yml'
    );
    const raw = readFileSync(workflowPath, 'utf-8');
    expect(raw).toContain('workflow_call');
  });
});
