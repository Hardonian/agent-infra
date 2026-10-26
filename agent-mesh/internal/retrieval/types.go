// Package retrieval implements the M2 scoped-retrieval index: vector similarity is only an INDEX,
// never the permission authority. Every query carries the caller's scope, which the index expands
// into a server-side filter applied BEFORE ranking and revalidated before serving — a caller can
// never broaden their own access. Backed by an in-memory cosine index (default) or Qdrant (with the
// same server-side scope filter pushed down).
package retrieval

import "time"

// Visibility controls who may read a document beyond the owning tenant/project.
type Visibility string

const (
	VisPrivate  Visibility = "private"  // owner only
	VisProject  Visibility = "project"  // owner + members of the document's project
	VisTenant   Visibility = "tenant"   // any principal in the document's tenant
	VisPublic   Visibility = "public"   // any authenticated principal (still tenant-gated at ingress)
)

// Sensitivity marks data class; high-sensitivity docs require an explicit disclosure policy.
type Sensitivity string

const (
	SensPublic    Sensitivity = "public"
	SensInternal  Sensitivity = "internal"
	SensConfidial Sensitivity = "confidential"
	SensRestricted Sensitivity = "restricted"
)

// ValidationStatus tracks whether a record is a trusted durable fact vs untrusted scratch.
type ValidationStatus string

const (
	ValUnvalidated ValidationStatus = "unvalidated"
	ValObserved    ValidationStatus = "observed"    // from real execution evidence
	ValPromoted    ValidationStatus = "promoted"    // authorized promotion to durable knowledge
	ValRetracted   ValidationStatus = "retracted"   // superseded / deleted; must stop retrieval
)

// Document is a scoped, embeddable knowledge record.
type Document struct {
	ID         string     `json:"id"`
	TenantID   string     `json:"tenantId"`
	ProjectID  string     `json:"projectId,omitempty"`
	OwnerID    string     `json:"ownerId"`
	Visibility Visibility `json:"visibility"`
	Sensitivity Sensitivity `json:"sensitivity"`
	Text       string     `json:"text"`
	Source     string     `json:"source,omitempty"`     // provenance reference
	Kind       string     `json:"kind,omitempty"`       // user_assertion | observed | inference | external
	Status     ValidationStatus `json:"status"`
	Embedding  []float32  `json:"-"`                    // index vector (not serialized to callers)
	CreatedAt  time.Time  `json:"createdAt"`
	UpdatedAt  time.Time  `json:"updatedAt"`
	ExpiresAt  *time.Time `json:"expiresAt,omitempty"`
	Supersedes string     `json:"supersedes,omitempty"` // prior doc this replaces
}

// Scope is the caller's verified identity (derived server-side from authentication — never accepted
// from the caller as a filter). It determines which documents the index will even consider.
type Scope struct {
	TenantID  string   `json:"tenantId"`
	ProjectID string   `json:"projectId,omitempty"`
	UserID    string   `json:"userId"`
	Roles     []string `json:"roles,omitempty"`
	// AllowPublic includes VisPublic documents from other projects/owners in the caller's tenant.
	AllowPublic bool `json:"allowPublic,omitempty"`
	// DataClasses the caller is cleared to read (sensitivity gate).
	ClearedClasses []Sensitivity `json:"clearedClasses,omitempty"`
}

func (s Scope) cleared(class Sensitivity) bool {
	for _, c := range s.ClearedClasses {
		if c == class || c == Sensitivity("*") {
			return true
		}
	}
	// public/internal are readable by default; confidential/restricted require explicit clearance.
	return class == SensPublic || class == SensInternal
}

// Query is a retrieval request. Scope is authoritative and NOT caller-overridable.
type Query struct {
	Text  string
	TopK  int
	// Statuses filters by validation status; empty = only non-retracted.
	Statuses []ValidationStatus
}
