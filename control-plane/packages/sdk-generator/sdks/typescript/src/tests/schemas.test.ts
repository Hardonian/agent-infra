import { describe, expect, it } from 'vitest';
import { ErrorSeveritySchema } from '../schemas.js';

describe('generated schemas', () => {
  it('round-trips a valid value through JSON', () => {
    const value = ErrorSeveritySchema.parse('error');
    const roundTripped = ErrorSeveritySchema.parse(JSON.parse(JSON.stringify(value)));

    expect(roundTripped).toBe(value);
  });
});
