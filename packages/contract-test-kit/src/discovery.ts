import {
  CapabilityRegistry,
  RegisteredRunner,
  ConnectorInstance,
  RunnerCategory,
  RunnerCategoryDescriptions,
  createEmptyRegistry,
  PredefinedConnectors,
  TruthCoreCompatibility,
  CONTRACT_VERSION_CURRENT,
} from '@controlplane/contracts';
import { glob } from 'glob';
import { readFile, access } from 'fs/promises';
import { join } from 'path';

export interface DiscoveryOptions {
  workspaceRoot: string;
  environment?: 'development' | 'staging' | 'production';
  includeOffline?: boolean;
}

export interface DiscoveryResult {
  registry: CapabilityRegistry;
  errors: string[];
  warnings: string[];
}

interface PackageManifest {
  name: string;
  version: string;
  controlplane?: {
    runner?: {
      category?: string;
      capabilities?: string[];
      connectors?: string[];
    };
  };
}

// LRU Cache for package.json reads
class PackageCache {
  private cache = new Map<string, { content: string; mtime: number }>();
  private maxSize = 50;

  async get(pkgPath: string): Promise<string | null> {
    try {
      const stats = await import('fs/promises').then((fs) => fs.stat(pkgPath));
      const cached = this.cache.get(pkgPath);

      if (cached && cached.mtime === stats.mtimeMs) {
        return cached.content;
      }

      const content = await readFile(pkgPath, 'utf-8');

      // Evict oldest if at capacity
      if (this.cache.size >= this.maxSize) {
        const firstKey = this.cache.keys().next().value;
        if (firstKey !== undefined) {
          this.cache.delete(firstKey);
        }
      }

      this.cache.set(pkgPath, { content, mtime: stats.mtimeMs });
      return content;
    } catch {
      return null;
    }
  }
}

const packageCache = new PackageCache();

/**
 * Check if file exists asynchronously
 */
async function existsAsync(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Batch process an array with concurrency limit
 */
async function batchProcess<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency = 5
): Promise<{ results: R[]; errors: string[] }> {
  const results: R[] = [];
  const errors: string[] = [];

  // Process in chunks
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const chunkResults = await Promise.allSettled(chunk.map(processor));

    for (const result of chunkResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        errors.push(String(result.reason));
      }
    }
  }

  return { results, errors };
}

/**
 * Discover all runners from the workspace
 */
export async function discoverRunners(
  options: DiscoveryOptions
): Promise<{ runners: RegisteredRunner[]; errors: string[] }> {
  const runners: RegisteredRunner[] = [];
  const errors: string[] = [];

  try {
    // Look for runner manifests in services directory - async glob
    const servicePaths = await glob('services/*/package.json', {
      cwd: options.workspaceRoot,
      absolute: true,
    });

    // Process service packages in parallel with batching
    const processServicePackage = async (pkgPath: string): Promise<RegisteredRunner | null> => {
      const content = await packageCache.get(pkgPath);
      if (!content) return null;

      const pkg: PackageManifest = JSON.parse(content);

      // Check if this is a runner package
      if (pkg.controlplane?.runner) {
        const runnerConfig = pkg.controlplane.runner;
        const category = (runnerConfig.category as RunnerCategory) || 'custom';

        // Create a mock runner metadata (in production, this would come from the actual service)
        const runner: RegisteredRunner = {
          metadata: {
            id: `${pkg.name}-${Date.now()}`,
            name: pkg.name,
            version: pkg.version,
            contractVersion: CONTRACT_VERSION_CURRENT,
            capabilities: [], // Would be populated from actual runner
            supportedContracts: ['1.0.0'],
            healthCheckEndpoint: `http://localhost:3000/health`,
            registeredAt: new Date().toISOString(),
            lastHeartbeatAt: new Date().toISOString(),
            status: 'healthy',
            tags: [category],
          },
          category,
          connectors: runnerConfig.connectors || [],
          health: {
            status: 'healthy',
            activeJobs: 0,
            queuedJobs: 0,
          },
          capabilities: [],
        };

        return runner;
      }
      return null;
    };

    const serviceResults = await batchProcess(servicePaths, processServicePackage, 5);
    runners.push(...serviceResults.results.filter((r): r is RegisteredRunner => r !== null));
    errors.push(...serviceResults.errors.map((e) => `Failed to process service manifest: ${e}`));

    // Also check for runner declarations in packages - async glob
    const packagePaths = await glob('packages/*/package.json', {
      cwd: options.workspaceRoot,
      absolute: true,
    });

    const processPackage = async (pkgPath: string): Promise<RegisteredRunner | null> => {
      const content = await packageCache.get(pkgPath);
      if (!content) return null;

      const pkg: PackageManifest = JSON.parse(content);

      // Skip the contracts and test-kit packages themselves
      if (
        pkg.name === '@controlplane/contracts' ||
        pkg.name === '@controlplane/contract-test-kit'
      ) {
        return null;
      }

      // Check for runner configuration
      if (pkg.controlplane?.runner) {
        const runnerConfig = pkg.controlplane.runner;
        const category = (runnerConfig.category as RunnerCategory) || 'custom';

        const runner: RegisteredRunner = {
          metadata: {
            id: `${pkg.name}-local`,
            name: pkg.name,
            version: pkg.version,
            contractVersion: CONTRACT_VERSION_CURRENT,
            capabilities: [],
            supportedContracts: ['1.0.0'],
            healthCheckEndpoint: 'http://localhost:3000/health',
            registeredAt: new Date().toISOString(),
            lastHeartbeatAt: new Date().toISOString(),
            status: 'offline',
            tags: [category, 'package'],
          },
          category,
          connectors: runnerConfig.connectors || [],
          health: {
            status: options.includeOffline ? 'offline' : 'healthy',
            activeJobs: 0,
            queuedJobs: 0,
          },
          capabilities: [],
        };

        return runner;
      }
      return null;
    };

    const packageResults = await batchProcess(packagePaths, processPackage, 5);
    runners.push(...packageResults.results.filter((r): r is RegisteredRunner => r !== null));
    errors.push(...packageResults.errors.map((e) => `Failed to process package manifest: ${e}`));
  } catch (error) {
    errors.push(`Failed to discover runners: ${error}`);
  }

  return { runners, errors };
}

/**
 * Discover connectors from configuration
 */
export async function discoverConnectors(
  options: DiscoveryOptions
): Promise<{ connectors: ConnectorInstance[]; errors: string[] }> {
  const connectors: ConnectorInstance[] = [];
  const errors: string[] = [];

  try {
    // Look for connector configuration files
    const configPaths = [
      join(options.workspaceRoot, 'config', 'connectors.json'),
      join(options.workspaceRoot, '.env'),
    ];

    // Check for environment-based connectors in parallel
    const connectorResults = await Promise.allSettled(
      configPaths.map(async (configPath) => {
        if (await existsAsync(configPath)) {
          if (configPath.endsWith('.json')) {
            const content = await readFile(configPath, 'utf-8');
            const config = JSON.parse(content);

            if (config.connectors && Array.isArray(config.connectors)) {
              return config.connectors
                .map((connConfig: { id: string }) => {
                  const predefined = PredefinedConnectors.find((c) => c.id === connConfig.id);
                  if (predefined) {
                    return {
                      config: predefined,
                      status: 'unknown' as const,
                      metadata: connConfig,
                    };
                  }
                  return null;
                })
                .filter((c: ConnectorInstance | null): c is ConnectorInstance => c !== null);
            }
          }
        }
        return [];
      })
    );

    for (const result of connectorResults) {
      if (result.status === 'fulfilled') {
        connectors.push(...result.value);
      } else {
        errors.push(String(result.reason));
      }
    }

    // If no connectors found, add predefined ones as templates
    if (connectors.length === 0) {
      connectors.push(
        ...PredefinedConnectors.map((predefined) => ({
          config: predefined,
          status: 'unknown' as const,
          metadata: {},
        }))
      );
    }
  } catch (error) {
    errors.push(`Failed to discover connectors: ${error}`);
  }

  return { connectors, errors };
}

/**
 * Get TruthCore compatibility information
 */
export function getTruthCoreCompatibility(): TruthCoreCompatibility {
  return {
    contractVersion: CONTRACT_VERSION_CURRENT,
    supportedVersions: {
      min: { major: 1, minor: 0, patch: 0 },
      max: { major: 1, minor: 0, patch: 999 },
    },
    features: ['assertions', 'queries', 'subscriptions', 'batch-operations'],
    breakingChanges: [],
    deprecatedFeatures: [],
  };
}

/**
 * Build the complete capability registry
 */
export async function buildCapabilityRegistry(options: DiscoveryOptions): Promise<DiscoveryResult> {
  const registry = createEmptyRegistry();
  const errors: string[] = [];
  const warnings: string[] = [];

  // Set system info
  registry.system.environment = options.environment || 'development';

  // Set TruthCore compatibility
  registry.truthcore = getTruthCoreCompatibility();

  // Discover runners and connectors in parallel
  const [{ runners, errors: runnerErrors }, { connectors, errors: connectorErrors }] =
    await Promise.all([discoverRunners(options), discoverConnectors(options)]);

  registry.runners = runners;
  registry.connectors = connectors;
  errors.push(...runnerErrors, ...connectorErrors);

  // Calculate summary
  registry.summary = {
    totalRunners: runners.length,
    totalCapabilities: runners.reduce((sum, r) => sum + r.capabilities.length, 0),
    totalConnectors: connectors.length,
    healthyRunners: runners.filter((r) => r.health.status === 'healthy').length,
    healthyConnectors: connectors.filter((c) => c.status === 'connected').length,
    categories: runners.reduce(
      (acc, r) => {
        acc[r.category] = (acc[r.category] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    ),
  };

  // Update timestamp
  registry.generatedAt = new Date().toISOString();

  return { registry, errors, warnings };
}

/**
 * Filter registry by query parameters
 */
export function filterRegistry(
  registry: CapabilityRegistry,
  filters: {
    category?: RunnerCategory;
    healthStatus?: 'healthy' | 'degraded' | 'unhealthy' | 'offline' | 'any';
  }
): CapabilityRegistry {
  const filtered = { ...registry };

  if (filters.category) {
    filtered.runners = filtered.runners.filter((r) => r.category === filters.category);
  }

  if (filters.healthStatus && filters.healthStatus !== 'any') {
    filtered.runners = filtered.runners.filter((r) => r.health.status === filters.healthStatus);
  }

  // Recalculate summary
  filtered.summary = {
    totalRunners: filtered.runners.length,
    totalCapabilities: filtered.runners.reduce((sum, r) => sum + r.capabilities.length, 0),
    totalConnectors: filtered.connectors.length,
    healthyRunners: filtered.runners.filter((r) => r.health.status === 'healthy').length,
    healthyConnectors: filtered.connectors.filter((c) => c.status === 'connected').length,
    categories: filtered.runners.reduce(
      (acc, r) => {
        acc[r.category] = (acc[r.category] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    ),
  };

  return filtered;
}

/**
 * Format registry for output
 */
export function formatRegistryOutput(
  registry: CapabilityRegistry,
  format: 'json' | 'yaml' | 'table' = 'json'
): string {
  switch (format) {
    case 'json':
      return JSON.stringify(registry, null, 2);

    case 'yaml':
      // Simple YAML-like formatting
      return `# ControlPlane Capability Registry
# Generated: ${registry.generatedAt}
# Version: ${registry.version}

system:
  name: ${registry.system.name}
  version: ${registry.system.version}
  environment: ${registry.system.environment}

truthcore:
  contractVersion: ${registry.truthcore.contractVersion.major}.${registry.truthcore.contractVersion.minor}.${registry.truthcore.contractVersion.patch}
  features:
${registry.truthcore.features.map((f) => `    - ${f}`).join('\n')}

runners:
${registry.runners
  .map(
    (r) => `  - name: ${r.metadata.name}
    category: ${r.category}
    status: ${r.health.status}
    connectors: [${r.connectors.join(', ')}]`
  )
  .join('\n')}

connectors:
${registry.connectors
  .map(
    (c) => `  - id: ${c.config.id}
    name: ${c.config.name}
    type: ${c.config.type}
    status: ${c.status}`
  )
  .join('\n')}

summary:
  totalRunners: ${registry.summary.totalRunners}
  totalCapabilities: ${registry.summary.totalCapabilities}
  totalConnectors: ${registry.summary.totalConnectors}
  healthyRunners: ${registry.summary.healthyRunners}
  healthyConnectors: ${registry.summary.healthyConnectors}
`;

    case 'table':
    default:
      return JSON.stringify(registry, null, 2);
  }
}

// Export category descriptions
export { RunnerCategoryDescriptions };
