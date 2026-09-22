# Troubleshooting

This guide covers common issues when working with the contracts and tooling in this repository.

## Installation Fails

```bash
pnpm install
```

- Ensure Node.js 18+ and pnpm 8+ are installed.
- Remove `node_modules` and retry if you switched Node versions.

## Contract Build Errors

```bash
pnpm run build:contracts
```

- Verify TypeScript is installed via `pnpm install`.
- Check for syntax errors in `packages/contracts/src`.

## Contract Validation Fails

```bash
pnpm run contract:validate
```

- Check for schema mismatches in `@controlplane/contracts`.
- Ensure `@controlplane/contract-test-kit` is built.

## Compatibility Matrix Drift

```bash
pnpm run compat:check
```

- Update package versions or compatibility ranges.
- Regenerate the matrix with `pnpm run compat:generate`.

## Docs Verification Fails

```bash
pnpm run docs:verify
```

- Ensure README Quick Start commands reference real scripts.
- Fix broken relative links in README.

If you’re stuck, open an issue with logs and repro steps.
