import { z } from 'zod';
import { ContractVersion, ContractRange } from '../versioning/index.js';
import { RunnerCapability, RunnerMetadata } from './runners.js';

export const ConnectorType = z.enum([
  'database',
  'queue',
  'storage',
  'api',
  'webhook',
  'stream',
  'cache',
  'messaging',
]);
export type ConnectorType = z.infer<typeof ConnectorType>;

export const ConnectorConfig = z.object({
  id: z.string(),
  name: z.string(),
  type: ConnectorType,
  version: z.string(),
  description: z.string(),
  configSchema: z.record(z.unknown()),
  required: z.boolean().default(false),
  healthCheckable: z.boolean().default(true),
});
export type ConnectorConfig = z.infer<typeof ConnectorConfig>;

export const ConnectorStatus = z.enum(['connected', 'disconnected', 'error', 'unknown']);
export type ConnectorStatus = z.infer<typeof ConnectorStatus>;

export const ConnectorInstance = z.object({
  config: ConnectorConfig,
  status: ConnectorStatus,
  lastConnectedAt: z.string().datetime().optional(),
  lastErrorAt: z.string().datetime().optional(),
  errorMessage: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type ConnectorInstance = z.infer<typeof ConnectorInstance>;

export const RunnerCategory = z.enum([
  'ops',
  'finops',
  'support',
  'growth',
  'analytics',
  'security',
  'infrastructure',
  'custom',
]);
export type RunnerCategory = z.infer<typeof RunnerCategory>;

export const RegisteredRunner = z.object({
  metadata: RunnerMetadata,
  category: RunnerCategory,
  connectors: z.array(z.string()),
  health: z.object({
    status: z.enum(['healthy', 'degraded', 'unhealthy', 'offline']),
    lastHeartbeat: z.string().datetime().optional(),
    activeJobs: z.number().int().nonnegative().default(0),
    queuedJobs: z.number().int().nonnegative().default(0),
  }),
  capabilities: z.array(RunnerCapability),
});
export type RegisteredRunner = z.infer<typeof RegisteredRunner>;

export const TruthCoreCompatibility = z.object({
  contractVersion: ContractVersion,
  supportedVersions: ContractRange,
  features: z.array(z.string()).default([]),
  breakingChanges: z.array(z.string()).default([]),
  deprecatedFeatures: z.array(z.string()).default([]),
});
export type TruthCoreCompatibility = z.infer<typeof TruthCoreCompatibility>;

export const CapabilityRegistry = z.object({
  version: z.string(),
  generatedAt: z.string().datetime(),
  system: z.object({
    name: z.string(),
    version: z.string(),
    environment: z.enum(['development', 'staging', 'production']),
  }),
  truthcore: TruthCoreCompatibility,
  runners: z.array(RegisteredRunner),
  connectors: z.array(ConnectorInstance),
  summary: z.object({
    totalRunners: z.number().int().nonnegative(),
    totalCapabilities: z.number().int().nonnegative(),
    totalConnectors: z.number().int().nonnegative(),
    healthyRunners: z.number().int().nonnegative(),
    healthyConnectors: z.number().int().nonnegative(),
    categories: z.record(z.number().int().nonnegative()),
  }),
});
export type CapabilityRegistry = z.infer<typeof CapabilityRegistry>;

export const RegistryQuery = z.object({
  category: RunnerCategory.optional(),
  connectorType: ConnectorType.optional(),
  healthStatus: z.enum(['healthy', 'degraded', 'unhealthy', 'offline', 'any']).default('any'),
  includeCapabilities: z.boolean().default(true),
  includeConnectors: z.boolean().default(true),
});
export type RegistryQuery = z.infer<typeof RegistryQuery>;

export const RegistryDiff = z.object({
  added: z.array(
    z.object({
      type: z.enum(['runner', 'connector', 'capability']),
      id: z.string(),
      data: z.unknown(),
    })
  ),
  removed: z.array(
    z.object({
      type: z.enum(['runner', 'connector', 'capability']),
      id: z.string(),
    })
  ),
  modified: z.array(
    z.object({
      type: z.enum(['runner', 'connector', 'capability']),
      id: z.string(),
      changes: z.record(
        z.object({
          old: z.unknown(),
          new: z.unknown(),
        })
      ),
    })
  ),
  timestamp: z.string().datetime(),
  previousChecksum: z.string(),
  currentChecksum: z.string(),
});
export type RegistryDiff = z.infer<typeof RegistryDiff>;

// Predefined connector configurations
export const PredefinedConnectors: ConnectorConfig[] = [
  {
    id: 'redis',
    name: 'Redis',
    type: 'cache',
    version: '1.0.0',
    description: 'Redis cache and queue connector',
    configSchema: {
      type: 'object',
      properties: {
        host: { type: 'string' },
        port: { type: 'number' },
        password: { type: 'string' },
        db: { type: 'number' },
      },
      required: ['host', 'port'],
    },
    required: true,
    healthCheckable: true,
  },
  {
    id: 'postgresql',
    name: 'PostgreSQL',
    type: 'database',
    version: '1.0.0',
    description: 'PostgreSQL database connector',
    configSchema: {
      type: 'object',
      properties: {
        host: { type: 'string' },
        port: { type: 'number' },
        database: { type: 'string' },
        username: { type: 'string' },
        password: { type: 'string' },
      },
      required: ['host', 'port', 'database'],
    },
    required: true,
    healthCheckable: true,
  },
  {
    id: 's3',
    name: 'S3 Storage',
    type: 'storage',
    version: '1.0.0',
    description: 'AWS S3 compatible storage connector',
    configSchema: {
      type: 'object',
      properties: {
        endpoint: { type: 'string' },
        bucket: { type: 'string' },
        region: { type: 'string' },
        accessKeyId: { type: 'string' },
        secretAccessKey: { type: 'string' },
      },
      required: ['bucket'],
    },
    required: false,
    healthCheckable: true,
  },
  {
    id: 'kafka',
    name: 'Kafka',
    type: 'stream',
    version: '1.0.0',
    description: 'Apache Kafka streaming connector',
    configSchema: {
      type: 'object',
      properties: {
        brokers: { type: 'array', items: { type: 'string' } },
        clientId: { type: 'string' },
        groupId: { type: 'string' },
      },
      required: ['brokers'],
    },
    required: false,
    healthCheckable: true,
  },
  {
    id: 'webhook',
    name: 'Webhook',
    type: 'webhook',
    version: '1.0.0',
    description: 'Generic webhook connector',
    configSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', format: 'uri' },
        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'] },
        headers: { type: 'object' },
        timeout: { type: 'number' },
      },
      required: ['url'],
    },
    required: false,
    healthCheckable: false,
  },
];

// Predefined runner categories with descriptions
export const RunnerCategoryDescriptions: Record<RunnerCategory, string> = {
  ops: 'Operations runners - handle infrastructure and operational tasks',
  finops: 'FinOps runners - manage cost optimization and financial operations',
  support: 'Support runners - handle customer support and ticketing',
  growth: 'Growth runners - manage marketing and growth experiments',
  analytics: 'Analytics runners - process data and generate insights',
  security: 'Security runners - handle security scanning and compliance',
  infrastructure: 'Infrastructure runners - manage cloud resources',
  custom: 'Custom runners - specialized domain-specific capabilities',
};

// Helper function to create an empty registry
export function createEmptyRegistry(): CapabilityRegistry {
  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    system: {
      name: 'ControlPlane',
      version: '1.0.0',
      environment: 'development',
    },
    truthcore: {
      contractVersion: { major: 1, minor: 0, patch: 0 },
      supportedVersions: {
        min: { major: 1, minor: 0, patch: 0 },
      },
      features: [],
      breakingChanges: [],
      deprecatedFeatures: [],
    },
    runners: [],
    connectors: [],
    summary: {
      totalRunners: 0,
      totalCapabilities: 0,
      totalConnectors: 0,
      healthyRunners: 0,
      healthyConnectors: 0,
      categories: {},
    },
  };
}

// Helper function to calculate registry checksum
export function calculateRegistryChecksum(registry: CapabilityRegistry): string {
  // Simple hash of the registry content
  const content = JSON.stringify({
    runners: registry.runners.map((r) => r.metadata.id).sort(),
    connectors: registry.connectors.map((c) => c.config.id).sort(),
    version: registry.version,
  });

  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  return Math.abs(hash).toString(16).padStart(8, '0');
}
