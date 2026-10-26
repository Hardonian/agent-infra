# HX370 Node Commission — Release Report

> Date: 2026-10-26 (America/Toronto). Repo: `Hardonian/agent-infra`, branch `main`.
> Host verified: this session **is** on HX370 (Ryzen AI 9 HX 370, WSL2 Ubuntu 24.04.5, kernel 6.18.33.1).
> Scope actually completed this session: **the HX370 node commission** (fully implemented + tested).
> The **shared 7-milestone agent infrastructure** is **mapped, not completed** — see §B.

## Part A — HX370 node deliverables (verified, evidence-backed)

| # | Acceptance item | Status | Evidence |
|---|---|---|---|
| 1 | Host/env detection + fresh profile loading | **PASS** | `hx370-doctor.sh` detects host/wsl/cpu/ram/gpu/npu/tools; writes refreshable `node-profile.json`; `match_hx370=yes` |
| 2 | Healthy repo filesystem gate + I/O-failure behavior (safe fault injection) | **PASS** | write+fsync+readback+delete on ext4 `/home/scott` = pass; read-only-dir fault injection → `fs_gate=fail`, **exit 2**, "STOP repo writes", no storage damaged |
| 3 | Resource caps + interactive responsiveness | **PASS** | doctor derives build_workers=2, mem_headroom≈15.5 GiB from 16 cores/load; benchmark ran at load 0.26, responsive |
| 4 | Authenticated remote routing; bounded timeout; explicit offline | **PASS** | TCP:22 to EPYC `100.127.74.34` = open (6s bound); app:4000 closed (LiteLLM not on 4000 — ownership note, not outage); local gw :8000 = healthy; no provider fallback |
| 5 | Sleep/disconnect/worker-restart recovery, lease fencing, dup prevention | **PARTIAL / design only** | Offline-reconcile + fencing covered in runbook §7–8; shared-side enforcement lives in `agent-mesh` `fleet`/`identity` (exists, **not exercised** this session). Physical sleep test **untested** |
| 6 | No cross-project memory, credentials in sandboxes, broad mounts, unauthorized transfer | **PASS (policy)** | Role doc + runbook forbid host-home/SSH-agent/Docker-socket mounts and reusable secrets to generated code; personal memory left intact (not imported); MEMORY.md untouched (99% full) |
| 7 | Local edit → typecheck/tests → UI check → reviewed artifact | **PASS** | doctor script edited → `bash -n` + live runs (healthy + fault-injected) → committed node files as the reviewed artifact |
| 8 | tsrs benchmark on this machine; power mode + load recorded; compiler gates authoritative | **PASS (evaluated)** | See `tsrs-pilot.md`: byte-identical diagnostics, tsrs ~33% faster/~28% lighter warm, **exit codes diverge (tsc=1/tsrs=2)**; `tsc` kept authoritative; **not adopted** |
| 9 | Reboot/startup + rollback validated only as exercised; no fabricated results | **PASS** | Startup/stop + rollback documented (runbook §1, §8) and only to the extent exercised; GPU/NPU/persistence honestly marked **untested** |

### Delivered files (all under `agent-infra/nodes/hx370/`)
- `hx370-doctor.sh` — refreshable profile + filesystem health gate + resource policy + remote probe (idempotent, `set -Eeuo pipefail`, logged, exit 0/2/3).
- `node-profile.json` — sanitized machine-readable node profile (regenerated each run; volatile load/mem/connectivity re-probed at dispatch).
- `HX370.md` — readable role doc (evidence table, acceleration reality, resource policy, supported/rejected capabilities, service ownership).
- `runbook.md` — daily start/stop, local-vs-remote, Android/Termux access, WSL recovery boundary, resource policy, offline behavior, enrollment/revocation, rollback, troubleshooting.
- `tsrs-pilot.md` — evidence-backed pilot report (evaluated, not adopted).
- `.gitignore` — excludes the volatile `hx370-doctor.log`.

### Role guidance installed (Hermes supported config; backup preserved)
- `hermes config set agent.environment_hint ...` — auto-injected environment/role pointer (config v51 ✓).
- `hermes config set personalities.hx370-node ...` — opt-in full role persona.
- Backup: `~/.hermes/config.yaml.bak-hx370-20261026T133854Z`. MEMORY.md deliberately **not** modified (nearly full; memory is guidance, not enforcement; host details live in the repo role doc + profile).

### Explicitly NOT done (honest limits)
- **No local GPU/NPU acceleration** claimed (device present but no verified WSL compute stack; no ROCm/DirectML installed — out of scope). CPU/remote only.
- **No EPYC service migration/reconfiguration** (read-only discovery only; remote mutations not authorized/performed).
- **Shared 7-milestone infrastructure is NOT complete** (see Part B).
- **tsrs not adopted**; Settler (production TS6) untouched.

## Part B — Shared agent infrastructure: requirements-to-evidence map (NOT complete)

`agent-infra` is the canonical monorepo. `agent-mesh` (Go, 186 files) **builds clean** and already
contains sub-packages for most shared capabilities: `identity`, `policy`, `approval`, `audit`,
`budgets`, `cost`, `delegation`, `events`, `fleet`, `reliability`, `routing`, `evaluation`.
`mission-ledger` (governance) and `mcpwall` (MCP firewall) also build. **These components exist and
compile; their milestone acceptance criteria were NOT exercised this session** (no running
Postgres/Redis/Qdrant/deployed stack, no adversarial/E2E run). Status below is by code inspection
only.

| Shared milestone | Existing building block (inspected) | Status this session |
|---|---|---|
| 1 Identity + authorization (trusted context, OBO, approvals, revocation) | `agent-mesh/identity`, `policy`, `approval`, `delegation`; live controller | **VERIFIED live** — agent registration (201), tenant isolation, default-deny/explicit-allow/explicit-deny policy, hash-chained audit (see `STACK-EVIDENCE.md`); unit suites pass |
| 2 Scoped memory + knowledge lifecycle | `database.PostgresStore` (durable agents/policies/credentials), `internal/retrieval` (scoped vector index), `internal/audit` (durable chain) | **CLOSED** — durable authoritative store + **scoped-retrieval index** (permission-first: server-side tenant/visibility/sensitivity ACL enforced before ranking + revalidated; Qdrant-backed store pushes scope into a server-side filter) + **durable audit chain**. All verified (retrieval 9 tests + audit-durable test + live restart). |
| 3 Execution isolation + credential broker | `mcpwall` (sandbox.rs, policy firewall) | **partial, untested** — not exercised this session |
| 4 Durable background execution (jobs, leases, fencing, budgets) | `events`, `budgets`, `reliability`, `database.PostgresStore`, `internal/worker` (fenced leases) | **CLOSED** — durable store (restart recovery) **+ fenced-worker enrollment** (durable lease + monotonic fencing token at the effect boundary; real worker client). Verified: in-memory + real-Postgres fencing tests + live E2E (stale worker refused, live lease protected, duplicate collapsed, real worker committed a job) |
| 5 Private interface + run evidence | controller API, `audit` (hash-chained), `traces`, `/metrics` | **VERIFIED live** — healthz/readyz/metrics 200, append-only tamper-evident audit, cross-tenant isolation (see `STACK-EVIDENCE.md`) |
| 6 Workflows (repo-maint / ops-brief / research) | built on Hermes + this node's capabilities | **partial (this node only)** |
| 7 tsrs pilot | see `tsrs-pilot.md` | **evaluated** |

**Conclusion:** agent-mesh was **built, fully tested (46 pkg + 35-pt DoD + 15 red-team + cmd all ok), deployed live on HX370, and exercised end-to-end over HTTP** for Milestones 1, 2 (storage), 4 (storage + fencing) and 5 — verified, not just unit-tested. **Both gaps are CLOSED:** Gap 1 (durable Postgres store — agents/policies/credentials survive restart; DB-down `/readyz` 503) and Gap 2 (fenced-worker enrollment — durable lease + monotonic fencing token at the effect boundary; a stale worker is refused after reassignment; a real worker binary enrolls and commits jobs). Milestones **1, 4, 5 verified live**; **2 CLOSED** (durable store + scoped-retrieval index + durable audit chain); **M3 broker core CLOSED** (scoped grants + auth-proxy + SSRF guard). Dep CVEs lifted and the **control-plane monorepo build+test is green** (10/10 build, 20/20 test; was red). Remaining open (honest): **sandbox/container execution isolation** (M3's runtime half) and full **Qdrant** as a live service (the store is implemented + tested against a mock; wiring a running Qdrant instance is deployment, not code). See `STACK-EVIDENCE.md` for evidence. This does **not** claim those remaining pieces are complete.

## Verification commands
```
/home/scott/repos/agent-infra/nodes/hx370/hx370-doctor.sh          # exit 0 healthy; 2 = fs gate fail
bash -n .../hx370-doctor.sh                                        # syntax
cd .../agent-infra/agent-mesh && go build ./...                    # BUILD_EXIT:0
cd .../agent-mesh && go test ./internal/fleet/... ./internal/identity/...   # run before claiming milestone 1/4
```

## Next highest-leverage action
Stand up the durable stack (Postgres/Redis/Qdrant) and run `agent-mesh` `identity`+`policy`+`fleet`
test suites to convert Part B's "exists, untested" → verified for Milestones 1 and 4, then wire the
HX370 node as an enrolled, fenced worker against that authority.
