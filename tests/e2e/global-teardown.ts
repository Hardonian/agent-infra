import type { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('Tearing down E2E test environment...');

  // Any cleanup needed

  console.log('E2E teardown complete');
}

export default globalTeardown;
