# HX370 Node Commission — Checkpoint (resumable)

> Update before handoff/context loss. Re-read with live git/service state on resume.

- **Canonical repo:** `Hardonian/agent-infra`, branch `main`, base commit `df4a188`.
- **Host:** verified this session **is** HX370 (Ryzen AI 9 HX 370, WSL2 Ubuntu 24.04.5, kernel 6.18.33.1, 16 CPUs, ~19.5 GiB RAM).
- **Filesystem gate:** PASS (ext4 `/home/scott`, write+fsync+readback+delete OK; fault-injection path verified → exit 2).
- **Changed files (new, under `nodes/hx370/`):** `hx370-doctor.sh`, `node-profile.json`, `HX370.md`, `runbook.md`, `tsrs-pilot.md`, `RELEASE-REPORT.md`, `CHECKPOINT.md`, `.gitignore`.
- **Hermes config changed (sanctioned `hermes config set`):** `agent.environment_hint`, `personalities.hx370-node`. Backup: `~/.hermes/config.yaml.bak-hx370-20261026T133854Z`. MEMORY.md untouched (99% full).
- **Milestone status:** HX370 node commission = **complete + tested**. Shared 7-milestone infra = **mapped + unit-tested (identity/fleet/policy/approval pass)**, NOT complete (needs running Postgres/Redis/Qdrant + deployed agent-mesh + E2E).
- **tsrs pilot:** EVALUATED, not adopted (byte-identical diagnostics; tsrs ~33% faster/~28% lighter warm; exit codes diverge tsc=1/tsrs=2; keep tsc authoritative).
- **Decisions:** pilot on control-plane/contracts (TS7, in-scope) not Settler (TS6, production); GPU/NPU = CPU/remote only (no verified WSL compute stack, none installed); EPYC read-only discovery only (reachable via Tailscale TCP:22).
- **Verification results:** `hx370-doctor.sh` exit 0 (healthy) & exit 2 (fault-injected RO dir); `go build ./...` BUILD_EXIT:0 (agent-mesh, mission-ledger); `go test` identity/fleet/policy/approval all `ok`; tsrs/tsc byte-identical diagnostics.
- **Blockers:** shared-infra E2E blocked on no running durable stack + no deployed agent-mesh (not authorized/attempted this session). Physical sleep/restart recovery **untested**.
- **Next executable action:** stand up Postgres/Redis/Qdrant, deploy agent-mesh, run its E2E identity/fleet suite, then enroll HX370 as a fenced worker against that authority.
- **Not pushed:** commit is local only; push requires Scott's explicit go-ahead.
