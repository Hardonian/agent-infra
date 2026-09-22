// Auto-generated validation utilities
// DO NOT EDIT MANUALLY - regenerate from source

import { z } from 'zod';

/**
 * Validates data against a Zod schema
 * @throws {z.ZodError} If validation fails
 */
export function validate<T>(schema: z.ZodType<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Safely validates data without throwing
 * @returns Object with success flag and either data or error
 */
export function safeValidate<T>(
  schema: z.ZodType<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Creates a validator function for a specific schema
 * Useful for form validation and API middleware
 */
export function createValidator<T>(schema: z.ZodType<T>) {
  return {
    parse: (data: unknown): T => schema.parse(data),
    safeParse: (data: unknown) => schema.safeParse(data),
    assert: (data: unknown): asserts data is T => {
      schema.parse(data);
    },
  };
}
