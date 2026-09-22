import { readFileSync, writeFileSync } from 'node:fs';
import type { RegistryState } from '../registry/hardened.js';
import {
  discoverModules,
  buildRegistryState,
  DEFAULT_DISCOVERY_CONFIG,
} from '../registry/hardened.js';
import { createLogger, CorrelationManager } from '@controlplane/observability';

// Initialize observability for drift detection
const correlation = new CorrelationManager();
const logger = createLogger({
  service: 'controlplane-drift',
  version: '1.0.0',
  level: 'info',
});

/**
 * Ecosystem Drift Detector
 *
 * Detects drift between expected and actual module configurations.
 * This is the "money feature" for ecosystem integrity.
 */

// ============================================================================
// Types
// ============================================================================

export interface DriftConfig {
  /** Baseline to compare against */
  baseline?: {
    path: string;
    version: string;
  };

  /** Detection options */
  detect: {
    missingModules: boolean;
    unexpectedModules: boolean;
    versionMismatch: boolean;
    schemaMismatch: boolean;
    manifestInvalid: boolean;
    missingCommands: boolean;
    missingExports: boolean;
    removedCapabilities: boolean;
    configDrift: boolean;
  };

  /** Severity thresholds */
  thresholds: {
    warning: number;
    critical: number;
  };

  /** Auto-fix options */
  autoFix: {
    enabled: boolean;
    safeOnly: boolean;
  };
}

export interface Drift {
  type: DriftType;
  severity: 'info' | 'warning' | 'error' | 'fatal';
  module: string;
  expected?: unknown;
  actual?: unknown;
  diff?: string;
  hint: string;
  autoFixable: boolean;
}

export type DriftType =
  | 'MISSING_MODULE'
  | 'UNEXPECTED_MODULE'
  | 'VERSION_MISMATCH'
  | 'SCHEMA_MISMATCH'
  | 'MANIFEST_INVALID'
  | 'MISSING_COMMAND'
  | 'MISSING_EXPORT'
  | 'REMOVED_CAPABILITY'
  | 'CONFIG_DRIFT';

export interface DriftReport {
  scanId: string;
  generatedAt: string;
  status: 'healthy' | 'warning' | 'critical';
  drifts: Drift[];
  summary: {
    totalDrifts: number;
    bySeverity: {
      info: number;
      warning: number;
      error: number;
      fatal: number;
    };
    byType: Record<DriftType, number>;
    modulesAffected: number;
    autoFixable: number;
  };
  baseline?: {
    version: string;
    generatedAt: string;
    path: string;
  };
  recommendations: DriftRecommendation[];
}

export interface DriftRecommendation {
  priority: number;
  description: string;
  action: string;
  estimatedEffort: 'low' | 'medium' | 'high';
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_DRIFT_CONFIG: DriftConfig = {
  detect: {
    missingModules: true,
    unexpectedModules: true,
    versionMismatch: true,
    schemaMismatch: true,
    manifestInvalid: true,
    missingCommands: true,
    missingExports: true,
    removedCapabilities: true,
    configDrift: true,
  },
  thresholds: {
    warning: 5,
    critical: 10,
  },
  autoFix: {
    enabled: false,
    safeOnly: true,
  },
};

// ============================================================================
// Drift Detection Functions
// ============================================================================

/**
 * Load baseline registry state
 */
function loadBaseline(path: string): RegistryState | undefined {
  try {
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content) as RegistryState;
  } catch {
    return undefined;
  }
}

/**
 * Detect all drifts between current state and baseline
 */
export function detectDrifts(
  current: RegistryState,
  baseline: RegistryState | undefined,
  config: DriftConfig
): Drift[] {
  const drifts: Drift[] = [];

  if (!baseline) {
    // No baseline - everything is unexpected
    if (config.detect.unexpectedModules) {
      for (const module of current.modules) {
        drifts.push({
          type: 'UNEXPECTED_MODULE',
          severity: 'warning',
          module: module.manifest.name,
          actual: module.manifest,
          hint: `Module ${module.manifest.name} exists but no baseline was found. Create a baseline with: controlplane registry:baseline`,
          autoFixable: false,
        });
      }
    }
    return drifts;
  }

  // Create maps for efficient lookup
  const currentMap = new Map(current.modules.map((m) => [m.manifest.name, m]));
  const baselineMap = new Map(baseline.modules.map((m) => [m.manifest.name, m]));

  // Check for missing modules
  if (config.detect.missingModules) {
    for (const baselineModule of baseline.modules) {
      const name = baselineModule.manifest.name;
      if (!currentMap.has(name)) {
        drifts.push({
          type: 'MISSING_MODULE',
          severity: 'error',
          module: name,
          expected: baselineModule.manifest,
          hint: `Module ${name} is missing. Expected version ${baselineModule.manifest.version}. Re-install or restore from backup.`,
          autoFixable: false,
        });
      }
    }
  }

  // Check for unexpected modules
  if (config.detect.unexpectedModules) {
    for (const currentModule of current.modules) {
      const name = currentModule.manifest.name;
      if (!baselineMap.has(name)) {
        drifts.push({
          type: 'UNEXPECTED_MODULE',
          severity: 'warning',
          module: name,
          actual: currentModule.manifest,
          hint: `Unexpected module ${name}@${currentModule.manifest.version} found. Remove it or add to baseline if intentional.`,
          autoFixable: true,
        });
      }
    }
  }

  // Check for version mismatches
  if (config.detect.versionMismatch) {
    for (const currentModule of current.modules) {
      const name = currentModule.manifest.name;
      const baselineModule = baselineMap.get(name);

      if (baselineModule && baselineModule.manifest.version !== currentModule.manifest.version) {
        const severity = isMajorVersionChange(
          baselineModule.manifest.version,
          currentModule.manifest.version
        )
          ? 'error'
          : 'warning';

        drifts.push({
          type: 'VERSION_MISMATCH',
          severity,
          module: name,
          expected: baselineModule.manifest.version,
          actual: currentModule.manifest.version,
          diff: `Expected: ${baselineModule.manifest.version}, Actual: ${currentModule.manifest.version}`,
          hint:
            severity === 'error'
              ? `Major version mismatch for ${name}. Breaking changes may affect compatibility. Review CHANGELOG.`
              : `Minor/patch version drift for ${name}. Consider updating baseline if intentional.`,
          autoFixable: false,
        });
      }
    }
  }

  // Check for manifest validation issues
  if (config.detect.manifestInvalid) {
    for (const currentModule of current.modules) {
      if (currentModule.status === 'invalid') {
        drifts.push({
          type: 'MANIFEST_INVALID',
          severity: 'error',
          module: currentModule.manifest.name,
          actual: currentModule.validation.errors,
          hint: `Module ${currentModule.manifest.name} has invalid manifest. Fix errors: ${currentModule.validation.errors.join(', ')}`,
          autoFixable: false,
        });
      } else if (currentModule.status === 'incompatible') {
        drifts.push({
          type: 'SCHEMA_MISMATCH',
          severity: 'error',
          module: currentModule.manifest.name,
          actual: currentModule.validation.errors,
          hint: `Module ${currentModule.manifest.name} has incompatible contract version. Update contracts or module.`,
          autoFixable: false,
        });
      }
    }
  }

  // Check for removed capabilities
  if (config.detect.removedCapabilities) {
    for (const currentModule of current.modules) {
      const name = currentModule.manifest.name;
      const baselineModule = baselineMap.get(name);

      if (baselineModule) {
        const baselineCaps = baselineModule.manifest.capabilities || [];
        const currentCaps = currentModule.manifest.capabilities || [];

        const removed = baselineCaps.filter((cap) => !currentCaps.includes(cap));

        if (removed.length > 0) {
          drifts.push({
            type: 'REMOVED_CAPABILITY',
            severity: 'warning',
            module: name,
            expected: baselineCaps,
            actual: currentCaps,
            diff: `Removed: ${removed.join(', ')}`,
            hint: `Module ${name} removed capabilities: ${removed.join(', ')}. Verify this is intentional.`,
            autoFixable: false,
          });
        }
      }
    }
  }

  return drifts;
}

/**
 * Check if version change is a major version change
 */
function isMajorVersionChange(from: string, to: string): boolean {
  const fromMajor = parseInt(from.split('.')[0], 10);
  const toMajor = parseInt(to.split('.')[0], 10);

  return fromMajor !== toMajor || toMajor < fromMajor;
}

// ============================================================================
// Report Generation
// ============================================================================

export function generateDriftReport(
  current: RegistryState,
  drifts: Drift[],
  baseline?: RegistryState,
  config: DriftConfig = DEFAULT_DRIFT_CONFIG
): DriftReport {
  const scanId = generateScanId();

  // Calculate summary
  const bySeverity = {
    info: drifts.filter((d) => d.severity === 'info').length,
    warning: drifts.filter((d) => d.severity === 'warning').length,
    error: drifts.filter((d) => d.severity === 'error').length,
    fatal: drifts.filter((d) => d.severity === 'fatal').length,
  };

  const byType = drifts.reduce(
    (acc, drift) => {
      acc[drift.type] = (acc[drift.type] || 0) + 1;
      return acc;
    },
    {} as Record<DriftType, number>
  );

  const affectedModules = new Set(drifts.map((d) => d.module)).size;
  const autoFixable = drifts.filter((d) => d.autoFixable).length;

  // Determine status
  const totalDrifts = drifts.length;
  let status: DriftReport['status'] = 'healthy';

  if (bySeverity.fatal > 0 || bySeverity.error >= config.thresholds.critical) {
    status = 'critical';
  } else if (bySeverity.error > 0 || totalDrifts >= config.thresholds.warning) {
    status = 'warning';
  }

  // Generate recommendations
  const recommendations = generateRecommendations(drifts);

  return {
    scanId,
    generatedAt: new Date().toISOString(),
    status,
    drifts,
    summary: {
      totalDrifts,
      bySeverity,
      byType,
      modulesAffected: affectedModules,
      autoFixable,
    },
    baseline: baseline
      ? {
          version: baseline.version,
          generatedAt: baseline.generatedAt,
          path: config.baseline?.path || 'unknown',
        }
      : undefined,
    recommendations,
  };
}

function generateScanId(): string {
  return `drift-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateRecommendations(drifts: Drift[]): DriftRecommendation[] {
  const recommendations: DriftRecommendation[] = [];

  // Group by severity
  const fatal = drifts.filter((d) => d.severity === 'fatal');
  const errors = drifts.filter((d) => d.severity === 'error');
  const warnings = drifts.filter((d) => d.severity === 'warning');

  if (fatal.length > 0) {
    recommendations.push({
      priority: 1,
      description: `Address ${fatal.length} fatal drift(s) immediately`,
      action: 'Review fatal errors and restore system to known good state',
      estimatedEffort: 'high',
    });
  }

  if (errors.some((d) => d.type === 'MISSING_MODULE')) {
    recommendations.push({
      priority: 2,
      description: 'Reinstall missing modules',
      action: 'Run: controlplane registry:sync to restore missing modules',
      estimatedEffort: 'low',
    });
  }

  if (errors.some((d) => d.type === 'VERSION_MISMATCH')) {
    recommendations.push({
      priority: 3,
      description: 'Review version mismatches',
      action: 'Check CHANGELOGs for breaking changes and update dependencies',
      estimatedEffort: 'medium',
    });
  }

  if (warnings.some((d) => d.type === 'UNEXPECTED_MODULE')) {
    recommendations.push({
      priority: 4,
      description: 'Review unexpected modules',
      action:
        'Remove unexpected modules or update baseline: controlplane registry:baseline --update',
      estimatedEffort: 'low',
    });
  }

  if (drifts.length === 0) {
    recommendations.push({
      priority: 5,
      description: 'No drifts detected',
      action: 'System is healthy. Continue monitoring.',
      estimatedEffort: 'low',
    });
  }

  return recommendations;
}

// ============================================================================
// Report Formatting
// ============================================================================

export function formatDriftReport(
  report: DriftReport,
  format: 'json' | 'text' | 'markdown'
): string {
  switch (format) {
    case 'json':
      return JSON.stringify(report, null, 2);
    case 'text':
      return formatTextReport(report);
    case 'markdown':
      return formatMarkdownReport(report);
    default:
      throw new Error(`Unknown format: ${format}`);
  }
}

function formatTextReport(report: DriftReport): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('Ecosystem Drift Detection Report');
  lines.push('================================');
  lines.push(`Scan ID: ${report.scanId}`);
  lines.push(`Generated: ${new Date(report.generatedAt).toLocaleString()}`);
  lines.push('');

  // Status
  const statusIcon = report.status === 'healthy' ? '✅' : report.status === 'warning' ? '⚠️' : '🔴';
  lines.push(`Status: ${statusIcon} ${report.status.toUpperCase()}`);
  lines.push('');

  // Summary
  lines.push('Summary');
  lines.push('-------');
  lines.push(`Total Drifts: ${report.summary.totalDrifts}`);
  lines.push(`  Fatal:   ${report.summary.bySeverity.fatal}`);
  lines.push(`  Error:   ${report.summary.bySeverity.error}`);
  lines.push(`  Warning: ${report.summary.bySeverity.warning}`);
  lines.push(`  Info:    ${report.summary.bySeverity.info}`);
  lines.push(`Modules Affected: ${report.summary.modulesAffected}`);
  lines.push(`Auto-Fixable: ${report.summary.autoFixable}`);
  lines.push('');

  // Drifts by type
  if (report.drifts.length > 0) {
    lines.push('Detected Drifts');
    lines.push('---------------');

    for (const drift of report.drifts) {
      const icon = getSeverityIcon(drift.severity);
      lines.push(`${icon} [${drift.type}] ${drift.module}`);

      if (drift.diff) {
        lines.push(`   Diff: ${drift.diff}`);
      }

      lines.push(`   Hint: ${drift.hint}`);

      if (drift.autoFixable) {
        lines.push(`   🛠️  Auto-fixable`);
      }

      lines.push('');
    }
  }

  // Recommendations
  if (report.recommendations.length > 0) {
    lines.push('Recommendations');
    lines.push('---------------');

    for (const rec of report.recommendations) {
      lines.push(`${rec.priority}. ${rec.description} [${rec.estimatedEffort}]`);
      lines.push(`   Action: ${rec.action}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

function formatMarkdownReport(report: DriftReport): string {
  const lines: string[] = [];

  lines.push('# Ecosystem Drift Detection Report');
  lines.push('');
  lines.push(`**Scan ID:** ${report.scanId}`);
  lines.push(`**Generated:** ${new Date(report.generatedAt).toLocaleString()}`);
  lines.push('');

  // Status
  const statusIcon = report.status === 'healthy' ? '✅' : report.status === 'warning' ? '⚠️' : '🔴';
  lines.push(`## Status: ${statusIcon} ${report.status.toUpperCase()}`);
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Count |');
  lines.push('|--------|-------|');
  lines.push(`| Total Drifts | ${report.summary.totalDrifts} |`);
  lines.push(`| 🔴 Fatal | ${report.summary.bySeverity.fatal} |`);
  lines.push(`| ❌ Error | ${report.summary.bySeverity.error} |`);
  lines.push(`| ⚠️ Warning | ${report.summary.bySeverity.warning} |`);
  lines.push(`| ℹ️ Info | ${report.summary.bySeverity.info} |`);
  lines.push(`| Modules Affected | ${report.summary.modulesAffected} |`);
  lines.push(`| Auto-Fixable | ${report.summary.autoFixable} |`);
  lines.push('');

  // Drifts
  if (report.drifts.length > 0) {
    lines.push('## Detected Drifts');
    lines.push('');

    for (const drift of report.drifts) {
      const icon = getSeverityIcon(drift.severity);
      lines.push(`### ${icon} ${drift.type}: ${drift.module}`);
      lines.push('');

      if (drift.diff) {
        lines.push(`**Diff:** ${drift.diff}`);
        lines.push('');
      }

      lines.push(`**Hint:** ${drift.hint}`);
      lines.push('');

      if (drift.autoFixable) {
        lines.push('🛠️ **Auto-fixable**');
        lines.push('');
      }
    }
  }

  // Recommendations
  if (report.recommendations.length > 0) {
    lines.push('## Recommendations');
    lines.push('');

    for (const rec of report.recommendations) {
      lines.push(`${rec.priority}. **${rec.description}** [${rec.estimatedEffort}]`);
      lines.push(`   - Action: ${rec.action}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

function getSeverityIcon(severity: Drift['severity']): string {
  switch (severity) {
    case 'fatal':
      return '🔴';
    case 'error':
      return '❌';
    case 'warning':
      return '⚠️';
    case 'info':
      return 'ℹ️';
    default:
      return '❓';
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

export interface RunDriftDetectionOptions {
  repoRoot: string;
  baselinePath?: string;
  format?: 'json' | 'text' | 'markdown';
  outputPath?: string;
  config?: Partial<DriftConfig>;
}

export async function runDriftDetection(
  options: RunDriftDetectionOptions
): Promise<{ report: DriftReport; exitCode: number }> {
  // Run with correlation context for tracing
  return correlation.runWithNew(async () => {
    const runId = correlation.getId();
    const childLogger = logger.child({ correlationId: runId });

    const startTime = Date.now();

    childLogger.info('Drift detection started', {
      repoRoot: options.repoRoot,
      hasBaseline: !!options.baselinePath,
      format: options.format || 'text',
    });

    const config: DriftConfig = {
      ...DEFAULT_DRIFT_CONFIG,
      ...options.config,
    };

    // Load baseline if specified
    let baseline: RegistryState | undefined;
    if (options.baselinePath) {
      config.baseline = {
        path: options.baselinePath,
        version: '1.0.0',
      };
      baseline = loadBaseline(options.baselinePath);
      childLogger.debug('Baseline loaded', { baselinePath: options.baselinePath });
    }

    // Discover current state
    const modules = discoverModules(options.repoRoot, DEFAULT_DISCOVERY_CONFIG);
    const current = buildRegistryState(modules);

    childLogger.debug('Modules discovered', { moduleCount: modules.length });

    // Detect drifts
    const drifts = detectDrifts(current, baseline, config);

    // Generate report
    const report = generateDriftReport(current, drifts, baseline, config);

    const duration = Date.now() - startTime;

    // Format output
    const format = options.format || 'text';
    const output = formatDriftReport(report, format);

    // Write to file or stdout
    if (options.outputPath) {
      writeFileSync(options.outputPath, output);
      childLogger.info('Drift report written to file', {
        outputPath: options.outputPath,
        duration,
      });
    } else {
      // For console output in text/markdown mode, we still print to stdout
      // for CLI usability, but we also log structured
      console.log(output);
    }

    childLogger.info('Drift detection completed', {
      status: report.status,
      totalDrifts: report.summary.totalDrifts,
      fatalCount: report.summary.bySeverity.fatal,
      errorCount: report.summary.bySeverity.error,
      warningCount: report.summary.bySeverity.warning,
      duration,
      runId,
    });

    // Determine exit code
    const exitCode = report.status === 'healthy' ? 0 : report.status === 'warning' ? 1 : 2;

    return { report, exitCode };
  });
}
