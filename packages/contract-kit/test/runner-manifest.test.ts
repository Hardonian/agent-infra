import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateRunnerManifest } from '../src/index.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const runnersDir = path.join(repoRoot, 'runners');

const getRunnerManifests = () => {
  const entries = readdirSync(runnersDir);
  return entries
    .map((entry) => path.join(runnersDir, entry, 'runner.manifest.json'))
    .filter((manifestPath) => {
      try {
        return statSync(manifestPath).isFile();
      } catch {
        return false;
      }
    });
};

describe('runner manifest contract validation', () => {
  it('validates all runner manifests against the contract', () => {
    const manifests = getRunnerManifests();
    expect(manifests.length).toBeGreaterThan(0);

    for (const manifestPath of manifests) {
      const payload = JSON.parse(readFileSync(manifestPath, 'utf-8')) as unknown;
      const result = validateRunnerManifest(payload);
      expect(result.valid, `${manifestPath} invalid: ${result.errors.join(', ')}`).toBe(true);
    }
  });
});
