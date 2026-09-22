import { existsSync } from 'node:fs';
import { writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateReport,
  validateEvidencePacket,
  type ValidationResult,
} from '@controlplane/contract-kit';
import { listRunners, type RunnerRecord } from './registry/index.js';
import {
  buildExecutionRegistry,
  resolveExecutableRunner,
} from './registry/execution-registry.js';
import {
  runEntrypoint,
  readJsonFile,
  ensureAbsolutePath,
  type InvocationResult,
} from './invoke/index.js';
import {
  validateRunnerInput,
  type ExecutionResult,
  type RunnerInput,
  type EvidencePacket,
} from './contracts.js';
import { Errors } from './errors.js';

export type RunRunnerOptions = {
  runner: string;
  input: unknown;
  outputPath?: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
};

export type RunnerExecution = {
  runner: RunnerRecord;
  invocation: InvocationResult;
  report: unknown;
  validation: ValidationResult;
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const writeInputFile = (input: unknown, cwd: string) => {
  const inputPath = path.join(cwd, `controlplane-input-${Date.now()}.json`);
  writeFileSync(inputPath, JSON.stringify(input, null, 2));
  return inputPath;
};

const buildArgs = (baseArgs: string[], inputPath: string, outputPath: string) => {
  const args = [...baseArgs];
  if (!args.includes('--input')) {
    args.push('--input', inputPath);
  }
  if (!args.includes('--out')) {
    args.push('--out', outputPath);
  }
  if (!args.includes('--format')) {
    args.push('--format', 'json');
  }
  return args;
};

export const runRunner = async (options: RunRunnerOptions): Promise<RunnerExecution> => {
  // ── 1. Validate input before dispatch ──────────────────────────────
  const inputCheck = validateRunnerInput(options.input);
  if (!inputCheck.valid) {
    throw Errors.validationFailed(
      `input for runner "${options.runner}"`,
      inputCheck.errors
    );
  }

  // ── 2. Resolve runner via execution registry (fail-fast) ───────────
  const executableRunner = resolveExecutableRunner(options.runner);

  const cwd = repoRoot;
  const profileEnabled = process.env.CONTROLPLANE_PROFILE === '1';
  const requestId = process.env.CONTROLPLANE_REQUEST_ID ?? randomUUID();
  const profileLog = (step: string, durationMs: number) => {
    if (!profileEnabled) return;
    console.log(
      JSON.stringify({
        type: 'profile',
        requestId,
        runner: executableRunner.name,
        step,
        durationMs,
      })
    );
  };
  const totalStart = Date.now();

  const inputPath = writeInputFile(options.input, cwd);
  const outputPath = ensureAbsolutePath(
    options.outputPath ?? path.join(cwd, `${executableRunner.name}-report.json`),
    cwd
  );

  // ── 3. Invoke runner ───────────────────────────────────────────────
  const args = buildArgs(executableRunner.entrypoint.args, inputPath, outputPath);
  const invocation = await runEntrypoint(executableRunner.entrypoint.command, args, {
    cwd,
    env: options.env,
    timeoutMs: options.timeoutMs,
    redactEnvKeys: executableRunner.requiredEnv ?? [],
  });
  profileLog('invoke', Date.now() - totalStart);

  // ── 4. Fail fast on non-zero exit ──────────────────────────────────
  if (invocation.exitCode !== 0) {
    throw Errors.invocationFailed(
      executableRunner.name,
      invocation.exitCode,
      invocation.stderr
    );
  }

  // ── 5. Read and validate report ────────────────────────────────────
  if (!existsSync(outputPath)) {
    throw Errors.invocationFailed(
      executableRunner.name,
      invocation.exitCode,
      `Runner completed but report file was not written: ${outputPath}`
    );
  }

  const readStart = Date.now();
  const report = readJsonFile(outputPath);
  profileLog('read-report', Date.now() - readStart);

  const validateStart = Date.now();
  const validation = validateReport(report);
  profileLog('validate-report', Date.now() - validateStart);
  profileLog('total', Date.now() - totalStart);

  if (!validation.valid) {
    throw Errors.validationFailed(
      `report from runner "${executableRunner.name}"`,
      validation.errors
    );
  }

  // ── 6. Validate embedded evidence packet if present ────────────────
  const reportData = report as Record<string, unknown>;
  const data = reportData.data as Record<string, unknown> | undefined;
  if (data?.evidence) {
    const evidenceValidation = validateEvidencePacket(data.evidence);
    if (!evidenceValidation.valid) {
      throw Errors.validationFailed(
        `evidence packet from runner "${executableRunner.name}"`,
        evidenceValidation.errors
      );
    }
  }

  return {
    runner: executableRunner,
    invocation,
    report,
    validation,
  };
};

/**
 * Full orchestrated execution path:
 *   ControlPlane → select runner → execute → collect evidence → return result
 *
 * This is the canonical programmatic API for executing a runner through
 * ControlPlane with full contract enforcement.
 */
export const executeRunner = async (
  runnerName: string,
  input: RunnerInput,
  options: { timeoutMs?: number; outputPath?: string; env?: NodeJS.ProcessEnv } = {}
): Promise<ExecutionResult> => {
  const start = Date.now();

  const execution = await runRunner({
    runner: runnerName,
    input,
    outputPath: options.outputPath,
    timeoutMs: options.timeoutMs ?? 30_000,
    env: options.env,
  });

  const durationMs = Date.now() - start;
  const reportData = execution.report as Record<string, unknown>;
  const data = reportData.data as Record<string, unknown> | undefined;

  let evidence: EvidencePacket | null = null;
  let evidenceValid = false;
  if (data?.evidence) {
    const evResult = validateEvidencePacket(data.evidence);
    evidenceValid = evResult.valid;
    if (evResult.valid) {
      evidence = data.evidence as EvidencePacket;
    }
  }

  return {
    runner: runnerName,
    report: reportData as ExecutionResult['report'],
    evidence,
    reportValid: execution.validation.valid,
    evidenceValid,
    durationMs,
  };
};

export const listRunnerManifests = () => listRunners();

export const validateReportPayload = validateReport;

// Re-export registry
export { listModules, resolveModule } from './registry/index.js';
export type { ModuleRecord, ModuleType } from './registry/index.js';

// Re-export execution registry
export {
  buildExecutionRegistry,
  resolveExecutableRunner,
} from './registry/execution-registry.js';
export type {
  ExecutableRunner,
  FailedRunner,
  RegistryEntry,
  ExecutionRegistryState,
  PreflightCheck,
} from './registry/execution-registry.js';

// Re-export contracts
export {
  validateRunnerInput,
} from './contracts.js';
export type {
  RunnerInput,
  RunnerReport,
  EvidencePacket,
  EvidenceDecision,
  EvidenceItem,
  ExecutionResult,
  InputValidationResult,
  ReportStatus,
} from './contracts.js';

// Re-export discovery
export { discoverSiblings, findMissingSiblings } from './discovery.js';
export type { SiblingRepo, SiblingManifest } from './discovery.js';
export { validateCompatibility } from './compatibility.js';
export type { CompatCheck, CompatReport } from './compatibility.js';
export { ControlPlaneError, Errors, formatError } from './errors.js';
export type { ErrorCode } from './errors.js';

export class ControlPlaneClient {
  listRunners() {
    return listRunnerManifests();
  }

  buildRegistry() {
    return buildExecutionRegistry();
  }

  async executeRunner(
    runnerName: string,
    input: RunnerInput,
    options?: { timeoutMs?: number; outputPath?: string; env?: NodeJS.ProcessEnv }
  ) {
    return executeRunner(runnerName, input, options);
  }

  async runRunner(options: RunRunnerOptions) {
    return runRunner(options);
  }

  validateReport(payload: unknown) {
    return validateReportPayload(payload);
  }

  validateInput(payload: unknown) {
    return validateRunnerInput(payload);
  }
}
