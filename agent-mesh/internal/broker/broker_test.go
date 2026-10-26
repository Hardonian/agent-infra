package broker

import (
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/agentmesh/agentmesh/internal/crypto"
)

func newTestBroker(t *testing.T, opts ...Option) *Broker {
	t.Helper()
	kp, err := crypto.GenerateKeyPair("broker-test")
	if err != nil {
		t.Fatalf("keypair: %v", err)
	}
	b, err := New(kp, opts...)
	if err != nil {
		t.Fatalf("broker: %v", err)
	}
	return b
}

func testGrant(id string) GrantPayload {
	return GrantPayload{
		GrantID:      id,
		RunID:        "run-1",
		Principal:    "agent-1",
		Integration:  "github",
		Operations:   []string{"repo.read"},
		Destinations: []string{"api.github.com"},
	}
}

func TestMintAuthorize_Allow(t *testing.T) {
	b := newTestBroker(t)
	token, _, err := b.Mint(testGrant("g1"), time.Minute)
	if err != nil {
		t.Fatalf("mint: %v", err)
	}
	dec, err := b.Authorize(token, "repo.read", "https://api.github.com/repos/x")
	if err != nil || !dec.Allowed {
		t.Fatalf("expected allow, got allowed=%v reason=%q err=%v", dec.Allowed, dec.Reason, err)
	}
}

func TestAuthorize_DeniesDisallowedOperation(t *testing.T) {
	b := newTestBroker(t)
	token, _, _ := b.Mint(testGrant("g2"), time.Minute)
	// payment.execute is NOT in grant scope -> default deny.
	dec, err := b.Authorize(token, "payment.execute", "https://api.github.com/x")
	if dec.Allowed || !errors.Is(err, ErrOpNotAllowed) {
		t.Fatalf("expected ErrOpNotAllowed, got allowed=%v err=%v", dec.Allowed, err)
	}
}

func TestAuthorize_DeniesDisallowedDestination(t *testing.T) {
	b := newTestBroker(t, WithLookupIP(func(h string) ([]net.IP, error) {
		return []net.IP{net.ParseIP("203.0.113.5")}, nil // public, resolvable
	}))
	token, _, _ := b.Mint(testGrant("g3"), time.Minute)
	// evil.com is public but NOT in grant destinations -> deny.
	dec, err := b.Authorize(token, "repo.read", "https://evil.com/steal")
	if dec.Allowed || !errors.Is(err, ErrDestNotAllowed) {
		t.Fatalf("expected ErrDestNotAllowed, got allowed=%v err=%v", dec.Allowed, err)
	}
}

func TestAuthorize_DeniesExpiredGrant(t *testing.T) {
	b := newTestBroker(t)
	// Mint with a tiny TTL then let it expire.
	token, _, _ := b.Mint(testGrant("g4"), time.Nanosecond)
	time.Sleep(5 * time.Millisecond)
	dec, err := b.Authorize(token, "repo.read", "https://api.github.com/x")
	if dec.Allowed {
		t.Fatalf("expected expired grant denied, got allowed")
	}
	if err == nil {
		t.Fatalf("expected verification error for expired grant")
	}
}

func TestAuthorize_DeniesRevokedGrant(t *testing.T) {
	b := newTestBroker(t)
	token, _, _ := b.Mint(testGrant("g5"), time.Minute)
	b.Revoke("g5")
	dec, err := b.Authorize(token, "repo.read", "https://api.github.com/x")
	if dec.Allowed || !errors.Is(err, ErrGrantRevoked) {
		t.Fatalf("expected ErrGrantRevoked, got allowed=%v err=%v", dec.Allowed, err)
	}
}

func TestAuthorize_SSRFBlockedDestinations(t *testing.T) {
	b := newTestBroker(t) // real resolver; we test IP literals + localhost (no DNS needed)
	// Grant wildcard destination so only the egress guard can deny (isolates the guard).
	p := testGrant("g6")
	p.Destinations = []string{"*"}
	token, _, _ := b.Mint(p, time.Minute)

	blocked := []string{
		"http://169.254.169.254/latest/meta-data/", // cloud metadata
		"http://127.0.0.1:8080/",                   // loopback
		"http://localhost:8080/",
		"http://10.0.0.5/internal",                 // RFC1918
		"http://192.168.1.1/",
		"http://[::1]:8080/",
	}
	for _, dest := range blocked {
		dec, err := b.Authorize(token, "repo.read", dest)
		if dec.Allowed || !errors.Is(err, ErrDestBlocked) {
			t.Errorf("expected SSRF block for %s, got allowed=%v err=%v", dest, dec.Allowed, err)
		}
	}
}

func TestAuthorize_DNSRebindingBlocked(t *testing.T) {
	// Hostname is public-looking but resolves to a private IP -> must be blocked (anti rebinding).
	b := newTestBroker(t, WithLookupIP(func(h string) ([]net.IP, error) {
		return []net.IP{net.ParseIP("10.0.0.9")}, nil
	}))
	p := testGrant("g7")
	p.Destinations = []string{"evil.example.com"}
	token, _, _ := b.Mint(p, time.Minute)
	dec, err := b.Authorize(token, "repo.read", "https://evil.example.com/x")
	if dec.Allowed || !errors.Is(err, ErrDestBlocked) {
		t.Fatalf("expected DNS-rebinding block, got allowed=%v err=%v", dec.Allowed, err)
	}
}

func TestGrantToken_DoesNotContainPrivilegedCredential(t *testing.T) {
	b := newTestBroker(t)
	token, _, _ := b.Mint(testGrant("g8"), time.Minute)
	if strings.Contains(token, "ghp_") || strings.Contains(token, "SECRET") {
		t.Fatalf("grant token leaked credential material")
	}
}

func TestAuthProxy_ForwardsAuthorizedWithHeldCredential(t *testing.T) {
	// Downstream records whether the privileged credential arrived.
	var gotAuth string
	ds := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		w.WriteHeader(200)
		_, _ = w.Write([]byte("ok"))
	}))
	defer ds.Close()

	p := newSSRFBypassBroker(t)
	proxy := NewAuthProxy(p)
	proxy.HoldCredential("github", "PRIVILEGED-SECRET", "")

	u, _ := url.Parse(ds.URL)
	host := u.Hostname()
	gp := testGrant("g9")
	gp.Destinations = []string{host}
	token, _, _ := p.Mint(gp, time.Minute)

	res, err := proxy.Forward(token, "repo.read", ds.URL, "GET", nil, nil)
	if err != nil || !res.Forwarded || res.StatusCode != 200 {
		t.Fatalf("expected forward 200, got %+v err=%v", res, err)
	}
	if gotAuth != "Bearer PRIVILEGED-SECRET" {
		t.Fatalf("downstream did not receive held credential, got Authorization=%q", gotAuth)
	}
}

func TestAuthProxy_BlocksUnauthorized_NoDownstreamContact(t *testing.T) {
	called := false
	ds := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
	}))
	defer ds.Close()

	p := newTestBroker(t)
	proxy := NewAuthProxy(p)
	proxy.HoldCredential("github", "SECRET", "")

	token, _, _ := p.Mint(testGrant("g10"), time.Minute)
	// op not in scope -> denied, downstream never contacted.
	res, _ := proxy.Forward(token, "payment.execute", ds.URL, "GET", nil, nil)
	if res.Forwarded || res.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 not-forwarded, got %+v", res)
	}
	if called {
		t.Fatalf("downstream was contacted on a denied operation")
	}
}

func TestAuthProxy_BlocksSSFR_NoCredentialLeak(t *testing.T) {
	p := newTestBroker(t)
	proxy := NewAuthProxy(p)
	proxy.HoldCredential("github", "SECRET", "")
	gp := testGrant("g11")
	gp.Destinations = []string{"*"}
	token, _, _ := p.Mint(gp, time.Minute)
	// metadata endpoint -> SSRF block; no credential should leave.
	res, _ := proxy.Forward(token, "repo.read", "http://169.254.169.254/latest/meta-data/", "GET", nil, nil)
	if res.Forwarded || res.StatusCode != http.StatusForbidden {
		t.Fatalf("expected SSRF block at proxy, got %+v", res)
	}
}

func TestAuthorize_PolicyCheckerDenies(t *testing.T) {
	b := newTestBroker(t, WithPolicy(func(p GrantPayload, op, dest string) error {
		return errors.New("org policy: repo writes require approval")
	}))
	token, _, _ := b.Mint(testGrant("g12"), time.Minute)
	dec, _ := b.Authorize(token, "repo.read", "https://api.github.com/x")
	if dec.Allowed {
		t.Fatalf("expected policy denial, got allowed")
	}
}

// newSSRFBypassBroker returns a broker whose egress guard permits the loopback test downstream. It
// is used ONLY by the proxy forwarding test (the SSRF guard itself is proven in dedicated tests).
func newSSRFBypassBroker(t *testing.T) *Broker {
	t.Helper()
	kp, _ := crypto.GenerateKeyPair("broker-proxy-test")
	// Empty lookupIP => hostnames fail to resolve, but IP literals are still checked. For the proxy
	// test we need loopback allowed, so we register a custom guard by overriding lookupIP is not
	// enough (loopback is an IP literal). Instead mint against the downstream and allow loopback by
	// using a broker that treats loopback as allowed via a dedicated option.
	b, err := New(kp, WithLookupIP(func(h string) ([]net.IP, error) {
		return []net.IP{net.ParseIP("127.0.0.1")}, nil
	}), WithAllowLoopbackForTest())
	if err != nil {
		t.Fatalf("proxy test broker: %v", err)
	}
	return b
}
