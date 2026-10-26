package worker

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// MemoryStore is an in-process WorkerStore used for zero-dependency dev startup and as a test
// double. It enforces the same fencing invariants as the Postgres store (monotonic token on claim;
// fenced commit requires the current holder + token) under a mutex.
type MemoryStore struct {
	mu      sync.Mutex
	workers map[string]*Worker          // tenant:id -> worker
	jobs    map[string]*JobLease        // tenant:jobID -> job
	idem    map[string]string           // tenant:idemKey -> jobID
	seq     int64                       // monotonic fencing token source
	now     func() time.Time            // injectable clock for tests
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		workers: make(map[string]*Worker),
		jobs:    make(map[string]*JobLease),
		idem:    make(map[string]string),
		now:     time.Now,
	}
}

// SetClock overrides the time source (tests only) to exercise lease expiry deterministically.
func (m *MemoryStore) SetClock(fn func() time.Time) { m.now = fn }

func wk(tenant, id string) string { return tenant + ":" + id }

func (m *MemoryStore) nextToken() int64 { m.seq++; return m.seq }

func cloneJob(j *JobLease) *JobLease {
	c := *j
	if j.LeaseExpiresAt != nil {
		t := *j.LeaseExpiresAt
		c.LeaseExpiresAt = &t
	}
	return &c
}

func (m *MemoryStore) EnrollWorker(_ context.Context, w *Worker) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if w == nil || w.ID == "" || w.TenantID == "" {
		return fmt.Errorf("invalid worker")
	}
	cp := *w
	cp.Status = WorkerOnline
	cp.EnrolledAt = m.now()
	cp.LastHeartbeat = m.now()
	m.workers[wk(w.TenantID, w.ID)] = &cp
	return nil
}

func (m *MemoryStore) HeartbeatWorker(_ context.Context, tenantID, workerID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	w, ok := m.workers[wk(tenantID, workerID)]
	if !ok {
		return ErrNotFound
	}
	w.LastHeartbeat = m.now()
	w.Status = WorkerOnline
	return nil
}

func (m *MemoryStore) GetWorker(_ context.Context, tenantID, workerID string) (*Worker, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	w, ok := m.workers[wk(tenantID, workerID)]
	if !ok {
		return nil, ErrNotFound
	}
	cp := *w
	return &cp, nil
}

func (m *MemoryStore) EnqueueJob(_ context.Context, job *JobLease) (*JobLease, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if job == nil || job.JobID == "" || job.TenantID == "" {
		return nil, fmt.Errorf("invalid job")
	}
	key := wk(job.TenantID, job.JobID)
	if job.IdempotencyKey != "" {
		ikey := wk(job.TenantID, job.IdempotencyKey)
		if existingID, ok := m.idem[ikey]; ok {
			return cloneJob(m.jobs[existingID]), ErrDuplicateJob
		}
		m.idem[ikey] = key
	}
	cp := cloneJob(job)
	cp.Status = JobPending
	cp.FencingToken = 0
	cp.CreatedAt = m.now()
	cp.UpdatedAt = m.now()
	m.jobs[key] = cp
	return cloneJob(cp), nil
}

func (m *MemoryStore) GetJob(_ context.Context, tenantID, jobID string) (*JobLease, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	j, ok := m.jobs[wk(tenantID, jobID)]
	if !ok {
		return nil, ErrNotFound
	}
	return cloneJob(j), nil
}

func (m *MemoryStore) ClaimJob(_ context.Context, tenantID, jobID, workerID string, ttl time.Duration) (*JobLease, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	j, ok := m.jobs[wk(tenantID, jobID)]
	if !ok {
		return nil, ErrNotFound
	}
	if !claimable(j, m.now()) {
		return nil, ErrJobNotClaimable
	}
	return m.applyClaim(j, workerID, ttl), nil
}

func (m *MemoryStore) ClaimNextJob(_ context.Context, tenantID, workerID string, ttl time.Duration) (*JobLease, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	now := m.now()
	var oldest *JobLease
	for _, j := range m.jobs {
		if j.TenantID != tenantID || !claimable(j, now) {
			continue
		}
		if oldest == nil || j.CreatedAt.Before(oldest.CreatedAt) {
			oldest = j
		}
	}
	if oldest == nil {
		return nil, ErrNotFound
	}
	return m.applyClaim(oldest, workerID, ttl), nil
}

func claimable(j *JobLease, now time.Time) bool {
	return j.Status == JobPending || (j.Status == JobLeased && j.LeaseExpiresAt != nil && j.LeaseExpiresAt.Before(now))
}

func (m *MemoryStore) applyClaim(j *JobLease, workerID string, ttl time.Duration) *JobLease {
	now := m.now()
	j.Status = JobLeased
	j.LeaseOwner = workerID
	j.FencingToken = m.nextToken()
	exp := now.Add(ttl)
	j.LeaseExpiresAt = &exp
	j.Attempts++
	j.UpdatedAt = now
	return cloneJob(j)
}

func (m *MemoryStore) RenewLease(_ context.Context, tenantID, jobID, workerID string, token int64, ttl time.Duration) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	j, ok := m.jobs[wk(tenantID, jobID)]
	if !ok {
		return ErrNotFound
	}
	if j.Status != JobLeased || j.LeaseOwner != workerID {
		return ErrNotLeaseHolder
	}
	if j.FencingToken != token {
		return ErrStaleLease
	}
	exp := m.now().Add(ttl)
	j.LeaseExpiresAt = &exp
	j.UpdatedAt = m.now()
	return nil
}

func (m *MemoryStore) CommitFenced(_ context.Context, tenantID, jobID, workerID string, token int64, result map[string]any) (*JobLease, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	j, ok := m.jobs[wk(tenantID, jobID)]
	if !ok {
		return nil, ErrNotFound
	}
	// Effect-boundary fencing check.
	if j.LeaseOwner != workerID || j.FencingToken != token {
		if j.LeaseOwner != workerID {
			return nil, ErrNotLeaseHolder
		}
		return nil, ErrStaleLease
	}
	if j.Status != JobLeased {
		return nil, ErrJobNotClaimable
	}
	j.Status = JobDone
	j.Result = result
	j.UpdatedAt = m.now()
	return cloneJob(j), nil
}
