# Contributing to ControlPlane

Thanks for contributing! This repository provides the contracts and tooling that power ControlPlane-compatible services and runners. All contributions are reviewed against compatibility and governance standards.

## Who Should Contribute

- Contract authors evolving schemas and error envelopes.
- Tooling contributors improving validation, compatibility, or SDK generation.
- Runner authors adding or updating runner manifests.
- Documentation contributors clarifying ecosystem expectations.

## Where to Start

- **Docs fixes:** Start in `docs/` or `README.md` and open a small PR.
- **Runner work:** Use the [Create Runner Quickstart](./docs/CREATE-RUNNER-QUICKSTART.md) to scaffold a runner, then run contract checks locally.
- **Connector work:** Follow the [Marketplace Submission Guide](./docs/MARKETPLACE-SUBMISSION-GUIDE.md) to align on connector types and metadata.
- **Contracts:** Read the [Contract Upgrade Guide](./docs/CONTRACT-UPGRADE.md) before proposing schema changes.
- **Extension guide:** See [docs/EXTENSION-GUIDE.md](./docs/EXTENSION-GUIDE.md) for step-by-step instructions on adding runners, connectors, rules, and schemas.

## Contribution Lanes

We keep changes safe by clearly separating contribution areas. Pick a lane and follow its guardrails:

| Lane | Typical changes | Start here | Local checks |
| --- | --- | --- | --- |
| docs | Guides, READMEs, release notes | `docs/` | `pnpm run format:check` |
| runner | New or updated runners | [Runner quickstart](./docs/CREATE-RUNNER-QUICKSTART.md) | `pnpm run contracts:check` |
| connector | New connectors or templates | [Marketplace guide](./docs/MARKETPLACE-SUBMISSION-GUIDE.md) | `pnpm run build:contracts && pnpm run contracts:check` |
| contracts | Schema, types, versioning | [Contract upgrade guide](./docs/CONTRACT-UPGRADE.md) | `pnpm run build:contracts && pnpm run contract:lint && pnpm run contracts:check` |

## Development Setup

### Prerequisites

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0

### Install and Build

```bash
# Install all dependencies
pnpm install

# Build all packages
pnpm run build

# Confirm everything is healthy
pnpm run doctor
```

### Registry Configuration

To avoid scoped registry misconfigurations, ensure `.npmrc` points to the public npm registry:

```ini
registry=https://registry.npmjs.org/
@Hardonian:registry=https://registry.npmjs.org/
always-auth=false
```

This repo does not require private registries for install.

## Development Workflow

1. Create a branch from `main`.
2. Keep changes small and focused.
3. Run verification before opening a PR:
   ```bash
   pnpm run verify   # lint + typecheck + test + build + docs
   ```
4. Update documentation when contracts or behavior changes.
5. Open a PR using the [PR template](/.github/PULL_REQUEST_TEMPLATE.md).

## Common Tasks

```bash
# Full verification suite (lint, typecheck, tests, build, docs)
pnpm run verify

# Validate contracts only
pnpm run contracts:check

# Run unit tests
pnpm run test

# Run diagnostics
pnpm run doctor

# Regenerate the compatibility matrix
pnpm run compat:generate

# Check for secret leaks
pnpm run secret-scan
```

## How CI Protects You

CI is intentionally strict to prevent accidental contract breakage and maintain ecosystem compatibility:

- **Contract checks:** validates contracts compile and pass schema validation.
- **Contract sync:** keeps JSON schemas and Zod schemas in sync.
- **Compatibility matrix:** ensures version compatibility across the ecosystem.
- **Semantic checks:** enforces Conventional Commits for predictable releases.
- **Secret scanning:** prevents accidental credential commits.
- **Distribution verification:** enforces OSS/cloud feature boundaries.

If you add a runner, the contract checks run before tests or builds, so you get fast feedback without breaking the pipeline. All checks require human review before merge.

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | When to use |
|---|---|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation only |
| `style:` | Formatting, no code change |
| `refactor:` | Code restructuring |
| `test:` | Adding or updating tests |
| `chore:` | Build process, dependencies |

Example:

```bash
git commit -m "feat(contracts): add runner heartbeat schema"
```

## Pull Request Process

1. Open a PR with a clear description and scope.
2. Fill out the [PR template](/.github/PULL_REQUEST_TEMPLATE.md), including contract impact.
3. Ensure `pnpm run verify` passes locally.
4. Include contract compatibility notes when applicable.
5. Respond to review feedback.

## Code Standards

- Keep schemas backwards compatible within a major version.
- Avoid placeholder docs or TODOs.
- Keep validation tooling deterministic and fast.
- Update the compatibility matrix when versions change.
- No secrets in code (use environment variables).
- See [docs/INVARIANTS.md](./docs/INVARIANTS.md) for the full list of rules that must never be broken.

## Definition of Done

A change is ready to merge when:

- [ ] `pnpm run lint` passes
- [ ] `pnpm run typecheck` passes
- [ ] `pnpm run build` succeeds
- [ ] `pnpm run test` passes
- [ ] `pnpm run contracts:check` exits 0
- [ ] Documentation is complete and references real files
- [ ] Conventional commit message is used
- [ ] PR template is filled out

## Community & Support

- Use GitHub Discussions for questions and design proposals.
- Use Issues for bugs and feature requests.

See [SUPPORT.md](./SUPPORT.md) for guidance.

### Discussion Categories

- **Q&A**: troubleshooting and usage questions.
- **Ideas**: proposals for new contracts or tooling.
- **Show & Tell**: sharing integrations or adoption stories.
- **Design / Architecture**: contract evolution and ecosystem design discussions.
