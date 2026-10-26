# agent-mesh Stack Bring-up & E2E Evidence (HX370)

> 2026-10-26, on HX370, `agent-infra/agent-mesh` @ commit after `0ed2a4e`. Go 1.26.3.
> This documents what was **actually run and observed**, and the **gaps found**.

## What was brought up (and what deliberately was not)
- Built all 4 binaries natively: `make build` → `bin/{agentmesh,agentmesh-controller,agentmesh-proxy,agentmesh-worker}` (BUILD_EXIT=0).
- Deployed the **controller natively** (dev mode) on `:18080`, verified live, then stopped gracefully.
- **Postgres:** at first it was correct to skip it — `grep` showed **no SQL driver** in the Go code (`DATABASE_URL` validated but never opened a connection; compose Postgres + migrations were aspirational). That in-memory-only state was the durability gap (restart → `null`). **Since then Gap 1 was closed** (below): the controller now wires a `PostgresStore` via `pgx` when `DATABASE_URL` is set, auto-applies `migrations/*.sql`, and Postgres 16-alpine is genuinely used for durable agents/policies/credentials. Redis/Qdrant remain unused (agent-mesh does not reference them) — still deliberately not started.

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

## Gap 1 — durable persistence: CLOSED (Milestones 2 & 4 storage layer)
Previously state was in-memory only (restart → `null`). **Now implemented and verified:**
- New `internal/database/postgres.go`: a `PostgresStore` that **embeds `*MemoryStore`** and overrides the
  authoritative entities (**agents, policies, credentials**) to persist to real Postgres tables via `pgx`
  (JSONB for contract/rules). The other ~35 ephemeral/derived methods (route outcomes, SLOs, canaries,
  telemetry, phase 3-5 records) are promoted from the embedded memory store — observability state that
  legitimately does not need to survive restart. `var _ Store = (*PostgresStore)(nil)` asserts full
  interface satisfaction (no stubs, no missing methods).
- `cmd/agentmesh-controller/main.go`: uses `PostgresStore` when `DATABASE_URL` is set + reachable;
  **dev falls back to in-memory with a warning**, **production hard-fails** (never silently loses state).
  Runs `Migrate()` at startup (idempotent, tracks `schema_migrations`). Closes the pool on shutdown.
- `internal/server/server.go`: `/readyz` now consults an optional ready-check (DB ping) → **503 with an
  actionable reason** when the DB is down, **200** when healthy.
- New additive migration `000006_durability.up.sql` (credentials.last_used_at/description) so the durable
  credential store round-trips every field without data loss.

**Verified on HX370** (Postgres 16-alpine on `:55433`, all 6 migrations auto-applied, 37 tables):
| Check | Before (in-memory) | After (Postgres) |
|---|---|---|
| Restart → agents | `null` | **`['hx370-node']`** recovered |
| Restart → policies | `null` | **`['hx370-ops']`** recovered |
| Restart → contract | lost | **name + hash + `tools.allow` intact** (JSONB round-trip) |
| `/readyz` DB down | hardcoded ready | **503** `{"status":"unavailable","reason":"…connection refused"}` |
| `/readyz` DB up | 200 | **200** |
| Data survives DB bounce | n/a | **yes** (volume-persisted) |

This closes the Milestone 4 "crash/restart recovers" and Milestone 2 "authoritative store" requirements
for the authoritative control-plane entities. Reproduce: `docker run -d …postgres:16-alpine` then
`DATABASE_URL=… ./bin/agentmesh-controller` (see Reproduce block).

## Gap 2 — fenced-worker enrollment: CLOSED (Milestone 4 / HX370 acceptance #5)
Previously `agentmesh-worker` was a logging stub and `fleet.Manager` an in-memory proxy registry —
no durable job leases or fencing. **Now implemented and verified:**
- **`migrations/000007_worker_leases.up.sql`**: `workers` + `job_leases` tables, a `fencing_seq`
  SEQUENCE (monotonic token source), and a unique idempotency index (one effect per logical request).
- **`internal/worker/`**: a `Store` interface with **in-memory and Postgres** implementations that both
  enforce the fencing invariant. `ClaimJob`/`ClaimNextJob` **atomically bump `fencing_token`** on every
  claim/reassignment (Postgres: `UPDATE … SET fencing_token=nextval('fencing_seq') … RETURNING`);
  `CommitFenced` **only succeeds for the current holder with the current token** (effect-boundary check).
- **Controller endpoints** (`/api/v1/workers/enroll`, `/workers/{id}/heartbeat`, `/jobs`, `/jobs/{id}/claim`,
  `/jobs/claim-next`, `/jobs/{id}/heartbeat`, `/jobs/{id}/commit`) with precise fencing error codes
  (409 `STALE_LEASE`/`NOT_LEASE_HOLDER`/`NOT_CLAIMABLE`). Durable worker store shares the Postgres pool.
- **`cmd/agentmesh-worker`**: rewritten from a stub into a **real fenced execution client**
  (enroll → claim-next → process → fenced commit → heartbeat; a stale commit is a 409 and it moves on).

**Verified (three independent layers):**
| Layer | Evidence |
|---|---|
| In-memory fencing unit tests | 4 tests PASS: stale-worker-after-reassignment refused, duplicate enqueue collapses, live lease not stealable, renew requires current token |
| **Real-Postgres fencing integration test** | `TestFencing_Postgres` PASS (1.4s): atomic token bump A=3→B=4, stale A commit refused, B commit DONE, duplicate collapse |
| **Live E2E on HX370** (durable controller) | A claims token3 → B blocked while live (409) → after expiry B claims token4 → stale A commit **409 NOT_LEASE_HOLDER** → B commit **200 DONE**, job durable in SQL; **real worker binary** enrolled (ONLINE) + committed a job end-to-end (DONE) |

This closes HX370 acceptance #5 (lease fencing, duplicate prevention, reassignment safety) and the
storage/coordination half of Milestone 4. Full suite: **46 packages ok**, build/vet clean.

## Reproduce
```
cd agent-infra/agent-mesh && make build && go test -p 1 ./pkg/... ./internal/... ./tests ./cmd/...
# in-memory (dev, no deps):
AGENTMESH_ENV=development AGENTMESH_HTTP_PORT=18080 ./bin/agentmesh-controller
# durable (Postgres) — Gap 1:
docker run -d --name agentmesh-pg -e POSTGRES_USER=agentmesh -e POSTGRES_PASSWORD=agentmesh \
  -e POSTGRES_DB=agentmesh -p 127.0.0.1:55433:5432 -v agentmesh-pgdata:/var/lib/postgresql/data postgres:16-alpine
DATABASE_URL='postgres://agentmesh:agentmesh@127.0.0.1:55433/agentmesh?sslmode=disable' \
  AGENTMESH_ENV=development AGENTMESH_HTTP_PORT=18080 ./bin/agentmesh-controller
# certification: go test ./tests -run 'TestPhase5DefinitionOfDone35Certifications|TestP0RedTeamScenarios'
```

## Follow-ups (out of this session's scope)
- 28 GitHub-reported vulnerabilities on the branch default (2 critical, 6 high) — dependabot-tracked, in nested projects; triage separately.
- ~~Wire durable Postgres store (Gap 1)~~ **DONE** → next: fenced-worker enrollment (Gap 2, needs durable lease table + fencing token at effect boundary) and pinning the audit trail to the durable store (audit.Logger is a separate in-memory service today).
