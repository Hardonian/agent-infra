package audit

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PostgresStore persists audit entries to the audit_events table (hash-chain columns included), so
// the tamper-evident trail survives restart.
type PostgresStore struct {
	pool *pgxpool.Pool
}

func NewPostgresStore(pool *pgxpool.Pool) *PostgresStore { return &PostgresStore{pool: pool} }

var _ Store = (*PostgresStore)(nil)

func (p *PostgresStore) Append(ctx context.Context, e *Entry) error {
	if e == nil {
		return errors.New("nil audit entry")
	}
	// audit_events.tenant_id FKs to organizations.
	if _, err := p.pool.Exec(ctx, `INSERT INTO organizations(id,name) VALUES($1,$1) ON CONFLICT (id) DO NOTHING`, e.TenantID); err != nil {
		return err
	}
	var details any
	if e.Details != nil {
		b, err := json.Marshal(e.Details)
		if err == nil {
			details = string(b)
		}
	}
	_, err := p.pool.Exec(ctx, `
		INSERT INTO audit_events (id, tenant_id, type, actor, subject, details_json, prev_hash, hash, timestamp)
		VALUES ($1,$2,$3,$4,$5,CAST($6 AS jsonb),$7,$8,$9)`,
		e.ID, e.TenantID, string(e.Type), e.Actor, e.Subject, details, e.PrevHash, e.Hash, e.Timestamp)
	return err
}

func (p *PostgresStore) ListEntries(ctx context.Context, tenantID string, limit int) ([]*Entry, error) {
	if limit <= 0 {
		limit = 100
	}
	rows, err := p.pool.Query(ctx, `
		SELECT id, tenant_id, type, actor, subject, details_json, prev_hash, hash, timestamp
		FROM (
			SELECT id, tenant_id, type, actor, subject, details_json, prev_hash, hash, timestamp
			FROM audit_events WHERE tenant_id=$1 ORDER BY timestamp DESC LIMIT $2
		) t ORDER BY timestamp ASC`, tenantID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanEntries(rows)
}

func (p *PostgresStore) AllEntries(ctx context.Context, tenantID string) ([]*Entry, error) {
	rows, err := p.pool.Query(ctx, `
		SELECT id, tenant_id, type, actor, subject, details_json, prev_hash, hash, timestamp
		FROM audit_events WHERE tenant_id=$1 ORDER BY timestamp ASC`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanEntries(rows)
}

func (p *PostgresStore) LastHash(ctx context.Context, tenantID string) (string, error) {
	var h string
	err := p.pool.QueryRow(ctx, `
		SELECT hash FROM audit_events WHERE tenant_id=$1 ORDER BY timestamp DESC LIMIT 1`, tenantID).Scan(&h)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil // no prior chain
	}
	return h, err
}

type entryRow interface{ Scan(dest ...any) error }

func scanEntries(rows pgx.Rows) ([]*Entry, error) {
	var out []*Entry
	for rows.Next() {
		var e Entry
		var details []byte
		var typ string
		if err := rows.Scan(&e.ID, &e.TenantID, &typ, &e.Actor, &e.Subject, &details, &e.PrevHash, &e.Hash, &e.Timestamp); err != nil {
			return nil, err
		}
		e.Type = EventType(typ)
		if len(details) > 0 {
			var v any
			if json.Unmarshal(details, &v) == nil {
				e.Details = v
			}
		}
		out = append(out, &e)
	}
	return out, rows.Err()
}
