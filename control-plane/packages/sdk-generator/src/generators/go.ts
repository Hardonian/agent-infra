import type { z } from 'zod';
import { SchemaDefinition, GeneratedSDK, SDKGeneratorConfig } from '../core.js';

export function generateGoSDK(
  schemas: SchemaDefinition[],
  config: SDKGeneratorConfig
): GeneratedSDK {
  const files = new Map<string, string>();

  const typesContent = generateGoTypesFile(schemas);
  files.set('types.go', typesContent);

  const clientContent = generateGoClientFile(config);
  files.set('client.go', clientContent);

  const validationContent = generateGoValidationFile();
  files.set('validation.go', validationContent);

  const schemasContent = generateGoSchemasFile(schemas);
  files.set('schemas.go', schemasContent);

  const readmeContent = generateReadme('Go', config);
  files.set('README.md', readmeContent);

  const goModContent = generateGoMod(config);
  files.set('go.mod', goModContent);

  const packageConfig = {
    module: `github.com/${config.organization}/sdk-go`,
    goVersion: '1.21',
    version: config.sdkVersion,
    description: 'ControlPlane SDK for Go - generated from canonical contracts',
  };

  return {
    language: 'go',
    files,
    packageConfig,
  };
}

function generateGoTypesFile(schemas: SchemaDefinition[]): string {
  const lines: string[] = [];
  lines.push('// Auto-generated Go types from ControlPlane contracts');
  lines.push('// DO NOT EDIT MANUALLY - regenerate from source');
  lines.push('');
  lines.push('package controlplane');
  lines.push('');
  lines.push('import (');
  lines.push('\t"encoding/json"');
  lines.push('\t"time"');
  lines.push(')');
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
      lines.push(...generateGoStructCode(schema));
      lines.push('');
    }
  }

  return lines.join('\n');
}

function generateGoStructCode(schema: SchemaDefinition): string[] {
  const lines: string[] = [];
  const zodDef = schema.schema._def as {
    typeName?: string;
    shape?: () => Record<string, z.ZodTypeAny>;
    values?: string[];
  };

  // Generate doc comment
  lines.push(`// ${schema.name} represents a ${schema.category} schema`);
  lines.push(`type ${schema.name} struct {`);

  if (zodDef?.typeName === 'ZodObject') {
    const shape = zodDef.shape?.() ?? {};

    for (const [key, val] of Object.entries(shape)) {
      const fieldDef = (val as z.ZodTypeAny)._def as { typeName?: string };
      const goType = zodToGoType(val as z.ZodTypeAny);
      const isOptional =
        fieldDef?.typeName === 'ZodOptional' || fieldDef?.typeName === 'ZodDefault';
      const jsonTag = isOptional ? `json:"${key},omitempty"` : `json:"${key}"`;

      lines.push(`\t${capitalizeFirst(key)} ${goType} \`${jsonTag}\``);
    }
  } else if (zodDef?.typeName === 'ZodEnum') {
    const values = zodDef.values as string[];
    lines.push(`\tValue string \`json:"value"\``);
    lines.push('}');
    lines.push('');
    lines.push(`// ${schema.name} valid values`);
    lines.push('const (');
    for (const value of values) {
      const constName = toGoConstName(schema.name, value);
      lines.push(`\t${constName} = "${value}"`);
    }
    lines.push(')');
    return lines;
  } else {
    lines.push(`\tValue interface{} \`json:"value"\``);
  }

  lines.push('}');

  // Add Validate method for structs
  lines.push('');
  lines.push(`// Validate checks if the ${schema.name} is valid`);
  lines.push(`func (m ${schema.name}) Validate() error {`);
  lines.push('\treturn validate' + schema.name + '(m)');
  lines.push('}');

  return lines;
}

function zodToGoType(schema: z.ZodTypeAny): string {
  if (!schema || !schema._def) return 'interface{}';

  const def = schema._def as {
    typeName?: string;
    checks?: Array<{ kind: string }>;
    innerType?: z.ZodTypeAny;
    type?: z.ZodTypeAny;
    valueType?: z.ZodTypeAny;
  };

  switch (def.typeName) {
    case 'ZodString':
      if (def.checks) {
        for (const check of def.checks) {
          if (check.kind === 'datetime') {
            return 'time.Time';
          }
        }
      }
      return 'string';

    case 'ZodNumber':
      if (def.checks?.some((c) => c.kind === 'int')) {
        return 'int';
      }
      return 'float64';

    case 'ZodBoolean':
      return 'bool';

    case 'ZodOptional':
      return zodToGoType(def.innerType ?? schema);

    case 'ZodDefault':
      return zodToGoType(def.innerType ?? schema);

    case 'ZodArray': {
      const itemType = zodToGoType(def.type ?? schema);
      return `[]${itemType}`;
    }

    case 'ZodObject':
      return 'map[string]interface{}';

    case 'ZodRecord': {
      const valueType = zodToGoType(def.valueType ?? schema);
      return `map[string]${valueType}`;
    }

    case 'ZodEnum':
      return 'string';

    case 'ZodUnion':
      return 'interface{}';

    case 'ZodUnknown':
    case 'ZodAny':
      return 'interface{}';

    default:
      return 'interface{}';
  }
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function toGoConstName(typeName: string, value: string): string {
  const cleanValue = value.toUpperCase().replace(/[^A-Z0-9]/g, '_');
  return `${typeName}${cleanValue}`;
}

function generateGoClientFile(config: SDKGeneratorConfig): string {
  return `// Auto-generated ControlPlane SDK Client
// DO NOT EDIT MANUALLY - regenerate from source

package controlplane

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// ClientConfig holds configuration for the ControlPlane client
type ClientConfig struct {
	BaseURL    string
	APIKey     string
	Timeout    time.Duration
	HTTPClient *http.Client
}

// ControlPlaneClient is the main SDK client
type ControlPlaneClient struct {
	config          ClientConfig
	contractVersion ContractVersion
	client          *http.Client
}

// NewClient creates a new ControlPlane SDK client
func NewClient(config ClientConfig) *ControlPlaneClient {
	if config.Timeout == 0 {
		config.Timeout = 30 * time.Second
	}
	if config.HTTPClient == nil {
		config.HTTPClient = &http.Client{Timeout: config.Timeout}
	}

	return &ControlPlaneClient{
		config: config,
		contractVersion: ContractVersion{
			Major: ${config.contractVersion.split('.')[0]},
			Minor: ${config.contractVersion.split('.')[1]},
			Patch: ${config.contractVersion.split('.')[2]},
		},
		client: config.HTTPClient,
	}
}

// GetContractVersion returns the contract version used by this client
func (c *ControlPlaneClient) GetContractVersion() ContractVersion {
	return c.contractVersion
}

func (c *ControlPlaneClient) serializeVersion(v ContractVersion) string {
	return fmt.Sprintf("%d.%d.%d", v.Major, v.Minor, v.Patch)
}

func (c *ControlPlaneClient) defaultHeaders() map[string]string {
	headers := map[string]string{
		"Content-Type":       "application/json",
		"X-Contract-Version": c.serializeVersion(c.contractVersion),
	}
	if c.config.APIKey != "" {
		headers["Authorization"] = fmt.Sprintf("Bearer %s", c.config.APIKey)
	}
	return headers
}

// Request makes an HTTP request to the ControlPlane API
func (c *ControlPlaneClient) Request(ctx context.Context, method, path string, body interface{}) (*http.Response, error) {
	var bodyReader *bytes.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		bodyReader = bytes.NewReader(jsonBody)
	} else {
		bodyReader = bytes.NewReader([]byte{})
	}

	url := fmt.Sprintf("%s%s", c.config.BaseURL, path)
	req, err := http.NewRequestWithContext(ctx, method, url, bodyReader)
	if err != nil {
		return nil, err
	}

	for key, value := range c.defaultHeaders() {
		req.Header.Set(key, value)
	}

	return c.client.Do(req)
}

// Validate validates a model using the generated validators
func (c *ControlPlaneClient) Validate(model Validatable) error {
	return model.Validate()
}

// Validatable interface for models that can be validated
type Validatable interface {
	Validate() error
}
`;
}

function generateGoValidationFile(): string {
  return `// Auto-generated validation utilities
// DO NOT EDIT MANUALLY - regenerate from source

package controlplane

import (
	"errors"
	"fmt"
)

// ValidationError represents a validation error
type ValidationError struct {
	Field   string
	Message string
}

func (e ValidationError) Error() string {
	return fmt.Sprintf("%s: %s", e.Field, e.Message)
}

// ValidationErrors collects multiple validation errors
type ValidationErrors struct {
	Errors []ValidationError
}

func (e ValidationErrors) Error() string {
	if len(e.Errors) == 0 {
		return "validation failed"
	}
	return e.Errors[0].Error()
}

// IsValid checks if there are no validation errors
func (e ValidationErrors) IsValid() bool {
	return len(e.Errors) == 0
}

// Add adds a validation error
func (e *ValidationErrors) Add(field, message string) {
	e.Errors = append(e.Errors, ValidationError{Field: field, Message: message})
}
`;
}

function generateGoSchemasFile(schemas: SchemaDefinition[]): string {
  const lines: string[] = [];
  lines.push('// Auto-generated schema validation functions');
  lines.push('// DO NOT EDIT MANUALLY - regenerate from source');
  lines.push('');
  lines.push('package controlplane');
  lines.push('');
  lines.push('import "fmt"');
  lines.push('');
  lines.push('// SchemaValidator is a function that validates a model');
  lines.push('type SchemaValidator func(interface{}) error');
  lines.push('');
  lines.push('// SchemaRegistry maps schema names to their validators');
  lines.push('var SchemaRegistry = map[string]SchemaValidator{');

  for (const schema of schemas) {
    const zodDef = schema.schema._def as {
      typeName?: string;
    };
    if (zodDef?.typeName === 'ZodObject') {
      lines.push(`\t"${schema.name}": func(m interface{}) error {`);
      lines.push(`\t\tif v, ok := m.(${schema.name}); ok {`);
      lines.push(`\t\t\treturn validate${schema.name}(v)`);
      lines.push(`\t\t}`);
      lines.push(`\t\treturn fmt.Errorf("invalid type for ${schema.name}")`);
      lines.push(`\t},`);
    }
  }

  lines.push('}');
  lines.push('');

  for (const schema of schemas) {
    const zodDef = schema.schema._def as {
      typeName?: string;
      shape?: () => Record<string, z.ZodTypeAny>;
    };
    if (zodDef?.typeName === 'ZodObject') {
      lines.push(...generateGoValidationFunction(schema, zodDef.shape?.() ?? {}));
      lines.push('');
    }
  }

  return lines.join('\n');
}

function generateGoValidationFunction(
  schema: SchemaDefinition,
  shape: Record<string, z.ZodTypeAny>
): string[] {
  const lines: string[] = [];
  lines.push(`// validate${schema.name} validates a ${schema.name} instance`);
  lines.push(`func validate${schema.name}(m ${schema.name}) error {`);
  lines.push('\tvar errs ValidationErrors');
  lines.push('');

  for (const [key, val] of Object.entries(shape)) {
    const fieldDef = val._def;
    const isRequired = fieldDef?.typeName !== 'ZodOptional' && fieldDef?.typeName !== 'ZodDefault';
    const capitalizedKey = capitalizeFirst(key);

    if (isRequired) {
      const goType = zodToGoType(val);
      if (goType === 'string') {
        lines.push(`\tif m.${capitalizedKey} == "" {`);
        lines.push(`\t\terrs.Add("${key}", "is required")`);
        lines.push(`\t}`);
      } else if (goType === 'int' || goType === 'float64') {
        lines.push(`\tif m.${capitalizedKey} == 0 {`);
        lines.push(`\t\terrs.Add("${key}", "is required")`);
        lines.push(`\t}`);
      }
    }
  }

  lines.push('');
  lines.push('\tif !errs.IsValid() {');
  lines.push('\t\treturn errs');
  lines.push('\t}');
  lines.push('\treturn nil');
  lines.push('}');

  return lines;
}

function generateGoMod(config: SDKGeneratorConfig): string {
  return `module github.com/${config.organization}/sdk-go

go 1.21

require (
	github.com/google/uuid v1.6.0
)
`;
}

function generateReadme(language: string, config: SDKGeneratorConfig): string {
  return `# ControlPlane SDK for ${language}

Auto-generated SDK from ControlPlane contracts v${config.contractVersion}.

## Installation

\`\`\`bash
go get github.com/${config.organization}/sdk-go
\`\`\`

## Usage

### Struct Types

\`\`\`go
package main

import (
    "github.com/${config.organization}/sdk-go"
)

func main() {
    // Models are fully typed Go structs
    job := controlplane.JobRequest{
        ID:   "550e8400-e29b-41d4-a716-446655440000",
        Type: "process-data",
        // ...
    }
}
\`\`\`

### Runtime Validation

\`\`\`go
package main

import (
    "fmt"
    "github.com/${config.organization}/sdk-go"
)

func main() {
    job := controlplane.JobRequest{
        ID:   "550e8400-e29b-41d4-a716-446655440000",
        Type: "process-data",
    }

    // Each model has a Validate() method
    if err := job.Validate(); err != nil {
        fmt.Printf("Validation failed: %v\\n", err)
    }
}
\`\`\`

### Client Usage

\`\`\`go
package main

import (
    "context"
    "os"
    "github.com/${config.organization}/sdk-go"
)

func main() {
    client := controlplane.NewClient(controlplane.ClientConfig{
        BaseURL: "https://api.controlplane.io",
		APIKey:  os.Getenv("CONTROLPLANE_API_KEY"),
    })

    ctx := context.Background()
    resp, err := client.Request(ctx, "GET", "/health", nil)
    if err != nil {
        panic(err)
    }
    defer resp.Body.Close()
}
\`\`\`

## Features

- ✅ **Strongly typed structs** - Full compile-time type safety
- ✅ **Built-in validation** - Each model has a Validate() method
- ✅ **Zero drift** - Auto-generated from canonical contracts
- ✅ **Context support** - Full context.Context support for timeouts

## Versioning

- SDK version: ${config.sdkVersion}
- Contract version: ${config.contractVersion}

## Regeneration

This SDK is auto-generated. Do not edit manually.
To regenerate, run: \`sdk-gen --language go\`

## License

Apache-2.0
`;
}
