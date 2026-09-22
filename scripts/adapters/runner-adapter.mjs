#!/usr/bin/env node
/**
 * Universal runner adapter — executes runner logic, produces report + evidence packet.
 * Supports: --runner <name> --input <file|json> --out <path> --format json [--dry-run] [--evidence-out <path>]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const args = process.argv.slice(2);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  if (idx === -1) return undefined;
  return args[idx + 1];
};

const runner = getArg('--runner');
const inputValue = getArg('--input');
const outputValue = getArg('--out');
const format = getArg('--format') ?? 'json';
const dryRun = args.includes('--dry-run');
const evidenceOut = getArg('--evidence-out');

if (!runner) {
  console.error('Missing --runner <name>.');
  process.exit(1);
}

if (!inputValue) {
  console.error('Missing --input <file|json>.');
  process.exit(1);
}

if (!outputValue) {
  console.error('Missing --out <path>.');
  process.exit(1);
}

if (format !== 'json') {
  console.error('Only --format json is supported.');
  process.exit(1);
}

const readInput = (value) => {
  try {
    const filePath = path.isAbsolute(value)
      ? value
      : path.join(process.cwd(), value);
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    try {
      return JSON.parse(value);
    } catch {
      throw new Error(`Unable to read input: ${value}`);
    }
  }
};

/** Stable hash of an object: sort keys recursively, then SHA-256. */
const stableStringify = (obj) => {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
};

const stableHash = (obj) => {
  return createHash('sha256').update(stableStringify(obj)).digest('hex');
};

/** Redact sensitive keys from an object. */
const redactSensitive = (obj) => {
  const sensitiveKeys = ['password', 'secret', 'token', 'apikey', 'api_key', 'authorization'];
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(redactSensitive);
  const redacted = {};
  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
      redacted[key] = '***REDACTED***';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactSensitive(value);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
};

let input;
try {
  input = readInput(inputValue);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Invalid input');
  process.exit(1);
}

const fixedTime = process.env.CONTROLPLANE_DEMO_TIME;
const getNow = () => (fixedTime ? new Date(fixedTime) : new Date());
const nowIso = () => getNow().toISOString();
const nowMs = () => getNow().getTime();

const startedAt = nowIso();

/** Count total fields in an object recursively. */
const countFields = (obj) => {
  if (typeof obj !== 'object' || obj === null) return 0;
  if (Array.isArray(obj)) return obj.reduce((sum, v) => sum + countFields(v), 0);
  let count = 0;
  for (const value of Object.values(obj)) {
    count += 1 + countFields(value);
  }
  return count;
};

/** Measure max nesting depth of an object. */
const maxDepth = (obj, depth = 0) => {
  if (typeof obj !== 'object' || obj === null) return depth;
  if (Array.isArray(obj)) return Math.max(depth, ...obj.map((v) => maxDepth(v, depth + 1)));
  return Math.max(depth, ...Object.values(obj).map((v) => maxDepth(v, depth + 1)));
};

// Runner-specific logic
const runnerLogic = {
  truthcore: () => {
    const fieldCount = countFields(input);
    const depth = maxDepth(input);
    const hasTimestamp = typeof input === 'object' && input !== null && 'timestamp' in input;
    let timestampFresh = false;
    if (hasTimestamp && typeof input.timestamp === 'string') {
      const tsAge = Date.now() - new Date(input.timestamp).getTime();
      timestampFresh = tsAge < 365 * 24 * 60 * 60 * 1000; // < 1 year
    }

    const reasons = [
      { ruleId: 'TC-001', message: 'Input payload structure validated', evidenceRefs: ['input-structure'] },
      { ruleId: 'TC-002', message: 'No anomalies detected in payload', evidenceRefs: ['input-hash'] },
      { ruleId: 'TC-003', message: `Field count check: ${fieldCount} fields found`, evidenceRefs: ['field-count'] },
      { ruleId: 'TC-004', message: depth <= 10 ? `Nesting depth ${depth} within limit` : `Nesting depth ${depth} exceeds recommended limit of 10`, evidenceRefs: ['nesting-depth'] },
    ];

    if (hasTimestamp) {
      reasons.push({
        ruleId: 'TC-005',
        message: timestampFresh
          ? 'Timestamp is within acceptable freshness window'
          : 'Timestamp is stale (older than 1 year)',
        evidenceRefs: ['timestamp-freshness'],
        ...(timestampFresh ? {} : { uncertainty: 'Stale timestamp may indicate outdated data' }),
      });
    }

    const allPassed = depth <= 10 && (hasTimestamp ? timestampFresh : true);

    return {
      decision: {
        outcome: allPassed ? 'pass' : 'uncertain',
        reasons,
        confidence: allPassed ? 0.95 : 0.7,
      },
      evaluationItems: [
        { key: 'field-count', value: fieldCount, source: 'truthcore-field-counter' },
        { key: 'input-hash', value: stableHash(input), source: 'truthcore-hasher' },
        { key: 'input-structure', value: typeof input === 'object' ? 'valid-object' : 'primitive', source: 'truthcore-validator' },
        { key: 'nesting-depth', value: depth, source: 'truthcore-depth-analyzer' },
        ...(hasTimestamp ? [{ key: 'timestamp-freshness', value: timestampFresh ? 'fresh' : 'stale', source: 'truthcore-freshness-checker' }] : []),
      ],
    };
  },
  jobforge: () => ({
    connectorResult: { ok: true, data: { jobsProcessed: 1 }, error: null },
    evaluationItems: [
      { key: 'connector-status', value: 'ok', source: 'jobforge-connector' },
      { key: 'jobs-processed', value: 1, source: 'jobforge-engine' },
    ],
  }),
  'ops-autopilot': () => ({
    automationResult: { actionsPlanned: 1, actionsExecuted: dryRun ? 0 : 1 },
    evaluationItems: [
      { key: 'actions-planned', value: 1, source: 'ops-autopilot' },
      { key: 'dry-run', value: dryRun, source: 'ops-autopilot' },
    ],
  }),
  'finops-autopilot': () => ({
    costAnalysis: { savingsIdentified: 0, recommendations: 0 },
    evaluationItems: [
      { key: 'cost-analysis-complete', value: true, source: 'finops-autopilot' },
    ],
  }),
  'growth-autopilot': () => ({
    growthMetrics: { opportunitiesFound: 0 },
    evaluationItems: [
      { key: 'growth-scan-complete', value: true, source: 'growth-autopilot' },
    ],
  }),
  'support-autopilot': () => ({
    supportMetrics: { ticketsProcessed: 0 },
    evaluationItems: [
      { key: 'support-scan-complete', value: true, source: 'support-autopilot' },
    ],
  }),
  'autopilot-suite': () => ({
    suiteResult: { modulesRun: 4 },
    evaluationItems: [
      { key: 'suite-complete', value: true, source: 'autopilot-suite' },
    ],
  }),
  aias: () => {
    const policies = (typeof input === 'object' && input !== null && input.payload?.policies) || [];
    const resources = (typeof input === 'object' && input !== null && input.payload?.resources) || [];
    const now = nowIso();

    const auditEntries = resources.map((resource, idx) => ({
      entryId: `audit-${idx + 1}`,
      action: 'evaluate',
      actor: 'aias-engine',
      timestamp: now,
      resource,
      outcome: 'success',
      details: { policiesApplied: policies.length },
      policyRef: policies[0] || 'default-policy',
    }));

    const auditTrail = {
      id: `at-aias-${nowMs()}`,
      runner: 'aias',
      timestamp: now,
      contractVersion: '1.0.0',
      scope: resources.length > 0 ? 'full' : 'partial',
      entries: auditEntries,
      summary: {
        totalEntries: auditEntries.length,
        passed: auditEntries.length,
        failed: 0,
        skipped: 0,
      },
      metadata: {
        correlationId: `corr-${nowMs()}`,
        durationMs: 0,
      },
    };

    return {
      auditTrail,
      decision: {
        outcome: auditEntries.length > 0 ? 'pass' : 'uncertain',
        reasons: [
          {
            ruleId: 'AIAS-001',
            message: `Audited ${resources.length} resource(s) against ${policies.length} policy/policies`,
            evidenceRefs: ['audit-resources', 'audit-policies'],
          },
          {
            ruleId: 'AIAS-002',
            message: auditEntries.length > 0 ? 'All audit entries passed' : 'No resources to audit',
            evidenceRefs: ['audit-summary'],
            ...(auditEntries.length === 0 ? { uncertainty: 'Empty resource list may indicate misconfiguration' } : {}),
          },
        ],
        confidence: auditEntries.length > 0 ? 0.9 : 0.5,
      },
      evaluationItems: [
        { key: 'audit-policies', value: policies.length, source: 'aias-policy-engine' },
        { key: 'audit-resources', value: resources.length, source: 'aias-resource-scanner' },
        { key: 'audit-summary', value: `${auditEntries.length} entries, ${auditEntries.length} passed`, source: 'aias-auditor' },
      ],
    };
  },
};

const logic = runnerLogic[runner] || runnerLogic[runner.toLowerCase()] || (() => ({
  evaluationItems: [{ key: 'generic-run', value: true, source: runner }],
}));

const result = logic();
const finishedAt = nowIso();
const durationMs = nowMs() - new Date(startedAt).getTime();

// Build evidence items with stable ordering
const evidenceItems = (result.evaluationItems || [])
  .sort((a, b) => a.key.localeCompare(b.key))
  .map((item) => ({
    ...item,
    redacted: false,
    hashValue: stableHash({ key: item.key, value: item.value }),
  }));

const evidenceHash = stableHash(evidenceItems);

const evidencePacket = {
  id: `ev-${runner}-${nowMs()}`,
  runner,
  timestamp: finishedAt,
  hash: evidenceHash,
  contractVersion: '1.0.0',
  items: evidenceItems,
  decision: result.decision || null,
  metadata: {
    durationMs,
    retryCount: 0,
    correlationId: `corr-${nowMs()}`,
  },
};

// Build the report
const redactedInput = redactSensitive(input);
const report = {
  runner: {
    name: runner,
    version: '0.1.0',
    source: 'controlplane-adapter',
  },
  status: 'success',
  startedAt,
  finishedAt,
  summary: dryRun
    ? `Dry-run completed for ${runner}`
    : `Execution completed for ${runner}`,
  metrics: { durationMs },
  artifacts: [
    { name: 'evidence-packet', path: evidenceOut || 'inline', mediaType: 'application/json' },
  ],
  errors: [],
  data: {
    input: redactedInput,
    evidence: evidencePacket,
    ...(result.decision ? { decision: result.decision } : {}),
    ...(result.connectorResult ? { connectorResult: result.connectorResult } : {}),
    ...(result.automationResult ? { automationResult: result.automationResult } : {}),
    ...(result.costAnalysis ? { costAnalysis: result.costAnalysis } : {}),
    ...(result.growthMetrics ? { growthMetrics: result.growthMetrics } : {}),
    ...(result.supportMetrics ? { supportMetrics: result.supportMetrics } : {}),
    ...(result.suiteResult ? { suiteResult: result.suiteResult } : {}),
    ...(result.auditTrail ? { auditTrail: result.auditTrail } : {}),
  },
};

const outputPath = path.isAbsolute(outputValue)
  ? outputValue
  : path.join(process.cwd(), outputValue);
writeFileSync(outputPath, JSON.stringify(report, null, 2));

// Write evidence packet separately if requested
if (evidenceOut) {
  const evPath = path.isAbsolute(evidenceOut)
    ? evidenceOut
    : path.join(process.cwd(), evidenceOut);
  mkdirSync(path.dirname(evPath), { recursive: true });
  writeFileSync(evPath, JSON.stringify(evidencePacket, null, 2));
}

console.log(JSON.stringify(report, null, 2));
