package worker

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PostgresStore is the durable WorkerStore backed by the workers/job_leases tables (migration
// 000007). Fencing is enforced in SQL so it is correct under concurrency: claim atomically bumps
// fencing_token from the fencing_seq SEQUENCE, and a fenced commit only succeeds for the current
// holder with the current token.
type PostgresStore struct {
	pool *pgxpool.Pool
}

func NewPostgresStore(pool *pgxpool.Pool) *PostgresStore { return &PostgresStore{pool: pool} }

var _ Store = (*PostgresStore)(nil)

func jsonbVal(v any) string {
	if v == nil {
		return "null"
	}
	b, err := json.Marshal(v)
	if err != nil || len(b) == 0 {
		return "null"
	}
	return string(b)
}

func (p *PostgresStore) EnrollWorker(ctx context.Context, w *Worker) error {
	if w == nil || w.ID == "" || w.TenantID == "" {
		return fmt.Errorf("invalid worker")
	}
	_, err := p.pool.Exec(ctx, `INSERT INTO organizations(id,name) VALUES($1,$1) ON CONFLICT (id) DO NOTHING`, w.TenantID)
	if err != nil {
		return err
	}
	cap := w.Capacity
	if cap <= 0 {
		cap = 1
	}
	_, err = p.pool.Exec(ctx, `
		INSERT INTO workers (tenant_id, id, node_id, status, capacity, last_heartbeat, enrolled_at)
		VALUES ($1,$2,$3,$4,$5,now(),now())
		ON CONFLICT (tenant_id,id) DO UPDATE SET node_id=$3, status=$4, capacity=$5, last_heartbeat=now()`,
		w.TenantID, w.ID, w.NodeID, WorkerOnline, cap)
	return err
}

func (p *PostgresStore) HeartbeatWorker(ctx context.Context, tenantID, workerID string) error {
	tag, err := p.pool.Exec(ctx, `UPDATE workers SET last_heartbeat=now(), status=$4 WHERE tenant_id=$1 AND id=$2`, tenantID, workerID, WorkerOnline)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (p *PostgresStore) GetWorker(ctx context.Context, tenantID, workerID string) (*Worker, error) {
	var w Worker
	err := p.pool.QueryRow(ctx, `SELECT tenant_id,id,node_id,status,capacity,last_heartbeat,enrolled_at FROM workers WHERE tenant_id=$1 AND id=$2`, tenantID, workerID).
		Scan(&w.TenantID, &w.ID, &w.NodeID, &w.Status, &w.Capacity, &w.LastHeartbeat, &w.EnrolledAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &w, nil
}

func (p *PostgresStore) EnqueueJob(ctx context.Context, job *JobLease) (*JobLease, error) {
	if job == nil || job.JobID == "" || job.TenantID == "" {
		return nil, fmt.Errorf("invalid job")
	}
	_, err := p.pool.Exec(ctx, `INSERT INTO organizations(id,name) VALUES($1,$1) ON CONFLICT (id) DO NOTHING`, job.TenantID)
	if err != nil {
		return nil, err
	}
	var idem any
	if job.IdempotencyKey != "" {
		idem = job.IdempotencyKey
	}
	// Idempotent insert: ON CONFLICT on the idempotency unique index resolves to the existing row.
	var returned JobLease
	err = p.pool.QueryRow(ctx, `
		INSERT INTO job_leases (tenant_id, job_id, idempotency_key, kind, payload_json, status)
		VALUES ($1,$2,$3,$4,CAST($5 AS jsonb),$6)
		ON CONFLICT (tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
		RETURNING tenant_id, job_id, COALESCE(idempotency_key,''), kind, status, COALESCE(lease_owner,''), fencing_token, attempts, created_at, updated_at`,
		job.TenantID, job.JobID, idem, job.Kind, jsonbVal(job.Payload), JobPending).
		Scan(&returned.TenantID, &returned.JobID, &returned.IdempotencyKey, &returned.Kind, &returned.Status, &returned.LeaseOwner, &returned.FencingToken, &returned.Attempts, &returned.CreatedAt, &returned.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		// Conflict on idempotency key -> return the existing job + duplicate signal.
		existing, gerr := p.getByIdempotency(ctx, job.TenantID, job.IdempotencyKey)
		if gerr != nil {
			return nil, gerr
		}
		return existing, ErrDuplicateJob
	}
	if err != nil {
		return nil, err
	}
	return &returned, nil
}

func (p *PostgresStore) getByIdempotency(ctx context.Context, tenantID, idemKey string) (*JobLease, error) {
	var j JobLease
	var payload []byte
	err := p.pool.QueryRow(ctx, `
		SELECT tenant_id, job_id, COALESCE(idempotency_key,''), kind, COALESCE(payload_json,'{}'), status,
		       COALESCE(lease_owner,''), fencing_token, attempts, created_at, updated_at
		FROM job_leases WHERE tenant_id=$1 AND idempotency_key=$2`, tenantID, idemKey).
		Scan(&j.TenantID, &j.JobID, &j.IdempotencyKey, &j.Kind, &payload, &j.Status, &j.LeaseOwner, &j.FencingToken, &j.Attempts, &j.CreatedAt, &j.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if len(payload) > 0 {
		_ = json.Unmarshal(payload, &j.Payload)
	}
	return &j, nil
}

func (p *PostgresStore) GetJob(ctx context.Context, tenantID, jobID string) (*JobLease, error) {
	var j JobLease
	var payload, result []byte
	err := p.pool.QueryRow(ctx, `
		SELECT tenant_id, job_id, COALESCE(idempotency_key,''), kind, COALESCE(payload_json,'{}'), status,
		       COALESCE(lease_owner,''), fencing_token, attempts, COALESCE(result_json,'{}'), created_at, updated_at
		FROM job_leases WHERE tenant_id=$1 AND job_id=$2`, tenantID, jobID).
		Scan(&j.TenantID, &j.JobID, &j.IdempotencyKey, &j.Kind, &payload, &j.Status, &j.LeaseOwner, &j.FencingToken, &j.Attempts, &result, &j.CreatedAt, &j.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if len(payload) > 0 {
		_ = json.Unmarshal(payload, &j.Payload)
	}
	if len(result) > 0 {
		_ = json.Unmarshal(result, &j.Result)
	}
	return &j, nil
}

func (p *PostgresStore) ClaimJob(ctx context.Context, tenantID, jobID, workerID string, ttl time.Duration) (*JobLease, error) {
	ttlSec := int64(ttl.Seconds())
	if ttlSec <= 0 {
		ttlSec = 30
	}
	// Atomic claim/reassignment: only an unexpired-lease-miss or pending job is claimable, and the
	// fencing token is bumped from the SEQUENCE in the same statement (concurrency-safe).
	var token int64
	err := p.pool.QueryRow(ctx, `
		UPDATE job_leases
		SET lease_owner=$3, fencing_token=nextval('fencing_seq'),
		    lease_expires_at = now() + make_interval(secs => $4),
		    status=$5, attempts=attempts+1, updated_at=now()
		WHERE tenant_id=$1 AND job_id=$2
		  AND (status=$6 OR (status=$5 AND lease_expires_at < now()))
		RETURNING fencing_token`,
		tenantID, jobID, workerID, ttlSec, JobLeased, JobPending).Scan(&token)
	if errors.Is(err, pgx.ErrNoRows) {
		// Distinguish not-found from not-claimable.
		if _, gerr := p.GetJob(ctx, tenantID, jobID); gerr != nil {
			return nil, gerr
		}
		return nil, ErrJobNotClaimable
	}
	if err != nil {
		return nil, err
	}
	return p.GetJob(ctx, tenantID, jobID)
}

func (p *PostgresStore) ClaimNextJob(ctx context.Context, tenantID, workerID string, ttl time.Duration) (*JobLease, error) {
	// Pick the oldest claimable job, then claim it atomically (re-checks claimability under the
	// UPDATE, so a concurrent claim loses safely).
	var nextJobID string
	err := p.pool.QueryRow(ctx, `
		SELECT job_id FROM job_leases
		WHERE tenant_id=$1 AND (status=$2 OR (status=$3 AND lease_expires_at < now()))
		ORDER BY created_at ASC LIMIT 1`, tenantID, JobPending, JobLeased).Scan(&nextJobID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return p.ClaimJob(ctx, tenantID, nextJobID, workerID, ttl)
}

func (p *PostgresStore) RenewLease(ctx context.Context, tenantID, jobID, workerID string, token int64, ttl time.Duration) error {
	ttlSec := int64(ttl.Seconds())
	if ttlSec <= 0 {
		ttlSec = 30
	}
	tag, err := p.pool.Exec(ctx, `
		UPDATE job_leases SET lease_expires_at = now() + make_interval(secs => $5), updated_at=now()
		WHERE tenant_id=$1 AND job_id=$2 AND lease_owner=$3 AND fencing_token=$4 AND status=$6`,
		tenantID, jobID, workerID, token, ttlSec, JobLeased)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return p.leaseMismatch(ctx, tenantID, jobID, workerID, token)
	}
	return nil
}

func (p *PostgresStore) CommitFenced(ctx context.Context, tenantID, jobID, workerID string, token int64, result map[string]any) (*JobLease, error) {
	var res any
	if result != nil {
		res = jsonbVal(result)
	}
	// Effect-boundary fencing: only the current holder with the current token may commit.
	tag, err := p.pool.Exec(ctx, `
		UPDATE job_leases SET status=$6, result_json=CAST($7 AS jsonb), updated_at=now()
		WHERE tenant_id=$1 AND job_id=$2 AND lease_owner=$3 AND fencing_token=$4 AND status=$5`,
		tenantID, jobID, workerID, token, JobLeased, JobDone, res)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, p.leaseMismatch(ctx, tenantID, jobID, workerID, token)
	}
	return p.GetJob(ctx, tenantID, jobID)
}

// leaseMismatch classifies a failed fenced operation into the precise fencing error.
func (p *PostgresStore) leaseMismatch(ctx context.Context, tenantID, jobID, workerID string, token int64) error {
	j, err := p.GetJob(ctx, tenantID, jobID)
	if err != nil {
		return err
	}
	if j.LeaseOwner != workerID {
		return ErrNotLeaseHolder
	}
	if j.FencingToken != token {
		return ErrStaleLease
	}
	return ErrJobNotClaimable
}
