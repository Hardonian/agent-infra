import type { FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('Setting up E2E test environment...');

  // Verify services are running
  const services = [
    process.env.TRUTHCORE_URL || 'http://localhost:3001',
    process.env.JOBFORGE_URL || 'http://localhost:3002',
    process.env.RUNNER_URL || 'http://localhost:3003',
  ];

  for (const url of services) {
    try {
      const response = await fetch(`${url}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        console.warn(`Warning: ${url} health check returned ${response.status}`);
      } else {
        console.log(`✓ ${url} is healthy`);
      }
    } catch (error) {
      console.warn(`Warning: Could not reach ${url}: ${(error as Error).message}`);
    }
  }

  console.log('E2E setup complete');
}

export default globalSetup;
