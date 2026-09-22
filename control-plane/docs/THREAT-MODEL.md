# Threat Model (Contracts & Tooling)

This repository ships contracts and tooling only. It does not include runtime services. The threat model focuses on risks to contract integrity and tooling supply chain. Implementing organizations are responsible for validating contracts at runtime and maintaining their own security controls.

## Assets

- Contract schemas and versioning rules
- Validation tooling and CLI outputs
- Compatibility matrices and distribution configs

## Threats

- **Schema tampering**: unauthorized changes that break compatibility.
- **Tooling compromise**: malicious changes in validation scripts or CLI binaries.
- **Supply chain risk**: dependency vulnerabilities impacting contract consumers.

## Mitigations

- Code review and CI gates on contract changes.
- Compatibility checks (`pnpm run compat:check`).
- Dependency audits via CI.

## Out of Scope

Runtime threats (authentication, authorization, mTLS, service-to-service trust, data retention) belong to the service implementations that consume these contracts. Implementing organizations must apply their own security controls, governance policies, and compliance frameworks to their deployments.
