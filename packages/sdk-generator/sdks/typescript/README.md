# ControlPlane SDK for TypeScript

Auto-generated SDK from ControlPlane contracts v1.0.0.

## Installation

```bash
npm install @controlplane/sdk
```

## Usage

### TypeScript Types

```typescript
import { JobRequest, ErrorEnvelope, ContractVersion } from '@controlplane/sdk';

// Types are fully typed and match the canonical contracts
const job: JobRequest = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  type: 'process-data',
  // ...
};
```

### Runtime Validation with Zod

```typescript
import { JobRequestSchema, validate, safeValidate } from '@controlplane/sdk';

// Runtime validation using the same schemas as the server
const result = validate(JobRequestSchema, incomingData);

// Or use safe validation to handle errors gracefully
const { success, data, error } = safeValidate(JobRequestSchema, incomingData);
if (success) {
  console.log('Valid job:', data);
} else {
  console.error('Validation failed:', error.errors);
}
```

### Client Usage

```typescript
import { ControlPlaneClient } from '@controlplane/sdk';

const client = new ControlPlaneClient({
  baseUrl: 'https://api.controlplane.io',
  apiKey: process.env.CONTROLPLANE_API_KEY,
});

// Client includes built-in validation methods
const validated = client.validate(JobRequestSchema, responseData);
```

## Features

- ✅ **First-class TypeScript types** - Full IntelliSense support
- ✅ **Runtime validation** - Same Zod schemas as the server
- ✅ **Zero drift** - Auto-generated from canonical contracts
- ✅ **Tree-shakeable** - Import only what you need

## Versioning

This SDK follows semantic versioning and tracks the ControlPlane contract version:
- SDK version: 1.0.0
- Contract version: 1.0.0

## Regeneration

This SDK is auto-generated. Do not edit manually.
To regenerate, run: `sdk-gen --language typescript`

## License

Apache-2.0
