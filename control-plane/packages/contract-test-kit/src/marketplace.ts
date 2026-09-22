import type {
  MarketplaceIndex,
  MarketplaceRunner,
  MarketplaceConnector,
  MarketplaceQuery,
  MarketplaceQueryResult,
  MarketplaceTrustSignals,
  CapabilityRegistry,
  RegisteredRunner,
  ConnectorInstance,
  TrustStatus,
  ContractTestStatus,
  SecurityScanStatus,
  VerificationMethod,
  CompatibilityInfo,
  DeprecationInfo,
  MarketplaceItemStatus,
} from '@controlplane/contracts';
import { createEmptyMarketplaceIndex, createDefaultTrustSignals } from '@controlplane/contracts';

export interface MarketplaceBuilderOptions {
  workspaceRoot: string;
  environment: 'development' | 'staging' | 'production';
  includeUnverified: boolean;
  includeDeprecated: boolean;
  includePending: boolean;
}

export interface TrustSignalSource {
  runnerId?: string;
  connectorId?: string;
  contractTestStatus?: ContractTestStatus;
  lastContractTestAt?: string;
  lastVerifiedVersion?: string;
  verificationMethod?: VerificationMethod;
  securityScanStatus?: SecurityScanStatus;
  lastSecurityScanAt?: string;
  vulnerabilities?: Array<{
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    description: string;
    cve?: string;
  }>;
  codeQualityScore?: number;
  maintainerReputation?: 'official' | 'verified' | 'community' | 'unknown';
  downloadCount?: number;
  averageRating?: number;
  ratingCount?: number;
}

export interface BuildResult {
  index: MarketplaceIndex;
  errors: string[];
  warnings: string[];
  stats: {
    runnersProcessed: number;
    connectorsProcessed: number;
    trustSignalsApplied: number;
  };
}

function calculateOverallTrust(signals: TrustSignalSource): TrustStatus {
  if (signals.maintainerReputation === 'official') return 'verified';

  if (
    signals.contractTestStatus === 'passing' &&
    signals.securityScanStatus === 'passed' &&
    signals.maintainerReputation === 'verified'
  ) {
    return 'verified';
  }

  if (signals.contractTestStatus === 'failing' || signals.securityScanStatus === 'failed') {
    return 'failed';
  }

  if (signals.contractTestStatus === 'passing' || signals.securityScanStatus === 'passed') {
    return 'pending';
  }

  return 'unverified';
}

function stableHash(seed: string): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 33) ^ seed.charCodeAt(i);
  }
  return hash >>> 0;
}

function stableNumber(seed: string, min: number, max: number): number {
  const range = max - min + 1;
  const hashed = stableHash(seed);
  return min + (hashed % range);
}

export function createDeterministicTrustSignal(
  seed: string,
  version: string,
  timestamp: string
): TrustSignalSource {
  const downloads = stableNumber(`${seed}:downloads`, 25, 950);
  const ratingCount = stableNumber(`${seed}:ratingCount`, 3, 80);
  const averageRating = Math.round((stableNumber(`${seed}:rating`, 36, 50) / 10) * 10) / 10;
  const codeQualityScore = stableNumber(`${seed}:quality`, 75, 98);

  return {
    runnerId: seed,
    contractTestStatus: 'passing',
    lastContractTestAt: timestamp,
    lastVerifiedVersion: version,
    verificationMethod: 'automated_ci',
    securityScanStatus: 'passed',
    lastSecurityScanAt: timestamp,
    codeQualityScore,
    maintainerReputation: 'verified',
    downloadCount: downloads,
    averageRating,
    ratingCount,
  };
}

function buildTrustSignals(source: TrustSignalSource): MarketplaceTrustSignals {
  const overallTrust = calculateOverallTrust(source);

  return {
    overallTrust,
    contractTestStatus: source.contractTestStatus || 'not_tested',
    lastContractTestAt: source.lastContractTestAt,
    lastVerifiedVersion: source.lastVerifiedVersion,
    verificationMethod: source.verificationMethod || 'community_verified',
    securityScanStatus: source.securityScanStatus || 'not_scanned',
    lastSecurityScanAt: source.lastSecurityScanAt,
    securityScanDetails: {
      vulnerabilities: source.vulnerabilities || [],
    },
    codeQualityScore: source.codeQualityScore,
    maintainerReputation: source.maintainerReputation || 'unknown',
    downloadCount: source.downloadCount || 0,
    rating: {
      average: source.averageRating,
      count: source.ratingCount || 0,
    },
  };
}

function buildCompatibilityInfo(
  runnerOrConnector: RegisteredRunner | ConnectorInstance
): CompatibilityInfo {
  const defaultVersion: { major: number; minor: number; patch: number } = {
    major: 1,
    minor: 0,
    patch: 0,
  };
  let contractVersion = defaultVersion;

  if ('metadata' in runnerOrConnector && runnerOrConnector.metadata?.contractVersion) {
    const cv = runnerOrConnector.metadata.contractVersion;
    if (typeof cv === 'object' && cv !== null && 'major' in cv && 'minor' in cv && 'patch' in cv) {
      contractVersion = cv as { major: number; minor: number; patch: number };
    }
  }

  return {
    minContractVersion: contractVersion,
    supportedRanges: [
      {
        min: { major: 1, minor: 0, patch: 0 },
      },
    ],
    incompatibleWith: [],
    testedWith: [],
  };
}

function buildDeprecationInfo(
  _runnerOrConnector: RegisteredRunner | ConnectorInstance
): DeprecationInfo {
  return {
    isDeprecated: false,
  };
}

export async function buildMarketplaceIndex(
  registry: CapabilityRegistry,
  trustSources: Map<string, TrustSignalSource>,
  options: MarketplaceBuilderOptions
): Promise<BuildResult> {
  const index = createEmptyMarketplaceIndex();
  const errors: string[] = [];
  const warnings: string[] = [];
  let trustSignalsApplied = 0;

  index.system.environment = options.environment;
  index.generatedAt = new Date().toISOString();

  // Process runners
  const marketplaceRunners: MarketplaceRunner[] = [];
  for (const runner of registry.runners) {
    try {
      const trustSource = trustSources.get(runner.metadata.id);

      if (!trustSource && !options.includeUnverified) {
        warnings.push(
          `Skipping unverified runner: ${runner.metadata.name} (${runner.metadata.id})`
        );
        continue;
      }

      const trustSignals = trustSource
        ? buildTrustSignals(trustSource)
        : createDefaultTrustSignals();

      if (trustSource) {
        trustSignalsApplied++;
      }

      const marketplaceRunner: MarketplaceRunner = {
        id: runner.metadata.id,
        metadata: runner.metadata,
        category: runner.category,
        description: runner.metadata.capabilities[0]?.description || 'No description available',
        author: {
          name: 'Unknown',
        },
        license: 'Unknown',
        keywords: runner.metadata.tags || [],
        capabilities: runner.metadata.capabilities,
        compatibility: buildCompatibilityInfo(runner),
        trustSignals,
        deprecation: buildDeprecationInfo(runner),
        status: 'active',
        publishedAt: runner.metadata.registeredAt,
        updatedAt: runner.metadata.lastHeartbeatAt,
        documentation: {
          examples: [],
        },
        versionHistory: [
          {
            version: runner.metadata.version,
            publishedAt: runner.metadata.registeredAt,
            breakingChanges: false,
          },
        ],
        installation: {},
      };

      marketplaceRunners.push(marketplaceRunner);
    } catch (err) {
      errors.push(
        `Failed to process runner ${runner.metadata.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // Process connectors
  const marketplaceConnectors: MarketplaceConnector[] = [];
  for (const connector of registry.connectors) {
    try {
      const trustSource = trustSources.get(connector.config.id);

      if (!trustSource && !options.includeUnverified) {
        warnings.push(
          `Skipping unverified connector: ${connector.config.name} (${connector.config.id})`
        );
        continue;
      }

      const trustSignals = trustSource
        ? buildTrustSignals(trustSource)
        : createDefaultTrustSignals();

      if (trustSource) {
        trustSignalsApplied++;
      }

      const marketplaceConnector: MarketplaceConnector = {
        id: connector.config.id,
        config: connector.config,
        description: connector.config.description,
        author: {
          name: 'Unknown',
        },
        license: 'Unknown',
        keywords: [],
        inputSchema: connector.config.configSchema,
        outputSchema: { type: 'object' },
        compatibility: buildCompatibilityInfo(connector),
        trustSignals,
        deprecation: buildDeprecationInfo(connector),
        status: 'active',
        publishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        documentation: {
          examples: [],
        },
        versionHistory: [
          {
            version: connector.config.version,
            publishedAt: new Date().toISOString(),
            breakingChanges: false,
          },
        ],
        installation: {},
      };

      marketplaceConnectors.push(marketplaceConnector);
    } catch (err) {
      errors.push(
        `Failed to process connector ${connector.config.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // Update index
  index.runners = marketplaceRunners;
  index.connectors = marketplaceConnectors;

  // Calculate stats
  index.stats = {
    totalRunners: marketplaceRunners.length,
    totalConnectors: marketplaceConnectors.length,
    totalCapabilities: marketplaceRunners.reduce((sum, r) => sum + r.capabilities.length, 0),
    verifiedCount:
      marketplaceRunners.filter((r) => r.trustSignals.overallTrust === 'verified').length +
      marketplaceConnectors.filter((c) => c.trustSignals.overallTrust === 'verified').length,
    pendingReviewCount:
      marketplaceRunners.filter((r) => r.trustSignals.overallTrust === 'pending').length +
      marketplaceConnectors.filter((c) => c.trustSignals.overallTrust === 'pending').length,
    deprecatedCount:
      marketplaceRunners.filter((r) => r.deprecation.isDeprecated).length +
      marketplaceConnectors.filter((c) => c.deprecation.isDeprecated).length,
    categories: marketplaceRunners.reduce(
      (acc, r) => {
        acc[r.category] = (acc[r.category] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    ),
    connectorTypes: marketplaceConnectors.reduce(
      (acc, c) => {
        acc[c.config.type] = (acc[c.config.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    ),
  };

  return {
    index,
    errors,
    warnings,
    stats: {
      runnersProcessed: marketplaceRunners.length,
      connectorsProcessed: marketplaceConnectors.length,
      trustSignalsApplied,
    },
  };
}

export function queryMarketplace(
  index: MarketplaceIndex,
  query: MarketplaceQuery
): MarketplaceQueryResult {
  let items: Array<MarketplaceRunner | MarketplaceConnector> = [];

  // Collect items based on type
  if (query.type === 'all' || query.type === 'runner') {
    items = items.concat(index.runners);
  }
  if (query.type === 'all' || query.type === 'connector') {
    items = items.concat(index.connectors);
  }

  // Apply filters
  if (query.status && query.status !== 'all') {
    const statusMap: Record<string, MarketplaceItemStatus> = {
      active: 'active',
      deprecated: 'deprecated',
      pending_review: 'pending_review',
    };
    items = items.filter((item) => item.status === statusMap[query.status!]);
  }

  if (query.category) {
    items = items.filter((item) => 'category' in item && item.category === query.category);
  }

  if (query.connectorType) {
    items = items.filter((item) => 'config' in item && item.config.type === query.connectorType);
  }

  if (query.trustLevel && query.trustLevel !== 'all') {
    const trustMap: Record<string, TrustStatus> = {
      verified: 'verified',
      community: 'pending',
    };
    items = items.filter(
      (item) =>
        item.trustSignals.overallTrust === trustMap[query.trustLevel!] ||
        (query.trustLevel === 'community' && item.trustSignals.overallTrust === 'unverified')
    );
  }

  if (query.search) {
    const searchLower = query.search.toLowerCase();
    items = items.filter(
      (item) =>
        ('metadata' in item && item.metadata?.name?.toLowerCase().includes(searchLower)) ||
        item.description?.toLowerCase().includes(searchLower) ||
        item.keywords?.some((k: string) => k.toLowerCase().includes(searchLower))
    );
  }

  if (query.author) {
    items = items.filter(
      (item) => item.author?.name === query.author || item.author?.organization === query.author
    );
  }

  if (query.keywords && query.keywords.length > 0) {
    items = items.filter((item) => query.keywords!.some((k) => item.keywords?.includes(k)));
  }

  // Calculate facets
  const facets = {
    categories: {} as Record<string, number>,
    trustLevels: {} as Record<string, number>,
    connectorTypes: {} as Record<string, number>,
    status: {} as Record<string, number>,
  };

  for (const item of items) {
    // Categories (runners only)
    if ('category' in item) {
      facets.categories[item.category] = (facets.categories[item.category] || 0) + 1;
    }

    // Trust levels
    facets.trustLevels[item.trustSignals.overallTrust] =
      (facets.trustLevels[item.trustSignals.overallTrust] || 0) + 1;

    // Connector types (connectors only)
    if ('config' in item) {
      facets.connectorTypes[item.config.type] = (facets.connectorTypes[item.config.type] || 0) + 1;
    }

    // Status
    facets.status[item.status] = (facets.status[item.status] || 0) + 1;
  }

  // Sort
  const sortedItems = [...items].sort((a, b) => {
    switch (query.sortBy) {
      case 'name': {
        const aName = 'metadata' in a ? a.metadata?.name : '';
        const bName = 'metadata' in b ? b.metadata?.name : '';
        return aName.localeCompare(bName);
      }
      case 'published':
        return new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime();
      case 'updated':
        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      case 'rating':
        return (a.trustSignals.rating.average || 0) - (b.trustSignals.rating.average || 0);
      case 'downloads':
        return a.trustSignals.downloadCount - b.trustSignals.downloadCount;
      case 'relevance':
      default:
        return 0;
    }
  });

  if (query.sortOrder === 'desc') {
    sortedItems.reverse();
  }

  // Paginate
  const total = sortedItems.length;
  const offset = query.offset || 0;
  const limit = query.limit || 20;
  const paginatedItems = sortedItems.slice(offset, offset + limit);

  return {
    query,
    total,
    hasMore: offset + limit < total,
    items: paginatedItems,
    facets,
  };
}

export function formatMarketplaceOutput(
  index: MarketplaceIndex,
  format: 'json' | 'yaml' = 'json'
): string {
  if (format === 'yaml') {
    // Simple YAML serialization
    return `version: "${index.version}"
generatedAt: ${index.generatedAt}
schema:
  version: "${index.schema.version}"
  url: ${index.schema.url}
system:
  name: ${index.system.name}
  version: "${index.system.version}"
  environment: ${index.system.environment}
stats:
  totalRunners: ${index.stats.totalRunners}
  totalConnectors: ${index.stats.totalConnectors}
  totalCapabilities: ${index.stats.totalCapabilities}
  verifiedCount: ${index.stats.verifiedCount}
  pendingReviewCount: ${index.stats.pendingReviewCount}
  deprecatedCount: ${index.stats.deprecatedCount}
`;
  }

  return JSON.stringify(index, null, 2);
}
