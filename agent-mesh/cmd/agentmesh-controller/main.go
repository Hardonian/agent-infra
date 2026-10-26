package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/agentmesh/agentmesh/internal/approval"
	"github.com/agentmesh/agentmesh/internal/audit"
	"github.com/agentmesh/agentmesh/internal/canary"
	"github.com/agentmesh/agentmesh/internal/config"
	"github.com/agentmesh/agentmesh/internal/crypto"
	"github.com/agentmesh/agentmesh/internal/database"
	"github.com/agentmesh/agentmesh/internal/policy"
	"github.com/agentmesh/agentmesh/internal/routing"
	"github.com/agentmesh/agentmesh/internal/server"
	"github.com/agentmesh/agentmesh/internal/telemetry"
	"github.com/agentmesh/agentmesh/internal/worker"
)

func buildControllerServer(cfg *config.AppConfig) (*server.Server, func(), error) {
	// Durable store when DATABASE_URL is reachable; otherwise zero-dependency in-memory store.
	// In production a reachable DATABASE_URL is required (config enforces its presence) and a
	// failed connect is fatal — never silently fall back to losing state.
	migrationsDir := os.Getenv("AGENTMESH_MIGRATIONS_DIR")
	if migrationsDir == "" {
		migrationsDir = "./migrations"
	}
	var store database.Store
	var pgStore *database.PostgresStore
	closeFn := func() {}
	if cfg.DatabaseURL != "" {
		ps, err := database.NewPostgresStore(context.Background(), cfg.DatabaseURL, migrationsDir)
		if err != nil {
			if cfg.Environment == "production" {
				return nil, nil, fmt.Errorf("durable store required in production: %w", err)
			}
			fmt.Fprintf(os.Stderr, "WARNING: Postgres unavailable (%v); using in-memory store (state will NOT survive restart)\n", err)
			store = database.NewMemoryStore()
		} else {
			pgStore = ps
			store = ps
			closeFn = ps.Close
			fmt.Fprintf(os.Stderr, "durable Postgres store active (agents/policies/credentials persist across restart)\n")
		}
	} else {
		store = database.NewMemoryStore()
	}

	// Initial Corporate Safety Policy
	defaultPolicy := &policy.Policy{
		ID:       "pol_default_baseline",
		Version:  "v1.0.0",
		Name:     "Baseline AI Safety & Tool Policy",
		TenantID: "default",
		Rules: []policy.Rule{
			{
				Name:    "Allow Read Queries to Registered Tools",
				Effect:  policy.EffectAllow,
				Agents:  []string{"*"},
				Tools:   []string{"bigquery.read", "web.search", "doc.summarize"},
				Actions: []string{"read", "search", "list"},
			},
			{
				Name:    "Require Approval for Destructive or Financial Tools",
				Effect:  policy.EffectRequireApproval,
				Agents:  []string{"*"},
				Tools:   []string{"bigquery.delete", "payment.*", "email.send"},
				Actions: []string{"delete", "execute", "send"},
			},
			{
				Name:            "Deny Restricted Data Classification Access",
				Effect:          policy.EffectDeny,
				Agents:          []string{"*"},
				DenyDataClasses: []string{policy.DataClassRestricted},
			},
		},
		CreatedAt: time.Now().UTC(),
	}
	_ = store.SavePolicy(context.Background(), defaultPolicy)

	polEngine := policy.NewEngine([]*policy.Policy{defaultPolicy})
	routerEng := routing.NewRouter(polEngine)
	collector := telemetry.NewCollector()
	canaryMgr := canary.NewManager()
	approvalSvc := approval.NewService()
	auditLogger := audit.NewLogger()

	// Cryptographic Signing Key
	kp, err := crypto.GenerateKeyPair(cfg.SigningKeyID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to generate ed25519 key pair: %w", err)
	}

	srv := server.NewServer(
		store,
		polEngine,
		routerEng,
		collector,
		canaryMgr,
		approvalSvc,
		auditLogger,
		kp,
	)
	if pgStore != nil {
		srv.SetReadyCheck(func(ctx context.Context) error { return pgStore.Ping(ctx) })
		// Durable fenced-worker leases share the same Postgres pool.
		srv.SetWorkerStore(worker.NewPostgresStore(pgStore.Pool()))
	}
	return srv, closeFn, nil
}

func main() {
	cfg, err := config.LoadFromEnv()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Config error: %v\n", err)
		os.Exit(1)
	}

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))

	logger.Info("Starting AgentMesh Control Plane Controller",
		"httpPort", cfg.HTTPPort,
		"env", cfg.Environment,
	)

	srv, closeStore, err := buildControllerServer(cfg)
	if err != nil {
		logger.Error("Failed to build controller server", "error", err)
		os.Exit(1)
	}
	defer closeStore()

	httpServer := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.HTTPPort),
		Handler:      srv.Router(),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("Control plane server failed", "error", err)
			os.Exit(1)
		}
	}()

	logger.Info("AgentMesh Control Plane online", "url", fmt.Sprintf("http://127.0.0.1:%d", cfg.HTTPPort))
	<-stop
	logger.Info("Stopping AgentMesh Control Plane gracefully...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = httpServer.Shutdown(shutdownCtx)
	logger.Info("AgentMesh Control Plane stopped.")
}
