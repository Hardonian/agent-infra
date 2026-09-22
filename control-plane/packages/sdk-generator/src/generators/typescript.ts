import type { z } from 'zod';
import { SchemaDefinition, GeneratedSDK, SDKGeneratorConfig } from '../core.js';

export function generateTypeScriptSDK(
  schemas: SchemaDefinition[],
  config: SDKGeneratorConfig
): GeneratedSDK {
  const files = new Map<string, string>();

  const zodSchemasContent = generateZodSchemasFile(schemas);
  files.set('src/schemas.ts', zodSchemasContent);

  const typesContent = generateTypesFile(schemas);
  files.set('src/types.ts', typesContent);

  const clientContent = generateClientFile(config);
  files.set('src/client.ts', clientContent);

  const indexContent = generateIndexFile(schemas);
  files.set('src/index.ts', indexContent);

  const validationContent = generateValidationFile(schemas);
  files.set('src/validation.ts', validationContent);

  const readmeContent = generateReadme('TypeScript', config);
  files.set('README.md', readmeContent);

  const packageConfig = {
    name: `${config.packagePrefix}/sdk`,
    version: config.sdkVersion,
    description: 'ControlPlane SDK for TypeScript - generated from canonical contracts',
    type: 'module',
    main: './dist/index.js',
    types: './dist/index.d.ts',
    exports: {
      '.': {
        types: './dist/index.d.ts',
        import: './dist/index.js',
        require: './dist/index.cjs',
      },
      './schemas': {
        types: './dist/schemas.d.ts',
        import: './dist/schemas.js',
        require: './dist/schemas.cjs',
      },
    },
    scripts: {
      build: 'tsup src/index.ts src/schemas.ts --format esm,cjs --dts',
      typecheck: 'tsc --noEmit',
      test: 'vitest run',
    },
    dependencies: {
      zod: '^3.22.4',
    },
    devDependencies: {
      '@types/node': '^20.10.0',
      tsup: '^8.0.1',
      typescript: '^5.3.3',
      vitest: '^1.1.0',
    },
    engines: {
      node: '>=18.0.0',
    },
    license: 'Apache-2.0',
  };

  return {
    language: 'typescript',
    files,
    packageConfig,
  };
}

function generateZodSchemasFile(schemas: SchemaDefinition[]): string {
  const lines: string[] = [];
  lines.push('// Auto-generated Zod schemas from ControlPlane contracts');
  lines.push('// DO NOT EDIT MANUALLY - regenerate from source');
  lines.push('');
  lines.push("import { z } from 'zod';");
  lines.push('');

  const groupedSchemas = schemas.reduce(
    (acc, schema) => {
      if (!acc[schema.category]) acc[schema.category] = [];
      acc[schema.category].push(schema);
      return acc;
    },
    {} as Record<string, SchemaDefinition[]>
  );

  for (const [category, categorySchemas] of Object.entries(groupedSchemas) as [
    string,
    SchemaDefinition[],
  ][]) {
    lines.push(`// ${category.toUpperCase()} schemas`);
    lines.push('');

    for (const schema of categorySchemas) {
      lines.push(...generateZodSchemaCode(schema));
      lines.push('');
    }
  }

  return lines.join('\n');
}

function generateZodSchemaCode(schema: SchemaDefinition): string[] {
  const lines: string[] = [];
  const zodDef = generateZodDefinition(schema.schema);

  lines.push(`/**`);
  lines.push(` * Zod schema for ${schema.name}`);
  lines.push(` * @category ${schema.category}`);
  lines.push(` */`);
  lines.push(`export const ${schema.name}Schema = ${zodDef};`);
  lines.push('');
  lines.push(`/**`);
  lines.push(` * TypeScript type inferred from ${schema.name}Schema`);
  lines.push(` */`);
  lines.push(`export type ${schema.name} = z.infer<typeof ${schema.name}Schema>;`);

  return lines;
}

function generateZodDefinition(schema: z.ZodTypeAny, depth = 0): string {
  if (!schema) return 'z.any()';

  // Handle Zod types
  if (schema._def) {
    const def = schema._def as {
      typeName?: string;
      checks?: Array<{ kind: string; value?: number; inclusive?: boolean }>;
      innerType?: z.ZodTypeAny;
      type?: z.ZodTypeAny;
      shape?: () => Record<string, z.ZodTypeAny>;
      valueType?: z.ZodTypeAny;
      values?: string[];
      options?: z.ZodTypeAny[];
      schema?: z.ZodTypeAny;
      getter?: () => z.ZodTypeAny;
      defaultValue?: () => unknown;
    };
    const typeName = def.typeName;

    switch (typeName) {
      case 'ZodString': {
        let str = 'z.string()';
        if (def.checks) {
          for (const check of def.checks) {
            switch (check.kind) {
              case 'min':
                str += `.min(${check.value})`;
                break;
              case 'max':
                str += `.max(${check.value})`;
                break;
              case 'email':
                str += '.email()';
                break;
              case 'uuid':
                str += '.uuid()';
                break;
              case 'url':
                str += '.url()';
                break;
              case 'datetime':
                str += '.datetime()';
                break;
            }
          }
        }
        return str;
      }

      case 'ZodNumber': {
        let num = 'z.number()';
        if (def.checks) {
          for (const check of def.checks) {
            switch (check.kind) {
              case 'min':
                if (check.inclusive) num += `.min(${check.value})`;
                break;
              case 'max':
                if (check.inclusive) num += `.max(${check.value})`;
                break;
              case 'int':
                num += '.int()';
                break;
            }
          }
        }
        return num;
      }

      case 'ZodBoolean':
        return 'z.boolean()';

      case 'ZodNull':
        return 'z.null()';

      case 'ZodOptional':
        return `${generateZodDefinition(def.innerType ?? schema, depth)}.optional()`;

      case 'ZodDefault': {
        const inner = generateZodDefinition(def.innerType ?? schema, depth);
        const defaultValue = JSON.stringify(def.defaultValue?.());
        return `${inner}.default(${defaultValue})`;
      }

      case 'ZodArray':
        return `z.array(${generateZodDefinition(def.type ?? schema, depth)})`;

      case 'ZodObject': {
        const shape = def.shape?.() ?? {};
        const entries = Object.entries(shape)
          .map(([key, val]) => `  ${key}: ${generateZodDefinition(val, depth + 1)}`)
          .join(',\n');
        return `z.object({\n${entries}\n})`;
      }

      case 'ZodRecord':
        return `z.record(${generateZodDefinition(def.valueType ?? schema, depth)})`;

      case 'ZodEnum': {
        const values = (def.values ?? []).map((v) => `'${v}'`).join(', ');
        return `z.enum([${values}])`;
      }

      case 'ZodUnion':
      case 'ZodDiscriminatedUnion': {
        const options = (def.options ?? [])
          .map((opt) => generateZodDefinition(opt, depth))
          .join(', ');
        return `z.union([${options}])`;
      }

      case 'ZodEffects':
        return generateZodDefinition(def.schema ?? schema, depth);

      case 'ZodLazy':
        return generateZodDefinition(def.getter?.() ?? schema, depth);

      case 'ZodUnknown':
        return 'z.unknown()';

      case 'ZodAny':
        return 'z.any()';

      default:
        return 'z.any()';
    }
  }

  return 'z.any()';
}

function generateTypesFile(schemas: SchemaDefinition[]): string {
  const lines: string[] = [];
  lines.push('// Auto-generated TypeScript types from ControlPlane contracts');
  lines.push('// DO NOT EDIT MANUALLY - regenerate from source');
  lines.push('');
  lines.push("import { z } from 'zod';");
  lines.push("import * as schemas from './schemas.js';");
  lines.push('');

  const groupedSchemas = schemas.reduce(
    (acc, schema) => {
      if (!acc[schema.category]) acc[schema.category] = [];
      acc[schema.category].push(schema);
      return acc;
    },
    {} as Record<string, SchemaDefinition[]>
  );

  for (const [category, categorySchemas] of Object.entries(groupedSchemas) as [
    string,
    SchemaDefinition[],
  ][]) {
    lines.push(`// ${category.toUpperCase()} types`);
    lines.push('');

    for (const schema of categorySchemas) {
      lines.push(`/**`);
      lines.push(` * @category ${schema.category}`);
      lines.push(` */`);
      lines.push(`export type ${schema.name} = z.infer<typeof schemas.${schema.name}Schema>;`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

function generateClientFile(config: SDKGeneratorConfig): string {
  return `// Auto-generated ControlPlane SDK Client
// DO NOT EDIT MANUALLY - regenerate from source

import { z } from 'zod';
import { ContractVersionSchema, ContractVersion } from './schemas.js';

export interface ClientConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
}

export class ControlPlaneClient {
  private config: ClientConfig;
  private contractVersion: ContractVersion = {
    major: ${config.contractVersion.split('.')[0]},
    minor: ${config.contractVersion.split('.')[1]},
    patch: ${config.contractVersion.split('.')[2]},
  };

  constructor(config: ClientConfig) {
    this.config = {
      timeout: 30000,
      ...config,
    };
  }

  getContractVersion(): ContractVersion {
    return this.contractVersion;
  }

  /**
   * Validates data against a Zod schema at runtime
   */
  validate<T>(schema: z.ZodType<T>, data: unknown): T {
    return schema.parse(data);
  }

  /**
   * Safely validates data, returning success/failure result
   */
  safeValidate<T>(schema: z.ZodType<T>, data: unknown): { success: true; data: T } | { success: false; error: z.ZodError } {
    const result = schema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, error: result.error };
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = new URL(path, this.config.baseUrl);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url.toString(), {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': \`Bearer \${this.config.apiKey}\` }),
          'X-Contract-Version': this.serializeVersion(this.contractVersion),
          ...options?.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
      }

      return await response.json() as T;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private serializeVersion(version: ContractVersion): string {
    return \`\${version.major}.\${version.minor}.\${version.patch}\`;
  }
}
`;
}

function generateIndexFile(_schemas: SchemaDefinition[]): string {
  const lines: string[] = [];
  lines.push('// Auto-generated ControlPlane SDK');
  lines.push('// DO NOT EDIT MANUALLY - regenerate from source');
  lines.push('');
  lines.push('// Export all Zod schemas for runtime validation');
  lines.push("export * from './schemas.js';");
  lines.push('');
  lines.push('// Export all TypeScript types');
  lines.push("export * from './types.js';");
  lines.push('');
  lines.push('// Export client');
  lines.push("export { ControlPlaneClient, type ClientConfig } from './client.js';");
  lines.push('');
  lines.push('// Export validation utilities');
  lines.push("export { validate, safeValidate } from './validation.js';");
  lines.push('');
  lines.push('// Re-export z for convenience');
  lines.push("export { z } from 'zod';");

  return lines.join('\n');
}

function generateValidationFile(_schemas: SchemaDefinition[]): string {
  const lines: string[] = [];
  lines.push('// Auto-generated validation utilities');
  lines.push('// DO NOT EDIT MANUALLY - regenerate from source');
  lines.push('');
  lines.push("import { z } from 'zod';");
  lines.push('');
  lines.push('/**');
  lines.push(' * Validates data against a Zod schema');
  lines.push(' * @throws {z.ZodError} If validation fails');
  lines.push(' */');
  lines.push('export function validate<T>(schema: z.ZodType<T>, data: unknown): T {');
  lines.push('  return schema.parse(data);');
  lines.push('}');
  lines.push('');
  lines.push('/**');
  lines.push(' * Safely validates data without throwing');
  lines.push(' * @returns Object with success flag and either data or error');
  lines.push(' */');
  lines.push('export function safeValidate<T>(schema: z.ZodType<T>, data: unknown):');
  lines.push('  | { success: true; data: T }');
  lines.push('  | { success: false; error: z.ZodError } {');
  lines.push('  const result = schema.safeParse(data);');
  lines.push('  if (result.success) {');
  lines.push('    return { success: true, data: result.data };');
  lines.push('  }');
  lines.push('  return { success: false, error: result.error };');
  lines.push('}');
  lines.push('');
  lines.push('/**');
  lines.push(' * Creates a validator function for a specific schema');
  lines.push(' * Useful for form validation and API middleware');
  lines.push(' */');
  lines.push('export function createValidator<T>(schema: z.ZodType<T>) {');
  lines.push('  return {');
  lines.push('    parse: (data: unknown): T => schema.parse(data),');
  lines.push('    safeParse: (data: unknown) => schema.safeParse(data),');
  lines.push('    assert: (data: unknown): asserts data is T => {');
  lines.push('      schema.parse(data);');
  lines.push('    },');
  lines.push('  };');
  lines.push('}');

  return lines.join('\n');
}

function generateReadme(language: string, config: SDKGeneratorConfig): string {
  return `# ControlPlane SDK for ${language}

Auto-generated SDK from ControlPlane contracts v${config.contractVersion}.

## Installation

\`\`\`bash
npm install ${config.packagePrefix}/sdk
\`\`\`

## Usage

### TypeScript Types

\`\`\`typescript
import { JobRequest, ErrorEnvelope, ContractVersion } from '${config.packagePrefix}/sdk';

// Types are fully typed and match the canonical contracts
const job: JobRequest = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  type: 'process-data',
  // ...
};
\`\`\`

### Runtime Validation with Zod

\`\`\`typescript
import { JobRequestSchema, validate, safeValidate } from '${config.packagePrefix}/sdk';

// Runtime validation using the same schemas as the server
const result = validate(JobRequestSchema, incomingData);

// Or use safe validation to handle errors gracefully
const { success, data, error } = safeValidate(JobRequestSchema, incomingData);
if (success) {
  console.log('Valid job:', data);
} else {
  console.error('Validation failed:', error.errors);
}
\`\`\`

### Client Usage

\`\`\`typescript
import { ControlPlaneClient } from '${config.packagePrefix}/sdk';

const client = new ControlPlaneClient({
  baseUrl: 'https://api.controlplane.io',
  apiKey: process.env.CONTROLPLANE_API_KEY,
});

// Client includes built-in validation methods
const validated = client.validate(JobRequestSchema, responseData);
\`\`\`

## Features

- ✅ **First-class TypeScript types** - Full IntelliSense support
- ✅ **Runtime validation** - Same Zod schemas as the server
- ✅ **Zero drift** - Auto-generated from canonical contracts
- ✅ **Tree-shakeable** - Import only what you need

## Versioning

This SDK follows semantic versioning and tracks the ControlPlane contract version:
- SDK version: ${config.sdkVersion}
- Contract version: ${config.contractVersion}

## Regeneration

This SDK is auto-generated. Do not edit manually.
To regenerate, run: \`sdk-gen --language typescript\`

## License

Apache-2.0
`;
}
