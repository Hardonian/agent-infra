package worker

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// TestFencing_Postgres is a real-database fencing integration test. It runs the same stale-worker
// scenario as the in-memory test but against Postgres, proving the SQL fencing (atomic claim bumping
// fencing_seq; fenced commit requires current holder+token) is correct. It is SKIPPED unless
// WORKER_TEST_DATABASE_URL is set (so CI without a database still passes), and it applies its own
// idempotent DDL so it does not depend on the controller's migration runner.
func TestFencing_Postgres(t *testing.T) {
	dsn := os.Getenv("WORKER_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("WORKER_TEST_DATABASE_URL not set; skipping Postgres fencing integration test")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		t.Fatalf("ping: %v", err)
	}

	// Minimal idempotent schema (matches migration 000007).
	for _, ddl := range []string{
		`CREATE TABLE IF NOT EXISTS organizations (id VARCHAR(64) PRIMARY KEY, name VARCHAR(255), created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now())`,
		`CREATE SEQUENCE IF NOT EXISTS fencing_seq START 1`,
		`CREATE TABLE IF NOT EXISTS job_leases (tenant_id VARCHAR(64) NOT NULL, job_id VARCHAR(128) NOT NULL, idempotency_key VARCHAR(255), kind VARCHAR(64) NOT NULL DEFAULT 'generic', payload_json JSONB, status VARCHAR(16) NOT NULL DEFAULT 'PENDING', lease_owner VARCHAR(128), fencing_token BIGINT NOT NULL DEFAULT 0, lease_expires_at TIMESTAMPTZ, attempts INT NOT NULL DEFAULT 0, result_json JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (tenant_id, job_id))`,
		`CREATE UNIQUE INDEX IF NOT EXISTS job_leases_idem ON job_leases(tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL`,
	} {
		if _, err := pool.Exec(ctx, ddl); err != nil {
			t.Fatalf("ddl: %v", err)
		}
	}

	s := NewPostgresStore(pool)
	tenant := "pgtest"
	// Unique ids per run to avoid collisions with prior runs.
	suffix := time.Now().UnixNano()
	jobID := "job-pg-" + time.Now().Format("150405.000000000")

	if _, err := s.EnqueueJob(ctx, &JobLease{TenantID: tenant, JobID: jobID, IdempotencyKey: "idem-" + time.Now().Format("150405.000000000"), Kind: "test"}); err != nil {
		t.Fatalf("enqueue: %v", err)
	}
	_ = suffix

	// Worker A claims with a 1s TTL.
	a, err := s.ClaimJob(ctx, tenant, jobID, "workerA", 1*time.Second)
	if err != nil {
		t.Fatalf("A claim: %v", err)
	}
	if a.FencingToken == 0 {
		t.Fatal("expected non-zero token")
	}

	// Let A's lease expire.
	time.Sleep(1300 * time.Millisecond)

	// Worker B takes over -> strictly higher token.
	b, err := s.ClaimJob(ctx, tenant, jobID, "workerB", 5*time.Second)
	if err != nil {
		t.Fatalf("B claim after expiry: %v", err)
	}
	if b.FencingToken <= a.FencingToken {
		t.Fatalf("token must increase on reassignment: A=%d B=%d", a.FencingToken, b.FencingToken)
	}

	// Stale A commit -> refused.
	if _, err := s.CommitFenced(ctx, tenant, jobID, "workerA", a.FencingToken, map[string]any{"by": "A"}); !errors.Is(err, ErrStaleLease) && !errors.Is(err, ErrNotLeaseHolder) {
		t.Fatalf("stale A commit must be refused, got %v", err)
	}

	// Holder B commit -> succeeds.
	done, err := s.CommitFenced(ctx, tenant, jobID, "workerB", b.FencingToken, map[string]any{"by": "B"})
	if err != nil {
		t.Fatalf("B commit: %v", err)
	}
	if done.Status != JobDone {
		t.Fatalf("expected DONE, got %s", done.Status)
	}

	// Duplicate enqueue collapses.
	jobID2 := "job-pg-dup-" + time.Now().Format("150405.000000000")
	idem := "dup-" + time.Now().Format("150405.000000000")
	first, _ := s.EnqueueJob(ctx, &JobLease{TenantID: tenant, JobID: jobID2, IdempotencyKey: idem})
	second, err2 := s.EnqueueJob(ctx, &JobLease{TenantID: tenant, JobID: jobID2 + "-b", IdempotencyKey: idem})
	if !errors.Is(err2, ErrDuplicateJob) || second.JobID != first.JobID {
		t.Fatalf("duplicate enqueue must collapse to same job, got err=%v id=%s", err2, second.JobID)
	}
}
