import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Deterministic Module Discovery and Registry
 *
 * Provides:
 * - Explicit search paths with stable ordering
 * - Load-time validation of all modules
 * - Centralized discovery logic
 * - JSON/text registry reports
 */

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface VersionedManifest {
  name: string;
  version: string;
  description: string;
  entrypoint: {
    command: string;
    args: string[];
    env?: Record<string, string>;
    workingDir?: string;
  };
  contractVersion?: string;
  capabilities?: string[];
  requiredEnv?: string[];
  outputs?: string[];
}

export interface DiscoveredModule {
  manifest: VersionedManifest;
  source: {
    path: string;
    type: 'runners' | 'cache' | 'sibling' | 'custom';
    discoveredAt: string;
  };
  status: 'valid' | 'invalid' | 'incompatible' | 'unreachable' | 'disabled';
  validation: {
    schemaValid: boolean;
    versionCompatible: boolean;
    entrypointExists: boolean;
    requiredEnvPresent: boolean;
    errors: string[];
  };
  lastValidatedAt: string;
}

export interface RegistryState {
  version: string;
  generatedAt: string;
  modules: DiscoveredModule[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
    incompatible: number;
    unreachable: number;
    disabled: number;
  };
}

export interface DiscoveryConfig {
  /** Explicit search paths (in priority order) */
  paths: string[];

  /** Discovery options */
  options: {
    /** Follow symbolic links */
    followSymlinks: boolean;

    /** Maximum directory depth */
    maxDepth: number;

    /** Include hidden directories */
    includeHidden: boolean;

    /** Cache results */
    cache: boolean;

    /** Cache TTL in milliseconds */
    cacheTtlMs: number;
  };

  /** Validation configuration */
  validation: {
    /** Strict mode - fail on any validation error */
    strict: boolean;

    /** Validate schema compatibility */
    validateSchema: boolean;

    /** Check entrypoint exists */
    checkEntrypoint: boolean;

    /** Check required environment variables */
    checkRequiredEnv: boolean;

    /** Minimum contract version required */
    minimumContractVersion?: string;
  };
}

export interface RegistryReportOptions {
  format: 'json' | 'text' | 'markdown';
  includeErrors: boolean;
  includeWarnings: boolean;
  verbose: boolean;
}

// ============================================================================
// Default Discovery Configuration
// ============================================================================

export const DEFAULT_DISCOVERY_CONFIG: DiscoveryConfig = {
  paths: [
    // Primary: runners directory (relative to repo root)
    './runners',

    // Secondary: cached repositories
    './.cache/repos',
  ],

  options: {
    followSymlinks: false,
    maxDepth: 2,
    includeHidden: false,
    cache: true,
    cacheTtlMs: 60000, // 1 minute
  },

  validation: {
    strict: false,
    validateSchema: true,
    checkEntrypoint: true,
    checkRequiredEnv: false,
    minimumContractVersion: '1.0.0',
  },
};

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates a manifest against the versioned schema
 */
export function validateManifest(
  data: unknown,
  config: DiscoveryConfig['validation']
): { valid: boolean; errors: string[]; manifest?: VersionedManifest } {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    errors.push('Manifest must be an object');
    return { valid: false, errors };
  }

  const manifest = data as Record<string, unknown>;

  // Required fields
  if (!manifest.name || typeof manifest.name !== 'string') {
    errors.push('name is required and must be a string');
  } else if (!/^[a-z0-9-]+$/.test(manifest.name)) {
    errors.push('name must be lowercase alphanumeric with hyphens only');
  }

  if (!manifest.version || typeof manifest.version !== 'string') {
    errors.push('version is required and must be a string');
  } else if (!isValidSemver(manifest.version)) {
    errors.push('version must be valid semver (e.g., "1.0.0")');
  }

  if (!manifest.description || typeof manifest.description !== 'string') {
    errors.push('description is required and must be a string');
  }

  if (!manifest.entrypoint || typeof manifest.entrypoint !== 'object') {
    errors.push('entrypoint is required and must be an object');
  } else {
    const entrypoint = manifest.entrypoint as Record<string, unknown>;
    if (!entrypoint.command || typeof entrypoint.command !== 'string') {
      errors.push('entrypoint.command is required');
    }
  }

  if (errors.length > 0 && config.strict) {
    return { valid: false, errors };
  }

  // Version compatibility check
  if (config.minimumContractVersion && config.validateSchema) {
    const contractVersion = (manifest.contractVersion as string) || '1.0.0';
    if (!isVersionCompatible(contractVersion, config.minimumContractVersion)) {
      errors.push(
        `Contract version ${contractVersion} is not compatible ` +
          `with minimum required ${config.minimumContractVersion}`
      );
    }
  }

  // Validate capabilities if present
  if (manifest.capabilities && !Array.isArray(manifest.capabilities)) {
    errors.push('capabilities must be an array');
  }

  // Validate requiredEnv if present
  if (manifest.requiredEnv && !Array.isArray(manifest.requiredEnv)) {
    errors.push('requiredEnv must be an array');
  }

  return {
    valid: errors.length === 0,
    errors,
    manifest: manifest as unknown as VersionedManifest,
  };
}

/**
 * Validate semantic version format
 */
function isValidSemver(version: string): boolean {
  return /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[\w.-]+)?(?:\+[\w.-]+)?$/.test(version);
}

/**
 * Check if a version meets minimum requirements
 */
function isVersionCompatible(version: string, minimum: string): boolean {
  const vParts = version.split('.').map(Number);
  const mParts = minimum.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const v = vParts[i] || 0;
    const m = mParts[i] || 0;

    if (v > m) return true;
    if (v < m) return false;
  }

  return true;
}

/**
 * Check if required environment variables are present
 */
export function checkRequiredEnv(required: string[]): {
  present: boolean;
  missing: string[];
} {
  const missing = required.filter((env) => !process.env[env]);

  return {
    present: missing.length === 0,
    missing,
  };
}

// ============================================================================
// Deterministic Discovery
// ============================================================================

/**
 * Discover modules from configured paths with deterministic ordering
 */
export function discoverModules(
  repoRoot: string,
  config: DiscoveryConfig = DEFAULT_DISCOVERY_CONFIG
): DiscoveredModule[] {
  const modules: DiscoveredModule[] = [];
  const seen = new Set<string>();

  for (const searchPath of config.paths) {
    const fullPath = resolve(repoRoot, searchPath);

    try {
      const entries = readdirSync(fullPath, { withFileTypes: true });

      // Sort entries for deterministic ordering
      const sortedEntries = entries
        .filter((entry) => config.options.includeHidden || !entry.name.startsWith('.'))
        .sort((a, b) => a.name.localeCompare(b.name));

      for (const entry of sortedEntries) {
        if (!entry.isDirectory()) continue;

        const manifestPath = join(fullPath, entry.name, 'runner.manifest.json');

        try {
          const stat = statSync(manifestPath);
          if (!stat.isFile()) continue;

          // Prevent duplicates
          if (seen.has(entry.name)) continue;
          seen.add(entry.name);

          // Load and validate manifest
          const content = readFileSync(manifestPath, 'utf-8');
          const data = JSON.parse(content);

          const validation = validateManifest(data, config.validation);

          // Check entrypoint exists
          let entrypointExists = false;
          if (validation.manifest?.entrypoint?.command) {
            // Simple check - just verify it's not empty
            entrypointExists = validation.manifest.entrypoint.command.length > 0;
          }

          // Check required env
          const envCheck = validation.manifest?.requiredEnv
            ? checkRequiredEnv(validation.manifest.requiredEnv)
            : { present: true, missing: [] };

          const status: DiscoveredModule['status'] = validation.valid
            ? 'valid'
            : config.validation.strict
              ? 'invalid'
              : validation.errors.some((e) => e.includes('version'))
                ? 'incompatible'
                : 'invalid';

          const module: DiscoveredModule = {
            manifest: validation.manifest || (data as VersionedManifest),
            source: {
              path: manifestPath,
              type: searchPath.includes('cache')
                ? 'cache'
                : searchPath.includes('runners')
                  ? 'runners'
                  : 'custom',
              discoveredAt: new Date().toISOString(),
            },
            status,
            validation: {
              schemaValid: validation.errors.length === 0,
              versionCompatible: !validation.errors.some((e) => e.includes('version')),
              entrypointExists,
              requiredEnvPresent: envCheck.present,
              errors: validation.errors,
            },
            lastValidatedAt: new Date().toISOString(),
          };

          modules.push(module);
        } catch {
          // Manifest doesn't exist or is invalid
          continue;
        }
      }
    } catch {
      // Path doesn't exist or isn't readable
      continue;
    }
  }

  return modules;
}

// ============================================================================
// Registry State Management
// ============================================================================

/**
 * Build complete registry state from discovered modules
 */
export function buildRegistryState(modules: DiscoveredModule[]): RegistryState {
  const summary = {
    total: modules.length,
    valid: modules.filter((m) => m.status === 'valid').length,
    invalid: modules.filter((m) => m.status === 'invalid').length,
    incompatible: modules.filter((m) => m.status === 'incompatible').length,
    unreachable: modules.filter((m) => m.status === 'unreachable').length,
    disabled: modules.filter((m) => m.status === 'disabled').length,
  };

  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    modules,
    summary,
  };
}

// ============================================================================
// Registry Report Generation
// ============================================================================

export function generateRegistryReport(
  state: RegistryState,
  options: RegistryReportOptions
): string {
  switch (options.format) {
    case 'json':
      return generateJsonReport(state, options);
    case 'text':
      return generateTextReport(state, options);
    case 'markdown':
      return generateMarkdownReport(state, options);
    default:
      throw new Error(`Unknown report format: ${options.format}`);
  }
}

function generateJsonReport(state: RegistryState, options: RegistryReportOptions): string {
  const report = {
    generatedAt: new Date().toISOString(),
    summary: state.summary,
    modules: state.modules.map((m: DiscoveredModule) => ({
      name: m.manifest.name,
      version: m.manifest.version,
      status: m.status,
      source: m.source,
      ...(options.includeErrors && m.validation.errors.length > 0
        ? { errors: m.validation.errors }
        : {}),
    })),
    ...(options.verbose ? { version: state.version, generatedAt: state.generatedAt } : {}),
  };

  return JSON.stringify(report, null, 2);
}

function generateTextReport(state: RegistryState, options: RegistryReportOptions): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('Module Registry Report');
  lines.push('======================');
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push('');

  // Summary
  lines.push('Summary');
  lines.push('-------');
  lines.push(`Total Modules: ${state.summary.total}`);
  lines.push(`  ✅ Valid: ${state.summary.valid}`);
  lines.push(`  ❌ Invalid: ${state.summary.invalid}`);
  lines.push(`  ⚠️  Incompatible: ${state.summary.incompatible}`);
  lines.push(`  🔴 Unreachable: ${state.summary.unreachable}`);
  lines.push(`  ⏸️  Disabled: ${state.summary.disabled}`);
  lines.push('');

  // Module details
  lines.push('Modules');
  lines.push('-------');

  for (const module of state.modules) {
    const icon = getStatusIcon(module.status);
    lines.push(`${icon} ${module.manifest.name}@${module.manifest.version}`);

    if (options.verbose) {
      lines.push(`   Source: ${module.source.type} (${module.source.path})`);
      lines.push(`   Capabilities: ${module.manifest.capabilities?.join(', ') || 'none'}`);
    }

    if (options.includeErrors && module.validation.errors.length > 0) {
      for (const error of module.validation.errors) {
        lines.push(`   ⚠️  ${error}`);
      }
    }
  }

  lines.push('');

  return lines.join('\n');
}

function generateMarkdownReport(state: RegistryState, _options: RegistryReportOptions): string {
  const lines: string[] = [];

  lines.push('# Module Registry Report');
  lines.push('');
  lines.push(`**Generated:** ${new Date().toLocaleString()}`);
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Count |');
  lines.push('|--------|-------|');
  lines.push(`| Total Modules | ${state.summary.total} |`);
  lines.push(`| ✅ Valid | ${state.summary.valid} |`);
  lines.push(`| ❌ Invalid | ${state.summary.invalid} |`);
  lines.push(`| ⚠️ Incompatible | ${state.summary.incompatible} |`);
  lines.push(`| 🔴 Unreachable | ${state.summary.unreachable} |`);
  lines.push(`| ⏸️ Disabled | ${state.summary.disabled} |`);
  lines.push('');

  // Module details
  lines.push('## Modules');
  lines.push('');
  lines.push('| Name | Version | Status | Source |');
  lines.push('|------|---------|--------|--------|');

  for (const module of state.modules) {
    const icon = getStatusIcon(module.status);
    lines.push(
      `| ${module.manifest.name} | ${module.manifest.version} | ` +
        `${icon} ${module.status} | ${module.source.type} |`
    );
  }

  lines.push('');

  return lines.join('\n');
}

function getStatusIcon(status: DiscoveredModule['status']): string {
  switch (status) {
    case 'valid':
      return '✅';
    case 'invalid':
      return '❌';
    case 'incompatible':
      return '⚠️';
    case 'unreachable':
      return '🔴';
    case 'disabled':
      return '⏸️';
    default:
      return '❓';
  }
}

// ============================================================================
// Registry Cache
// ============================================================================

export class RegistryCache {
  private cache: Map<string, { state: RegistryState; expiresAt: number }> = new Map();
  private defaultTtlMs: number;

  constructor(defaultTtlMs: number = 60000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  get(key: string): RegistryState | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.state;
  }

  set(key: string, state: RegistryState, ttlMs?: number): void {
    const expiresAt = Date.now() + (ttlMs || this.defaultTtlMs);
    this.cache.set(key, { state, expiresAt });
  }

  invalidate(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  isValid(key: string): boolean {
    const entry = this.cache.get(key);
    return entry !== undefined && Date.now() <= entry.expiresAt;
  }
}

// Export singleton instance
export const registryCache = new RegistryCache();
