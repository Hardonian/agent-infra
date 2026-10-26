# HX370 Node Commission — Checkpoint (resumable)

> Update before handoff/context loss. Re-read with live git/service state on resume.

- **Canonical repo:** `Hardonian/agent-infra`, branch `main`. Node files committed **and pushed** (rebased onto dependabot bumps → `0ed2a4e`).
- **Host:** verified this session **is** HX370 (Ryzen AI 9 HX 370, WSL2 Ubuntu 24.04.5, kernel 6.18.33.1, 16 CPUs, ~19.5 GiB RAM).
- **Filesystem gate:** PASS (ext4 `/home/scott`, write+fsync+readback+delete OK; fault-injection path verified → exit 2).
- **Changed files (new, under `nodes/hx370/`):** `hx370-doctor.sh`, `node-profile.json`, `HX370.md`, `runbook.md`, `tsrs-pilot.md`, `STACK-EVIDENCE.md`, `RELEASE-REPORT.md`, `CHECKPOINT.md`, `.gitignore`.
- **Hermes config changed (sanctioned `hermes config set`):** `agent.environment_hint`, `personalities.hx370-node`. Backup: `~/.hermes/config.yaml.bak-hx370-20261026T133854Z`. MEMORY.md untouched (99% full).
- **Milestone status:** HX370 node commission = **complete + tested**. Shared infra: M1 (identity/authz) + M5 (private interface/run-evidence) = **VERIFIED live** on a deployed controller (registration, tenant isolation, default-deny/allow/deny, hash-chained audit). M4 = primitives pass but **durable-store GAP**. M2 = **missing** (in-memory only). M3 = partial/untested. M7 tsrs = evaluated.
- **Stack bring-up done:** 4 binaries built; full suite 41 pkg ok; 35-pt DoD + 15 red-team ok; controller deployed live on HX370 (:18080), exercised over HTTP, stopped gracefully. Postgres/Redis/Qdrant **deliberately not started** (agent-mesh has no SQL driver — unused).
- **Gaps found (honest):** persistence is in-memory (restart loses state, `/readyz` hardcoded) → durable memory + crash-recovering jobs + fenced-worker enrollment not implemented (`agentmesh-worker` is a stub; `fleet.Manager` in-memory proxy registry).
- **tsrs pilot:** EVALUATED, not adopted (byte-identical diagnostics; tsrs ~33% faster/~28% lighter warm; exit codes diverge tsc=1/tsrs=2; keep tsc authoritative).
- **Blockers:** closing M2/M4 requires wiring `database.Store`→Postgres (pgx) + applying migrations + durable lease store for fencing — real engineering, not authorized as a rewrite this session. 28 GitHub vulns on branch (dependabot-tracked) — triage separately.
- **Next executable action:** wire the durable Postgres store (close Gap 1), then fenced-worker enrollment (Gap 2); triage the 28 dependabot vulns.
