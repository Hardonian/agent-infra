-- 000007_worker_leases.up.sql
-- Durable worker enrollment + job leases with monotonic fencing tokens (Gap 2).
--
-- Fencing model: every successful claim/reassignment bumps fencing_token from a Postgres SEQUENCE,
-- so a token is strictly increasing per job. A worker that held a lease, then lost it to a
-- reassignment (lease expiry), presents a now-stale token and its fenced commit is refused at the
-- effect boundary. The idempotency unique index prevents duplicate jobs for one logical request.

CREATE SEQUENCE IF NOT EXISTS fencing_seq START 1;

CREATE TABLE IF NOT EXISTS workers (
    tenant_id     VARCHAR(64)  NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    id            VARCHAR(128) NOT NULL,
    node_id       VARCHAR(128) NOT NULL,
    status        VARCHAR(16)  NOT NULL DEFAULT 'ONLINE',
    capacity      INT          NOT NULL DEFAULT 1,
    last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT now(),
    enrolled_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS job_leases (
    tenant_id       VARCHAR(64)  NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    job_id          VARCHAR(128) NOT NULL,
    idempotency_key VARCHAR(255),
    kind            VARCHAR(64)  NOT NULL DEFAULT 'generic',
    payload_json    JSONB,
    status          VARCHAR(16)  NOT NULL DEFAULT 'PENDING', -- PENDING | LEASED | DONE | FAILED
    lease_owner     VARCHAR(128),
    fencing_token   BIGINT       NOT NULL DEFAULT 0,
    lease_expires_at TIMESTAMPTZ,
    attempts        INT          NOT NULL DEFAULT 0,
    result_json     JSONB,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, job_id)
);

-- One intended effect per logical request: duplicates collapse to the same row.
CREATE UNIQUE INDEX IF NOT EXISTS job_leases_idem
    ON job_leases(tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Ready-to-claim work lookup.
CREATE INDEX IF NOT EXISTS job_leases_ready
    ON job_leases(tenant_id, status, lease_expires_at);
