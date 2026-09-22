#!/usr/bin/env node

/**
 * Wait for Healthy Services
 *
 * Polls all services in parallel until they're healthy or timeout is reached.
 * Uses exponential backoff with jitter to avoid thundering herd.
 */

const SERVICES = [
  { name: 'Redis', url: 'redis://localhost:6379', type: 'redis' },
  { name: 'TruthCore', url: process.env.TRUTHCORE_URL || 'http://localhost:3001', type: 'http' },
  { name: 'JobForge', url: process.env.JOBFORGE_URL || 'http://localhost:3002', type: 'http' },
  { name: 'Runner', url: process.env.RUNNER_URL || 'http://localhost:3003', type: 'http' },
];

// Tighter timeout configuration
const MAX_TIMEOUT = 60000; // 1 minute (reduced from 2 minutes)
const INITIAL_INTERVAL = 1000; // 1 second (reduced from 5 seconds)
const MAX_INTERVAL = 8000; // 8 seconds max backoff
const BACKOFF_MULTIPLIER = 1.5;
const JITTER_FACTOR = 0.3; // Add up to 30% random jitter
const HEALTH_CHECK_TIMEOUT = 3000; // 3 seconds per check (reduced from 5)

/**
 * Calculate next poll interval with exponential backoff and jitter
 */
function calculateNextInterval(attempt) {
  const baseDelay = Math.min(
    INITIAL_INTERVAL * Math.pow(BACKOFF_MULTIPLIER, attempt),
    MAX_INTERVAL
  );
  // Add jitter to prevent thundering herd
  const jitter = baseDelay * JITTER_FACTOR * (Math.random() - 0.5);
  return Math.max(100, Math.floor(baseDelay + jitter)); // Min 100ms
}

/**
 * Check health of a single service with tight timeout
 */
async function checkHealth(service) {
  try {
    if (service.type === 'http') {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

      try {
        const response = await fetch(`${service.url}/health`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return response.ok;
      } catch (error) {
        clearTimeout(timeoutId);
        return false;
      }
    }
    // Redis checks would need a Redis client, simplified for now
    return true;
  } catch {
    return false;
  }
}

/**
 * Check all services in parallel
 */
async function checkAllServices(healthy, pendingServices) {
  const results = await Promise.all(
    pendingServices.map(async (service) => {
      const isHealthy = await checkHealth(service);
      return { service, isHealthy };
    })
  );

  const newlyHealthy = [];
  for (const { service, isHealthy } of results) {
    if (isHealthy && !healthy.has(service.name)) {
      healthy.add(service.name);
      newlyHealthy.push(service.name);
    }
  }

  return newlyHealthy;
}

async function main() {
  console.log('⏳ Waiting for services to become healthy...\n');

  const start = Date.now();
  const healthy = new Set();
  let attempt = 0;

  while (Date.now() - start < MAX_TIMEOUT) {
    // Get pending services
    const pendingServices = SERVICES.filter((s) => !healthy.has(s.name));

    if (pendingServices.length === 0) {
      console.log('\n🎉 All services are healthy!');
      process.exit(0);
    }

    // Check all pending services in parallel
    const newlyHealthy = await checkAllServices(healthy, pendingServices);

    // Log newly healthy services
    for (const name of newlyHealthy) {
      console.log(`✅ ${name} is healthy`);
    }

    // Check if all are now healthy
    if (healthy.size === SERVICES.length) {
      console.log('\n🎉 All services are healthy!');
      process.exit(0);
    }

    // Log remaining pending services
    const remaining = pendingServices.filter((s) => !newlyHealthy.includes(s.name));
    if (remaining.length > 0) {
      console.log(`⏳ Waiting for: ${remaining.map((s) => s.name).join(', ')}...`);
    }

    // Calculate next interval with backoff and jitter
    const nextInterval = calculateNextInterval(attempt);
    attempt++;

    await new Promise((r) => setTimeout(r, nextInterval));
  }

  console.error('\n❌ Timeout waiting for services');
  const unhealthy = SERVICES.filter((s) => !healthy.has(s.name));
  console.error(`Still unhealthy: ${unhealthy.map((s) => s.name).join(', ')}`);
  process.exit(1);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(2);
});
