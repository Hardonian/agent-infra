# Module Registration Guide

This document explains how to properly add a new module (package, connector, or runner) to the ControlPlane ecosystem.

## Overview

ControlPlane uses a monorepo structure with the following module types:

- **Packages**: Located in `packages/` - reusable libraries and tools
- **Runners**: Located in `runners/` - executable runner implementations

## Adding a New Package

### 1. Create the Package Structure

```bash
mkdir -p packages/my-new-package/src
```

### 2. Create package.json

Required fields:
- `name`: Must follow `@controlplane/*` naming convention
- `version`: Semantic versioning
- `main`: Path to the main entry point (e.g., `./dist/index.js`)
- `types`: Path to TypeScript declarations (e.g., `./dist/index.d.ts`)
- `exports`: Recommended for explicit API surface
- `scripts.build`: Build command (e.g., `tsc` or `tsup`)
- `dependencies`: List of dependencies

Example `package.json`:
```json
{
  "name": "@controlplane/my-new-package",
  "version": "1.0.0",
  "description": "Description of the package",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@controlplane/contracts": "workspace:*"
  }
}
```

### 3. Create TypeScript Source

Create `src/index.ts` with proper exports:
```typescript
export * from './my-feature';
// or
export { MyClass, myFunction } from './my-feature';
```

### 4. Build the Package

```bash
pnpm build --filter=@controlplane/my-new-package
```

### 5. Verify with Scripts

Run the validation scripts:
```bash
# Check registry coherence
npx tsx scripts/registry-lint.ts

# Run smoke test
npx tsx scripts/smoke-test.ts
```

## Adding a New Runner

### 1. Create the Runner Directory

```bash
mkdir -p runners/my-runner
```

### 2. Create runner.manifest.json

Required fields:
- `name`: Unique runner identifier
- `version`: Semantic versioning
- `description`: Human-readable description
- `entrypoint`: Command and args to run the runner
- `capabilities`: Array of runner capabilities
- `requiredEnv`: Array of required environment variables
- `outputs`: Array of output types

Example `runner.manifest.json`:
```json
{
  "name": "my-runner",
  "version": "1.0.0",
  "description": "My custom runner for X",
  "entrypoint": {
    "command": "node",
    "args": ["dist/index.js", "--runner", "my-runner"]
  },
  "capabilities": ["adapter", "dry-run"],
  "requiredEnv": ["API_KEY"],
  "outputs": ["report"],
  "docs": "docs/runners/my-runner.md"
}
```

### 3. Create Runner Implementation

Create the actual runner code in the runner directory.

### 4. Verify Runner Manifest

Run the registry lint to validate:
```bash
npx tsx scripts/registry-lint.ts
```

## Package Exports Best Practices

### Single Entry Point

For simple packages:
```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  }
}
```

### Multiple Sub-exports

For packages with multiple features:
```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./feature-a": {
      "types": "./dist/feature-a.d.ts",
      "import": "./dist/feature-a.js"
    },
    "./feature-b": {
      "types": "./dist/feature-b.d.ts",
      "import": "./dist/feature-b.js"
    }
  }
}
```

## Build Configuration

### Using tsc (Recommended for Most Packages)

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

Build script in `package.json`:
```json
{
  "scripts": {
    "build": "tsc"
  }
}
```

### Using tsup (For Dual ESM/CJS)

```json
{
  "scripts": {
    "build": "tsup src/index.ts --format esm,cjs --dts"
  }
}
```

## Validation Scripts

### registry-lint.ts

Validates:
- All packages have valid package.json with required fields
- All exports paths point to existing files
- All runners have valid manifests
- Schema registry contains expected types

Usage:
```bash
npx tsx scripts/registry-lint.ts
```

### smoke-test.ts

Validates:
- All packages can be imported
- Packages export expected functions/classes
- CLI binaries exist (when installed)

Usage:
```bash
npx tsx scripts/smoke-test.ts
```

## Common Issues

### Missing Exports

If you see errors like:
```
exports['./feature'] points to non-existent file: ./dist/feature/index.d.ts
```

Fix: Either create the file or remove the export from package.json.

### Missing Dependencies

Workspace dependencies (e.g., `"@controlplane/contracts": "workspace:*"`) will show as missing in direct imports. This is normal - they resolve correctly in the monorepo context.

### CLI Packages

CLI-only packages (like `create-runner`) should have:
- `main` pointing to the CLI entry
- Logic to skip execution when imported

## Testing Checklist

Before submitting a new module:

- [ ] Package.json has all required fields
- [ ] Main entry point exists and exports something
- [ ] TypeScript declarations are generated
- [ ] Build completes successfully: `pnpm build --filter=@controlplane/my-package`
- [ ] Registry lint passes: `npx tsx scripts/registry-lint.ts`
- [ ] Smoke test passes: `npx tsx scripts/smoke-test.ts`
- [ ] For runners: `runner.manifest.json` is valid
- [ ] All capabilities and outputs are documented
