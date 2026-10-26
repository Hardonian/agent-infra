package worker

import (
	"context"
	"errors"
	"testing"
	"time"
)

// TestFencing_StaleWorkerCannotCommitAfterReassignment is the core Gap-2 acceptance test:
// worker A claims a job, its lease expires, worker B claims it (higher fencing token), and A's
// attempt to commit with its old token is refused at the effect boundary.
func TestFencing_StaleWorkerCannotCommitAfterReassignment(t *testing.T) {
	ctx := context.Background()
	s := NewMemoryStore()
	clock := time.Now()
	s.SetClock(func() time.Time { return clock })

	if _, err := s.EnqueueJob(ctx, &JobLease{TenantID: "t1", JobID: "job1", Kind: "repo-maint"}); err != nil {
		t.Fatalf("enqueue: %v", err)
	}

	// Worker A claims with a short TTL.
	a, err := s.ClaimJob(ctx, "t1", "job1", "workerA", 10*time.Second)
	if err != nil {
		t.Fatalf("A claim: %v", err)
	}
	if a.FencingToken == 0 {
		t.Fatal("expected a non-zero fencing token on claim")
	}

	// A's lease expires (advance the clock past TTL).
	clock = clock.Add(30 * time.Second)

	// Worker B takes over the expired lease -> strictly higher token.
	b, err := s.ClaimJob(ctx, "t1", "job1", "workerB", 10*time.Second)
	if err != nil {
		t.Fatalf("B claim: %v", err)
	}
	if b.FencingToken <= a.FencingToken {
		t.Fatalf("fencing token must strictly increase on reassignment: A=%d B=%d", a.FencingToken, b.FencingToken)
	}

	// Stale worker A tries to commit with its old token -> MUST be refused.
	if _, err := s.CommitFenced(ctx, "t1", "job1", "workerA", a.FencingToken, map[string]any{"by": "A"}); !errors.Is(err, ErrStaleLease) && !errors.Is(err, ErrNotLeaseHolder) {
		t.Fatalf("stale worker A commit must be refused, got err=%v", err)
	}

	// Current holder B commits with its token -> succeeds.
	done, err := s.CommitFenced(ctx, "t1", "job1", "workerB", b.FencingToken, map[string]any{"by": "B"})
	if err != nil {
		t.Fatalf("B commit: %v", err)
	}
	if done.Status != JobDone {
		t.Fatalf("expected DONE, got %s", done.Status)
	}
}

// TestFencing_DuplicateJobEnqueueCollapsesToOneEffect proves idempotent enqueue: the same
// idempotency key yields one job (duplicate produces no second effect).
func TestFencing_DuplicateJobEnqueueCollapsesToOneEffect(t *testing.T) {
	ctx := context.Background()
	s := NewMemoryStore()
	first, err := s.EnqueueJob(ctx, &JobLease{TenantID: "t1", JobID: "jobA", IdempotencyKey: "webhook-123"})
	if err != nil {
		t.Fatalf("first enqueue: %v", err)
	}
	second, err := s.EnqueueJob(ctx, &JobLease{TenantID: "t1", JobID: "jobB", IdempotencyKey: "webhook-123"})
	if !errors.Is(err, ErrDuplicateJob) {
		t.Fatalf("duplicate enqueue must return ErrDuplicateJob, got err=%v", err)
	}
	if second.JobID != first.JobID {
		t.Fatalf("duplicate must resolve to the same job: %s vs %s", second.JobID, first.JobID)
	}
}

// TestFencing_RenewRequiresCurrentToken proves a reassignment invalidates the old holder's renew.
func TestFencing_RenewRequiresCurrentToken(t *testing.T) {
	ctx := context.Background()
	s := NewMemoryStore()
	clock := time.Now()
	s.SetClock(func() time.Time { return clock })
	_, _ = s.EnqueueJob(ctx, &JobLease{TenantID: "t1", JobID: "job1"})

	a, _ := s.ClaimJob(ctx, "t1", "job1", "workerA", 10*time.Second)
	clock = clock.Add(30 * time.Second)
	b, _ := s.ClaimJob(ctx, "t1", "job1", "workerB", 10*time.Second)

	// Old holder A cannot renew with its stale token.
	if err := s.RenewLease(ctx, "t1", "job1", "workerA", a.FencingToken, 10*time.Second); !errors.Is(err, ErrStaleLease) && !errors.Is(err, ErrNotLeaseHolder) {
		t.Fatalf("stale renew must be refused, got %v", err)
	}
	// Current holder B can renew.
	if err := s.RenewLease(ctx, "t1", "job1", "workerB", b.FencingToken, 10*time.Second); err != nil {
		t.Fatalf("holder renew: %v", err)
	}
}

// TestFencing_ClaimRefusedWhileLeaseHeld proves a live (unexpired) lease cannot be stolen.
func TestFencing_ClaimRefusedWhileLeaseHeld(t *testing.T) {
	ctx := context.Background()
	s := NewMemoryStore()
	_, _ = s.EnqueueJob(ctx, &JobLease{TenantID: "t1", JobID: "job1"})
	if _, err := s.ClaimJob(ctx, "t1", "job1", "workerA", 10*time.Second); err != nil {
		t.Fatalf("A claim: %v", err)
	}
	// B tries to claim while A's lease is still live -> refused.
	if _, err := s.ClaimJob(ctx, "t1", "job1", "workerB", 10*time.Second); !errors.Is(err, ErrJobNotClaimable) {
		t.Fatalf("live lease must not be stealable, got %v", err)
	}
}
