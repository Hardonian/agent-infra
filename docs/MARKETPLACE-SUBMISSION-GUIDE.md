# Marketplace Submission Guide

This repository provides tooling and metadata schemas for a ControlPlane marketplace registry. The registry itself is external to this repo. Submissions remain under the control of the submitting organization.

## What This Guide Covers

- Metadata shape for marketplace submissions
- Contract validation expectations
- Using the marketplace CLI for local checks

## Marketplace Metadata

Marketplace entries are described with structured metadata. Example:

```typescript
{
  id: "unique-identifier",
  name: "Human Readable Name",
  version: "1.0.0",
  description: "What this does",
  author: {
    name: "Your Name",
    email: "you@example.com",
    organization: "Your Org"
  },
  license: "Apache-2.0",
  repository: {
    url: "https://github.com/your/repo",
    type: "git",
    branch: "main"
  }
}
```

## Validation

Use the marketplace CLI from `@controlplane/contract-test-kit` to validate entries before submission:

```bash
pnpm exec marketplace build
```

## Expectations

- Use the latest `@controlplane/contracts` package.
- Pass contract validation tests.
- Provide contact and license metadata.

## Support

If you need help with validation, open an issue or discussion.
