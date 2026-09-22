import { z } from 'zod';
import { ContractVersion, ContractRange } from '../versioning/index.js';
import { RunnerCapability, RunnerMetadata } from './runners.js';
import { ConnectorConfig } from './registry.js';

export const TrustStatus = z.enum(['verified', 'pending', 'failed', 'unverified']);
export type TrustStatus = z.infer<typeof TrustStatus>;

export const SecurityScanStatus = z.enum(['passed', 'failed', 'pending', 'not_scanned']);
export type SecurityScanStatus = z.infer<typeof SecurityScanStatus>;

export const ContractTestStatus = z.enum(['passing', 'failing', 'not_tested', 'stale']);
export type ContractTestStatus = z.infer<typeof ContractTestStatus>;

export const VerificationMethod = z.enum([
  'automated_ci',
  'manual_review',
  'community_verified',
  'official_publisher',
]);
export type VerificationMethod = z.infer<typeof VerificationMethod>;

export const MarketplaceTrustSignals = z.object({
  overallTrust: TrustStatus,
  contractTestStatus: ContractTestStatus,
  lastContractTestAt: z.string().datetime().optional(),
  lastVerifiedVersion: z.string().optional(),
  verificationMethod: VerificationMethod,
  securityScanStatus: SecurityScanStatus,
  lastSecurityScanAt: z.string().datetime().optional(),
  securityScanDetails: z
    .object({
      vulnerabilities: z
        .array(
          z.object({
            severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
            description: z.string(),
            cve: z.string().optional(),
          })
        )
        .default([]),
      scanDurationMs: z.number().nonnegative().optional(),
    })
    .default({}),
  codeQualityScore: z.number().min(0).max(100).optional(),
  maintainerReputation: z.enum(['official', 'verified', 'community', 'unknown']).default('unknown'),
  downloadCount: z.number().nonnegative().default(0),
  rating: z
    .object({
      average: z.number().min(0).max(5).optional(),
      count: z.number().nonnegative().default(0),
    })
    .default({}),
});
export type MarketplaceTrustSignals = z.infer<typeof MarketplaceTrustSignals>;

export const DeprecationInfo = z.object({
  isDeprecated: z.boolean().default(false),
  deprecationDate: z.string().datetime().optional(),
  replacementId: z.string().optional(),
  migrationGuide: z.string().url().optional(),
  reason: z.string().optional(),
});
export type DeprecationInfo = z.infer<typeof DeprecationInfo>;

export const CompatibilityInfo = z.object({
  minContractVersion: ContractVersion,
  maxContractVersion: ContractVersion.optional(),
  supportedRanges: z.array(ContractRange).default([]),
  incompatibleWith: z.array(z.string()).default([]),
  testedWith: z
    .array(
      z.object({
        contractVersion: ContractVersion,
        testedAt: z.string().datetime(),
        result: z.enum(['compatible', 'incompatible', 'unknown']),
      })
    )
    .default([]),
});
export type CompatibilityInfo = z.infer<typeof CompatibilityInfo>;

export const MarketplaceItemStatus = z.enum([
  'active',
  'deprecated',
  'pending_review',
  'rejected',
  'delisted',
]);
export type MarketplaceItemStatus = z.infer<typeof MarketplaceItemStatus>;

export const MarketplaceRunner = z.object({
  id: z.string(),
  metadata: RunnerMetadata,
  category: z.enum([
    'ops',
    'finops',
    'support',
    'growth',
    'analytics',
    'security',
    'infrastructure',
    'custom',
  ]),
  description: z.string(),
  longDescription: z.string().optional(),
  author: z.object({
    name: z.string(),
    email: z.string().email().optional(),
    url: z.string().url().optional(),
    organization: z.string().optional(),
  }),
  repository: z
    .object({
      url: z.string().url(),
      type: z.enum(['git', 'svn', 'mercurial']).default('git'),
      branch: z.string().default('main'),
    })
    .optional(),
  documentation: z
    .object({
      readme: z.string().url().optional(),
      changelog: z.string().url().optional(),
      examples: z.array(z.string().url()).default([]),
    })
    .default({}),
  license: z.string(),
  keywords: z.array(z.string()).default([]),
  capabilities: z.array(RunnerCapability),
  compatibility: CompatibilityInfo,
  trustSignals: MarketplaceTrustSignals,
  deprecation: DeprecationInfo.default({ isDeprecated: false }),
  status: MarketplaceItemStatus.default('active'),
  publishedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  versionHistory: z
    .array(
      z.object({
        version: z.string(),
        publishedAt: z.string().datetime(),
        changelog: z.string().optional(),
        breakingChanges: z.boolean().default(false),
      })
    )
    .default([]),
  installation: z
    .object({
      npm: z.string().optional(),
      docker: z.string().optional(),
      binary: z.string().optional(),
      source: z.string().optional(),
    })
    .default({}),
});
export type MarketplaceRunner = z.infer<typeof MarketplaceRunner>;

export const MarketplaceConnector = z.object({
  id: z.string(),
  config: ConnectorConfig,
  description: z.string(),
  longDescription: z.string().optional(),
  author: z.object({
    name: z.string(),
    email: z.string().email().optional(),
    url: z.string().url().optional(),
    organization: z.string().optional(),
  }),
  repository: z
    .object({
      url: z.string().url(),
      type: z.enum(['git', 'svn', 'mercurial']).default('git'),
      branch: z.string().default('main'),
    })
    .optional(),
  documentation: z
    .object({
      readme: z.string().url().optional(),
      configuration: z.string().url().optional(),
      examples: z.array(z.string().url()).default([]),
    })
    .default({}),
  license: z.string(),
  keywords: z.array(z.string()).default([]),
  inputSchema: z.record(z.unknown()),
  outputSchema: z.record(z.unknown()),
  compatibility: CompatibilityInfo,
  trustSignals: MarketplaceTrustSignals,
  deprecation: DeprecationInfo.default({ isDeprecated: false }),
  status: MarketplaceItemStatus.default('active'),
  publishedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  versionHistory: z
    .array(
      z.object({
        version: z.string(),
        publishedAt: z.string().datetime(),
        changelog: z.string().optional(),
        breakingChanges: z.boolean().default(false),
      })
    )
    .default([]),
  installation: z
    .object({
      npm: z.string().optional(),
      docker: z.string().optional(),
    })
    .default({}),
});
export type MarketplaceConnector = z.infer<typeof MarketplaceConnector>;

export const MarketplaceIndex = z.object({
  version: z.string(),
  generatedAt: z.string().datetime(),
  schema: z.object({
    version: z.string(),
    url: z.string().url(),
  }),
  system: z.object({
    name: z.string(),
    version: z.string(),
    environment: z.enum(['development', 'staging', 'production']),
  }),
  stats: z.object({
    totalRunners: z.number().nonnegative(),
    totalConnectors: z.number().nonnegative(),
    totalCapabilities: z.number().nonnegative(),
    verifiedCount: z.number().nonnegative(),
    pendingReviewCount: z.number().nonnegative(),
    deprecatedCount: z.number().nonnegative(),
    categories: z.record(z.number().nonnegative()),
    connectorTypes: z.record(z.number().nonnegative()),
  }),
  runners: z.array(MarketplaceRunner),
  connectors: z.array(MarketplaceConnector),
  filters: z.object({
    categories: z.array(z.string()),
    connectorTypes: z.array(z.string()),
    trustLevels: z.array(z.string()),
    licenseTypes: z.array(z.string()),
  }),
});
export type MarketplaceIndex = z.infer<typeof MarketplaceIndex>;

export const MarketplaceQuery = z.object({
  type: z.enum(['runner', 'connector', 'all']).default('all'),
  category: z.string().optional(),
  connectorType: z.string().optional(),
  status: z.enum(['active', 'deprecated', 'pending_review', 'all']).default('active'),
  trustLevel: z.enum(['verified', 'community', 'all']).default('all'),
  search: z.string().optional(),
  compatibilityVersion: ContractVersion.optional(),
  author: z.string().optional(),
  keywords: z.array(z.string()).default([]),
  sortBy: z
    .enum(['relevance', 'name', 'published', 'updated', 'rating', 'downloads'])
    .default('relevance'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  limit: z.number().nonnegative().max(100).default(20),
  offset: z.number().nonnegative().default(0),
});
export type MarketplaceQuery = z.infer<typeof MarketplaceQuery>;

export const MarketplaceQueryResult = z.object({
  query: MarketplaceQuery,
  total: z.number().nonnegative(),
  hasMore: z.boolean(),
  items: z.array(z.union([MarketplaceRunner, MarketplaceConnector])),
  facets: z.object({
    categories: z.record(z.number()).default({}),
    trustLevels: z.record(z.number()).default({}),
    connectorTypes: z.record(z.number()).default({}),
    status: z.record(z.number()).default({}),
  }),
});
export type MarketplaceQueryResult = z.infer<typeof MarketplaceQueryResult>;

export const SubmissionRequirements = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string(),
  author: z.object({
    name: z.string(),
    email: z.string().email(),
  }),
  license: z.string(),
  repository: z.object({
    url: z.string().url(),
  }),
  contractCompliant: z.boolean(),
  testCoverage: z.object({
    unit: z.number().min(0).max(100),
    integration: z.number().min(0).max(100),
    contract: z.number().min(0).max(100),
  }),
  documentation: z.object({
    readme: z.boolean(),
    api: z.boolean(),
    examples: z.boolean(),
    changelog: z.boolean(),
  }),
  securityScan: z.object({
    passed: z.boolean(),
    criticalIssues: z.number().nonnegative(),
    highIssues: z.number().nonnegative(),
  }),
  validation: z.object({
    schemaValid: z.boolean(),
    testsPassing: z.boolean(),
    noBreakingChanges: z.boolean(),
    compatibleWithLatest: z.boolean(),
  }),
});
export type SubmissionRequirements = z.infer<typeof SubmissionRequirements>;

export function createEmptyMarketplaceIndex(): MarketplaceIndex {
  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    schema: {
      version: '1.0.0',
      url: 'https://schemas.controlplane.io/marketplace/v1',
    },
    system: {
      name: 'ControlPlane',
      version: '1.0.0',
      environment: 'development',
    },
    stats: {
      totalRunners: 0,
      totalConnectors: 0,
      totalCapabilities: 0,
      verifiedCount: 0,
      pendingReviewCount: 0,
      deprecatedCount: 0,
      categories: {},
      connectorTypes: {},
    },
    runners: [],
    connectors: [],
    filters: {
      categories: [
        'ops',
        'finops',
        'support',
        'growth',
        'analytics',
        'security',
        'infrastructure',
        'custom',
      ],
      connectorTypes: [
        'database',
        'queue',
        'storage',
        'api',
        'webhook',
        'stream',
        'cache',
        'messaging',
      ],
      trustLevels: ['verified', 'community', 'unverified'],
      licenseTypes: ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'GPL-3.0', 'Proprietary', 'Other'],
    },
  };
}

export function createDefaultTrustSignals(): MarketplaceTrustSignals {
  return {
    overallTrust: 'unverified',
    contractTestStatus: 'not_tested',
    verificationMethod: 'community_verified',
    securityScanStatus: 'not_scanned',
    securityScanDetails: {
      vulnerabilities: [],
    },
    maintainerReputation: 'unknown',
    downloadCount: 0,
    rating: {
      count: 0,
    },
  };
}
