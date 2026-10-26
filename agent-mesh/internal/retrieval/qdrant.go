package retrieval

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// QdrantStore is a Qdrant-backed Store. The caller's scope is compiled into a server-side Qdrant
// filter (hard tenant isolation + status) so it cannot be bypassed at query time; the fine-grained
// ACL (visibility/owner/sensitivity) is revalidated locally before serving (defense in depth). There
// is no API for a caller to inject or broaden the filter.
type QdrantStore struct {
	baseURL    string
	collection string
	embedder   Embedder
	client     *http.Client
}

func NewQdrantStore(baseURL, collection string, embedder Embedder) *QdrantStore {
	if embedder == nil {
		embedder = NewHashEmbedder(128)
	}
	return &QdrantStore{
		baseURL:    baseURL,
		collection: collection,
		embedder:   embedder,
		client:     &http.Client{Timeout: 10 * time.Second},
	}
}

type qdrantPoint struct {
	ID      string                 `json:"id"`
	Payload map[string]interface{} `json:"payload"`
	Vector  []float32              `json:"vector,omitempty"`
}

// qdrantFilter is the server-side filter; the scope is ALWAYS injected here (never caller-supplied).
type qdrantFilter struct {
	Must     []map[string]interface{} `json:"must,omitempty"`
	MustNot  []map[string]interface{} `json:"must_not,omitempty"`
}

func match(key, value string) map[string]interface{} {
	return map[string]interface{}{"key": key, "match": map[string]interface{}{"value": value}}
}

// buildFilter compiles the caller's scope into the Qdrant server-side filter. This is the ONLY place
// the scope becomes a filter; Query takes no caller filter parameter.
func buildFilter(scope Scope, statuses []ValidationStatus) qdrantFilter {
	f := qdrantFilter{
		Must: []map[string]interface{}{
			match("tenant_id", scope.TenantID), // hard tenant isolation, server-side
		},
		MustNot: []map[string]interface{}{
			match("status", string(ValRetracted)), // retracted docs never returned by default
		},
	}
	// Explicitly retracted-only queries flip the must_not.
	for _, s := range statuses {
		if s == ValRetracted {
			f.MustNot = nil
		}
	}
	return f
}

func (q *QdrantStore) Upsert(doc *Document) error {
	emb, err := q.embedder.Embed(doc.Text)
	if err != nil {
		return err
	}
	doc.Embedding = emb
	if doc.Status == "" {
		doc.Status = ValUnvalidated
	}
	if doc.Visibility == "" {
		doc.Visibility = VisPrivate
	}
	payload := map[string]interface{}{
		"tenant_id":  doc.TenantID,
		"project_id": doc.ProjectID,
		"owner_id":   doc.OwnerID,
		"visibility": string(doc.Visibility),
		"sensitivity": string(doc.Sensitivity),
		"status":     string(doc.Status),
		"text":       doc.Text,
		"source":     doc.Source,
		"kind":       doc.Kind,
	}
	body, _ := json.Marshal(map[string]interface{}{
		"points": []map[string]interface{}{
			{"id": doc.ID, "payload": payload, "vector": emb},
		},
	})
	url := fmt.Sprintf("%s/collections/%s/points?wait=true", q.baseURL, q.collection)
	req, _ := http.NewRequest(http.MethodPut, url, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := q.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("qdrant upsert %d: %s", resp.StatusCode, string(b))
	}
	return nil
}

type qdrantSearchResp struct {
	Result []struct {
		ID      string                 `json:"id"`
		Payload map[string]interface{} `json:"payload"`
		Score   float32                `json:"score"`
	} `json:"result"`
}

func (q *QdrantStore) Query(scope Scope, query Query) ([]*Document, error) {
	qemb, err := q.embedder.Embed(query.Text)
	if err != nil {
		return nil, err
	}
	topK := query.TopK
	if topK <= 0 {
		topK = 10
	}
	search := map[string]interface{}{
		"vector":       qemb,
		"limit":        topK,
		"filter":       buildFilter(scope, query.Statuses), // server-side scope filter
		"with_payload": true,
	}
	body, _ := json.Marshal(search)
	url := fmt.Sprintf("%s/collections/%s/points/search", q.baseURL, q.collection)
	req, _ := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := q.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("qdrant search %d: %s", resp.StatusCode, string(b))
	}
	var sr qdrantSearchResp
	if err := json.Unmarshal(b, &sr); err != nil {
		return nil, err
	}

	// Defense in depth: revalidate the full ACL locally before serving (never trust the DB filter
	// alone for fine-grained visibility/owner/sensitivity).
	out := make([]*Document, 0, len(sr.Result))
	for _, r := range sr.Result {
		d := docFromPayload(r.ID, r.Payload)
		if !statusAllowed(d.Status, query.Statuses) {
			continue
		}
		if !readableBy(scope, d) {
			continue
		}
		d.Embedding = nil
		out = append(out, d)
	}
	return out, nil
}

func (q *QdrantStore) Delete(id string) error {
	body, _ := json.Marshal(map[string]interface{}{"points": []string{id}})
	url := fmt.Sprintf("%s/collections/%s/points/delete?wait=true", q.baseURL, q.collection)
	req, _ := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := q.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("qdrant delete %d: %s", resp.StatusCode, string(b))
	}
	return nil
}

func docFromPayload(id string, p map[string]interface{}) *Document {
	str := func(k string) string {
		if v, ok := p[k].(string); ok {
			return v
		}
		return ""
	}
	return &Document{
		ID:          id,
		TenantID:    str("tenant_id"),
		ProjectID:   str("project_id"),
		OwnerID:     str("owner_id"),
		Visibility:  Visibility(str("visibility")),
		Sensitivity: Sensitivity(str("sensitivity")),
		Status:      ValidationStatus(str("status")),
		Text:        str("text"),
		Source:      str("source"),
		Kind:        str("kind"),
	}
}
