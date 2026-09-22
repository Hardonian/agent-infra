import { describe, expect, it } from 'vitest';
import { listRunnerManifests } from '../src/index.js';

describe('controlplane SDK', () => {
  it('lists runner manifests from the registry', () => {
    const runners = listRunnerManifests();
    expect(runners.length).toBeGreaterThan(0);
  });
});
