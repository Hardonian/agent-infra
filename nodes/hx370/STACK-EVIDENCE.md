# agent-mesh Stack Bring-up & E2E Evidence (HX370)

> 2026-10-26, on HX370, `agent-infra/agent-mesh` @ commit after `0ed2a4e`. Go 1.26.3.
> This documents what was **actually run and observed**, and the **gaps found**.

## What was brought up (and what deliberately was not)
- Built all 4 binaries natively: `make build` → `bin/{agentmesh,agentmesh-controller,agentmesh-proxy,agentmesh-worker}` (BUILD_EXIT=0).
- Deployed the **controller natively** (dev mode, in-memory) on `:18080`, verified live, then stopped gracefully.
- **Did NOT bring up Postgres/Redis/Qdrant.** Reason (verified, not assumed): `grep` shows **no `database/sql`/`pgx`/`lib/pq`/`gorm` import anywhere** in the Go code. `DATABASE_URL` is only *validated* in production mode and never used to open a connection. The `docker-compose.yml` Postgres + `migrations/*.sql` are **aspirational/unused**. Starting them would be pure bloat with no durability benefit. This is the honest call.

## Test / E2E results (all green)
| Suite | Command | Result |
|---|---|---|
| Full unit+integration | `go test -p 1 ./pkg/... ./internal/... ./tests` | **41 packages ok**, exit 0 |
| 35-point Definition-of-Done | `go test ./tests -run TestPhase5DefinitionOfDone35Certifications` | **ok**, exit 0 |
| 15-scenario Adversarial Red Team | `go test ./tests -run TestP0RedTeamScenarios` | **ok**, exit 0 |
| Durability/coordination/recovery | reliability, reconcile, events, budgets, delegation, audit, outcome, cost | **all ok** |

## Live control-plane HTTP evidence (deployed on HX370)
Controller: `AGENTMESH_ENV=development AGENTMESH_HTTP_PORT=18080 ./bin/agentmesh-controller`.

| Check | Request | Observed |
|---|---|---|
| Serving | `GET /healthz`,`/readyz`,`/metrics` | **200**; readyz body `{"status":"ready"}` |
| Agent registration (M1 identity) | `POST /api/v1/agents` (valid `AgentContract`) | **201**; `agentId=hx370-node`, `contractHash=0936de92…`, `status=HEALTHY` |
| Tenant isolation (M1 authz) | `GET /api/v1/agents` tenant-a vs tenant-b | tenant-a returns the agent; **tenant-b → `null`** |
| Default-deny (M1) | `POST /policy/evaluate` unknown.tool | `effect=DENY`, `ruleName=default-deny`, decisionVersion v1 |
| Explicit ALLOW (M1) | after loading policy; `git.read` | `effect=ALLOW`, `ruleName=allow-repo-readonly` |
| Explicit DENY (M1) | `payment.execute` | `effect=DENY`, `ruleName=deny-sensitive-effects` |
| Append-only tamper-evident audit (M5) | `GET /api/v1/audit` | `agent.registered` event with `contractHash` + **`prevHash` (hash chain)** |
| Cross-tenant audit isolation (M5) | audit tenant-b | `[]` (empty) |
| Graceful shutdown | SIGTERM | `Stopping…gracefully` → `stopped` (clean) |

Policy engine behavior: default-deny unless an explicit allow rule matches; explicit deny beats allow; decisions carry `policyId`/`ruleName`/`decisionVersion`. Authorization is enforced **server-side** (not in prompts).

## Gap 1 — durable persistence is NOT wired (Milestones 2 & 4)
State is **in-memory only**. Proven: after killing the controller and starting a fresh one on `:18081`, `GET /api/v1/agents` and `/api/v1/policies` both returned **`null`** — prior state was **not** recovered. `/readyz` is a hardcoded `{"status":"ready"}` with no dependency check. There is **no SQL store**, so crash-restart recovery of agents/policies/audit/jobs does not happen. The `migrations/*.sql` + compose Postgres are unused by the Go code.
- **Consequence:** Milestone 4 "crash/restart recovers" and Milestone 2 "authoritative scoped memory store" are **unmet** at the persistence layer. The in-memory pieces (policy engine, audit chain, retry/idempotency/circuit-breaker, events, budgets) work but do not survive restart.
- **To make durable:** wire `database.Store` to Postgres via `pgx`/`database/sql`, apply `migrations/*.sql`, back audit + policy + agent registry by it, and make `/readyz` check the DB. This is a real engineering task (not a config toggle).

## Gap 2 — fenced-worker enrollment is NOT wired (HX370 acceptance #5)
`cmd/agentmesh-worker/main.go` is a **stub**: it only logs `"Worker heartbeat…"` every 10s on a ticker; it does not register, claim, or fence. `internal/fleet.Manager` is an **in-memory registry of proxy instances** (health/config-version/canary) — not durable job leases with fencing tokens. `internal/reliability` has real `ExecuteWithRetry(ctx, IdempotencyClass, …)` + `CircuitBreaker` primitives (tests pass), but there is **no durable lease store or fencing-token comparison at an effect boundary**.
- **Consequence:** genuine "stale worker cannot commit after reassignment" fencing + lease-expiry job claims are **not implemented**; only the design concepts + isolated primitives exist.
- **To make real:** a durable lease table (Postgres), worker enrollment issuing short-lived creds, heartbeat/lease-expiry, and a fencing-token check inside the effect-commit path. Requires Gap 1's durable store first.

## Reproduce
```
cd agent-infra/agent-mesh && make build && go test -p 1 ./pkg/... ./internal/... ./tests
AGENTMESH_ENV=development AGENTMESH_HTTP_PORT=18080 ./bin/agentmesh-controller   # then curl as above
# certification: go test ./tests -run 'TestPhase5DefinitionOfDone35Certifications|TestP0RedTeamScenarios'
```

## Follow-ups (out of this session's scope)
- 28 GitHub-reported vulnerabilities on the branch default (2 critical, 6 high) — dependabot-tracked, in nested projects; triage separately.
- Wire durable Postgres store (Gap 1) → then fenced-worker enrollment (Gap 2).
