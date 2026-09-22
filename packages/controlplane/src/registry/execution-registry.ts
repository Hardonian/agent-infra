/**
 * Execution Registry — validates that discovered runners are actually callable.
 *
 * The standard registry (index.ts) discovers runners by reading manifest files.
 * This module adds a pre-flight validation layer: before ControlPlane dispatches
 * work to a runner it ensures the entrypoint binary exists, required env vars
 * are set, and the manifest itself is schema-valid.
 *
 * Runners that fail pre-flight are excluded from the executable set, and their
 * failures are surfaced as structured diagnostics so the operator can fix them.
 */
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listRunners, type RunnerRecord } from './index.js';
import { validateRunnerManifest } from '@controlplane/contract-kit';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../..'
);

// ── Types ──────────────────────────────────────────────────────────────

export type PreflightCheck = {
  check: string;
  passed: boolean;
  message: string;
};

export type ExecutableRunner = RunnerRecord & {
  preflight: PreflightCheck[];
  executable: true;
};

export type FailedRunner = RunnerRecord & {
  preflight: PreflightCheck[];
  executable: false;
  reason: string;
};

export type RegistryEntry = ExecutableRunner | FailedRunner;

export type ExecutionRegistryState = {
  timestamp: string;
  runners: RegistryEntry[];
  executable: ExecutableRunner[];
  failed: FailedRunner[];
};

// ── Pre-flight checks ──────────────────────────────────────────────────

const checkManifestValid = (runner: RunnerRecord): PreflightCheck => {
  const result = validateRunnerManifest(runner);
  return {
    check: 'manifest-schema',
    passed: result.valid,
    message: result.valid
      ? 'Manifest satisfies runner.manifest.schema.json'
      : `Manifest invalid: ${result.errors.join(', ')}`,
  };
};

const checkEntrypointExists = (runner: RunnerRecord): PreflightCheck => {
  // The entrypoint is always `node scripts/adapters/runner-adapter.mjs`
  // with --runner <name> as an arg. Verify the adapter script exists.
  const adapterArg = runner.entrypoint.args[0];
  if (!adapterArg) {
    return {
      check: 'entrypoint-exists',
      passed: false,
      message: 'Entrypoint args are empty — cannot determine script path',
    };
  }

  const scriptPath = path.resolve(repoRoot, adapterArg);
  const exists = existsSync(scriptPath);
  return {
    check: 'entrypoint-exists',
    passed: exists,
    message: exists
      ? `Entrypoint script exists: ${adapterArg}`
      : `Entrypoint script missing: ${scriptPath}`,
  };
};

const checkCommandAvailable = (runner: RunnerRecord): PreflightCheck => {
  const cmd = runner.entrypoint.command;
  try {
    execSync(`which ${cmd}`, { stdio: 'pipe', encoding: 'utf-8' });
    return {
      check: 'command-available',
      passed: true,
      message: `Command "${cmd}" is available on PATH`,
    };
  } catch {
    return {
      check: 'command-available',
      passed: false,
      message: `Command "${cmd}" is not installed or not on PATH`,
    };
  }
};

const checkRequiredEnv = (runner: RunnerRecord): PreflightCheck => {
  const required = runner.requiredEnv ?? [];
  if (required.length === 0) {
    return {
      check: 'required-env',
      passed: true,
      message: 'No required environment variables',
    };
  }
  const missing = required.filter((key) => !process.env[key]);
  return {
    check: 'required-env',
    passed: missing.length === 0,
    message:
      missing.length === 0
        ? `All ${required.length} required env var(s) are set`
        : `Missing env var(s): ${missing.join(', ')}`,
  };
};

const checkRunnerNameInArgs = (runner: RunnerRecord): PreflightCheck => {
  const runnerFlagIdx = runner.entrypoint.args.indexOf('--runner');
  if (runnerFlagIdx === -1) {
    return {
      check: 'runner-arg',
      passed: false,
      message: 'Entrypoint args do not include --runner flag',
    };
  }
  const runnerName = runner.entrypoint.args[runnerFlagIdx + 1];
  const matches = runnerName === runner.name;
  return {
    check: 'runner-arg',
    passed: matches,
    message: matches
      ? `--runner arg matches manifest name: ${runner.name}`
      : `--runner arg "${runnerName}" does not match manifest name "${runner.name}"`,
  };
};

// ── Registry builder ───────────────────────────────────────────────────

const runPreflight = (runner: RunnerRecord): RegistryEntry => {
  const checks: PreflightCheck[] = [
    checkManifestValid(runner),
    checkEntrypointExists(runner),
    checkCommandAvailable(runner),
    checkRequiredEnv(runner),
    checkRunnerNameInArgs(runner),
  ];

  const failures = checks.filter((c) => !c.passed);
  if (failures.length > 0) {
    return {
      ...runner,
      preflight: checks,
      executable: false,
      reason: failures.map((f) => f.message).join('; '),
    };
  }

  return {
    ...runner,
    preflight: checks,
    executable: true,
  };
};

/**
 * Build the execution registry by discovering all runners and running
 * pre-flight checks on each one.
 */
export const buildExecutionRegistry = (): ExecutionRegistryState => {
  const discovered = listRunners();
  const entries = discovered.map(runPreflight);

  const executable = entries.filter(
    (e): e is ExecutableRunner => e.executable
  );
  const failed = entries.filter(
    (e): e is FailedRunner => !e.executable
  );

  return {
    timestamp: new Date().toISOString(),
    runners: entries,
    executable,
    failed,
  };
};

/**
 * Resolve a single runner from the execution registry, failing fast
 * if it is not executable.
 */
export const resolveExecutableRunner = (name: string): ExecutableRunner => {
  const registry = buildExecutionRegistry();
  const entry = registry.runners.find((r) => r.name === name);

  if (!entry) {
    throw new Error(
      `Runner "${name}" not found. Available runners: ${registry.runners.map((r) => r.name).join(', ')}`
    );
  }

  if (!entry.executable) {
    throw new Error(
      `Runner "${name}" failed pre-flight checks: ${(entry as FailedRunner).reason}`
    );
  }

  return entry as ExecutableRunner;
};
