package retrieval

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func seed(t *testing.T, ix *Index) {
	t.Helper()
	must := func(d *Document) {
		if err := ix.Upsert(d); err != nil {
			t.Fatalf("upsert %s: %v", d.ID, err)
		}
	}
	must(&Document{ID: "a-priv", TenantID: "tenantA", OwnerID: "alice", Visibility: VisPrivate,
		Sensitivity: SensPublic, Text: "alice private deployment runbook kubernetes"})
	must(&Document{ID: "a-proj", TenantID: "tenantA", ProjectID: "proj1", OwnerID: "alice", Visibility: VisProject,
		Sensitivity: SensPublic, Text: "proj1 shared architecture notes kubernetes"})
	must(&Document{ID: "a-conf", TenantID: "tenantA", OwnerID: "alice", Visibility: VisTenant,
		Sensitivity: SensConfidial, Text: "confidential customer billing kubernetes"})
	must(&Document{ID: "b-priv", TenantID: "tenantB", OwnerID: "bob", Visibility: VisTenant,
		Sensitivity: SensPublic, Text: "tenantB secret kubernetes deployment"})
}

func TestQuery_CrossTenantIsolation(t *testing.T) {
	ix := NewIndex(NewHashEmbedder(64))
	seed(t, ix)
	// tenantA scope querying "kubernetes deployment" must never see tenantB's doc.
	res, err := ix.Query(Scope{TenantID: "tenantA", UserID: "alice", AllowPublic: true,
		ClearedClasses: []Sensitivity{"*"}}, Query{Text: "kubernetes deployment", TopK: 10})
	if err != nil {
		t.Fatal(err)
	}
	for _, d := range res {
		if d.TenantID != "tenantA" {
			t.Fatalf("cross-tenant leak: returned %s from %s", d.ID, d.TenantID)
		}
	}
}

func TestQuery_PrivateDocOnlyOwner(t *testing.T) {
	ix := NewIndex(NewHashEmbedder(64))
	seed(t, ix)
	// Another user in tenantA must NOT see alice's private doc.
	res, _ := ix.Query(Scope{TenantID: "tenantA", UserID: "mallory", ClearedClasses: []Sensitivity{"*"}},
		Query{Text: "private deployment runbook", TopK: 10})
	for _, d := range res {
		if d.ID == "a-priv" {
			t.Fatalf("private doc leaked to non-owner")
		}
	}
	// Owner DOES see it.
	res, _ = ix.Query(Scope{TenantID: "tenantA", UserID: "alice", ClearedClasses: []Sensitivity{"*"}},
		Query{Text: "private deployment runbook", TopK: 10})
	found := false
	for _, d := range res {
		if d.ID == "a-priv" {
			found = true
		}
	}
	if !found {
		t.Fatalf("owner could not read own private doc")
	}
}

func TestQuery_SensitivityGate(t *testing.T) {
	ix := NewIndex(NewHashEmbedder(64))
	seed(t, ix)
	// tenantA member WITHOUT confidential clearance must not see the confidential doc.
	res, _ := ix.Query(Scope{TenantID: "tenantA", UserID: "bob", ClearedClasses: []Sensitivity{SensPublic}},
		Query{Text: "confidential customer billing", TopK: 10})
	for _, d := range res {
		if d.ID == "a-conf" {
			t.Fatalf("confidential doc returned without clearance")
		}
	}
	// WITH clearance, it is returned.
	res, _ = ix.Query(Scope{TenantID: "tenantA", UserID: "bob", ClearedClasses: []Sensitivity{SensConfidial}},
		Query{Text: "confidential customer billing", TopK: 10})
	found := false
	for _, d := range res {
		if d.ID == "a-conf" {
			found = true
		}
	}
	if !found {
		t.Fatalf("cleared caller could not read confidential doc")
	}
}

func TestQuery_DeletionStopsRetrieval(t *testing.T) {
	ix := NewIndex(NewHashEmbedder(64))
	seed(t, ix)
	before, _ := ix.Query(Scope{TenantID: "tenantA", UserID: "alice", ClearedClasses: []Sensitivity{"*"}},
		Query{Text: "shared architecture notes", TopK: 10})
	has := func(id string) bool { for _, d := range before { if d.ID == id { return true } }; return false }
	if !has("a-proj") {
		t.Fatalf("setup: a-proj should be visible before delete")
	}
	if err := ix.Delete("a-proj"); err != nil {
		t.Fatal(err)
	}
	after, _ := ix.Query(Scope{TenantID: "tenantA", UserID: "alice", ClearedClasses: []Sensitivity{"*"}},
		Query{Text: "shared architecture notes", TopK: 10})
	for _, d := range after {
		if d.ID == "a-proj" {
			t.Fatalf("deleted doc still returned by retrieval")
		}
	}
}

func TestQuery_RetractionNeverSurfaces(t *testing.T) {
	ix := NewIndex(NewHashEmbedder(64))
	_ = ix.Upsert(&Document{ID: "r1", TenantID: "tenantA", OwnerID: "alice", Visibility: VisTenant,
		Sensitivity: SensPublic, Status: ValRetracted, Text: "poisoned retracted guidance kubernetes"})
	res, _ := ix.Query(Scope{TenantID: "tenantA", UserID: "alice", ClearedClasses: []Sensitivity{"*"}},
		Query{Text: "poisoned guidance kubernetes", TopK: 10})
	for _, d := range res {
		if d.ID == "r1" {
			t.Fatalf("retracted doc surfaced")
		}
	}
}

func TestQuery_EmbeddingNotLeaked(t *testing.T) {
	ix := NewIndex(NewHashEmbedder(64))
	seed(t, ix)
	res, _ := ix.Query(Scope{TenantID: "tenantA", UserID: "alice", ClearedClasses: []Sensitivity{"*"}},
		Query{Text: "kubernetes", TopK: 10})
	for _, d := range res {
		if d.Embedding != nil {
			t.Fatalf("embedding vector leaked to caller for %s", d.ID)
		}
	}
}

func TestQuery_TopKAndRanking(t *testing.T) {
	ix := NewIndex(NewHashEmbedder(64))
	seed(t, ix)
	res, _ := ix.Query(Scope{TenantID: "tenantA", UserID: "alice", ClearedClasses: []Sensitivity{"*"}},
		Query{Text: "kubernetes deployment runbook", TopK: 2})
	if len(res) != 2 {
		t.Fatalf("expected topK=2, got %d", len(res))
	}
}

// TestQdrant_ServerSideFilterAndRevalidation proves (1) the scope is pushed into a server-side Qdrant
// filter, and (2) even if the DB misbehaves and returns another tenant's doc, local revalidation
// drops it before serving.
func TestQdrant_ServerSideFilterAndRevalidation(t *testing.T) {
	var captured map[string]interface{}
	ds := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost && r.URL.Query().Get("wait") == "" {
			_ = json.NewDecoder(r.Body).Decode(&captured)
		}
		// Simulate a compromised/misbehaving DB returning BOTH a valid tenantA doc AND a foreign
		// tenantB doc; local revalidation must drop the foreign one.
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"result": []map[string]interface{}{
			{"id": "ok", "score": 0.9, "payload": map[string]interface{}{
				"tenant_id": "tenantA", "owner_id": "alice", "visibility": "tenant",
				"sensitivity": "public", "status": "promoted", "text": "tenantA fact"}},
			{"id": "leak", "score": 0.99, "payload": map[string]interface{}{
				"tenant_id": "tenantB", "owner_id": "bob", "visibility": "tenant",
				"sensitivity": "public", "status": "promoted", "text": "tenantB secret"}},
		}})
	}))
	defer ds.Close()

	qs := NewQdrantStore(ds.URL, "memory", NewHashEmbedder(64))
	res, err := qs.Query(Scope{TenantID: "tenantA", UserID: "alice", ClearedClasses: []Sensitivity{"*"}},
		Query{Text: "fact", TopK: 10})
	if err != nil {
		t.Fatal(err)
	}
	// (1) server-side filter enforced tenant scope
	f, _ := captured["filter"].(map[string]interface{})
	must, _ := f["must"].([]interface{})
	foundTenant := false
	for _, m := range must {
		mm, _ := m.(map[string]interface{})
		key, _ := mm["key"].(string)
		if key == "tenant_id" {
			if matchObj, ok := mm["match"].(map[string]interface{}); ok && matchObj["value"] == "tenantA" {
				foundTenant = true
			}
		}
	}
	if !foundTenant {
		t.Fatalf("Qdrant search filter did not enforce tenant_id server-side: %v", f)
	}
	// (2) local revalidation dropped the foreign doc
	for _, d := range res {
		if d.ID == "leak" || d.TenantID != "tenantA" {
			t.Fatalf("foreign doc served despite server-side filter + revalidation")
		}
	}
	if len(res) != 1 || res[0].ID != "ok" {
		t.Fatalf("expected only the authorized tenantA doc, got %d", len(res))
	}
}

func TestExpiredDocNotReturned(t *testing.T) {
	ix := NewIndex(NewHashEmbedder(64))
	past := time.Now().UTC().Add(-time.Hour)
	_ = ix.Upsert(&Document{ID: "exp", TenantID: "tenantA", OwnerID: "alice", Visibility: VisTenant,
		Sensitivity: SensPublic, Text: "expired ephemeral note", ExpiresAt: &past})
	res, _ := ix.Query(Scope{TenantID: "tenantA", UserID: "alice", ClearedClasses: []Sensitivity{"*"}},
		Query{Text: "expired ephemeral note", TopK: 10})
	for _, d := range res {
		if d.ID == "exp" {
			t.Fatalf("expired doc returned")
		}
	}
}
