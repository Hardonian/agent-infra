#!/usr/bin/env node
/**
 * TruthCore Determinism Golden Test
 *
 * Verifies that TruthCore evaluation is deterministic:
 * - Same input -> same evidence hash
 * - Stable sort of evidence items
 * - Stable hashing algorithm
 * - Rule engine outputs consistent decisions
 * - Adversarial inputs produce consistent results
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const resultsDir = path.join(repoRoot, 'test-results/golden');
mkdirSync(resultsDir, { recursive: true });

const adapterPath = path.join(repoRoot, 'scripts/adapters/runner-adapter.mjs');

let passed = 0;
let failed = 0;
const failures = [];

const assert = (label, condition, detail) => {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${label}`);
  } else {
    failed++;
    failures.push({ label, detail });
    console.log(`  [FAIL] ${label}: ${detail || 'assertion failed'}`);
  }
};

const runTruthCore = (inputPath, outputPath) => {
  execFileSync('node', [
    adapterPath,
    '--runner', 'truthcore',
    '--input', inputPath,
    '--out', outputPath,
    '--format', 'json',
  ], { cwd: repoRoot, encoding: 'utf-8', timeout: 15000 });
  return JSON.parse(readFileSync(outputPath, 'utf-8'));
};

console.log('\nTruthCore Determinism Golden Tests\n' + '='.repeat(50));

// Test 1: Same input produces same evidence hash across 3 runs
console.log('\n--- Determinism: same input -> same hash ---');
const goldenInput = path.join(repoRoot, 'tests/fixtures/golden-input.json');
const hashes = [];
for (let i = 0; i < 3; i++) {
  const outPath = path.join(resultsDir, `determinism-run-${i}.json`);
  const report = runTruthCore(goldenInput, outPath);
  const evidence = report.data?.evidence;
  hashes.push(evidence?.hash);
}
assert('3 runs produce identical evidence hash', hashes[0] === hashes[1] && hashes[1] === hashes[2],
  `Hashes: ${JSON.stringify(hashes)}`);

// Test 2: Evidence items are sorted by key
console.log('\n--- Stable sort of evidence items ---');
{
  const outPath = path.join(resultsDir, 'sort-check.json');
  const report = runTruthCore(goldenInput, outPath);
  const items = report.data?.evidence?.items || [];
  const keys = items.map((i) => i.key);
  const sortedKeys = [...keys].sort();
  assert('Evidence items sorted by key', JSON.stringify(keys) === JSON.stringify(sortedKeys),
    `Keys: ${JSON.stringify(keys)}`);
}

// Test 3: Decision structure is complete
console.log('\n--- Decision structure validation ---');
{
  const outPath = path.join(resultsDir, 'decision-check.json');
  const report = runTruthCore(goldenInput, outPath);
  const decision = report.data?.evidence?.decision || report.data?.decision;
  assert('Decision has outcome', decision && typeof decision.outcome === 'string');
  assert('Decision has reasons array', decision && Array.isArray(decision.reasons));
  assert('Decision has confidence', decision && typeof decision.confidence === 'number');
  if (decision?.reasons) {
    for (const reason of decision.reasons) {
      assert(`Reason ${reason.ruleId} has message`, typeof reason.message === 'string');
      assert(`Reason ${reason.ruleId} has evidenceRefs`, Array.isArray(reason.evidenceRefs));
    }
  }
}

// Test 4: Adversarial input produces valid output
console.log('\n--- Adversarial input handling ---');
{
  const adversarialInput = path.join(repoRoot, 'tests/fixtures/adversarial-input.json');
  const outPath = path.join(resultsDir, 'adversarial-check.json');
  const report = runTruthCore(adversarialInput, outPath);
  assert('Adversarial input produces valid report', report.status === 'success');
  assert('Adversarial input has evidence', !!report.data?.evidence);

  // Check secret redaction
  const reportStr = JSON.stringify(report);
  assert('Secrets are redacted in output', !reportStr.includes('should-be-redacted'),
    'Found unredacted secret in output');
}

// Test 5: Hash algorithm is SHA-256
console.log('\n--- Hash algorithm verification ---');
{
  const outPath = path.join(resultsDir, 'hash-algo-check.json');
  const report = runTruthCore(goldenInput, outPath);
  const hash = report.data?.evidence?.hash;
  assert('Evidence hash is 64 hex chars (SHA-256)', hash && /^[a-f0-9]{64}$/.test(hash),
    `Hash: ${hash}`);
}

// Test 6: New rules TC-003 (field count), TC-004 (nesting depth), TC-005 (timestamp freshness)
console.log('\n--- New rules: TC-003, TC-004, TC-005 ---');
{
  const outPath = path.join(resultsDir, 'new-rules-check.json');
  const report = runTruthCore(goldenInput, outPath);
  const decision = report.data?.evidence?.decision || report.data?.decision;
  const reasons = decision?.reasons || [];
  const ruleIds = reasons.map((r) => r.ruleId);

  assert('TC-003 (field-count) rule present', ruleIds.includes('TC-003'),
    `Found rule IDs: ${JSON.stringify(ruleIds)}`);
  assert('TC-004 (nesting-depth) rule present', ruleIds.includes('TC-004'),
    `Found rule IDs: ${JSON.stringify(ruleIds)}`);
  // TC-005 only fires when input has a timestamp field
  assert('TC-005 (timestamp-freshness) rule present', ruleIds.includes('TC-005'),
    `Found rule IDs: ${JSON.stringify(ruleIds)}`);

  // Verify field-count evidence item exists
  const items = report.data?.evidence?.items || [];
  const fieldCountItem = items.find((i) => i.key === 'field-count');
  assert('field-count evidence item exists', !!fieldCountItem);
  assert('field-count is a number', fieldCountItem && typeof fieldCountItem.value === 'number');

  const depthItem = items.find((i) => i.key === 'nesting-depth');
  assert('nesting-depth evidence item exists', !!depthItem);
  assert('nesting-depth is a number', depthItem && typeof depthItem.value === 'number');

  const freshnessItem = items.find((i) => i.key === 'timestamp-freshness');
  assert('timestamp-freshness evidence item exists', !!freshnessItem);
}

// Test 7: New rules are deterministic across runs
console.log('\n--- New rules determinism ---');
{
  const ruleResults = [];
  for (let i = 0; i < 3; i++) {
    const outPath = path.join(resultsDir, `new-rules-det-${i}.json`);
    const report = runTruthCore(goldenInput, outPath);
    const decision = report.data?.evidence?.decision || report.data?.decision;
    ruleResults.push(JSON.stringify(decision?.reasons?.map((r) => ({ id: r.ruleId, msg: r.message }))));
  }
  assert('New rules produce identical reasons across 3 runs',
    ruleResults[0] === ruleResults[1] && ruleResults[1] === ruleResults[2],
    `Mismatch between runs`);
}

// Test 8: Deeply nested adversarial triggers TC-004 appropriately
console.log('\n--- Deep nesting guard (TC-004) ---');
{
  const adversarialInput = path.join(repoRoot, 'tests/fixtures/adversarial-input.json');
  const outPath = path.join(resultsDir, 'deep-nesting-check.json');
  const report = runTruthCore(adversarialInput, outPath);
  const items = report.data?.evidence?.items || [];
  const depthItem = items.find((i) => i.key === 'nesting-depth');
  assert('Adversarial input nesting-depth is captured', !!depthItem);
  assert('Adversarial input nesting-depth is >= 4', depthItem && depthItem.value >= 4,
    `Depth: ${depthItem?.value}`);
}

// Test 9: aias runner produces valid report + audit trail
console.log('\n--- aias runner validation ---');
{
  const runAias = (inputPath, outputPath) => {
    execFileSync('node', [
      adapterPath,
      '--runner', 'aias',
      '--input', inputPath,
      '--out', outputPath,
      '--format', 'json',
    ], { cwd: repoRoot, encoding: 'utf-8', timeout: 15000 });
    return JSON.parse(readFileSync(outputPath, 'utf-8'));
  };

  const aiasInput = path.join(repoRoot, 'tests/fixtures/aias-audit.json');
  const outPath = path.join(resultsDir, 'aias-check.json');
  const report = runAias(aiasInput, outPath);

  assert('aias produces success report', report.status === 'success');
  assert('aias has evidence packet', !!report.data?.evidence);
  assert('aias has audit trail', !!report.data?.auditTrail);

  const auditTrail = report.data.auditTrail;
  assert('audit trail has id', typeof auditTrail.id === 'string' && auditTrail.id.length > 0);
  assert('audit trail has entries array', Array.isArray(auditTrail.entries));
  assert('audit trail has 3 entries (3 resources)', auditTrail.entries.length === 3,
    `Got ${auditTrail.entries.length} entries`);

  // Every entry should have evaluate action
  const allEvaluate = auditTrail.entries.every((e) => e.action === 'evaluate');
  assert('All audit entries use evaluate action', allEvaluate);

  // Summary should be correct
  assert('audit trail summary.totalEntries matches', auditTrail.summary?.totalEntries === 3,
    `Got ${auditTrail.summary?.totalEntries}`);
  assert('audit trail summary.passed matches', auditTrail.summary?.passed === 3);

  // Decision should reference AIAS rules
  const decision = report.data?.evidence?.decision || report.data?.decision;
  assert('aias decision has AIAS-001 rule', decision?.reasons?.some((r) => r.ruleId === 'AIAS-001'));
  assert('aias decision has AIAS-002 rule', decision?.reasons?.some((r) => r.ruleId === 'AIAS-002'));
}

// Test 10: aias secret redaction
console.log('\n--- aias secret redaction ---');
{
  const runAias = (inputPath, outputPath) => {
    execFileSync('node', [
      adapterPath,
      '--runner', 'aias',
      '--input', inputPath,
      '--out', outputPath,
      '--format', 'json',
    ], { cwd: repoRoot, encoding: 'utf-8', timeout: 15000 });
    return JSON.parse(readFileSync(outputPath, 'utf-8'));
  };

  const adversarialInput = path.join(repoRoot, 'tests/fixtures/aias-adversarial.json');
  const outPath = path.join(resultsDir, 'aias-adversarial-check.json');
  const report = runAias(adversarialInput, outPath);
  const reportStr = JSON.stringify(report);
  assert('aias adversarial: secrets redacted', !reportStr.includes('should-not-appear-in-output'),
    'Found unredacted secret in aias output');
  assert('aias adversarial: produces valid report', report.status === 'success');
}

// Summary
console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failures.length > 0) {
  console.log('\nFailures:');
  for (const f of failures) {
    console.log(`  - ${f.label}: ${f.detail || ''}`);
  }
}

process.exit(failed > 0 ? 1 : 0);
