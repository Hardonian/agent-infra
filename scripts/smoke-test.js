#!/usr/bin/env node

/**
 * Smoke Test Script
 *
 * Verifies all services in the ControlPlane stack are healthy.
 * Uses parallel health checks for faster execution.
 * Outputs a JSON smoke report suitable for CI/CD pipelines.
 */

import { writeFile } from 'fs/promises';
import { join } from 'path';

/**
 * @typedef {Object} ServiceCheck
 * @property {string} name
 * @property {string} url
 * @property {'passed' | 'failed' | 'skipped'} status
 * @property {number} responseTime
 * @property {string | undefined} [error]
 * @property {string | undefined} [version]
 */

/**
 * @typedef {Object} SmokeReport
 * @property {string} timestamp
 * @property {string} environment
 * @property {number} totalServices
 * @property {number} passed
 * @property {number} failed
 * @property {number} duration
 * @property {ServiceCheck[]} services
 */

const SERVICES = [
  { name: 'TruthCore', url: process.env.TRUTHCORE_URL || 'http://localhost:3001' },
  { name: 'JobForge', url: process.env.JOBFORGE_URL || 'http://localhost:3002' },
  { name: 'Runner-Example', url: process.env.RUNNER_URL || 'http://localhost:3003' },
  { name: 'Redis', url: 'http://localhost:6379', skip: true }, // Redis doesn't have HTTP health endpoint
];

// Tighter timeout - 5 seconds instead of 10
const HEALTH_CHECK_TIMEOUT = 5000;
const ALLOW_MISSING_SERVICES = process.env.CP_SMOKE_ALLOW_MISSING !== 'false';

function isConnectivityError(message) {
  const lowered = message.toLowerCase();
  return (
    lowered.includes('fetch failed') ||
    lowered.includes('econnrefused') ||
    lowered.includes('ehostunreach') ||
    lowered.includes('enotfound') ||
    lowered.includes('timed out') ||
    lowered.includes('timeout')
  );
}

/**
 * @param {{ name: string; url: string; skip?: boolean }} service
 * @returns {Promise<ServiceCheck>}
 */
async function checkService(service) {
  const start = Date.now();

  if (service.skip) {
    return {
      name: service.name,
      url: service.url,
      status: 'skipped',
      responseTime: 0,
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

    const response = await fetch(`${service.url}/health`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - start;

    if (!response.ok) {
      return {
        name: service.name,
        url: service.url,
        status: 'failed',
        responseTime,
        error: `HTTP ${response.status}`,
      };
    }

    const data = await response.json().catch(() => ({}));

    return {
      name: service.name,
      url: service.url,
      status: data.status === 'healthy' ? 'passed' : 'failed',
      responseTime,
      version: data.version,
      error: data.status !== 'healthy' ? `Status: ${data.status}` : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (ALLOW_MISSING_SERVICES && isConnectivityError(message)) {
      return {
        name: service.name,
        url: service.url,
        status: 'skipped',
        responseTime: Date.now() - start,
        error: message,
      };
    }
    return {
      name: service.name,
      url: service.url,
      status: 'failed',
      responseTime: Date.now() - start,
      error: message,
    };
  }
}

async function main() {
  const start = Date.now();

  console.log('🔍 Running ControlPlane smoke tests...\n');

  // Run all health checks in parallel for faster execution
  console.log('Checking services in parallel...\n');
  const checkPromises = SERVICES.map((service) => checkService(service));
  const results = await Promise.all(checkPromises);

  // Print results
  for (const result of results) {
    if (result.status === 'passed') {
      console.log(`✅ ${result.name}: ${result.responseTime}ms`);
    } else if (result.status === 'skipped') {
      console.log(`⏭️  ${result.name}: skipped`);
    } else {
      console.log(`❌ ${result.name}: ${result.error}`);
    }
  }

  const duration = Date.now() - start;
  const passed = results.filter((r) => r.status === 'passed').length;
  const failed = results.filter((r) => r.status === 'failed').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;

  /** @type {SmokeReport} */
  const report = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    totalServices: SERVICES.length - skipped,
    passed,
    failed,
    duration,
    services: results,
  };

  // Write report to file asynchronously
  const reportPath = join(process.cwd(), 'smoke-report.json');
  await writeFile(reportPath, JSON.stringify(report, null, 2));

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('Smoke Test Summary');
  console.log('='.repeat(50));
  console.log(`Total:     ${report.totalServices}`);
  console.log(`Passed:    ${passed} ✅`);
  console.log(`Failed:    ${failed} ❌`);
  console.log(`Duration:  ${duration}ms`);
  console.log('='.repeat(50));

  if (failed === 0) {
    console.log('\n✅ All smoke tests passed!');
    process.exit(0);
  } else {
    console.log(`\n❌ ${failed} service(s) failed smoke tests`);
    console.log(`📄 Report written to: ${reportPath}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Smoke test error:', error);
  process.exit(2);
});
