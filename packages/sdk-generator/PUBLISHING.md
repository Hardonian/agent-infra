# SDK Publishing Guide

This document describes how SDK versions are managed and published.

## Versioning Policy

### Contract-Driven Versioning

SDKs follow the **Contract Version** as the single source of truth:

```
SDK Version = Contract Version + SDK Patch

Example:
- Contract: 1.2.3
- TypeScript SDK: 1.2.3+0 (first SDK release for this contract)
- Python SDK: 1.2.3+0
- Go SDK: 1.2.3+0
```

### Version Components

| Component | Description | Example |
|-----------|-------------|---------|
| Contract Major | Breaking schema changes | `2.0.0` - incompatible with 1.x |
| Contract Minor | New features, backward compatible | `1.2.0` - adds new optional fields |
| Contract Patch | Bug fixes | `1.2.1` - fixes validation logic |
| SDK Patch | SDK-specific fixes | `1.2.1+1` - fixes SDK bug, same contract |

### SDK Version Tracking

Each SDK release includes:
- `sdkVersion`: The full SDK version (e.g., `1.2.3+0`)
- `contractVersion`: The canonical contract version (e.g., `1.2.3`)

## Generation Workflow

### 1. Contract Change Detected

When contracts are modified:

```bash
# Update contract version according to VERSIONING.md
# Then regenerate all SDKs
pnpm sdk:generate
```

### 2. SDK Regeneration

The generator:
1. Extracts all schemas from `@controlplane/contracts`
2. Validates schemas against canonical definitions
3. Generates SDK code for all languages
4. Updates package metadata
5. Runs compile checks

### 3. CI Enforcement

```yaml
# .github/workflows/sdk-generation.yml
name: SDK Generation Check

on:
  push:
    paths:
      - 'packages/contracts/**'
      - 'packages/sdk-generator/**'

jobs:
  check-sdk-generation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Generate SDKs
        run: pnpm sdk:generate
      
      - name: Check for drift
        run: |
          if [ -n "$(git status --porcelain sdks/)" ]; then
            echo "Error: SDKs are out of date. Run 'pnpm sdk:generate' and commit changes."
            git diff --stat sdks/
            exit 1
          fi
```

## Publishing

### Automated Publishing (Recommended)

```yaml
# .github/workflows/sdk-publish.yml
name: Publish SDKs

on:
  push:
    tags:
      - 'sdk-v*'

jobs:
  publish-typescript:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
      - run: pnpm install
      - run: pnpm sdk:generate
      - run: |
          cd sdks/typescript
          npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

  publish-python:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pnpm sdk:generate
      - run: |
          cd sdks/python
          pip install build twine
          python -m build
          twine upload dist/*
        env:
          TWINE_USERNAME: __token__
          TWINE_PASSWORD: ${{ secrets.PYPI_TOKEN }}

  publish-go:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.21'
      - run: pnpm sdk:generate
      - run: |
          cd sdks/go
          git tag "v${VERSION}"
          git push origin "v${VERSION}"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Manual Publishing

```bash
# TypeScript
pnpm sdk:generate
cd sdks/typescript
npm publish --access public

# Python
pnpm sdk:generate
cd sdks/python
pip install build twine
python -m build
twine upload dist/*

# Go
pnpm sdk:generate
cd sdks/go
git tag v1.2.3
git push origin v1.2.3
```

## SDK Registry

Published SDKs:

| Language | Package Registry | Package Name |
|----------|-----------------|--------------|
| TypeScript | npm | `@controlplane/sdk` |
| Python | PyPI | `controlplane-sdk` |
| Go | GitHub Releases | `github.com/controlplane/sdk-go` |

## Breaking Changes

When contracts have breaking changes (major version bump):

1. **Update migration guide** in `MIGRATION.md`
2. **Deprecate old SDKs** with clear sunset date
3. **Publish new major versions** of all SDKs
4. **Update compatibility matrix**

### Example Migration

```
Contract 1.x.x → 2.0.0 (breaking)
├── TypeScript SDK 1.x.x → 2.0.0
├── Python SDK 1.x.x → 2.0.0
└── Go SDK v1.x.x → v2.0.0
```
