import { describe, expect, it } from 'vitest';
import { createDeterministicTrustSignal, queryMarketplace } from '../src/marketplace.js';
import {
  createDefaultTrustSignals,
  createEmptyMarketplaceIndex,
  type MarketplaceRunner,
} from '@controlplane/contracts';

const timestamp = '2024-01-01T00:00:00.000Z';

function buildRunner(id: string, name: string, downloads: number): MarketplaceRunner {
  return {
    id,
    metadata: {
      id,
      name,
      version: '1.0.0',
      contractVersion: { major: 1, minor: 0, patch: 0 },
      capabilities: [
        {
          id: 'capability',
          name: 'Capability',
          version: '1.0.0',
          description: 'Test capability',
          inputSchema: {},
          outputSchema: {},
          supportedJobTypes: ['test.job'],
          maxConcurrency: 1,
          timeoutMs: 30000,
          resourceRequirements: {},
        },
      ],
      supportedContracts: ['1.0.0'],
      healthCheckEndpoint: 'http://localhost:3000/health',
      registeredAt: timestamp,
      lastHeartbeatAt: timestamp,
      status: 'healthy',
      tags: [],
    },
    category: 'ops',
    description: 'Runner description',
    author: { name: 'ControlPlane' },
    documentation: { examples: [] },
    license: 'MIT',
    keywords: [],
    capabilities: [],
    compatibility: {
      minContractVersion: { major: 1, minor: 0, patch: 0 },
      supportedRanges: [{ min: { major: 1, minor: 0, patch: 0 } }],
      incompatibleWith: [],
      testedWith: [],
    },
    trustSignals: {
      ...createDefaultTrustSignals(),
      downloadCount: downloads,
    },
    deprecation: { isDeprecated: false },
    status: 'active',
    publishedAt: timestamp,
    updatedAt: timestamp,
    versionHistory: [
      {
        version: '1.0.0',
        publishedAt: timestamp,
        breakingChanges: false,
      },
    ],
    installation: {},
  };
}

describe('queryMarketplace sorting', () => {
  it('sorts by name ascending when sortOrder is asc', () => {
    const index = createEmptyMarketplaceIndex();
    index.runners = [
      buildRunner('11111111-1111-1111-1111-111111111111', 'Beta', 50),
      buildRunner('22222222-2222-2222-2222-222222222222', 'Alpha', 100),
    ];

    const result = queryMarketplace(index, {
      type: 'runner',
      status: 'all',
      trustLevel: 'all',
      sortBy: 'name',
      sortOrder: 'asc',
      limit: 10,
      offset: 0,
      keywords: [],
    });

    expect('category' in result.items[0]).toBe(true);
    const first = result.items[0] as MarketplaceRunner;
    expect(first.metadata.name).toBe('Alpha');
  });

  it('sorts by downloads descending when sortOrder is desc', () => {
    const index = createEmptyMarketplaceIndex();
    index.runners = [
      buildRunner('33333333-3333-3333-3333-333333333333', 'Runner A', 10),
      buildRunner('44444444-4444-4444-4444-444444444444', 'Runner B', 250),
    ];

    const result = queryMarketplace(index, {
      type: 'runner',
      status: 'all',
      trustLevel: 'all',
      sortBy: 'downloads',
      sortOrder: 'desc',
      limit: 10,
      offset: 0,
      keywords: [],
    });

    const first = result.items[0] as MarketplaceRunner;
    expect(first.trustSignals.downloadCount).toBe(250);
  });
});

describe('createDeterministicTrustSignal', () => {
  it('returns stable values for the same seed and timestamp', () => {
    const first = createDeterministicTrustSignal('runner-1', '1.0.0', timestamp);
    const second = createDeterministicTrustSignal('runner-1', '1.0.0', timestamp);

    expect(first.downloadCount).toBe(second.downloadCount);
    expect(first.averageRating).toBe(second.averageRating);
    expect(first.ratingCount).toBe(second.ratingCount);
    expect(first.codeQualityScore).toBe(second.codeQualityScore);
  });
});
