import { describe, it, expect } from 'vitest';
import type { z } from 'zod';
import { extractSchemas, validateSchemas, DEFAULT_CONFIG } from '../core.js';
import { generateTypeScriptSDK } from '../generators/typescript.js';
import { generatePythonSDK } from '../generators/python.js';
import { generateGoSDK } from '../generators/go.js';

describe('SDK Generator', () => {
  describe('Core functionality', () => {
    it('should extract schemas from contracts', async () => {
      const schemas = await extractSchemas();
      expect(schemas.length).toBeGreaterThan(0);
      expect(schemas.some((s) => s.name === 'JobRequest')).toBe(true);
      expect(schemas.some((s) => s.name === 'ErrorEnvelope')).toBe(true);
      expect(schemas.some((s) => s.name === 'ContractVersion')).toBe(true);
    });

    it('should validate schemas successfully', async () => {
      const schemas = await extractSchemas();
      const validation = validateSchemas(schemas);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect duplicate schema names', () => {
      const schemas = [
        { name: 'Test', schema: {} as z.ZodTypeAny, jsonSchema: {}, category: 'types' as const },
        { name: 'Test', schema: {} as z.ZodTypeAny, jsonSchema: {}, category: 'types' as const },
      ];
      const validation = validateSchemas(schemas);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Duplicate schema names found: Test');
    });
  });

  describe('TypeScript SDK', () => {
    it('should generate TypeScript SDK files', async () => {
      const schemas = await extractSchemas();
      const sdk = generateTypeScriptSDK(schemas, DEFAULT_CONFIG);

      expect(sdk.language).toBe('typescript');
      expect(sdk.files.has('src/schemas.ts')).toBe(true);
      expect(sdk.files.has('src/types.ts')).toBe(true);
      expect(sdk.files.has('src/client.ts')).toBe(true);
      expect(sdk.files.has('src/index.ts')).toBe(true);
      expect(sdk.files.has('src/validation.ts')).toBe(true);
      expect(sdk.files.has('README.md')).toBe(true);
      expect(sdk.packageConfig.name).toBe('@controlplane/sdk');
    });

    it('should generate valid TypeScript schemas with Zod', async () => {
      const schemas = await extractSchemas();
      const sdk = generateTypeScriptSDK(schemas, DEFAULT_CONFIG);
      const schemasContent = sdk.files.get('src/schemas.ts');

      expect(schemasContent).toContain('export const');
      expect(schemasContent).toContain('z.');
      expect(schemasContent).toContain('export type');
      expect(schemasContent).toContain('Auto-generated Zod schemas from ControlPlane contracts');
    });

    it('should generate validation utilities', async () => {
      const schemas = await extractSchemas();
      const sdk = generateTypeScriptSDK(schemas, DEFAULT_CONFIG);
      const validationContent = sdk.files.get('src/validation.ts');

      expect(validationContent).toContain('export function validate');
      expect(validationContent).toContain('export function safeValidate');
      expect(validationContent).toContain('export function createValidator');
    });
  });

  describe('Python SDK', () => {
    it('should generate Python SDK files', async () => {
      const schemas = await extractSchemas();
      const sdk = generatePythonSDK(schemas, DEFAULT_CONFIG);

      expect(sdk.language).toBe('python');
      expect(sdk.files.has('controlplane_sdk/models.py')).toBe(true);
      expect(sdk.files.has('controlplane_sdk/client.py')).toBe(true);
      expect(sdk.files.has('controlplane_sdk/__init__.py')).toBe(true);
      expect(sdk.files.has('controlplane_sdk/validation.py')).toBe(true);
      expect(sdk.files.has('controlplane_sdk/schemas.py')).toBe(true);
      expect(sdk.files.has('pyproject.toml')).toBe(true);
      expect(sdk.packageConfig.name).toBe('controlplane-sdk');
    });

    it('should generate valid Python Pydantic models', async () => {
      const schemas = await extractSchemas();
      const sdk = generatePythonSDK(schemas, DEFAULT_CONFIG);
      const modelsContent = sdk.files.get('controlplane_sdk/models.py');

      expect(modelsContent).toContain('class');
      expect(modelsContent).toContain('BaseModel');
      expect(modelsContent).toContain('Auto-generated Pydantic models from ControlPlane contracts');
    });
  });

  describe('Go SDK', () => {
    it('should generate Go SDK files', async () => {
      const schemas = await extractSchemas();
      const sdk = generateGoSDK(schemas, DEFAULT_CONFIG);

      expect(sdk.language).toBe('go');
      expect(sdk.files.has('types.go')).toBe(true);
      expect(sdk.files.has('client.go')).toBe(true);
      expect(sdk.files.has('validation.go')).toBe(true);
      expect(sdk.files.has('schemas.go')).toBe(true);
      expect(sdk.files.has('go.mod')).toBe(true);
      expect(sdk.files.has('README.md')).toBe(true);
    });

    it('should generate valid Go structs', async () => {
      const schemas = await extractSchemas();
      const sdk = generateGoSDK(schemas, DEFAULT_CONFIG);
      const typesContent = sdk.files.get('types.go');

      expect(typesContent).toContain('package controlplane');
      expect(typesContent).toContain('type');
      expect(typesContent).toContain('struct');
      expect(typesContent).toContain('Auto-generated Go types from ControlPlane contracts');
    });

    it('should generate validation methods', async () => {
      const schemas = await extractSchemas();
      const sdk = generateGoSDK(schemas, DEFAULT_CONFIG);
      const typesContent = sdk.files.get('types.go');

      expect(typesContent).toContain('Validate() error');
    });
  });
});
