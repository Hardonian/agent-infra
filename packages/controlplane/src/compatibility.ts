/**
 * Compatibility validation module.
 *
 * Checks:
 *   1. Contract version compatibility between runners and ControlPlane
 *   2. Required CLI commands exist (node, pnpm)
 *   3. Required SDK exports exist (contract-kit validators)
 *   4. Build artifacts are present
 *   5. Schema files are present
 */
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateReport,
  validateRunnerManifest,
  validateEvidencePacket,
} from '@controlplane/contract-kit';
import type { SiblingRepo } from './discovery.js';
import { listRunners, type RunnerRecord } from './registry/index.js';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..'
);

export type CompatCheck = {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  fix?: string;
};

export type CompatReport = {
  status: 'compatible' | 'degraded' | 'incompatible';
  controlplaneVersion: string;
  contractVersion: string;
  checks: CompatCheck[];
};

const CONTROLPLANE_VERSION = '1.0.0';
const CONTRACT_VERSION = '1.0.0';

const checkCommandExists = (cmd: string): boolean => {
  try {
    execSync(`which ${cmd}`, { stdio: 'pipe', encoding: 'utf-8' });
    return true;
  } catch {
    return false;
  }
};

const checkCLICommands = (): CompatCheck[] => {
  const required = ['node', 'pnpm'];
  return required.map((cmd) => {
    const exists = checkCommandExists(cmd);
    return {
      name: `cli:${cmd}`,
      status: exists ? 'pass' : 'fail',
      message: exists ? `${cmd} is available` : `${cmd} is not installed`,
      ...(exists ? {} : { fix: `Install ${cmd}` }),
    };
  });
};

const checkSDKExports = (): CompatCheck[] => {
  const exports = [
    { name: 'validateReport', fn: validateReport },
    { name: 'validateRunnerManifest', fn: validateRunnerManifest },
    { name: 'validateEvidencePacket', fn: validateEvidencePacket },
  ];

  return exports.map((exp) => ({
    name: `sdk:${exp.name}`,
    status: (typeof exp.fn === 'function' ? 'pass' : 'fail') as 'pass' | 'fail',
    message:
      typeof exp.fn === 'function'
        ? `${exp.name} is exported`
        : `${exp.name} is missing from @controlplane/contract-kit`,
    ...(typeof exp.fn === 'function'
      ? {}
      : { fix: 'Rebuild @controlplane/contract-kit: pnpm run build' }),
  }));
};

const checkBuildArtifacts = (): CompatCheck[] => {
  const targets = [
    'packages/contracts/dist',
    'packages/contract-kit/dist',
    'packages/controlplane/dist',
  ];
  return targets.map((target) => {
    const exists = existsSync(path.join(repoRoot, target));
    return {
      name: `build:${target}`,
      status: exists ? 'pass' : ('warn' as 'pass' | 'warn'),
      message: exists ? `${target} exists` : `${target} is missing`,
      ...(exists ? {} : { fix: 'Run "pnpm run build"' }),
    };
  });
};

const checkSchemas = (): CompatCheck[] => {
  const schemas = [
    'contracts/runner.manifest.schema.json',
    'contracts/events.schema.json',
    'contracts/reports.schema.json',
    'contracts/evidence.schema.json',
    'contracts/module.manifest.schema.json',
  ];
  return schemas.map((schema) => {
    const exists = existsSync(path.join(repoRoot, schema));
    return {
      name: `schema:${path.basename(schema)}`,
      status: exists ? 'pass' : ('warn' as 'pass' | 'warn'),
      message: exists ? `${schema} exists` : `${schema} is missing`,
      ...(exists ? {} : { fix: 'Run "pnpm run contract:sync:fix"' }),
    };
  });
};

const checkRunnerContracts = (runners: RunnerRecord[]): CompatCheck[] => {
  return runners.map((runner) => {
    const result = validateRunnerManifest(runner);
    return {
      name: `runner:${runner.name}`,
      status: result.valid ? 'pass' : ('fail' as 'pass' | 'fail'),
      message: result.valid
        ? `${runner.name}@${runner.version} manifest is valid`
        : `${runner.name} manifest invalid: ${result.errors.join(', ')}`,
      ...(result.valid ? {} : { fix: `Fix runner.manifest.json for ${runner.name}` }),
    };
  });
};

const checkSiblingCompatibility = (siblings: SiblingRepo[]): CompatCheck[] => {
  return siblings.map((sibling) => {
    if (!sibling.manifest) {
      return {
        name: `sibling:${sibling.name}`,
        status: 'warn' as const,
        message: `${sibling.name} found (${sibling.source}) but no manifest`,
        fix: `Add a module.manifest.json or runner.manifest.json to ${sibling.name}`,
      };
    }
    const cv = sibling.manifest.contractVersion;
    if (cv && cv !== CONTRACT_VERSION) {
      const major = (v: string) => v.split('.')[0];
      const compatible = major(cv) === major(CONTRACT_VERSION);
      return {
        name: `sibling:${sibling.name}`,
        status: compatible ? ('warn' as const) : ('fail' as const),
        message: `${sibling.name} targets contract ${cv}, ControlPlane expects ${CONTRACT_VERSION}`,
        fix: 'Update contracts to a compatible version. See docs/COMPATIBILITY.md.',
      };
    }
    return {
      name: `sibling:${sibling.name}`,
      status: 'pass' as const,
      message: `${sibling.name}@${sibling.manifest.version} (${sibling.source})`,
    };
  });
};

/**
 * Run all compatibility checks and return a structured report.
 */
export const validateCompatibility = (
  siblings: SiblingRepo[]
): CompatReport => {
  let runners: RunnerRecord[];
  try {
    runners = listRunners();
  } catch {
    runners = [];
  }

  const checks: CompatCheck[] = [
    ...checkCLICommands(),
    ...checkSDKExports(),
    ...checkBuildArtifacts(),
    ...checkSchemas(),
    ...checkRunnerContracts(runners),
    ...checkSiblingCompatibility(siblings),
  ];

  const fails = checks.filter((c) => c.status === 'fail').length;
  const warns = checks.filter((c) => c.status === 'warn').length;

  return {
    status: fails > 0 ? 'incompatible' : warns > 0 ? 'degraded' : 'compatible',
    controlplaneVersion: CONTROLPLANE_VERSION,
    contractVersion: CONTRACT_VERSION,
    checks,
  };
};
