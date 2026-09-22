#!/usr/bin/env node
import { mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  listRunnerManifests,
  runRunner,
  resolveModule,
  executeRunner,
  buildExecutionRegistry,
  validateRunnerInput,
} from './index.js';
import { createHash } from 'node:crypto';
import { validateEvidencePacket } from '@controlplane/contract-kit';
import { discoverSiblings, findMissingSiblings } from './discovery.js';
import { validateCompatibility } from './compatibility.js';
import { ControlPlaneError, formatError } from './errors.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const ARTIFACTS_ROOT = path.join(repoRoot, 'artifacts');

const exitWith = (code: number, message?: string): never => {
  if (message) {
    console.error(message);
  }
  process.exit(code);
};

const readJsonInput = (value: string) => {
  try {
    const filePath = path.isAbsolute(value) ? value : path.join(process.cwd(), value);
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as unknown;
  } catch {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      throw new ControlPlaneError(
        'MISSING_DEPENDENCY',
        `Unable to read input: ${value}`,
        'Provide a valid JSON file path or inline JSON string.'
      );
    }
  }
};

const getOption = (args: string[], name: string) => {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return args[index + 1];
};

const hasFlag = (args: string[], name: string) => args.includes(name);

const command = process.argv[2];
const args = process.argv.slice(3);

const printHelp = () => {
  console.log(`ControlPlane CLI

Commands:
  controlplane doctor                                  Aggregated health check
  controlplane doctor --sibling                        Include sibling repo doctor checks
  controlplane list                                    List discovered runners
  controlplane plan                                    Dry-run discovery + validation
  controlplane run <runner> --input <file|json> --out <path>  Execute a runner
  controlplane run --smoke                             Smoke-test all runners
  controlplane run demo                                Execute full pipeline demo
  controlplane execute <runner> --input <file|json>    Full orchestrated execution with contract enforcement
  controlplane registry                                Show execution registry with pre-flight status
  controlplane verify-integrations                     Full integration verification
  controlplane verify:ecosystem                        Detect ecosystem drift
    --baseline <path>                                  Path to baseline registry state
    --format <json|text|markdown>                      Output format (default: text)
    --out <path>                                       Write report to file
  controlplane registry:report                         Generate registry report
    --format <json|text|markdown>                      Output format (default: text)
    --out <path>                                       Write report to file
    --verbose                                          Include detailed information
    --include-errors                                   Include validation errors

Exit Codes:
  0  Success
  1  Invalid arguments or warnings detected
  2  Execution/validation failure or critical drift
`);
};

if (!command || command === '--help' || command === '-h') {
  printHelp();
  process.exit(0);
}

/** Structured log entry for smoke/run output. */
type LogEntry = {
  ts: string;
  level: 'info' | 'warn' | 'error';
  runner?: string;
  phase: string;
  message: string;
};

const logs: LogEntry[] = [];

const log = (level: 'info' | 'warn' | 'error', phase: string, message: string, runner?: string) => {
  logs.push({ ts: new Date().toISOString(), level, phase, message, runner });
};

const run = async () => {
  // ── doctor ──────────────────────────────────────────────────────────
  if (command === 'doctor') {
    const runners = listRunnerManifests();
    const siblings = discoverSiblings();
    const missing = findMissingSiblings();
    const compat = validateCompatibility(siblings);

    const buildTargets = [
      'packages/contracts/dist',
      'packages/contract-kit/dist',
      'packages/controlplane/dist',
    ];
    const buildChecks = buildTargets.map((t) => ({
      target: t,
      exists: existsSync(path.join(repoRoot, t)),
    }));

    const schemaFiles = [
      'contracts/runner.manifest.schema.json',
      'contracts/events.schema.json',
      'contracts/reports.schema.json',
      'contracts/evidence.schema.json',
      'contracts/module.manifest.schema.json',
    ];
    const schemaChecks = schemaFiles.map((s) => ({
      schema: s,
      exists: existsSync(path.join(repoRoot, s)),
    }));

    const allBuildOk = buildChecks.every((b) => b.exists);
    const allSchemasOk = schemaChecks.every((s) => s.exists);

    // Optionally invoke sibling doctor commands
    const siblingDoctorResults: { name: string; ok: boolean; output?: string; error?: string }[] =
      [];
    if (hasFlag(args, '--sibling')) {
      for (const sib of siblings) {
        if (sib.hasDoctorCommand && sib.source === 'sibling') {
          try {
            const output = execSync('pnpm run doctor --json', {
              cwd: sib.path,
              encoding: 'utf-8',
              timeout: 15_000,
              stdio: ['pipe', 'pipe', 'pipe'],
            });
            siblingDoctorResults.push({ name: sib.name, ok: true, output: output.trim() });
          } catch (err) {
            siblingDoctorResults.push({
              name: sib.name,
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }
    }

    const overallStatus =
      compat.status === 'incompatible'
        ? 'unhealthy'
        : allBuildOk && allSchemasOk
          ? compat.status === 'compatible'
            ? 'healthy'
            : 'degraded'
          : 'degraded';

    const report = {
      status: overallStatus,
      node: process.version,
      runners: runners.length,
      runnerNames: runners.map((r) => r.name),
      repoRoot,
      builds: buildChecks,
      schemas: schemaChecks,
      siblings: siblings.map((s) => ({
        name: s.name,
        source: s.source,
        hasManifest: !!s.manifest,
        hasDoctorCommand: s.hasDoctorCommand,
      })),
      missingSiblings: missing,
      compatibility: compat,
      ...(siblingDoctorResults.length > 0 ? { siblingDoctors: siblingDoctorResults } : {}),
    };

    console.log(JSON.stringify(report, null, 2));

    if (missing.length > 0) {
      console.error(
        `\nNote: ${missing.length} sibling repo(s) not detected: ${missing.join(', ')}.`
      );
      console.error(
        'Clone them as sibling directories or set CONTROLPLANE_OFFLINE=1 to suppress this warning.'
      );
    }
    return;
  }

  // ── list ────────────────────────────────────────────────────────────
  if (command === 'list') {
    const runners = listRunnerManifests();
    console.log(JSON.stringify(runners, null, 2));
    return;
  }

  // ── plan ────────────────────────────────────────────────────────────
  if (command === 'plan') {
    const runners = listRunnerManifests();
    const siblings = discoverSiblings();
    const compat = validateCompatibility(siblings);
    const fixturePath = path.join(repoRoot, 'tests/fixtures/golden-input.json');
    const fixtureExists = existsSync(fixturePath);

    const steps: { step: number; action: string; reason: string }[] = [];
    let stepNum = 1;

    const addStep = (action: string, reason: string) => {
      steps.push({ step: stepNum++, action, reason });
    };

    addStep(
      'Discover runner manifests',
      `Scan runners/ and .cache/repos/ for runner.manifest.json files. Found ${runners.length} runner(s).`
    );

    addStep(
      'Discover sibling repositories',
      `Check parent directory, cache, and runners/ for known sibling repos. Found ${siblings.length} sibling(s).`
    );

    addStep(
      'Validate compatibility',
      `Check CLI commands, SDK exports, schemas, and contract versions. Status: ${compat.status}.`
    );

    addStep(
      'Validate all manifests against schema',
      'Each runner.manifest.json must have name, version, description, and entrypoint.'
    );

    if (fixtureExists) {
      addStep(
        'Load golden fixture input',
        `Use ${fixturePath} as the standard test input for all runners.`
      );
    } else {
      addStep(
        'Load golden fixture input',
        'WARNING: tests/fixtures/golden-input.json is missing. Smoke run will fail.'
      );
    }

    for (const r of runners) {
      addStep(
        `Execute ${r.name}`,
        `Invoke ${r.entrypoint.command} ${r.entrypoint.args.join(' ')} with golden input. Expects a valid report + evidence packet.`
      );
    }

    addStep(
      'Validate all output reports',
      'Each report must satisfy the report schema (runner, status, startedAt, finishedAt, summary).'
    );

    addStep(
      'Validate all evidence packets',
      'Each evidence packet must have id, runner, timestamp, hash, and items array.'
    );

    addStep(
      'Write artifacts',
      `Persist reports and evidence under ${ARTIFACTS_ROOT}/<runner>/<timestamp>/`
    );

    addStep(
      'Aggregate results',
      'Produce a summary JSON with pass/fail counts and artifact paths.'
    );

    const plan = {
      phase: 'plan',
      dryRun: true,
      timestamp: new Date().toISOString(),
      runnersDiscovered: runners.length,
      siblingsDiscovered: siblings.length,
      compatibility: compat.status,
      runners: runners.map((r) => ({
        name: r.name,
        version: r.version,
        capabilities: r.capabilities || [],
        entrypoint: `${r.entrypoint.command} ${r.entrypoint.args.join(' ')}`,
        manifestValid: true,
      })),
      siblings: siblings.map((s) => ({
        name: s.name,
        source: s.source,
        version: s.manifest?.version ?? 'unknown',
      })),
      goldenFixture: fixtureExists ? fixturePath : null,
      executionOrder: runners.map((r) => r.name),
      contractSchemas: [
        'runner.manifest.schema.json',
        'events.schema.json',
        'reports.schema.json',
        'evidence.schema.json',
        'module.manifest.schema.json',
      ],
      steps,
    };

    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  // ── run ─────────────────────────────────────────────────────────────
  if (command === 'run') {
    if (args[0] === 'demo') {
      log('info', 'init', 'Starting demo pipeline execution');

      // Step 1: Load sample job input
      const fixturePath = path.join(repoRoot, 'tests/fixtures/golden-input.json');
      if (!existsSync(fixturePath)) {
        log('error', 'init', 'Golden fixture missing');
        exitWith(
          2,
          formatError(
            new ControlPlaneError(
              'MISSING_DEPENDENCY',
              'Demo requires tests/fixtures/golden-input.json',
              'Create the fixture file or run "pnpm run test:golden" to generate it.'
            )
          )
        );
      }
      const input = JSON.parse(readFileSync(fixturePath, 'utf-8')) as unknown;
      log('info', 'init', 'Loaded sample job input');

      mkdirSync(ARTIFACTS_ROOT, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const demoDir = path.join(ARTIFACTS_ROOT, 'demo', timestamp);
      mkdirSync(demoDir, { recursive: true });

      const results: Array<{
        stage: string;
        runner: string;
        success: boolean;
        durationMs?: number;
        outputPath?: string;
        error?: string;
      }> = [];

      // Step 2: Run TruthCore for validation
      {
        const startMs = Date.now();
        try {
          log('info', 'pipeline', 'Running TruthCore validation', 'truthcore');
          const truthcoreModule = resolveModule('truthcore', 'runner');
          if (!truthcoreModule.available) {
            log('warn', 'pipeline', `TruthCore not available: ${truthcoreModule.error}`, 'truthcore');
          } else {
            const outputPath = path.join(demoDir, 'truthcore-report.json');
            const result = await runRunner({
              runner: 'truthcore',
              input,
              outputPath,
              timeoutMs: 30_000,
            });
            results.push({
              stage: 'validation',
              runner: 'truthcore',
              success: result.validation.valid,
              durationMs: Date.now() - startMs,
              outputPath,
            });
            log('info', 'pipeline', 'TruthCore validation completed', 'truthcore');
          }
        } catch (error) {
          log(
            'error',
            'pipeline',
            `TruthCore failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            'truthcore'
          );
          results.push({
            stage: 'validation',
            runner: 'truthcore',
            success: false,
            durationMs: Date.now() - startMs,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Step 3: Run JobForge connector
      {
        const startMs = Date.now();
        try {
          log('info', 'pipeline', 'Running JobForge connector', 'JobForge');
          const jobforgeModule = resolveModule('jobforge', 'runner');
          if (!jobforgeModule.available) {
            log('warn', 'pipeline', `JobForge not available: ${jobforgeModule.error}`, 'JobForge');
          } else {
            const outputPath = path.join(demoDir, 'jobforge-report.json');
            const result = await runRunner({
              runner: 'jobforge',
              input,
              outputPath,
              timeoutMs: 30_000,
            });
            results.push({
              stage: 'connector',
              runner: 'jobforge',
              success: result.validation.valid,
              durationMs: Date.now() - startMs,
              outputPath,
            });
            log('info', 'pipeline', 'JobForge connector completed', 'JobForge');
          }
        } catch (error) {
          log(
            'error',
            'pipeline',
            `JobForge failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            'JobForge'
          );
          results.push({
              stage: 'connector',
              runner: 'jobforge',
              success: false,
              durationMs: Date.now() - startMs,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
      }

      // Step 4: Run one autopilot runner (ops-autopilot as example)
      {
        const startMs = Date.now();
        try {
          log('info', 'pipeline', 'Running ops-autopilot', 'ops-autopilot');
          const opsModule = resolveModule('ops-autopilot', 'runner');
          if (!opsModule.available) {
            log(
              'warn',
              'pipeline',
              `ops-autopilot not available: ${opsModule.error}`,
              'ops-autopilot'
            );
          } else {
            const outputPath = path.join(demoDir, 'ops-autopilot-report.json');
            const result = await runRunner({
              runner: 'ops-autopilot',
              input,
              outputPath,
              timeoutMs: 30_000,
            });
            results.push({
              stage: 'automation',
              runner: 'ops-autopilot',
              success: result.validation.valid,
              durationMs: Date.now() - startMs,
              outputPath,
            });
            log('info', 'pipeline', 'ops-autopilot completed', 'ops-autopilot');
          }
        } catch (error) {
          log(
            'error',
            'pipeline',
            `ops-autopilot failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            'ops-autopilot'
          );
          results.push({
            stage: 'automation',
            runner: 'ops-autopilot',
            success: false,
            durationMs: Date.now() - startMs,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Step 5: Generate evidence packet and summary
      const evidencePayload = JSON.stringify(
        results.map((r) => ({ stage: r.stage, runner: r.runner, success: r.success }))
      );
      const evidenceHash = createHash('sha256').update(evidencePayload).digest('hex');

      const evidencePacket = {
        id: `demo-${Date.now()}`,
        runner: 'controlplane-demo',
        timestamp: new Date().toISOString(),
        hash: evidenceHash,
        contractVersion: '1.0.0',
        items: results.map((r, i) => ({
          key: `stage-${i}`,
          value: r.success,
          source: r.runner,
          redacted: false,
        })),
        decision: {
          outcome: results.every((r) => r.success) ? 'pass' : 'fail',
          reasons: results.map((r) => ({
            ruleId: `DEMO-${r.stage.toUpperCase()}`,
            message: `${r.runner} ${r.success ? 'succeeded' : 'failed'}`,
          })),
          confidence: results.filter((r) => r.success).length / results.length,
        },
      };

      const markdownSummary = `# ControlPlane Demo Pipeline Results

**Executed:** ${new Date().toISOString()}
**Status:** ${results.every((r) => r.success) ? '✅ SUCCESS' : '❌ PARTIAL FAILURE'}

## Pipeline Stages

${results
  .map(
    (r) => `### ${r.stage}: ${r.runner}
- **Status:** ${r.success ? '✅ Passed' : '❌ Failed'}
${r.error ? `- **Error:** ${r.error}` : ''}
${r.outputPath ? `- **Output:** ${r.outputPath}` : ''}
`
  )
  .join('\n')}

## Evidence Packet

\`\`\`json
${JSON.stringify(evidencePacket, null, 2)}
\`\`\`

## Replay Instructions

To reproduce this demo:

\`\`\`bash
# Ensure golden fixture exists
pnpm controlplane run demo
\`\`\`

## Next Steps

${
  results.every((r) => r.success)
    ? '- All stages completed successfully'
    : '- Review failed stages and check module availability'
}
${results.some((r) => !r.success) ? '- Run `pnpm controlplane doctor` to diagnose issues' : ''}
`;

      writeFileSync(path.join(demoDir, 'evidence.json'), JSON.stringify(evidencePacket, null, 2));
      writeFileSync(path.join(demoDir, 'summary.md'), markdownSummary);

      const manifest = {
        command: 'run demo',
        timestamp: new Date().toISOString(),
        artifactsRoot: demoDir,
        results,
        logs,
        summary: {
          totalStages: results.length,
          passed: results.filter((r) => r.success).length,
          failed: results.filter((r) => !r.success).length,
        },
      };

      writeFileSync(path.join(demoDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

      console.log(JSON.stringify(manifest, null, 2));
      console.log(`\n📄 Summary: ${path.join(demoDir, 'summary.md')}`);
      console.log(`🧾 Evidence: ${path.join(demoDir, 'evidence.json')}`);

      if (results.some((r) => !r.success)) {
        exitWith(2, 'Demo pipeline had failures - check logs and module availability');
      }
      return;
    }

    if (hasFlag(args, '--smoke')) {
      log('info', 'init', 'Starting smoke run');

      const runners = listRunnerManifests();
      log('info', 'discovery', `Discovered ${runners.length} runner(s)`);

      const fixturePath = path.join(repoRoot, 'tests/fixtures/golden-input.json');
      if (!existsSync(fixturePath)) {
        log('error', 'init', 'Golden fixture missing');
        exitWith(
          2,
          formatError(
            new ControlPlaneError(
              'MISSING_DEPENDENCY',
              'Golden fixture tests/fixtures/golden-input.json not found.',
              'Create the fixture file or run "pnpm run test:golden" to generate it.'
            )
          )
        );
      }
      const input = JSON.parse(readFileSync(fixturePath, 'utf-8')) as unknown;
      log('info', 'init', 'Loaded golden fixture');

      mkdirSync(ARTIFACTS_ROOT, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const smokeDir = path.join(ARTIFACTS_ROOT, 'smoke', timestamp);
      mkdirSync(smokeDir, { recursive: true });

      const results: {
        runner: string;
        ok: boolean;
        reportValid: boolean;
        evidenceValid: boolean;
        durationMs?: number;
        errors?: string[];
        artifactPath?: string;
      }[] = [];

      for (const runner of runners) {
        const runnerArtifactDir = path.join(smokeDir, runner.name);
        mkdirSync(runnerArtifactDir, { recursive: true });
        const outputPath = path.join(runnerArtifactDir, 'report.json');
        const evidencePath = path.join(runnerArtifactDir, 'evidence.json');

        log('info', 'execute', `Running ${runner.name}`, runner.name);
        const startMs = Date.now();

        try {
          const result = await runRunner({
            runner: runner.name,
            input,
            outputPath,
            timeoutMs: 30_000,
          });

          const durationMs = Date.now() - startMs;
          log('info', 'execute', `${runner.name} completed in ${durationMs}ms`, runner.name);

          let evidenceValid = false;
          const reportData = result.report as Record<string, unknown> | undefined;
          if (reportData && typeof reportData === 'object') {
            const data = (reportData as Record<string, unknown>).data as
              | Record<string, unknown>
              | undefined;
            if (data && typeof data === 'object' && data.evidence) {
              const evResult = validateEvidencePacket(data.evidence);
              evidenceValid = evResult.valid;
              writeFileSync(evidencePath, JSON.stringify(data.evidence, null, 2));
              log(
                evResult.valid ? 'info' : 'warn',
                'validate',
                `${runner.name} evidence: ${evResult.valid ? 'valid' : evResult.errors.join(', ')}`,
                runner.name
              );
            }
          }

          log(
            result.validation.valid ? 'info' : 'warn',
            'validate',
            `${runner.name} report: ${result.validation.valid ? 'valid' : result.validation.errors.join(', ')}`,
            runner.name
          );

          results.push({
            runner: runner.name,
            ok: result.validation.valid,
            reportValid: result.validation.valid,
            evidenceValid,
            durationMs,
            artifactPath: runnerArtifactDir,
            errors: result.validation.errors.length > 0 ? result.validation.errors : undefined,
          });
        } catch (error) {
          const durationMs = Date.now() - startMs;
          const msg = error instanceof Error ? error.message : 'Unknown execution error';
          log('error', 'execute', `${runner.name} failed: ${msg}`, runner.name);

          results.push({
            runner: runner.name,
            ok: false,
            reportValid: false,
            evidenceValid: false,
            durationMs,
            errors: [msg],
          });
        }
      }

      const failures = results.filter((r) => !r.ok);

      // Write the manifest to the smoke directory
      const manifest = {
        command: 'run --smoke',
        timestamp: new Date().toISOString(),
        artifactsRoot: smokeDir,
        results,
        logs,
        summary: {
          total: results.length,
          passed: results.length - failures.length,
          failed: failures.length,
        },
      };

      writeFileSync(path.join(smokeDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
      log('info', 'artifacts', `Manifest written to ${smokeDir}/manifest.json`);

      console.log(JSON.stringify(manifest, null, 2));

      if (failures.length > 0) {
        exitWith(2, `Smoke test failed for ${failures.length} runner(s).`);
      }
      return;
    }

    const runner = args[0];
    if (!runner || runner.startsWith('--')) {
      exitWith(
        1,
        'Runner name is required. Usage: controlplane run <runner> --input <file|json> --out <path>'
      );
      return;
    }
    const inputValue = getOption(args, '--input');
    if (!inputValue) {
      exitWith(1, 'Missing --input <file|json>.');
      return;
    }
    const outputPath = getOption(args, '--out');
    if (!outputPath) {
      exitWith(1, 'Missing --out <path>.');
      return;
    }
    const input = readJsonInput(inputValue);
    const result = await runRunner({
      runner,
      input,
      outputPath,
    });
    if (!result.validation.valid) {
      exitWith(
        2,
        formatError(
          new ControlPlaneError(
            'VALIDATION_FAILED',
            `Report validation failed: ${result.validation.errors.join(', ')}`,
            'Check the runner output against the report schema.'
          )
        )
      );
    }
    console.log(JSON.stringify(result.report, null, 2));
    return;
  }

  // ── execute ─────────────────────────────────────────────────────────
  // Full orchestrated execution: ControlPlane → select → execute → collect evidence → result
  if (command === 'execute') {
    const runnerName = args[0];
    if (!runnerName || runnerName.startsWith('--')) {
      exitWith(
        1,
        'Runner name is required. Usage: controlplane execute <runner> --input <file|json>'
      );
      return;
    }

    const inputValue = getOption(args, '--input');
    if (!inputValue) {
      exitWith(1, 'Missing --input <file|json>.');
      return;
    }

    const input = readJsonInput(inputValue);

    // Validate input contract before dispatch
    const inputCheck = validateRunnerInput(input);
    if (!inputCheck.valid) {
      exitWith(
        2,
        formatError(
          new ControlPlaneError(
            'VALIDATION_FAILED',
            `Input contract violation: ${inputCheck.errors.join(', ')}`,
            'Input must have requestId (string), timestamp (ISO-8601 string), and payload (object).'
          )
        )
      );
      return;
    }

    const timeoutMs = parseInt(getOption(args, '--timeout') ?? '30000', 10);
    const outputPath = getOption(args, '--out');

    try {
      const result = await executeRunner(
        runnerName,
        input as { requestId: string; timestamp: string; payload: Record<string, unknown> },
        { timeoutMs, outputPath }
      );

      console.log(JSON.stringify({
        runner: result.runner,
        status: result.report.status,
        reportValid: result.reportValid,
        evidenceValid: result.evidenceValid,
        durationMs: result.durationMs,
        evidence: result.evidence ? {
          id: result.evidence.id,
          hash: result.evidence.hash,
          decision: result.evidence.decision,
          itemCount: result.evidence.items.length,
        } : null,
      }, null, 2));
    } catch (error) {
      exitWith(2, formatError(error));
    }
    return;
  }

  // ── registry ───────────────────────────────────────────────────────
  if (command === 'registry') {
    const registry = buildExecutionRegistry();

    console.log(JSON.stringify({
      timestamp: registry.timestamp,
      total: registry.runners.length,
      executable: registry.executable.length,
      failed: registry.failed.length,
      runners: registry.runners.map((r) => ({
        name: r.name,
        version: r.version,
        executable: r.executable,
        preflight: r.preflight,
        ...(!r.executable ? { reason: (r as { reason: string }).reason } : {}),
      })),
    }, null, 2));

    if (registry.failed.length > 0) {
      exitWith(1, `${registry.failed.length} runner(s) failed pre-flight checks.`);
    }
    return;
  }

  // ── verify-integrations ─────────────────────────────────────────────
  if (command === 'verify-integrations') {
    const runners = listRunnerManifests();
    const fixturePath = path.join(repoRoot, 'tests/fixtures/golden-input.json');
    const input = JSON.parse(readFileSync(fixturePath, 'utf-8')) as unknown;
    const resultsRoot = path.join(repoRoot, 'test-results');
    mkdirSync(resultsRoot, { recursive: true });
    const results: { runner: string; ok: boolean; errors?: string[] }[] = [];
    for (const runner of runners) {
      try {
        const outputPath = path.join(resultsRoot, `${runner.name}-report.json`);
        const result = await runRunner({
          runner: runner.name,
          input,
          outputPath,
          timeoutMs: 30_000,
        });
        results.push({
          runner: runner.name,
          ok: result.validation.valid,
          errors: result.validation.errors,
        });
      } catch (error) {
        results.push({
          runner: runner.name,
          ok: false,
          errors: [error instanceof Error ? error.message : 'Unknown execution error'],
        });
      }
    }
    const failures = results.filter((result) => !result.ok);
    console.log(JSON.stringify({ results }, null, 2));
    if (failures.length > 0) {
      exitWith(2, `Integration verification failed for ${failures.length} runner(s).`);
    }
    return;
  }

  // ── verify:ecosystem ────────────────────────────────────────────────
  if (command === 'verify:ecosystem') {
    const { runDriftDetection } = await import('./drift/index.js');

    const baselinePath = getOption(args, '--baseline');
    const format = (getOption(args, '--format') as 'json' | 'text' | 'markdown') || 'text';
    const outputPath = getOption(args, '--out');

    log('info', 'drift-detection', 'Starting ecosystem drift detection');

    const { report, exitCode } = await runDriftDetection({
      repoRoot,
      baselinePath,
      format,
      outputPath,
    });

    if (report.status === 'healthy') {
      log('info', 'drift-detection', 'No drift detected - ecosystem is healthy');
    } else {
      log(
        report.status === 'critical' ? 'error' : 'warn',
        'drift-detection',
        `Detected ${report.summary.totalDrifts} drift(s) - status: ${report.status}`
      );
    }

    process.exit(exitCode);
  }

  // ── registry:report ─────────────────────────────────────────────────
  if (command === 'registry:report') {
    const { discoverModules, buildRegistryState, generateRegistryReport } =
      await import('./registry/hardened.js');

    const format = (getOption(args, '--format') as 'json' | 'text' | 'markdown') || 'text';
    const outputPath = getOption(args, '--out');
    const verbose = hasFlag(args, '--verbose');
    const includeErrors = hasFlag(args, '--include-errors');

    log('info', 'registry', 'Discovering modules...');
    const modules = discoverModules(repoRoot);
    const state = buildRegistryState(modules);

    log('info', 'registry', `Discovered ${state.summary.total} modules`);

    const report = generateRegistryReport(state, {
      format,
      includeErrors: includeErrors || verbose,
      includeWarnings: true,
      verbose,
    });

    if (outputPath) {
      writeFileSync(outputPath, report);
      console.log(`Registry report written to: ${outputPath}`);
    } else {
      console.log(report);
    }

    return;
  }

  printHelp();
  exitWith(1, `Unknown command: ${command}`);
};

run().catch((error) => {
  console.error(formatError(error));
  process.exit(2);
});
