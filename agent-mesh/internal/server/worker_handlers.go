package server

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/agentmesh/agentmesh/internal/worker"
)

// Worker/lease handlers — durable fenced-worker enrollment and job execution (Gap 2). All effects
// are fenced: a commit presents the fencing token the worker was granted and is refused if the lease
// was reassigned.

func (s *Server) requireWorkerStore(w http.ResponseWriter) bool {
	if s.workerStore == nil {
		writeJSONError(w, http.StatusServiceUnavailable, "WORKER_STORE_DISABLED", "worker/lease subsystem not configured")
		return false
	}
	return true
}

// POST /api/v1/workers/enroll
func (s *Server) handleEnrollWorker(w http.ResponseWriter, r *http.Request) {
	if !s.requireWorkerStore(w) {
		return
	}
	var req struct {
		ID       string `json:"id"`
		NodeID   string `json:"nodeId"`
		Capacity int    `json:"capacity"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid JSON body")
		return
	}
	if req.ID == "" {
		writeJSONError(w, http.StatusBadRequest, "BAD_REQUEST", "id is required")
		return
	}
	if req.Capacity <= 0 {
		req.Capacity = 1
	}
	wd := &worker.Worker{TenantID: getTenantID(r), ID: req.ID, NodeID: req.NodeID, Capacity: req.Capacity}
	if err := s.workerStore.EnrollWorker(r.Context(), wd); err != nil {
		writeJSONError(w, http.StatusInternalServerError, "ENROLL_FAILED", err.Error())
		return
	}
	jsonResponse(w, http.StatusCreated, wd)
}

// POST /api/v1/workers/{id}/heartbeat
func (s *Server) handleWorkerHeartbeat(w http.ResponseWriter, r *http.Request) {
	if !s.requireWorkerStore(w) {
		return
	}
	id := chi.URLParam(r, "id")
	if err := s.workerStore.HeartbeatWorker(r.Context(), getTenantID(r), id); err != nil {
		writeJSONError(w, http.StatusNotFound, "NOT_FOUND", "worker not found")
		return
	}
	jsonResponse(w, http.StatusOK, map[string]string{"status": "ok"})
}

// POST /api/v1/jobs
func (s *Server) handleEnqueueJob(w http.ResponseWriter, r *http.Request) {
	if !s.requireWorkerStore(w) {
		return
	}
	var req struct {
		JobID          string         `json:"jobId"`
		IdempotencyKey string         `json:"idempotencyKey"`
		Kind           string         `json:"kind"`
		Payload        map[string]any `json:"payload"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid JSON body")
		return
	}
	if req.JobID == "" {
		writeJSONError(w, http.StatusBadRequest, "BAD_REQUEST", "jobId is required")
		return
	}
	if req.Kind == "" {
		req.Kind = "generic"
	}
	job, err := s.workerStore.EnqueueJob(r.Context(), &worker.JobLease{
		TenantID: getTenantID(r), JobID: req.JobID, IdempotencyKey: req.IdempotencyKey, Kind: req.Kind, Payload: req.Payload,
	})
	if err == worker.ErrDuplicateJob {
		// One intended effect per logical request: return the existing job, not a second.
		jsonResponse(w, http.StatusOK, map[string]any{"job": job, "duplicate": true})
		return
	}
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "ENQUEUE_FAILED", err.Error())
		return
	}
	jsonResponse(w, http.StatusCreated, job)
}

// POST /api/v1/jobs/{id}/claim
func (s *Server) handleClaimJob(w http.ResponseWriter, r *http.Request) {
	if !s.requireWorkerStore(w) {
		return
	}
	var req struct {
		WorkerID   string `json:"workerId"`
		TTLSeconds int    `json:"ttlSeconds"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.WorkerID == "" {
		writeJSONError(w, http.StatusBadRequest, "BAD_REQUEST", "workerId is required")
		return
	}
	if req.TTLSeconds <= 0 {
		req.TTLSeconds = 30
	}
	job, err := s.workerStore.ClaimJob(r.Context(), getTenantID(r), chi.URLParam(r, "id"), req.WorkerID, time.Duration(req.TTLSeconds)*time.Second)
	if err == worker.ErrJobNotClaimable {
		writeJSONError(w, http.StatusConflict, "NOT_CLAIMABLE", "job is held by a live lease")
		return
	}
	if err == worker.ErrNotFound {
		writeJSONError(w, http.StatusNotFound, "NOT_FOUND", "job not found")
		return
	}
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "CLAIM_FAILED", err.Error())
		return
	}
	jsonResponse(w, http.StatusOK, job)
}

// POST /api/v1/jobs/claim-next — claim the oldest claimable job (worker pool loop).
func (s *Server) handleClaimNextJob(w http.ResponseWriter, r *http.Request) {
	if !s.requireWorkerStore(w) {
		return
	}
	var req struct {
		WorkerID   string `json:"workerId"`
		TTLSeconds int    `json:"ttlSeconds"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.WorkerID == "" {
		writeJSONError(w, http.StatusBadRequest, "BAD_REQUEST", "workerId is required")
		return
	}
	if req.TTLSeconds <= 0 {
		req.TTLSeconds = 30
	}
	job, err := s.workerStore.ClaimNextJob(r.Context(), getTenantID(r), req.WorkerID, time.Duration(req.TTLSeconds)*time.Second)
	if err == worker.ErrNotFound {
		writeJSONError(w, http.StatusNoContent, "NO_WORK", "no claimable jobs")
		return
	}
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "CLAIM_FAILED", err.Error())
		return
	}
	jsonResponse(w, http.StatusOK, job)
}

// POST /api/v1/jobs/{id}/heartbeat — renew a held lease (fenced).
func (s *Server) handleJobHeartbeat(w http.ResponseWriter, r *http.Request) {
	if !s.requireWorkerStore(w) {
		return
	}
	var req struct {
		WorkerID   string `json:"workerId"`
		FencingToken int64 `json:"fencingToken"`
		TTLSeconds int    `json:"ttlSeconds"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.WorkerID == "" {
		writeJSONError(w, http.StatusBadRequest, "BAD_REQUEST", "workerId is required")
		return
	}
	if req.TTLSeconds <= 0 {
		req.TTLSeconds = 30
	}
	err := s.workerStore.RenewLease(r.Context(), getTenantID(r), chi.URLParam(r, "id"), req.WorkerID, req.FencingToken, time.Duration(req.TTLSeconds)*time.Second)
	if err != nil {
		writeFencingError(w, err)
		return
	}
	jsonResponse(w, http.StatusOK, map[string]string{"status": "renewed"})
}

// POST /api/v1/jobs/{id}/commit — fenced effect commit.
func (s *Server) handleCommitJob(w http.ResponseWriter, r *http.Request) {
	if !s.requireWorkerStore(w) {
		return
	}
	var req struct {
		WorkerID     string         `json:"workerId"`
		FencingToken int64          `json:"fencingToken"`
		Result       map[string]any `json:"result"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.WorkerID == "" {
		writeJSONError(w, http.StatusBadRequest, "BAD_REQUEST", "workerId is required")
		return
	}
	job, err := s.workerStore.CommitFenced(r.Context(), getTenantID(r), chi.URLParam(r, "id"), req.WorkerID, req.FencingToken, req.Result)
	if err != nil {
		writeFencingError(w, err)
		return
	}
	jsonResponse(w, http.StatusOK, job)
}

func writeFencingError(w http.ResponseWriter, err error) {
	switch err {
	case worker.ErrStaleLease:
		writeJSONError(w, http.StatusConflict, "STALE_LEASE", "fencing token mismatch: job was reassigned; commit refused")
	case worker.ErrNotLeaseHolder:
		writeJSONError(w, http.StatusConflict, "NOT_LEASE_HOLDER", "worker no longer holds this lease; commit refused")
	case worker.ErrJobNotClaimable:
		writeJSONError(w, http.StatusConflict, "NOT_CLAIMABLE", "job is not in a committable state")
	case worker.ErrNotFound:
		writeJSONError(w, http.StatusNotFound, "NOT_FOUND", "job not found")
	default:
		writeJSONError(w, http.StatusInternalServerError, "LEASE_ERROR", err.Error())
	}
}
