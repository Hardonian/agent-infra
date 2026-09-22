import type { z } from 'zod';
import { SchemaDefinition, GeneratedSDK, SDKGeneratorConfig } from '../core.js';

export function generatePythonSDK(
  schemas: SchemaDefinition[],
  config: SDKGeneratorConfig
): GeneratedSDK {
  const files = new Map<string, string>();

  const modelsContent = generatePydanticModelsFile(schemas);
  files.set('controlplane_sdk/models.py', modelsContent);

  const clientContent = generatePythonClientFile(config);
  files.set('controlplane_sdk/client.py', clientContent);

  const indexContent = generatePythonInitFile();
  files.set('controlplane_sdk/__init__.py', indexContent);

  const validationContent = generatePythonValidationFile();
  files.set('controlplane_sdk/validation.py', validationContent);

  const schemasContent = generatePythonSchemasFile(schemas);
  files.set('controlplane_sdk/schemas.py', schemasContent);

  const readmeContent = generateReadme('Python', config);
  files.set('README.md', readmeContent);

  const pyprojectContent = generatePyprojectToml(config);
  files.set('pyproject.toml', pyprojectContent);

  const packageConfig = {
    name: 'controlplane-sdk',
    version: config.sdkVersion,
    description: 'ControlPlane SDK for Python - generated from canonical contracts',
    python_requires: '>=3.8',
    packages: ['controlplane_sdk'],
    install_requires: ['pydantic>=2.0.0', 'httpx>=0.24.0', 'typing-extensions>=4.5.0'],
    extras_require: {
      dev: ['pytest>=7.0.0', 'mypy>=1.0.0', 'ruff>=0.1.0'],
    },
    classifiers: [
      'Development Status :: 4 - Beta',
      'Intended Audience :: Developers',
      'License :: OSI Approved :: Apache Software License',
      'Programming Language :: Python :: 3',
      'Programming Language :: Python :: 3.8',
      'Programming Language :: Python :: 3.9',
      'Programming Language :: Python :: 3.10',
      'Programming Language :: Python :: 3.11',
      'Programming Language :: Python :: 3.12',
    ],
    license: 'Apache-2.0',
  };

  return {
    language: 'python',
    files,
    packageConfig,
  };
}

function generatePydanticModelsFile(schemas: SchemaDefinition[]): string {
  const lines: string[] = [];
  lines.push('# Auto-generated Pydantic models from ControlPlane contracts');
  lines.push('# DO NOT EDIT MANUALLY - regenerate from source');
  lines.push('');
  lines.push('from __future__ import annotations');
  lines.push('from datetime import datetime');
  lines.push('from typing import Any, Dict, List, Optional, Union, Literal, TypeVar, Generic');
  lines.push('from pydantic import BaseModel, Field, ConfigDict');
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
    lines.push(`# ${category.toUpperCase()} models`);
    lines.push('');

    for (const schema of categorySchemas) {
      lines.push(...generatePydanticModelCode(schema));
      lines.push('');
    }
  }

  return lines.join('\n');
}

function generatePydanticModelCode(schema: SchemaDefinition): string[] {
  const lines: string[] = [];
  const zodDef = schema.schema._def as {
    typeName?: string;
    shape?: () => Record<string, z.ZodTypeAny>;
    values?: string[];
  };

  lines.push(`class ${schema.name}(BaseModel):`);
  lines.push(`    """${schema.category} schema: ${schema.name}"""`);

  if (zodDef?.typeName === 'ZodObject') {
    const shape = zodDef.shape?.() ?? {};
    const requiredFields: string[] = [];

    // First pass: collect required fields
    for (const [key, val] of Object.entries(shape)) {
      const fieldDef = (val as z.ZodTypeAny)._def as { typeName?: string };
      if (fieldDef?.typeName !== 'ZodOptional' && fieldDef?.typeName !== 'ZodDefault') {
        requiredFields.push(key);
      }
    }

    // Generate model_config with json_schema_extra for required fields
    if (requiredFields.length > 0) {
      lines.push('    model_config = ConfigDict(');
      lines.push(
        '        json_schema_extra={"required": [' +
          requiredFields.map((f) => `"${f}"`).join(', ') +
          ']}'
      );
      lines.push('    )');
      lines.push('');
    }

    // Generate fields
    for (const [key, val] of Object.entries(shape)) {
      const fieldType = zodToPythonType(val as z.ZodTypeAny);
      const fieldDef = (val as z.ZodTypeAny)._def as {
        typeName?: string;
        defaultValue?: () => unknown;
      };
      const isOptional =
        fieldDef?.typeName === 'ZodOptional' || fieldDef?.typeName === 'ZodDefault';
      const hasDefault = fieldDef?.typeName === 'ZodDefault';

      let fieldLine = `    ${key}: ${fieldType}`;

      if (hasDefault) {
        const defaultValue = JSON.stringify(fieldDef.defaultValue?.());
        fieldLine += ` = Field(default=${defaultValue})`;
      } else if (isOptional) {
        fieldLine += ' = None';
      }

      lines.push(fieldLine);
    }
  } else if (zodDef?.typeName === 'ZodEnum') {
    // Handle enum as Literal type
    const values = zodDef.values as string[];
    lines.push(`    value: Literal[${values.map((v: string) => `'${v}'`).join(', ')}]`);
  } else {
    lines.push(`    value: Any`);
  }

  return lines;
}

function zodToPythonType(schema: z.ZodTypeAny): string {
  if (!schema || !schema._def) return 'Any';

  const def = schema._def as {
    typeName?: string;
    checks?: Array<{ kind: string }>;
    innerType?: z.ZodTypeAny;
    type?: z.ZodTypeAny;
    valueType?: z.ZodTypeAny;
    values?: string[];
    options?: z.ZodTypeAny[];
  };

  switch (def.typeName) {
    case 'ZodString':
      // Check for format validations
      if (def.checks) {
        for (const check of def.checks) {
          if (check.kind === 'email' || check.kind === 'uuid' || check.kind === 'url') {
            return 'str';
          }
          if (check.kind === 'datetime') {
            return 'datetime';
          }
        }
      }
      return 'str';

    case 'ZodNumber':
      if (def.checks?.some((c) => c.kind === 'int')) {
        return 'int';
      }
      return 'float';

    case 'ZodBoolean':
      return 'bool';

    case 'ZodNull':
      return 'None';

    case 'ZodOptional': {
      const innerType = zodToPythonType(def.innerType ?? schema);
      return `Optional[${innerType}]`;
    }

    case 'ZodDefault':
      return zodToPythonType(def.innerType ?? schema);

    case 'ZodArray': {
      const itemType = zodToPythonType(def.type ?? schema);
      return `List[${itemType}]`;
    }

    case 'ZodObject':
      return 'Dict[str, Any]';

    case 'ZodRecord': {
      const valueType = zodToPythonType(def.valueType ?? schema);
      return `Dict[str, ${valueType}]`;
    }

    case 'ZodEnum': {
      const values = def.values as string[];
      return `Literal[${values.map((v: string) => `'${v}'`).join(', ')}]`;
    }

    case 'ZodUnion': {
      const types = (def.options ?? []).map((opt) => zodToPythonType(opt));
      return `Union[${types.join(', ')}]`;
    }

    case 'ZodUnknown':
    case 'ZodAny':
      return 'Any';

    default:
      return 'Any';
  }
}

function generatePythonClientFile(config: SDKGeneratorConfig): string {
  return `# Auto-generated ControlPlane SDK Client
# DO NOT EDIT MANUALLY - regenerate from source

from dataclasses import dataclass
from typing import Optional, Dict, Any, Type, TypeVar, Generic
import httpx
from pydantic import BaseModel, ValidationError

from .models import ContractVersion

T = TypeVar('T', bound=BaseModel)

@dataclass
class ClientConfig:
    base_url: str
    api_key: Optional[str] = None
    timeout: float = 30.0

class ControlPlaneClient:
    def __init__(self, config: ClientConfig):
        self.config = config
        self.contract_version = ContractVersion(
            major=${config.contractVersion.split('.')[0]},
            minor=${config.contractVersion.split('.')[1]},
            patch=${config.contractVersion.split('.')[2]}
        )
        self._client = httpx.Client(
            base_url=config.base_url,
            timeout=config.timeout,
            headers=self._default_headers()
        )

    def _default_headers(self) -> Dict[str, str]:
        headers = {
            'Content-Type': 'application/json',
            'X-Contract-Version': self._serialize_version(self.contract_version),
        }
        if self.config.api_key:
            headers['Authorization'] = f'Bearer {self.config.api_key}'
        return headers

    def _serialize_version(self, version: ContractVersion) -> str:
        return f'{version.major}.{version.minor}.{version.patch}'

    def get_contract_version(self) -> ContractVersion:
        return self.contract_version

    def validate(self, model_class: Type[T], data: Dict[str, Any]) -> T:
        """Validate data against a Pydantic model."""
        return model_class.model_validate(data)

    def safe_validate(self, model_class: Type[T], data: Dict[str, Any]) -> Dict[str, Any]:
        """Safely validate data, returning result with success flag."""
        try:
            validated = self.validate(model_class, data)
            return {"success": True, "data": validated}
        except ValidationError as e:
            return {"success": False, "error": e}

    def request(self, method: str, path: str, **kwargs) -> Dict[str, Any]:
        response = self._client.request(method, path, **kwargs)
        response.raise_for_status()
        return response.json()

    def close(self):
        self._client.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
`;
}

function generatePythonInitFile(): string {
  return `# Auto-generated ControlPlane SDK for Python
# DO NOT EDIT MANUALLY - regenerate from source

from .models import *
from .client import ControlPlaneClient, ClientConfig
from .validation import validate, safe_validate
from .schemas import *

__version__ = "1.0.0"
__all__ = [
    "ControlPlaneClient",
    "ClientConfig",
    "validate",
    "safe_validate",
]
`;
}

function generatePythonValidationFile(): string {
  return `# Auto-generated validation utilities
# DO NOT EDIT MANUALLY - regenerate from source

from typing import Type, TypeVar, Dict, Any, Union
from pydantic import BaseModel, ValidationError

T = TypeVar('T', bound=BaseModel)

def validate(model_class: Type[T], data: Dict[str, Any]) -> T:
    """Validate and parse data into a Pydantic model.
    
    Args:
        model_class: The Pydantic model class to validate against
        data: Dictionary containing the data to validate
        
    Returns:
        Validated model instance
        
    Raises:
        ValidationError: If validation fails
    """
    return model_class.model_validate(data)

def safe_validate(model_class: Type[T], data: Dict[str, Any]) -> Dict[str, Any]:
    """Safely validate data without throwing exceptions.
    
    Args:
        model_class: The Pydantic model class to validate against
        data: Dictionary containing the data to validate
        
    Returns:
        Dict with 'success' key. If successful, includes 'data' key.
        If failed, includes 'error' key with ValidationError.
    """
    try:
        validated = validate(model_class, data)
        return {"success": True, "data": validated}
    except ValidationError as e:
        return {"success": False, "error": e}

def create_validator(model_class: Type[T]):
    """Create a reusable validator for a specific model.
    
    Returns an object with validate and safe_validate methods
    pre-configured for the given model class.
    """
    return {
        "validate": lambda data: validate(model_class, data),
        "safe_validate": lambda data: safe_validate(model_class, data),
    }
`;
}

function generatePythonSchemasFile(schemas: SchemaDefinition[]): string {
  const lines: string[] = [];
  lines.push('# Auto-generated schema registry');
  lines.push('# DO NOT EDIT MANUALLY - regenerate from source');
  lines.push('');
  lines.push('from typing import Dict, Type');
  lines.push('from pydantic import BaseModel');
  lines.push('from . import models');
  lines.push('');
  lines.push('# Schema registry for runtime lookup');
  lines.push('SCHEMA_REGISTRY: Dict[str, Type[BaseModel]] = {');

  for (const schema of schemas) {
    const zodDef = schema.schema._def;
    if (zodDef?.typeName === 'ZodObject') {
      lines.push(`    "${schema.name}": models.${schema.name},`);
    }
  }

  lines.push('}');
  lines.push('');
  lines.push('def get_schema(name: str) -> Type[BaseModel]:');
  lines.push('    """Get a schema by name."""');
  lines.push('    if name not in SCHEMA_REGISTRY:');
  lines.push('        raise KeyError(f"Unknown schema: {name}")');
  lines.push('    return SCHEMA_REGISTRY[name]');
  lines.push('');
  lines.push('def list_schemas() -> list[str]:');
  lines.push('    """List all available schema names."""');
  lines.push('    return list(SCHEMA_REGISTRY.keys())');

  return lines.join('\n');
}

function generatePyprojectToml(config: SDKGeneratorConfig): string {
  return `[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "controlplane-sdk"
version = "${config.sdkVersion}"
description = "ControlPlane SDK for Python - generated from canonical contracts"
readme = "README.md"
license = "Apache-2.0"
requires-python = ">=3.8"
classifiers = [
    "Development Status :: 4 - Beta",
    "Intended Audience :: Developers",
    "License :: OSI Approved :: Apache Software License",
    "Programming Language :: Python :: 3",
    "Programming Language :: Python :: 3.8",
    "Programming Language :: Python :: 3.9",
    "Programming Language :: Python :: 3.10",
    "Programming Language :: Python :: 3.11",
    "Programming Language :: Python :: 3.12",
]
dependencies = [
    "pydantic>=2.0.0",
    "httpx>=0.24.0",
    "typing-extensions>=4.5.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.0.0",
    "mypy>=1.0.0",
    "ruff>=0.1.0",
]

[tool.hatch.build.targets.wheel]
packages = ["controlplane_sdk"]

[tool.mypy]
python_version = "3.8"
warn_return_any = true
warn_unused_configs = true
disallow_untyped_defs = true

[tool.ruff]
line-length = 100
target-version = "py38"
`;
}

function generateReadme(language: string, config: SDKGeneratorConfig): string {
  return `# ControlPlane SDK for ${language}

Auto-generated SDK from ControlPlane contracts v${config.contractVersion}.

## Installation

\`\`\`bash
pip install controlplane-sdk
\`\`\`

## Usage

### Pydantic Models

\`\`\`python
from controlplane_sdk import JobRequest, ErrorEnvelope

# Models are fully typed Pydantic v2 models
job = JobRequest(
    id="550e8400-e29b-41d4-a716-446655440000",
    type="process-data",
    # ...
)
\`\`\`

### Runtime Validation

\`\`\`python
from controlplane_sdk import validate, safe_validate, JobRequest

# Runtime validation with automatic type coercion
result = validate(JobRequest, incoming_data)

# Or use safe validation to handle errors gracefully
result = safe_validate(JobRequest, incoming_data)
if result["success"]:
    print(f"Valid job: {result['data']}")
else:
    print(f"Validation failed: {result['error']}")
\`\`\`

### Client Usage

\`\`\`python
import os
from controlplane_sdk import ControlPlaneClient, ClientConfig

client = ControlPlaneClient(
    ClientConfig(
        base_url="https://api.controlplane.io",
        api_key=os.getenv("CONTROLPLANE_API_KEY")
    )
)

# Client includes validation methods
with client:
    validated = client.validate(JobRequest, response_data)
\`\`\`

## Features

- ✅ **Pydantic v2 models** - Full type hints and validation
- ✅ **Runtime validation** - Same schemas as the server
- ✅ **Zero drift** - Auto-generated from canonical contracts
- ✅ **IDE support** - Full IntelliSense in VS Code, PyCharm, etc.

## Versioning

This SDK follows semantic versioning and tracks the ControlPlane contract version:
- SDK version: ${config.sdkVersion}
- Contract version: ${config.contractVersion}

## Regeneration

This SDK is auto-generated. Do not edit manually.
To regenerate, run: \`sdk-gen --language python\`

## License

Apache-2.0
`;
}
