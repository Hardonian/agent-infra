package audit

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log/slog"
	"sync"
	"time"
)

// Sink is the audit interface consumed by the control plane. *Logger (in-memory) and *DurableLogger
// (Postgres-backed) both satisfy it.
type Sink interface {
	Log(tenantID string, eventType EventType, actor, subject string, details any) *Entry
	List(tenantID string, limit int) []*Entry
	VerifyChain(tenantID string) (bool, error)
}

// Store is the durable audit backend. Append persists an entry; LastHash returns the tenant's most
// recent chain hash (so a fresh process continues the chain across restart instead of restarting it).
type Store interface {
	Append(ctx context.Context, e *Entry) error
	ListEntries(ctx context.Context, tenantID string, limit int) ([]*Entry, error)
	AllEntries(ctx context.Context, tenantID string) ([]*Entry, error)
	LastHash(ctx context.Context, tenantID string) (string, error)
}

var _ Sink = (*Logger)(nil)
var _ Sink = (*DurableLogger)(nil)

// DurableLogger persists the tamper-evident audit trail to a Store while reusing the in-memory
// Logger for chain computation. On first use of a tenant it seeds the chain's last hash from the
// store, so the hash chain is continuous across process restarts (durability).
type DurableLogger struct {
	inner  *Logger
	store  Store
	loaded map[string]bool
	mu     sync.Mutex
	log    *slog.Logger
}

func NewDurableLogger(store Store) *DurableLogger {
	return &DurableLogger{
		inner:  NewLogger(),
		store:  store,
		loaded: make(map[string]bool),
		log:    slog.Default(),
	}
}

// SetLogger overrides the logger used to surface durable-append failures.
func (d *DurableLogger) SetLogger(l *slog.Logger) { d.log = l }

func (d *DurableLogger) ensureLoaded(tenantID string) {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.loaded[tenantID] {
		return
	}
	if h, err := d.store.LastHash(context.Background(), tenantID); err == nil && h != "" {
		d.inner.lastHash[tenantID] = h // continue the existing chain
	}
	d.loaded[tenantID] = true
}

func (d *DurableLogger) Log(tenantID string, eventType EventType, actor, subject string, details any) *Entry {
	d.ensureLoaded(tenantID)
	entry := d.inner.Log(tenantID, eventType, actor, subject, details)
	// Synchronous durable append: an audit record must not be lost. On failure, keep the in-memory
	// entry and surface the error loudly (never silently drop audit evidence).
	if err := d.store.Append(context.Background(), entry); err != nil {
		d.log.Error("durable audit append failed", "tenant", tenantID, "entry", entry.ID, "error", err)
	}
	return entry
}

func (d *DurableLogger) List(tenantID string, limit int) []*Entry {
	if entries, err := d.store.ListEntries(context.Background(), tenantID, limit); err == nil && entries != nil {
		return entries
	}
	return d.inner.List(tenantID, limit)
}

func (d *DurableLogger) VerifyChain(tenantID string) (bool, error) {
	entries, err := d.store.AllEntries(context.Background(), tenantID)
	if err != nil || entries == nil {
		return d.inner.VerifyChain(tenantID)
	}
	return verifyChain(entries)
}

// verifyChain recomputes a hash chain over entries (chronological) and reports tampering/breaks.
func verifyChain(entries []*Entry) (bool, error) {
	expectedPrev := "0000000000000000000000000000000000000000000000000000000000000000"
	for idx, entry := range entries {
		if entry.PrevHash != expectedPrev {
			return false, fmt.Errorf("hash chain broken at entry %d (%s): expected prevHash %s, got %s",
				idx, entry.ID, expectedPrev, entry.PrevHash)
		}
		raw := fmt.Sprintf("%s|%s|%s|%s|%d", entry.PrevHash, entry.Type, entry.Actor, entry.Subject, entry.Timestamp.UnixNano())
		h := sha256.Sum256([]byte(raw))
		computed := hex.EncodeToString(h[:])
		if computed != entry.Hash {
			return false, fmt.Errorf("tampering detected at entry %d (%s): computed %s != stored %s",
				idx, entry.ID, computed, entry.Hash)
		}
		expectedPrev = entry.Hash
	}
	return true, nil
}

// nowUTC is a tiny helper for the Postgres store.
func nowUTC() time.Time { return time.Now().UTC() }
