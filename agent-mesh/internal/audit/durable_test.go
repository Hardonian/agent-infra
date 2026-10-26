package audit

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// TestDurableAudit_ChainSurvivesRestart proves the tamper-evident audit chain is durable: a fresh
// DurableLogger over the same store seeds lastHash from persisted entries and continues the chain
// (the new entry's prevHash equals the previous entry's hash), instead of restarting the chain.
// Skipped unless WORKER_TEST_DATABASE_URL is set.
func TestDurableAudit_ChainSurvivesRestart(t *testing.T) {
	dsn := os.Getenv("WORKER_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("WORKER_TEST_DATABASE_URL not set; skipping durable audit test")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer pool.Close()

	// Minimal idempotent audit schema (matches migrations).
	for _, ddl := range []string{
		`CREATE TABLE IF NOT EXISTS organizations (id VARCHAR(64) PRIMARY KEY, name VARCHAR(255), created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now())`,
		`CREATE TABLE IF NOT EXISTS audit_events (id VARCHAR(64) PRIMARY KEY, tenant_id VARCHAR(64) NOT NULL, type VARCHAR(64) NOT NULL, actor VARCHAR(128) NOT NULL, subject VARCHAR(255) NOT NULL, details_json JSONB, prev_hash VARCHAR(64) NOT NULL, hash VARCHAR(64) NOT NULL, timestamp TIMESTAMPTZ NOT NULL)`,
	} {
		if _, err := pool.Exec(ctx, ddl); err != nil {
			t.Fatalf("ddl: %v", err)
		}
	}

	store := NewPostgresStore(pool)
	tenant := "audit-durable-test-" + time.Now().Format("150405.000000000")

	// "Process 1": log two entries.
	l1 := NewDurableLogger(store)
	e1 := l1.Log(tenant, EventAgentRegistered, "api", "agent-1", map[string]any{"n": 1})
	e2 := l1.Log(tenant, EventPolicyPublished, "api", "pol-1", nil)

	if ok, err := l1.VerifyChain(tenant); !ok {
		t.Fatalf("chain invalid after process 1: %v", err)
	}

	// "Process 2": fresh logger over the SAME store — must continue, not restart, the chain.
	l2 := NewDurableLogger(store)
	e3 := l2.Log(tenant, EventCredentialCreated, "api", "cred-1", nil)

	if e3.PrevHash != e2.Hash {
		t.Fatalf("chain not continuous across restart: e3.prevHash=%s != e2.hash=%s", e3.PrevHash, e2.Hash)
	}
	if e2.PrevHash != e1.Hash {
		t.Fatalf("chain broken between e1/e2: e2.prev=%s e1.hash=%s", e2.PrevHash, e1.Hash)
	}
	if ok, err := l2.VerifyChain(tenant); !ok {
		t.Fatalf("chain invalid after restart: %v", err)
	}

	// List reads durable entries (3 total).
	if got := l2.List(tenant, 100); len(got) < 3 {
		t.Fatalf("expected >=3 durable audit entries, got %d", len(got))
	}
}
