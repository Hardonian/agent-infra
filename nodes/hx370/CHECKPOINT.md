# HX370 Node Commission — Checkpoint (resumable)

> Update before handoff/context loss. Re-read with live git/service state on resume.

- **Canonical repo:** `Hardonian/agent-infra`, branch `main`. Node files committed **and pushed** (rebased onto dependabot bumps → `0ed2a4e`).
- **Host:** verified this session **is** HX370 (Ryzen AI 9 HX 370, WSL2 Ubuntu 24.04.5, kernel 6.18.33.1, 16 CPUs, ~19.5 GiB RAM).
- **Filesystem gate:** PASS (ext4 `/home/scott`, write+fsync+readback+delete OK; fault-injection path verified → exit 2).
- **Changed files (new, under `nodes/hx370/`):** `hx370-doctor.sh`, `node-profile.json`, `HX370.md`, `runbook.md`, `tsrs-pilot.md`, `STACK-EVIDENCE.md`, `RELEASE-REPORT.md`, `CHECKPOINT.md`, `VULN-TRIAGE.md`, `.gitignore`.
- **Hermes config changed (sanctioned `hermes config set`):** `agent.environment_hint`, `personalities.hx370-node`. Backup: `~/.hermes/config.yaml.bak-hx370-20261026T133854Z`. MEMORY.md untouched (99% full).
- **Milestone status:** HX370 node commission = **complete + tested**. Shared infra: M1 (identity/authz) + M5 (private interface/run-evidence) = **VERIFIED live**; M2 + M4 storage layer = **CLOSED** (durable PostgresStore; crash/restart recovery + DB-down `/readyz` 503 verified). M4 fenced-worker enrollment + M3 credential-broker + Qdrant index remain open. M7 tsrs = evaluated.
- **Gap 1 CLOSED (durable persistence):** new `internal/database/postgres.go` `PostgresStore` (embeds MemoryStore; agents/policies/credentials → Postgres via pgx/JSONB); main.go wires it on `DATABASE_URL` (dev falls back to memory, prod hard-fails), auto-migrates; `/readyz` DB-ping → 503; additive migration 000006. Verified on HX370 (Postgres 16-alpine :55433, 6 migrations, 37 tables): restart recovers `hx370-node`+`hx370-ops`+contract; DB-down → 503. All builds/vet/41+cmd tests green.
- **Gaps remaining (honest):** fenced-worker enrollment (Gap 2: durable lease + fencing token at effect boundary; `agentmesh-worker` is a stub); audit trail is a separate in-memory service (not pinned to durable store); M3 credential-broker; Qdrant retrieval index.
- **tsrs pilot:** EVALUATED, not adopted (byte-identical diagnostics; tsrs ~33% faster/~28% lighter warm; exit codes diverge tsc=1/tsrs=2; keep tsc authoritative).
- **Blockers:** closing Gap 2 needs a durable lease table + fencing-token check in the worker effect-commit path (builds on the now-working durable store). Vuln triage delivered (`VULN-TRIAGE.md`); applying the control-plane dep bumps needs its own scoped PR + CI (not done blind here).
- **Next executable action:** **B (vuln triage) DONE** — see `VULN-TRIAGE.md` (0 in agent-mesh Go; all 27 npm are `control-plane` dev/transitive; no open fix PRs → recommend enabling Dependabot security updates + bumping the 3 direct `vitest` + a `pnpm` lockfile refresh, as a scoped PR with control-plane CI green). Then: fenced-worker enrollment (Gap 2) + pin audit trail to the durable store.
