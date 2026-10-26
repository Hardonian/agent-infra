package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/google/uuid"

	"github.com/agentmesh/agentmesh/internal/config"
)

// workerClient is a real fenced-worker execution client against the AgentMesh control plane. It
// enrolls, polls for the next claimable job, processes it, and commits the result under the fencing
// token it was granted. A stale commit (lease reassigned) is refused by the control plane (HTTP 409)
// and the worker moves on — it cannot commit after reassignment (Gap 2 fencing).
//
// Processing is generic (records that the worker handled the job). Real deployments dispatch on
// job.Kind to an executor; the fencing/lease transport is what this node owns.
type workerClient struct {
	cp       string
	tenant   string
	id       string
	node     string
	ttl      time.Duration
	interval time.Duration
	http     *http.Client
	log      *slog.Logger
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func envInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}

func (c *workerClient) post(ctx context.Context, path string, body any, out any) (int, error) {
	b, _ := json.Marshal(body)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.cp+path, bytes.NewReader(b))
	if err != nil {
		return 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", c.tenant)
	resp, err := c.http.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	if out != nil && resp.StatusCode < 300 {
		_ = json.NewDecoder(resp.Body).Decode(out)
	}
	return resp.StatusCode, nil
}

func (c *workerClient) enroll(ctx context.Context) error {
	code, err := c.post(ctx, "/api/v1/workers/enroll", map[string]any{"id": c.id, "nodeId": c.node, "capacity": 1}, nil)
	if err != nil {
		return err
	}
	if code >= 300 {
		return fmt.Errorf("enroll returned %d", code)
	}
	return nil
}

type jobResp struct {
	JobID        string         `json:"jobId"`
	Kind         string         `json:"kind"`
	Status       string         `json:"status"`
	LeaseOwner   string         `json:"leaseOwner"`
	FencingToken int64          `json:"fencingToken"`
	Payload      map[string]any `json:"payload"`
}

func (c *workerClient) run(ctx context.Context) {
	c.log.Info("worker running", "worker", c.id, "node", c.node, "tenant", c.tenant, "cp", c.cp)
	for {
		select {
		case <-ctx.Done():
			c.log.Info("worker stopping")
			return
		default:
		}

		// Renew worker heartbeat (keeps the node ONLINE).
		_, _ = c.post(ctx, fmt.Sprintf("/api/v1/workers/%s/heartbeat", c.id), map[string]any{}, nil)

		var job jobResp
		code, err := c.post(ctx, "/api/v1/jobs/claim-next", map[string]any{"workerId": c.id, "ttlSeconds": int(c.ttl.Seconds())}, &job)
		if err != nil {
			c.log.Debug("claim-next failed", "error", err)
			time.Sleep(c.interval)
			continue
		}
		if code == http.StatusNoContent { // no work
			time.Sleep(c.interval)
			continue
		}
		if code >= 300 {
			c.log.Debug("claim-next unexpected status", "code", code)
			time.Sleep(c.interval)
			continue
		}

		c.log.Info("claimed job", "job", job.JobID, "kind", job.Kind, "fencingToken", job.FencingToken)

		result := map[string]any{
			"processedBy":  c.id,
			"node":         c.node,
			"jobId":        job.JobID,
			"fencingToken": job.FencingToken,
			"at":           time.Now().UTC().Format(time.RFC3339),
		}

		// Fenced commit: refused by the control plane if the lease was reassigned (stale token).
		var committed jobResp
		ccode, cerr := c.post(ctx, fmt.Sprintf("/api/v1/jobs/%s/commit", job.JobID),
			map[string]any{"workerId": c.id, "fencingToken": job.FencingToken, "result": result}, &committed)
		if cerr != nil {
			c.log.Error("commit transport error", "job", job.JobID, "error", cerr)
			continue
		}
		switch ccode {
		case http.StatusOK:
			c.log.Info("job committed", "job", job.JobID, "status", committed.Status)
		case http.StatusConflict:
			// Fencing did its job: this worker lost the lease; another worker owns the effect.
			c.log.Warn("commit refused (lease reassigned) — fenced out", "job", job.JobID)
		default:
			c.log.Warn("commit unexpected status", "job", job.JobID, "code", ccode)
		}
	}
}

// runWorker is the testable loop entrypoint: it runs the fenced worker loop until ctx is done and
// returns the context error. It does not enroll (enrollment happens in main).
func runWorker(ctx context.Context, cfg *config.AppConfig, logger *slog.Logger, interval time.Duration) error {
	if cfg == nil {
		return fmt.Errorf("config cannot be nil")
	}
	cp := envOr("AGENTMESH_CONTROL_PLANE_URL", fmt.Sprintf("http://127.0.0.1:%d", cfg.HTTPPort))
	if cfg.ControlPlaneURL != "" {
		cp = cfg.ControlPlaneURL
	}
	c := &workerClient{
		cp:       cp,
		tenant:   envOr("WORKER_TENANT", "default"),
		id:       envOr("WORKER_ID", "worker-test"),
		node:     envOr("WORKER_NODE", "hx370"),
		ttl:      time.Duration(envInt("WORKER_LEASE_TTL_SECONDS", 30)) * time.Second,
		interval: interval,
		http:     &http.Client{Timeout: 2 * time.Second},
		log:      logger,
	}
	c.run(ctx)
	return ctx.Err()
}

func main() {
	cfg, _ := config.LoadFromEnv()
	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))

	cp := envOr("AGENTMESH_CONTROL_PLANE_URL", fmt.Sprintf("http://127.0.0.1:%d", cfg.HTTPPort))
	if cfg.ControlPlaneURL != "" {
		cp = cfg.ControlPlaneURL
	}
	id := envOr("WORKER_ID", "worker-"+uuid.NewString()[:8])
	c := &workerClient{
		cp:       cp,
		tenant:   envOr("WORKER_TENANT", "default"),
		id:       id,
		node:     envOr("WORKER_NODE", "hx370"),
		ttl:      time.Duration(envInt("WORKER_LEASE_TTL_SECONDS", 30)) * time.Second,
		interval: time.Duration(envInt("WORKER_POLL_SECONDS", 2)) * time.Second,
		http:     &http.Client{Timeout: 10 * time.Second},
		log:      log,
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	go func() { <-stop; cancel() }()

	// Retry enrollment briefly (control plane may still be starting).
	var err error
	for i := 0; i < 10; i++ {
		if err = c.enroll(ctx); err == nil {
			break
		}
		log.Warn("enroll failed; retrying", "error", err)
		time.Sleep(time.Second)
	}
	if err != nil {
		log.Error("could not enroll worker", "error", err)
		os.Exit(1)
	}
	c.run(ctx)
}
