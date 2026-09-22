import { describe, expect, it } from 'vitest';
import { runAllContractTests, runAllContractTestsDetailed } from '../src/index.js';

describe('runAllContractTestsDetailed', () => {
  it('matches summary results from runAllContractTests', () => {
    const detailed = runAllContractTestsDetailed();
    const summary = runAllContractTests();

    expect(detailed.passed).toBe(summary.passed);
    expect(detailed.failed).toBe(summary.failed);
    expect(detailed.details).toEqual(summary.details);
    expect(detailed.results.length).toBe(detailed.passed + detailed.failed);
  });
});
