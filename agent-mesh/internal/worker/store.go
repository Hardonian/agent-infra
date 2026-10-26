// Package worker implements durable worker enrollment and job leases with monotonic fencing
// tokens, closing the fenced-worker-enrollment gap (Milestone 4 / HX370 acceptance #5).
//
// Fencing invariant: a job's fencing_token strictly increases on every claim/reassignment. A fenced
// commit presents the token the worker was granted; if the lease was reassigned (lease expiry) the
// token is stale and the commit is refused at the effect boundary — a stale worker cannot commit
// results after reassignment.
package worker

import (
	"context"
	"errors"
	"time"
)

// Job status values.
const (
	JobPending = "PENDING"
	JobLeased  = "LEASED"
	JobDone    = "DONE"
	JobFailed  = "FAILED"
)

// Worker status values.
const (
	WorkerOnline  = "ONLINE"
	WorkerOffline = "OFFLINE"
)

var (
	ErrNotFound         = errors.New("worker/job not found")
	ErrStaleLease       = errors.New("stale lease: fencing token mismatch (job reassigned)")
	ErrNotLeaseHolder   = errors.New("not the current lease holder")
	ErrJobNotClaimable  = errors.New("job not claimable")
	ErrWorkerOffline    = errors.New("worker offline")
	ErrDuplicateJob     = errors.New("duplicate job (idempotency key already used)")
)

// Worker is an enrolled execution node advertising bounded capacity.
type Worker struct {
	TenantID      string    `json:"tenantId"`
	ID            string    `json:"id"`
	NodeID        string    `json:"nodeId"`
	Status        string    `json:"status"`
	Capacity      int       `json:"capacity"`
	LastHeartbeat time.Time `json:"lastHeartbeat"`
	EnrolledAt    time.Time `json:"enrolledAt"`
}

// JobLease is a durable unit of work with an associated lease and fencing token.
type JobLease struct {
	TenantID       string         `json:"tenantId"`
	JobID          string         `json:"jobId"`
	IdempotencyKey string         `json:"idempotencyKey,omitempty"`
	Kind           string         `json:"kind"`
	Payload        map[string]any `json:"payload,omitempty"`
	Status         string         `json:"status"`
	LeaseOwner     string         `json:"leaseOwner,omitempty"`
	FencingToken   int64          `json:"fencingToken"`
	LeaseExpiresAt *time.Time     `json:"leaseExpiresAt,omitempty"`
	Attempts       int            `json:"attempts"`
	Result         map[string]any `json:"result,omitempty"`
	CreatedAt      time.Time      `json:"createdAt"`
	UpdatedAt      time.Time      `json:"updatedAt"`
}

// Store is the durable worker/lease backend. Implementations must enforce the fencing invariant
// atomically (a concurrent reassignment must never let an old holder commit).
type Store interface {
	EnrollWorker(ctx context.Context, w *Worker) error
	HeartbeatWorker(ctx context.Context, tenantID, workerID string) error
	GetWorker(ctx context.Context, tenantID, workerID string) (*Worker, error)

	// EnqueueJob inserts a job idempotently. If idempotencyKey already exists it returns the
	// existing job and ErrDuplicateJob (one intended effect per logical request).
	EnqueueJob(ctx context.Context, job *JobLease) (*JobLease, error)
	GetJob(ctx context.Context, tenantID, jobID string) (*JobLease, error)

	// ClaimJob atomically takes (or takes over an expired) lease, bumping the fencing token, and
	// returns the job with the freshly granted token.
	ClaimJob(ctx context.Context, tenantID, jobID, workerID string, ttl time.Duration) (*JobLease, error)
	// ClaimNextJob atomically claims the oldest claimable job (pending or expired lease) for a worker.
	// Returns ErrNotFound when there is no claimable work.
	ClaimNextJob(ctx context.Context, tenantID, workerID string, ttl time.Duration) (*JobLease, error)
	// RenewLease extends a held lease only if workerID still holds it with the given token.
	RenewLease(ctx context.Context, tenantID, jobID, workerID string, token int64, ttl time.Duration) error
	// CommitFenced records the job result at the effect boundary. It succeeds ONLY if workerID still
	// holds the lease with the given token; otherwise ErrStaleLease/ErrNotLeaseHolder.
	CommitFenced(ctx context.Context, tenantID, jobID, workerID string, token int64, result map[string]any) (*JobLease, error)
}
