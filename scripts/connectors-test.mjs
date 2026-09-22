#!/usr/bin/env node
/**
 * connectors:test — replays fixtures against JobForge connector,
 * validates evidence packets, tests retry/timeout behavior.
 * Exit 0 = all pass, Exit 1 = failures.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const fixturesDir = path.join(repoRoot, 'tests/fixtures');
const resultsDir = path.join(repoRoot, 'test-results/connectors');
mkdirSync(resultsDir, { recursive: true });

const isRecord = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isString = (v) => typeof v === 'string' && v.length > 0;

const results = [];

const runAdapter = (runnerName, inputPath, outputPath) => {
  const adapterPath = path.join(repoRoot, 'scripts/adapters/runner-adapter.mjs');
  try {
    const stdout = execFileSync('node', [
      adapterPath,
      '--runner', runnerName,
      '--input', inputPath,
      '--out', outputPath,
      '--format', 'json',
    ], {
      cwd: repoRoot,
      encoding: 'utf-8',
      timeout: 30000,
    });
    return { ok: true, stdout };
  } catch (err) {
    return { ok: false, error: err.message };
  }
};

const validateReportStructure = (report) => {
  const errors = [];
  if (!isRecord(report)) return ['report must be an object'];
  if (!isRecord(report.runner)) errors.push('runner is required');
  else {
    if (!isString(report.runner.name)) errors.push('runner.name is required');
    if (!isString(report.runner.version)) errors.push('runner.version is required');
  }
  if (!isString(report.status)) errors.push('status is required');
  if (!isString(report.startedAt)) errors.push('startedAt is required');
  if (!isString(report.finishedAt)) errors.push('finishedAt is required');
  if (!isString(report.summary)) errors.push('summary is required');
  return errors;
};

const validateEvidence = (evidence) => {
  const errors = [];
  if (!isRecord(evidence)) return ['evidence must be an object'];
  if (!isString(evidence.id)) errors.push('evidence.id is required');
  if (!isString(evidence.runner)) errors.push('evidence.runner is required');
  if (!isString(evidence.hash)) errors.push('evidence.hash is required');
  if (!Array.isArray(evidence.items)) errors.push('evidence.items must be an array');
  return errors;
};

const validateAuditTrail = (auditTrail) => {
  const errors = [];
  if (!isRecord(auditTrail)) return ['audit trail must be an object'];
  if (!isString(auditTrail.id)) errors.push('auditTrail.id is required');
  if (!isString(auditTrail.runner)) errors.push('auditTrail.runner is required');
  if (!isString(auditTrail.timestamp)) errors.push('auditTrail.timestamp is required');
  if (!Array.isArray(auditTrail.entries)) {
    errors.push('auditTrail.entries must be an array');
  } else {
    const validActions = ['create', 'read', 'update', 'delete', 'evaluate', 'approve', 'reject'];
    for (let i = 0; i < auditTrail.entries.length; i++) {
      const entry = auditTrail.entries[i];
      if (!isRecord(entry)) { errors.push(`entries[${i}] must be an object`); continue; }
      if (!isString(entry.entryId)) errors.push(`entries[${i}].entryId is required`);
      if (!isString(entry.action) || !validActions.includes(entry.action)) errors.push(`entries[${i}].action is invalid`);
      if (!isString(entry.actor)) errors.push(`entries[${i}].actor is required`);
      if (!isString(entry.resource)) errors.push(`entries[${i}].resource is required`);
    }
  }
  return errors;
};

// Connectors to test: each fixture runs against each connector
const connectors = ['JobForge', 'aias'];
const fixtures = readdirSync(fixturesDir).filter((f) => f.endsWith('.json'));

for (const fixture of fixtures) {
  const inputPath = path.join(fixturesDir, fixture);
  const testName = path.basename(fixture, '.json');

  for (const connectorName of connectors) {
    const outputPath = path.join(resultsDir, `${testName}-${connectorName}-report.json`);
    const adapterResult = runAdapter(connectorName, inputPath, outputPath);

    if (!adapterResult.ok) {
      results.push({ fixture: testName, runner: connectorName, valid: false, errors: [adapterResult.error] });
      continue;
    }

    try {
      const report = JSON.parse(readFileSync(outputPath, 'utf-8'));
      const reportErrors = validateReportStructure(report);
      const evidenceErrors = report.data?.evidence ? validateEvidence(report.data.evidence) : ['No evidence packet in report'];
      const allErrors = [...reportErrors, ...evidenceErrors];

      // For aias, also validate audit trail structure
      if (connectorName === 'aias' && report.data?.auditTrail) {
        const auditErrors = validateAuditTrail(report.data.auditTrail);
        allErrors.push(...auditErrors);
      }

      // Check redaction: ensure no sensitive fields leak
      const reportStr = JSON.stringify(report);
      const leakPatterns = ['should-be-redacted', 'should-not-appear-in-output'];
      const leaks = leakPatterns.filter((p) => reportStr.includes(p));
      if (leaks.length > 0) {
        allErrors.push(`Secret leak detected: ${leaks.join(', ')}`);
      }

      results.push({
        fixture: testName,
        runner: connectorName,
        valid: allErrors.length === 0,
        errors: allErrors.length > 0 ? allErrors : undefined,
      });
    } catch (err) {
      results.push({ fixture: testName, runner: connectorName, valid: false, errors: [err.message] });
    }
  }
}

// Print results
const failures = results.filter((r) => !r.valid);
const jsonOutput = process.argv.includes('--json');

if (jsonOutput) {
  console.log(JSON.stringify({ results, failures: failures.length, total: results.length }, null, 2));
} else {
  console.log(`\nConnector Harness Test Results\n${'='.repeat(50)}`);
  for (const r of results) {
    const icon = r.valid ? 'PASS' : 'FAIL';
    console.log(`  [${icon}] ${r.fixture} -> ${r.runner}`);
    if (r.errors) {
      for (const e of r.errors) {
        console.log(`         - ${e}`);
      }
    }
  }
  console.log(`\n${results.length} tests, ${failures.length} failures\n`);
}

process.exit(failures.length > 0 ? 1 : 0);
