package retrieval

import (
	"errors"
	"sort"
	"sync"
	"time"
)

// Store is the vector-retrieval backend contract. Implementations MUST apply the caller's scope as a
// server-side filter and never accept a caller-supplied filter that broadens access.
type Store interface {
	Upsert(doc *Document) error
	Query(scope Scope, q Query) ([]*Document, error)
	Delete(id string) error
}

// Index is an in-memory, scope-enforcing vector store. The ACL is the authority; vector similarity
// only ranks within the already-permitted set.
type Index struct {
	mu       sync.RWMutex
	docs     map[string]*Document
	embedder Embedder
	now      func() time.Time
}

func NewIndex(embedder Embedder) *Index {
	if embedder == nil {
		embedder = NewHashEmbedder(128)
	}
	return &Index{
		docs:     make(map[string]*Document),
		embedder: embedder,
		now:      func() time.Time { return time.Now().UTC() },
	}
}

// SetClock overrides the time source (tests).
func (ix *Index) SetClock(now func() time.Time) { ix.now = now }

var ErrUnauthorized = errors.New("retrieval: caller not permitted to read document")

// Upsert embeds and stores a document. The document's own scope metadata is authoritative.
func (ix *Index) Upsert(doc *Document) error {
	if doc == nil || doc.ID == "" || doc.TenantID == "" || doc.OwnerID == "" {
		return errors.New("retrieval: document requires id, tenantId, ownerId")
	}
	emb, err := ix.embedder.Embed(doc.Text)
	if err != nil {
		return err
	}
	doc.Embedding = emb
	if doc.CreatedAt.IsZero() {
		doc.CreatedAt = ix.now()
	}
	doc.UpdatedAt = ix.now()
	if doc.Visibility == "" {
		doc.Visibility = VisPrivate
	}
	if doc.Status == "" {
		doc.Status = ValUnvalidated
	}
	ix.mu.Lock()
	ix.docs[doc.ID] = doc
	ix.mu.Unlock()
	return nil
}

// Delete removes a document so it stops being returned immediately (deletion propagates to the index).
func (ix *Index) Delete(id string) error {
	ix.mu.Lock()
	defer ix.mu.Unlock()
	if _, ok := ix.docs[id]; !ok {
		return errors.New("retrieval: document not found")
	}
	delete(ix.docs, id)
	return nil
}

// Query returns the topK most similar documents the SCOPE is permitted to read. The scope filter is
// derived from the caller's verified identity and applied BEFORE ranking; results are revalidated
// before serving. Query carries no caller-overridable filter.
func (ix *Index) Query(scope Scope, q Query) ([]*Document, error) {
	qemb, err := ix.embedder.Embed(q.Text)
	if err != nil {
		return nil, err
	}
	topK := q.TopK
	if topK <= 0 {
		topK = 10
	}

	ix.mu.RLock()
	var candidates []float32score
	for _, d := range ix.docs {
		if !statusAllowed(d.Status, q.Statuses) {
			continue
		}
		if d.ExpiresAt != nil && ix.now().After(*d.ExpiresAt) {
			continue
		}
		// Server-side ACL: the ONLY gate. Caller cannot influence this.
		if !readableBy(scope, d) {
			continue
		}
		candidates = append(candidates, float32score{d, Cosine(qemb, d.Embedding)})
	}
	ix.mu.RUnlock()

	sort.Slice(candidates, func(i, j int) bool {
		if candidates[i].s == candidates[j].s {
			return candidates[i].d.ID < candidates[j].d.ID
		}
		return candidates[i].s > candidates[j].s
	})
	if len(candidates) > topK {
		candidates = candidates[:topK]
	}

	// Defense in depth: revalidate access on the final set before serving.
	out := make([]*Document, 0, len(candidates))
	for _, c := range candidates {
		if !readableBy(scope, c.d) {
			continue // re-check; never serve an unauthorized doc
		}
		cp := *c.d
		cp.Embedding = nil // never leak the index vector to callers
		out = append(out, &cp)
	}
	return out, nil
}

type float32score struct {
	d *Document
	s float32
}

func statusAllowed(s ValidationStatus, allowed []ValidationStatus) bool {
	if s == ValRetracted {
		// Retracted docs never surface unless explicitly queried for.
		for _, a := range allowed {
			if a == ValRetracted {
				return true
			}
		}
		return false
	}
	if len(allowed) == 0 {
		return true
	}
	for _, a := range allowed {
		if a == s {
			return true
		}
	}
	return false
}

// readableBy is the single ACL decision. Hard tenant isolation first, then visibility + sensitivity.
func readableBy(scope Scope, d *Document) bool {
	// Hard tenant isolation: never cross tenants.
	if scope.TenantID == "" || scope.TenantID != d.TenantID {
		return false
	}
	// Sensitivity gate: confidential/restricted require explicit clearance.
	if !scope.cleared(d.Sensitivity) {
		return false
	}
	switch d.Visibility {
	case VisPrivate:
		return scope.UserID == d.OwnerID
	case VisProject:
		return scope.UserID == d.OwnerID || (d.ProjectID != "" && scope.ProjectID == d.ProjectID)
	case VisTenant:
		return true
	case VisPublic:
		// Public is still tenant-gated; include only if the caller opts into public reads.
		return scope.AllowPublic || scope.UserID == d.OwnerID
	default:
		return false // unknown visibility -> default deny
	}
}
