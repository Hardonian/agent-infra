import { z, ZodObject } from 'zod';
import type { ZodSchema, ZodIssue } from 'zod';
import {
  JobRequest,
  JobResponse,
  RunnerRegistrationRequest,
  TruthCoreRequest,
  TruthCoreResponse,
} from '@controlplane/contracts';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  path: string;
  message: string;
  code: string;
  value?: unknown;
}

export interface ValidationWarning {
  path: string;
  message: string;
  code: string;
}

export interface ContractTestSuite {
  name: string;
  tests: ContractTest[];
}

export interface ContractTest {
  name: string;
  description: string;
  schema: ZodSchema;
  testData: unknown;
  expectedValid: boolean;
}

export interface ContractTestResultDetail {
  suiteName: string;
  testName: string;
  expectedValid: boolean;
  actualValid: boolean;
  errors: ValidationError[];
}

export interface ContractTestRunSummary {
  passed: number;
  failed: number;
  details: string[];
  results: ContractTestResultDetail[];
}

// Simple LRU cache for validation results to avoid re-validating identical data
class ValidationCache {
  private cache = new Map<string, ValidationResult>();
  private maxSize = 100;

  getKey(schema: ZodSchema, data: unknown): string {
    // Create a deterministic key based on schema shape and data
    const schemaKey = (schema as { _id?: string })._id || String(schema._type);
    const dataKey =
      typeof data === 'object' && data !== null
        ? JSON.stringify(data).slice(0, 500) // Limit key size
        : String(data);
    return `${schemaKey}:${dataKey}`;
  }

  get(key: string): ValidationResult | undefined {
    return this.cache.get(key);
  }

  set(key: string, result: ValidationResult): void {
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, result);
  }

  clear(): void {
    this.cache.clear();
  }
}

const globalValidationCache = new ValidationCache();

export class ContractValidator {
  private results: Map<string, ValidationResult> = new Map();
  private useCache: boolean;
  private cache: ValidationCache;

  constructor(useGlobalCache = true) {
    this.useCache = useGlobalCache;
    this.cache = useGlobalCache ? globalValidationCache : new ValidationCache();
  }

  validate<T>(schema: ZodSchema<T>, data: unknown, context?: string): ValidationResult {
    // Check cache first if enabled
    if (this.useCache) {
      const cacheKey = this.cache.getKey(schema, data);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        if (context) {
          this.results.set(context, cached);
        }
        return cached;
      }
    }

    const result = schema.safeParse(data);

    if (result.success) {
      const validationResult: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      if (this.useCache) {
        this.cache.set(this.cache.getKey(schema, data), validationResult);
      }

      if (context) {
        this.results.set(context, validationResult);
      }

      return validationResult;
    }

    const errors: ValidationError[] = result.error.issues.map((issue: ZodIssue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
      value: issue.path.length > 0 ? this.getValueAtPath(data, issue.path) : undefined,
    }));

    const validationResult: ValidationResult = {
      valid: false,
      errors,
      warnings: [],
    };

    if (this.useCache) {
      this.cache.set(this.cache.getKey(schema, data), validationResult);
    }

    if (context) {
      this.results.set(context, validationResult);
    }

    return validationResult;
  }

  validatePartial(schema: z.ZodTypeAny, data: unknown, context?: string): ValidationResult {
    // Check cache first if enabled (using partial schema)
    if (this.useCache) {
      const cacheKey = `partial:${this.cache.getKey(schema, data)}`;
      const cached = this.cache.get(cacheKey);
      if (cached) {
        if (context) {
          this.results.set(context, cached);
        }
        return cached;
      }
    }

    // Check if schema is a ZodObject that supports partial()
    if (!(schema instanceof ZodObject)) {
      return this.validate(schema, data, context);
    }

    const result = schema.partial().safeParse(data);

    if (result.success) {
      const validationResult: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      if (this.useCache) {
        this.cache.set(`partial:${this.cache.getKey(schema, data)}`, validationResult);
      }

      if (context) {
        this.results.set(context, validationResult);
      }

      return validationResult;
    }

    const errors: ValidationError[] = result.error.issues.map((issue: ZodIssue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }));

    const validationResult: ValidationResult = {
      valid: false,
      errors,
      warnings: [],
    };

    if (this.useCache) {
      this.cache.set(`partial:${this.cache.getKey(schema, data)}`, validationResult);
    }

    if (context) {
      this.results.set(context, validationResult);
    }

    return validationResult;
  }

  runTestSuite(suite: ContractTestSuite): {
    passed: number;
    failed: number;
    results: Map<string, ValidationResult>;
  } {
    let passed = 0;
    let failed = 0;

    for (const test of suite.tests) {
      const result = this.validate(test.schema, test.testData, `${suite.name}.${test.name}`);

      if (result.valid === test.expectedValid) {
        passed++;
      } else {
        failed++;
      }
    }

    return { passed, failed, results: this.results };
  }

  getResults(): Map<string, ValidationResult> {
    return new Map(this.results);
  }

  clearResults(): void {
    this.results.clear();
  }

  private getValueAtPath(obj: unknown, path: (string | number)[]): unknown {
    let current: unknown = obj;
    for (const key of path) {
      if (current === null || current === undefined) return undefined;
      if (typeof current === 'object') {
        current = (current as Record<string | number, unknown>)[key];
      } else {
        return undefined;
      }
    }
    return current;
  }
}

export const predefinedJobRequest = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  type: 'test.job',
  priority: 50,
  payload: {
    type: 'test',
    version: '1.0.0',
    data: { test: true },
    options: {},
  },
  metadata: {
    source: 'test-suite',
    tags: [],
    createdAt: new Date().toISOString(),
  },
  retryPolicy: {
    maxRetries: 3,
    backoffMs: 1000,
    maxBackoffMs: 30000,
    backoffMultiplier: 2,
    retryableCategories: ['TIMEOUT', 'NETWORK_ERROR'],
    nonRetryableCategories: ['VALIDATION_ERROR'],
  },
  timeoutMs: 30000,
};

export const predefinedRunnerRegistration = {
  name: 'test-runner',
  version: '1.0.0',
  contractVersion: { major: 1, minor: 0, patch: 0 },
  capabilities: [
    {
      id: 'test-capability',
      name: 'Test Capability',
      version: '1.0.0',
      description: 'A test capability',
      inputSchema: { type: 'object' },
      outputSchema: { type: 'object' },
      supportedJobTypes: ['test.job'],
      maxConcurrency: 1,
      timeoutMs: 30000,
      resourceRequirements: {},
    },
  ],
  healthCheckEndpoint: 'http://localhost:8080/health',
  tags: [],
};

export const predefinedTruthCoreRequest = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  type: 'assert' as const,
  payload: {},
  metadata: {
    source: 'test-suite',
    timestamp: new Date().toISOString(),
  },
};

export const PredefinedTestSuites: ContractTestSuite[] = [
  {
    name: 'JobForge Contract Tests',
    tests: [
      {
        name: 'valid-job-request',
        description: 'Valid job request must pass validation',
        schema: JobRequest,
        testData: predefinedJobRequest,
        expectedValid: true,
      },
      {
        name: 'invalid-job-request-missing-id',
        description: 'Job request without ID must fail',
        schema: JobRequest,
        testData: { ...predefinedJobRequest, id: undefined },
        expectedValid: false,
      },
      {
        name: 'valid-job-response',
        description: 'Valid job response must pass validation',
        schema: JobResponse,
        testData: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          status: 'completed',
          request: predefinedJobRequest,
          result: {
            success: true,
            data: { result: 'success' },
            metadata: {
              completedAt: new Date().toISOString(),
              durationMs: 1000,
            },
          },
          updatedAt: new Date().toISOString(),
        },
        expectedValid: true,
      },
    ],
  },
  {
    name: 'Runner Contract Tests',
    tests: [
      {
        name: 'valid-runner-registration',
        description: 'Valid runner registration must pass',
        schema: RunnerRegistrationRequest,
        testData: predefinedRunnerRegistration,
        expectedValid: true,
      },
      {
        name: 'invalid-runner-missing-name',
        description: 'Runner without name must fail',
        schema: RunnerRegistrationRequest,
        testData: { ...predefinedRunnerRegistration, name: undefined },
        expectedValid: false,
      },
    ],
  },
  {
    name: 'TruthCore Contract Tests',
    tests: [
      {
        name: 'valid-truthcore-request',
        description: 'Valid TruthCore request must pass',
        schema: TruthCoreRequest,
        testData: predefinedTruthCoreRequest,
        expectedValid: true,
      },
      {
        name: 'valid-truthcore-response',
        description: 'Valid TruthCore response must pass',
        schema: TruthCoreResponse,
        testData: {
          requestId: '550e8400-e29b-41d4-a716-446655440001',
          success: true,
          data: { assertions: [] },
          timestamp: new Date().toISOString(),
        },
        expectedValid: true,
      },
    ],
  },
];

export function createStandardValidator(): ContractValidator {
  return new ContractValidator();
}

export function createCachedValidator(): ContractValidator {
  return new ContractValidator(true);
}

export function runAllContractTestsDetailed(): ContractTestRunSummary {
  const validator = createStandardValidator();
  let totalPassed = 0;
  let totalFailed = 0;
  const details: string[] = [];
  const results: ContractTestResultDetail[] = [];

  for (const suite of PredefinedTestSuites) {
    let suitePassed = 0;
    let suiteFailed = 0;

    for (const test of suite.tests) {
      const context = `${suite.name}.${test.name}`;
      const validation = validator.validate(test.schema, test.testData, context);
      const success = validation.valid === test.expectedValid;
      if (success) {
        suitePassed += 1;
      } else {
        suiteFailed += 1;
      }
      results.push({
        suiteName: suite.name,
        testName: test.name,
        expectedValid: test.expectedValid,
        actualValid: validation.valid,
        errors: validation.errors,
      });
    }

    totalPassed += suitePassed;
    totalFailed += suiteFailed;
    details.push(`${suite.name}: ${suitePassed} passed, ${suiteFailed} failed`);
  }

  return { passed: totalPassed, failed: totalFailed, details, results };
}

export function runAllContractTests(): { passed: number; failed: number; details: string[] } {
  const { passed, failed, details } = runAllContractTestsDetailed();
  return { passed, failed, details };
}

// Export discovery utilities
export * from './discovery.js';

// Export marketplace utilities
export * from './marketplace.js';
