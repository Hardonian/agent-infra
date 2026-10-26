package database

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/agentmesh/agentmesh/internal/identity"
	"github.com/agentmesh/agentmesh/internal/policy"
	"github.com/agentmesh/agentmesh/pkg/contracts"
	"github.com/agentmesh/agentmesh/pkg/passport"
)

// PostgresStore is a durable Store backed by PostgreSQL for the authoritative
// control-plane entities (agents, policies, credentials). It embeds *MemoryStore so the
// remaining ephemeral/derived entities (route outcomes, SLOs, canaries, telemetry, phase 3-5
// records) continue to use the in-process store — they are observability/derived state that does
// not need to survive a restart. Durable entities survive restart and are queryable in SQL.
//
// This closes the "state lost on restart" gap for exactly the records that Milestones 1 & 5
// require to be authoritative (agent registry, policy set, credential set), without a sprawling,
// error-prone port of every derived table.
type PostgresStore struct {
	*MemoryStore
	pool *pgxpool.Pool
}

// NewPostgresStore opens a pool, pings it, applies pending migrations, and returns a ready store.
// migrationsDir is the path to the *.up.sql files (e.g. "./migrations").
func NewPostgresStore(ctx context.Context, dsn, migrationsDir string) (*PostgresStore, error) {
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("parse DATABASE_URL: %w", err)
	}
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("connect postgres: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping postgres: %w", err)
	}
	ps := &PostgresStore{MemoryStore: NewMemoryStore(), pool: pool}
	if err := ps.Migrate(ctx, migrationsDir); err != nil {
		pool.Close()
		return nil, fmt.Errorf("migrate: %w", err)
	}
	return ps, nil
}

// Ping reports backend reachability (used by /readyz).
func (p *PostgresStore) Ping(ctx context.Context) error { return p.pool.Ping(ctx) }

// Close releases the connection pool.
func (p *PostgresStore) Close() { p.pool.Close() }

// Migrate applies unapplied *.up.sql files in lexical order, tracking applied versions in
// schema_migrations so it is idempotent. Each file runs in a transaction.
func (p *PostgresStore) Migrate(ctx context.Context, dir string) error {
	if _, err := p.pool.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`); err != nil {
		return fmt.Errorf("create schema_migrations: %w", err)
	}
	files, err := filepath.Glob(filepath.Join(dir, "*.up.sql"))
	if err != nil {
		return err
	}
	sort.Strings(files)
	for _, f := range files {
		version := filepath.Base(f)
		var applied bool
		if err := p.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version=$1)`, version).Scan(&applied); err != nil {
			return err
		}
		if applied {
			continue
		}
		sqlBytes, err := os.ReadFile(f)
		if err != nil {
			return err
		}
		tx, err := p.pool.Begin(ctx)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, string(sqlBytes)); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("apply %s: %w", version, err)
		}
		if _, err := tx.Exec(ctx, `INSERT INTO schema_migrations(version) VALUES($1)`, version); err != nil {
			_ = tx.Rollback(ctx)
			return err
		}
		if err := tx.Commit(ctx); err != nil {
			return err
		}
	}
	return nil
}

// ensureOrg inserts the tenant as an organization if absent (agents/policies/credentials FK to it).
func (p *PostgresStore) ensureOrg(ctx context.Context, tenantID string) error {
	_, err := p.pool.Exec(ctx, `INSERT INTO organizations(id, name) VALUES($1, $1) ON CONFLICT (id) DO NOTHING`, tenantID)
	return err
}

func jsonb(v any) string {
	if v == nil {
		return "{}"
	}
	b, err := json.Marshal(v)
	if err != nil || len(b) == 0 {
		return "{}"
	}
	return string(b)
}

// ---------------- Agents (durable) ----------------

func (p *PostgresStore) SaveAgent(ctx context.Context, agent *AgentRecord) error {
	if agent == nil || agent.ID == "" || agent.TenantID == "" {
		return errors.New("invalid agent record")
	}
	if err := p.ensureOrg(ctx, agent.TenantID); err != nil {
		return err
	}
	var passportJSON string
	if agent.Passport != nil {
		passportJSON = jsonb(agent.Passport)
	} else {
		passportJSON = "null"
	}
	_, err := p.pool.Exec(ctx, `
		INSERT INTO agents (id, tenant_id, name, status, contract_hash, contract_json, passport_json, endpoint_url, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, CAST($6 AS jsonb), CAST($7 AS jsonb), $8, COALESCE($9, now()), now())
		ON CONFLICT (tenant_id, id) DO UPDATE SET
			name = EXCLUDED.name, status = EXCLUDED.status, contract_hash = EXCLUDED.contract_hash,
			contract_json = EXCLUDED.contract_json, passport_json = EXCLUDED.passport_json,
			endpoint_url = EXCLUDED.endpoint_url, updated_at = now()`,
		agent.ID, agent.TenantID, agent.Name, agent.Status, agent.ContractHash,
		jsonb(agent.Contract), passportJSON, agent.EndpointURL, nullTime(agent.CreatedAt))
	return err
}

func (p *PostgresStore) GetAgent(ctx context.Context, tenantID, agentID string) (*AgentRecord, error) {
	row := p.pool.QueryRow(ctx, `
		SELECT id, tenant_id, name, status, contract_hash, contract_json, passport_json, endpoint_url, created_at, updated_at
		FROM agents WHERE tenant_id = $1 AND id = $2`, tenantID, agentID)
	return scanAgent(row)
}

func (p *PostgresStore) ListAgents(ctx context.Context, tenantID string) ([]*AgentRecord, error) {
	rows, err := p.pool.Query(ctx, `
		SELECT id, tenant_id, name, status, contract_hash, contract_json, passport_json, endpoint_url, created_at, updated_at
		FROM agents WHERE tenant_id = $1 ORDER BY created_at`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*AgentRecord
	for rows.Next() {
		a, err := scanAgent(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func (p *PostgresStore) DeleteAgent(ctx context.Context, tenantID, agentID string) error {
	tag, err := p.pool.Exec(ctx, `DELETE FROM agents WHERE tenant_id = $1 AND id = $2`, tenantID, agentID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

type rowScanner interface{ Scan(dest ...any) error }

func scanAgent(row rowScanner) (*AgentRecord, error) {
	var a AgentRecord
	var contractJSON, passportJSON []byte
	err := row.Scan(&a.ID, &a.TenantID, &a.Name, &a.Status, &a.ContractHash, &contractJSON, &passportJSON, &a.EndpointURL, &a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if len(contractJSON) > 0 {
		var c contracts.AgentContract
		if json.Unmarshal(contractJSON, &c) == nil {
			a.Contract = &c
		}
	}
	if len(passportJSON) > 0 && string(passportJSON) != "null" {
		var pp passport.AgentPassport
		if json.Unmarshal(passportJSON, &pp) == nil {
			a.Passport = &pp
		}
	}
	return &a, nil
}

// ---------------- Policies (durable) ----------------

func (p *PostgresStore) SavePolicy(ctx context.Context, pol *policy.Policy) error {
	if pol == nil || pol.ID == "" || pol.TenantID == "" {
		return errors.New("invalid policy")
	}
	if err := p.ensureOrg(ctx, pol.TenantID); err != nil {
		return err
	}
	_, err := p.pool.Exec(ctx, `
		INSERT INTO policies (id, tenant_id, name, version, rules_json, created_at)
		VALUES ($1, $2, $3, $4, CAST($5 AS jsonb), COALESCE($6, now()))
		ON CONFLICT (tenant_id, id) DO UPDATE SET
			name = EXCLUDED.name, version = EXCLUDED.version, rules_json = EXCLUDED.rules_json`,
		pol.ID, pol.TenantID, pol.Name, pol.Version, jsonb(pol.Rules), nullTime(pol.CreatedAt))
	return err
}

func (p *PostgresStore) GetPolicy(ctx context.Context, tenantID, policyID string) (*policy.Policy, error) {
	row := p.pool.QueryRow(ctx, `
		SELECT id, tenant_id, name, version, rules_json, created_at
		FROM policies WHERE tenant_id = $1 AND id = $2`, tenantID, policyID)
	var pol policy.Policy
	var rulesJSON []byte
	if err := row.Scan(&pol.ID, &pol.TenantID, &pol.Name, &pol.Version, &rulesJSON, &pol.CreatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if len(rulesJSON) > 0 {
		_ = json.Unmarshal(rulesJSON, &pol.Rules)
	}
	return &pol, nil
}

func (p *PostgresStore) ListPolicies(ctx context.Context, tenantID string) ([]*policy.Policy, error) {
	rows, err := p.pool.Query(ctx, `
		SELECT id, tenant_id, name, version, rules_json, created_at
		FROM policies WHERE tenant_id = $1 ORDER BY created_at`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*policy.Policy
	for rows.Next() {
		var pol policy.Policy
		var rulesJSON []byte
		if err := rows.Scan(&pol.ID, &pol.TenantID, &pol.Name, &pol.Version, &rulesJSON, &pol.CreatedAt); err != nil {
			return nil, err
		}
		if len(rulesJSON) > 0 {
			_ = json.Unmarshal(rulesJSON, &pol.Rules)
		}
		out = append(out, &pol)
	}
	return out, rows.Err()
}

// ---------------- Credentials (durable) ----------------

func (p *PostgresStore) SaveCredential(ctx context.Context, cred *identity.Credential) error {
	if cred == nil || cred.HashedKey == "" || cred.TenantID == "" {
		return errors.New("invalid credential")
	}
	if err := p.ensureOrg(ctx, cred.TenantID); err != nil {
		return err
	}
	_, err := p.pool.Exec(ctx, `
		INSERT INTO credentials (id, tenant_id, subject_id, key_prefix, hashed_key, scopes, revoked, expires_at, last_used_at, description, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11, now()))
		ON CONFLICT (hashed_key) DO UPDATE SET
			subject_id = EXCLUDED.subject_id, key_prefix = EXCLUDED.key_prefix, scopes = EXCLUDED.scopes,
			revoked = EXCLUDED.revoked, expires_at = EXCLUDED.expires_at, last_used_at = EXCLUDED.last_used_at,
			description = EXCLUDED.description`,
		cred.ID, cred.TenantID, cred.SubjectID, cred.KeyPrefix, cred.HashedKey, cred.Scopes,
		cred.Revoked, cred.ExpiresAt, cred.LastUsedAt, cred.Description, nullTime(cred.CreatedAt))
	return err
}

func (p *PostgresStore) GetCredentialByHash(ctx context.Context, hashedKey string) (*identity.Credential, error) {
	row := p.pool.QueryRow(ctx, `
		SELECT id, tenant_id, subject_id, key_prefix, hashed_key, scopes, revoked, expires_at, last_used_at, description, created_at
		FROM credentials WHERE hashed_key = $1`, hashedKey)
	return scanCredential(row)
}

func (p *PostgresStore) ListCredentials(ctx context.Context, tenantID string) ([]*identity.Credential, error) {
	rows, err := p.pool.Query(ctx, `
		SELECT id, tenant_id, subject_id, key_prefix, hashed_key, scopes, revoked, expires_at, last_used_at, description, created_at
		FROM credentials WHERE tenant_id = $1 ORDER BY created_at`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*identity.Credential
	for rows.Next() {
		c, err := scanCredential(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func scanCredential(row rowScanner) (*identity.Credential, error) {
	var c identity.Credential
	err := row.Scan(&c.ID, &c.TenantID, &c.SubjectID, &c.KeyPrefix, &c.HashedKey, &c.Scopes,
		&c.Revoked, &c.ExpiresAt, &c.LastUsedAt, &c.Description, &c.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &c, nil
}

// nullTime maps a zero time.Time to a nil *time.Time so COALESCE($, now()) applies.
func nullTime(t time.Time) *time.Time {
	if t.IsZero() {
		return nil
	}
	return &t
}

// compile-time assertion that *PostgresStore satisfies the full Store interface (durable overrides
// + all ephemeral methods promoted from the embedded *MemoryStore).
var _ Store = (*PostgresStore)(nil)
