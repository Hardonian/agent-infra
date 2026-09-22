# ControlPlane SDK Generator

Generates first-class SDKs for TypeScript, Python, and Go from canonical Zod contracts.

## Strategy

**Zod → JSON Schema → Language-Specific SDKs**

This approach:
- Uses existing Zod schemas as the single source of truth
- Converts to JSON Schema as an intermediate format
- Generates idiomatic code for each target language
- Ensures zero drift between contracts and SDKs

## Usage

### Generate All SDKs

```bash
pnpm sdk:generate
```

### Generate Specific Language

```bash
pnpm sdk:generate --language typescript
pnpm sdk:generate --language python
pnpm sdk:generate --language go
```

### Validate Generated SDKs

```bash
pnpm sdk:generate --validate
```

### Check for Drift

```bash
pnpm sdk:check
```

## Generated SDKs

### TypeScript SDK

```typescript
import { ControlPlaneClient, JobRequest } from '@controlplane/sdk';

const client = new ControlPlaneClient({
  baseUrl: 'https://api.controlplane.io',
  apiKey: process.env.CONTROLPLANE_API_KEY,
});
```

### Python SDK

```python
import os
from controlplane_sdk import ControlPlaneClient, ClientConfig

client = ControlPlaneClient(
    ClientConfig(
        base_url='https://api.controlplane.io',
        api_key=os.getenv('CONTROLPLANE_API_KEY')
    )
)
```

### Go SDK

```go
import (
    "os"
    "github.com/controlplane/sdk-go"
)

client := controlplane.NewClient(controlplane.ClientConfig{
    BaseURL: "https://api.controlplane.io",
    APIKey:  os.Getenv("CONTROLPLANE_API_KEY"),
})
```

## Architecture

```
packages/contracts/
├── src/
│   ├── types/          # Zod schemas (canonical)
│   ├── errors/         # Error schemas
│   └── versioning/     # Version schemas
└── dist/               # Compiled contracts

packages/sdk-generator/
├── src/
│   ├── core.ts         # Schema extraction
│   ├── cli.ts          # CLI entry point
│   └── generators/
│       ├── typescript.ts
│       ├── python.ts
│       └── go.ts
└── sdks/               # Generated output
    ├── typescript/
    ├── python/
    └── go/
```

## CI/CD

SDKs are regenerated automatically when:
1. Contracts change (via `packages/contracts/**` paths)
2. Generator code changes (via `packages/sdk-generator/**` paths)
3. PR is opened against `main` branch

See [PUBLISHING.md](./PUBLISHING.md) for release workflow details.

## Hard Rules

1. **SDKs are generated, not handwritten** - Never manually edit generated code
2. **Contracts are the single source of truth** - All changes start in `packages/contracts`
3. **No undocumented behavior** - Generated SDKs include full docstrings/types
4. **CI enforces regeneration** - PRs fail if SDKs drift from contracts

## Versioning

SDK versions track the contract version:

| Contract | TypeScript SDK | Python SDK | Go SDK |
|----------|----------------|------------|---------|
| 1.0.0 | 1.0.0 | 1.0.0 | v1.0.0 |
| 1.1.0 | 1.1.0 | 1.1.0 | v1.1.0 |
| 2.0.0 | 2.0.0 | 2.0.0 | v2.0.0 |

See [PUBLISHING.md](./PUBLISHING.md) for detailed versioning policy.

## Development

### Adding New Schemas

1. Add Zod schema to `packages/contracts/src/`
2. Export from `packages/contracts/src/*/index.ts`
3. Regenerate SDKs: `pnpm sdk:generate`
4. Verify: `pnpm sdk:validate`

### Adding New Language

1. Create generator in `src/generators/<language>.ts`
2. Export from `src/index.ts`
3. Add CLI support in `src/cli.ts`
4. Update CI workflow

## License

Apache-2.0
