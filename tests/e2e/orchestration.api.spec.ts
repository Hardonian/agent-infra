import { test, expect } from '@playwright/test';
import { z } from 'zod';
import { JobRequest, JobResponse, ErrorEnvelope, ErrorCategory } from '@controlplane/contracts';

const TRUTHCORE_URL = process.env.TRUTHCORE_URL || 'http://localhost:3001';
const JOBFORGE_URL = process.env.JOBFORGE_URL || 'http://localhost:3002';
const RUNNER_URL = process.env.RUNNER_URL || 'http://localhost:3003';

// Polling configuration with exponential backoff
const POLLING_CONFIG = {
  initialIntervalMs: 500, // Start with 500ms (tighter than 1000ms)
  maxIntervalMs: 3000, // Max 3 seconds between polls
  backoffMultiplier: 1.5, // 1.5x exponential growth
  maxAttempts: 25, // Max ~30 seconds total with backoff
};

/**
 * Calculate polling interval with exponential backoff
 */
function getPollingInterval(attempt: number): number {
  const interval = Math.min(
    POLLING_CONFIG.initialIntervalMs * Math.pow(POLLING_CONFIG.backoffMultiplier, attempt),
    POLLING_CONFIG.maxIntervalMs
  );
  // Add small jitter (±50ms) to avoid thundering herd in CI
  const jitter = (Math.random() - 0.5) * 100;
  return Math.max(100, Math.floor(interval + jitter));
}

test.describe('Happy Path: Full Job Lifecycle', () => {
  test('complete job flow: JobForge -> Runner -> TruthCore -> Response', async ({ request }) => {
    // 1. Submit job to JobForge
    const jobPayload = {
      id: crypto.randomUUID(),
      type: 'test.echo',
      priority: 50,
      payload: {
        type: 'echo',
        version: '1.0.0',
        data: { message: 'Hello, ControlPlane!' },
        options: {},
      },
      metadata: {
        source: 'e2e-test',
        tags: ['e2e', 'happy-path'],
        createdAt: new Date().toISOString(),
      },
      retryPolicy: {
        maxRetries: 3,
        backoffMs: 1000,
        maxBackoffMs: 30000,
        backoffMultiplier: 2,
        retryableCategories: [],
        nonRetryableCategories: [],
      },
      timeoutMs: 30000,
    };

    const submitResponse = await request.post(`${JOBFORGE_URL}/jobs`, {
      data: jobPayload,
    });

    expect(submitResponse.status()).toBe(202);
    const submitResult = await submitResponse.json();

    // Validate response schema
    const parsedSubmit = JobResponse.safeParse(submitResult);
    expect(
      parsedSubmit.success,
      `JobResponse validation failed: ${parsedSubmit.success ? '' : JSON.stringify(parsedSubmit.error.issues)}`
    ).toBe(true);
    expect(submitResult.status).toBe('queued');

    const jobId = submitResult.id;

    // 2. Poll for job completion with exponential backoff
    let completed = false;
    let attempts = 0;
    let finalResult: unknown;

    while (!completed && attempts < POLLING_CONFIG.maxAttempts) {
      const statusResponse = await request.get(`${JOBFORGE_URL}/jobs/${jobId}`);
      expect(statusResponse.status()).toBe(200);

      finalResult = await statusResponse.json();
      const parsedStatus = JobResponse.safeParse(finalResult);
      expect(parsedStatus.success).toBe(true);

      const status = (finalResult as { status: string }).status;
      if (status === 'completed' || status === 'failed') {
        completed = true;
      } else {
        attempts++;
        // Use exponential backoff with jitter
        const waitMs = getPollingInterval(attempts);
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }

    expect(completed, 'Job did not complete within timeout').toBe(true);
    expect((finalResult as { status: string }).status).toBe('completed');
    expect((finalResult as { result: { success: boolean } }).result.success).toBe(true);
  });

  test('truth assertion is stored and retrievable', async ({ request }) => {
    const assertion = {
      id: crypto.randomUUID(),
      subject: 'e2e-test',
      predicate: 'test.completed',
      object: { testId: crypto.randomUUID(), result: 'success' },
      confidence: 1.0,
      timestamp: new Date().toISOString(),
      source: 'e2e-test',
      metadata: { test: 'truth-storage' },
    };

    // Submit assertion
    const assertResponse = await request.post(`${TRUTHCORE_URL}/assert`, {
      data: assertion,
    });

    expect(assertResponse.ok()).toBeTruthy();

    // Query for the assertion
    const query = {
      pattern: {
        subject: assertion.subject,
        predicate: assertion.predicate,
      },
      limit: 10,
    };

    const queryResponse = await request.post(`${TRUTHCORE_URL}/query`, {
      data: query,
    });

    expect(queryResponse.ok()).toBeTruthy();
    const queryResult = await queryResponse.json();

    expect(queryResult.assertions).toBeDefined();
    expect(queryResult.assertions.length).toBeGreaterThan(0);
    expect(queryResult.assertions.some((a: { id: string }) => a.id === assertion.id)).toBe(true);
  });
});

test.describe('Degraded Path: Runner Unavailable', () => {
  test('JobForge returns recoverable error when runner is down', async ({ request }) => {
    // Submit job with runner that doesn't exist
    const jobPayload = {
      id: crypto.randomUUID(),
      type: 'test.nonexistent',
      priority: 50,
      payload: {
        type: 'nonexistent',
        version: '1.0.0',
        data: {},
        options: {},
      },
      metadata: {
        source: 'e2e-test',
        tags: ['e2e', 'degraded-runner'],
        createdAt: new Date().toISOString(),
      },
      retryPolicy: {
        maxRetries: 1,
        backoffMs: 500,
        maxBackoffMs: 5000,
        backoffMultiplier: 2,
        retryableCategories: ['RUNTIME_ERROR', 'SERVICE_UNAVAILABLE'],
        nonRetryableCategories: ['VALIDATION_ERROR'],
      },
      timeoutMs: 10000,
    };

    const response = await request.post(`${JOBFORGE_URL}/jobs`, {
      data: jobPayload,
    });

    // Should not hard-fail
    expect(response.status()).toBeLessThan(500);

    const result = await response.json();

    // Validate error envelope if present
    if (result.error) {
      const parsedError = ErrorEnvelope.safeParse(result.error);
      expect(parsedError.success).toBe(true);

      // Error should be retryable (SERVICE_UNAVAILABLE or RUNTIME_ERROR)
      expect(['SERVICE_UNAVAILABLE', 'RUNTIME_ERROR']).toContain(result.error.category);
      expect(result.error.retryable).toBe(true);
    }
  });
});

test.describe('Degraded Path: TruthCore Unavailable', () => {
  test('JobForge returns recoverable error when TruthCore is down', async ({ request }) => {
    // Job that requires truth assertion but truthcore is unavailable
    const jobPayload = {
      id: crypto.randomUUID(),
      type: 'test.truth-dependent',
      priority: 50,
      payload: {
        type: 'truth-dependent',
        version: '1.0.0',
        data: { requiresTruth: true },
        options: {},
      },
      metadata: {
        source: 'e2e-test',
        tags: ['e2e', 'degraded-truthcore'],
        createdAt: new Date().toISOString(),
      },
      retryPolicy: {
        maxRetries: 3,
        backoffMs: 1000,
        maxBackoffMs: 10000,
        backoffMultiplier: 2,
        retryableCategories: ['TRUTHCORE_ERROR', 'SERVICE_UNAVAILABLE', 'NETWORK_ERROR'],
        nonRetryableCategories: ['VALIDATION_ERROR'],
      },
      timeoutMs: 15000,
    };

    const response = await request.post(`${JOBFORGE_URL}/jobs`, {
      data: jobPayload,
    });

    // Should not hard-500
    expect(response.status()).toBeLessThan(500);

    const result = await response.json();

    // Should have error info
    if (result.error || result.status === 'failed') {
      expect(result.error || result.result?.error).toBeDefined();
    }
  });
});

test.describe('Bad Input Path: Schema Validation', () => {
  test('invalid job request returns validation error', async ({ request }) => {
    const invalidPayload = {
      // Missing required fields: id, type
      priority: 50,
      payload: {
        type: 'test',
        data: {},
      },
      metadata: {
        createdAt: new Date().toISOString(),
      },
    };

    const response = await request.post(`${JOBFORGE_URL}/jobs`, {
      data: invalidPayload,
    });

    // Should return 400, not 500
    expect(response.status()).toBe(400);

    const result = await response.json();

    // Should have structured error
    expect(result.error).toBeDefined();
    const parsedError = ErrorEnvelope.safeParse(result.error);
    expect(parsedError.success).toBe(true);
    expect(result.error.category).toBe('VALIDATION_ERROR');
  });

  test('invalid truth assertion returns validation error', async ({ request }) => {
    const invalidAssertion = {
      // Missing required fields: subject, predicate
      object: { test: true },
      timestamp: new Date().toISOString(),
    };

    const response = await request.post(`${TRUTHCORE_URL}/assert`, {
      data: invalidAssertion,
    });

    expect(response.status()).toBe(400);

    const result = await response.json();
    expect(result.error).toBeDefined();
    expect(result.error.category).toBe('VALIDATION_ERROR');
  });

  test('malformed JSON returns proper error', async ({ request }) => {
    const response = await request.post(`${JOBFORGE_URL}/jobs`, {
      data: '{invalid json}',
      headers: { 'Content-Type': 'application/json' },
    });

    expect(response.status()).toBe(400);
  });
});

test.describe('Health Checks', () => {
  test('all services report healthy', async ({ request }) => {
    const services = [
      { name: 'TruthCore', url: TRUTHCORE_URL },
      { name: 'JobForge', url: JOBFORGE_URL },
      { name: 'Runner', url: RUNNER_URL },
    ];

    // Check all services in parallel for faster execution
    const healthChecks = services.map(async (service) => {
      const response = await request.get(`${service.url}/health`);
      expect(response.ok(), `${service.name} health check failed`).toBeTruthy();

      const result = await response.json();
      expect(result.status).toBe('healthy');

      // Validate health check schema
      expect(result.service || result.name).toBeDefined();
      expect(result.version).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    await Promise.all(healthChecks);
  });
});
