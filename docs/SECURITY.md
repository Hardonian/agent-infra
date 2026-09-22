# Security Guide

This repository ships contracts and tooling. It does not ship production services, but it includes runner templates and CLI tooling that should be hardened in downstream deployments.

## Threat Model Summary

- **Contract drift**: mitigated by contract validation and compatibility checks.
- **Runner misuse**: templates provide error envelopes, structured logging, and rate limiting.
- **Secrets exposure**: no secrets are stored in repo; use environment variables.

See [docs/THREAT-MODEL.md](./THREAT-MODEL.md) for broader ecosystem threats.

## Authentication & Authorization

- The core repo does not implement authN/authZ because it is tooling-only.
- Generated runners should enforce authN/authZ at the API gateway or inside the runner, depending on your platform requirements.

## Rate Limiting

Runner templates include an in-memory rate limiter for public endpoints. Defaults:

- `RATE_LIMIT_WINDOW_MS=60000`
- `RATE_LIMIT_MAX=120`

For production, replace in-memory limits with a shared store (Redis) or gateway-level enforcement.

## Input Validation

- Runner templates validate inbound job payloads with `JobRequest.parse` and respond with a structured error envelope.
- Health endpoints use the `HealthCheck` contract to ensure schema compatibility.

## Webhooks

This repo does not ship webhook handlers. If you add Stripe webhooks in downstream services, ensure:

- Node runtime with raw body verification
- Signature validation
- Replay protection (store event IDs)

## Secrets Hygiene

- Use `.env.example` as the reference list of environment variables.
- Run `pnpm run secret-scan` before committing changes.
