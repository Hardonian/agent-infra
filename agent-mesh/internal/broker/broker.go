// Package broker implements the M3 credential broker: short-lived, scoped, opaque grants minted for
// a bounded tool call, enforced at an effect boundary. Generated code receives an opaque grant
// token — never a reusable service credential. The privileged credential stays with the broker/auth
// proxy, which authorizes each downstream operation narrowly (operation + destination + expiry +
// revocation + egress guard) before forwarding.
//
// Grants are Ed25519-signed, expiring bundles (reusing internal/crypto). A stale or forged grant is
// refused by KeyRing.Verify; a revoked grant is refused by the broker's revocation set.
package broker

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/agentmesh/agentmesh/internal/crypto"
)

// GrantPayload is the signed content of a grant. It never contains the privileged credential — only
// the scope of what the holder may do.
type GrantPayload struct {
	GrantID     string   `json:"grantId"`
	RunID       string   `json:"runId"`
	Principal   string   `json:"principal"`   // acting agent / on-behalf-of identity
	Integration string   `json:"integration"` // downstream system, e.g. "github"
	Operations  []string `json:"operations"`  // allowed operations, e.g. ["repo.read"]
	Destinations []string `json:"destinations"` // allowed destination hosts (exact or *.suffix)
	BudgetRef   string   `json:"budgetRef,omitempty"`
}

func (p GrantPayload) allowsOperation(op string) bool {
	for _, a := range p.Operations {
		if a == op || a == "*" {
			return true
		}
	}
	return false
}

func (p GrantPayload) allowsDestination(host string) bool {
	host = strings.ToLower(host)
	for _, d := range p.Destinations {
		d = strings.ToLower(d)
		if d == "*" {
			return true
		}
		if strings.HasPrefix(d, "*.") {
			if strings.HasSuffix(host, d[1:]) || host == d[2:] {
				return true
			}
			continue
		}
		if host == d {
			return true
		}
	}
	return false
}

// Decision is the outcome of an effect-boundary authorization.
type Decision struct {
	Allowed bool   `json:"allowed"`
	Reason  string `json:"reason"`
	Grant   *GrantPayload `json:"grant,omitempty"`
}

var (
	ErrGrantMalformed  = errors.New("grant token malformed")
	ErrGrantRevoked    = errors.New("grant revoked")
	ErrOpNotAllowed    = errors.New("operation not permitted by grant")
	ErrDestNotAllowed  = errors.New("destination not permitted by grant")
	ErrDestBlocked     = errors.New("destination blocked by egress guard (private/metadata network)")
)

// Broker mints and authorizes scoped grants. It is safe for concurrent use.
type Broker struct {
	kp       *crypto.KeyPair
	ring     *crypto.KeyRing
	mu       sync.RWMutex
	revoked  map[string]struct{} // grantID -> revoked
	maxTTL   time.Duration
	policy   PolicyChecker
	lookupIP func(host string) ([]net.IP, error) // overridable for tests / controlled DNS
	allowLoopback bool // test-only: permit loopback through the egress guard
}

// PolicyChecker optionally consults the org authorization boundary (internal/policy) on top of the
// grant's own scope. Returning a non-nil error denies the operation.
type PolicyChecker func(p GrantPayload, op, destination string) error

// Option configures a Broker.
type Option func(*Broker)

// WithMaxTTL caps the grant lifetime minted by this broker.
func WithMaxTTL(d time.Duration) Option { return func(b *Broker) { b.maxTTL = d } }

// WithPolicy consults an external authorization boundary (e.g. internal/policy.Engine) in addition
// to the grant scope.
func WithPolicy(c PolicyChecker) Option { return func(b *Broker) { b.policy = c } }

// WithAllowLoopbackForTest permits loopback destinations through the egress guard. Test-only: used
// so an integration test can reach a local httptest downstream; the SSRF guard itself is proven in
// dedicated tests that do NOT set this option.
func WithAllowLoopbackForTest() Option { return func(b *Broker) { b.allowLoopback = true } }

// WithLookupIP overrides DNS resolution used by the egress guard (tests, controlled resolvers).
func WithLookupIP(f func(host string) ([]net.IP, error)) Option {
	return func(b *Broker) { b.lookupIP = f }
}

// New creates a Broker that signs grants with kp and trusts kp's public key for verification.
func New(kp *crypto.KeyPair, opts ...Option) (*Broker, error) {
	if kp == nil || kp.PrivateKey == nil {
		return nil, errors.New("broker requires a signing key pair")
	}
	ring := crypto.NewKeyRing()
	ring.RegisterKey(kp.KeyID, kp.PublicKey)
	b := &Broker{
		kp:      kp,
		ring:    ring,
		revoked: make(map[string]struct{}),
		maxTTL:  5 * time.Minute,
		lookupIP: net.LookupIP,
	}
	for _, o := range opts {
		o(b)
	}
	return b, nil
}

// Mint issues a short-lived, scoped, opaque grant token for a bounded tool call. ttl is clamped to
// the broker's maxTTL. The returned token is opaque to the holder; the privileged credential is NOT
// embedded.
func (b *Broker) Mint(p GrantPayload, ttl time.Duration) (string, *crypto.SignedBundle, error) {
	if p.GrantID == "" || p.Integration == "" || len(p.Operations) == 0 || len(p.Destinations) == 0 {
		return "", nil, errors.New("grant requires id, integration, at least one operation and destination")
	}
	if ttl <= 0 || ttl > b.maxTTL {
		ttl = b.maxTTL
	}
	bundle, err := crypto.SignPayload(b.kp, "grant/v1", ttl, p)
	if err != nil {
		return "", nil, fmt.Errorf("sign grant: %w", err)
	}
	token := base64.RawURLEncoding.EncodeToString(mustJSON(bundle))
	return token, bundle, nil
}

// Authorize validates an opaque grant token for a requested operation+destination at an effect
// boundary. Default-deny: every check must pass.
func (b *Broker) Authorize(token, op, destination string) (Decision, error) {
	bundle, err := decodeToken(token)
	if err != nil {
		return Decision{Allowed: false, Reason: "malformed grant"}, err
	}
	// Signature + expiry + trusted key + future-issuance (crypto.KeyRing.Verify).
	if err := b.ring.Verify(bundle); err != nil {
		return Decision{Allowed: false, Reason: "grant invalid: " + err.Error()}, err
	}
	var p GrantPayload
	if err := json.Unmarshal([]byte(bundle.Payload), &p); err != nil {
		return Decision{Allowed: false, Reason: "grant payload malformed"}, err
	}

	b.mu.RLock()
	_, rev := b.revoked[p.GrantID]
	b.mu.RUnlock()
	if rev {
		return Decision{Allowed: false, Reason: "grant revoked", Grant: &p}, ErrGrantRevoked
	}

	if !p.allowsOperation(op) {
		return Decision{Allowed: false, Reason: fmt.Sprintf("operation %q not in grant scope", op), Grant: &p}, ErrOpNotAllowed
	}

	host, err := hostOf(destination)
	if err != nil {
		return Decision{Allowed: false, Reason: "invalid destination"}, err
	}
	if err := b.checkEgress(host); err != nil {
		return Decision{Allowed: false, Reason: err.Error(), Grant: &p}, err
	}
	if !p.allowsDestination(host) {
		return Decision{Allowed: false, Reason: fmt.Sprintf("destination %q not in grant scope", host), Grant: &p}, ErrDestNotAllowed
	}

	if b.policy != nil {
		if err := b.policy(p, op, destination); err != nil {
			return Decision{Allowed: false, Reason: "policy denied: " + err.Error(), Grant: &p}, err
		}
	}

	return Decision{Allowed: true, Reason: "allowed", Grant: &p}, nil
}

// Revoke invalidates a grant immediately (checked at every subsequent Authorize).
func (b *Broker) Revoke(grantID string) {
	b.mu.Lock()
	b.revoked[grantID] = struct{}{}
	b.mu.Unlock()
}

// checkEgress blocks private, loopback, link-local/metadata, and reserved destinations to prevent
// the broker being used as an SSRF/credential-exfiltration pivot. Hostnames are resolved and every
// resolved IP is checked (anti DNS-rebinding).
func (b *Broker) checkEgress(host string) error {
	h := strings.ToLower(strings.Trim(host, "[]"))
	if h == "localhost" || h == "metadata" || h == "metadata.google.internal" ||
		h == "metadata.goog" || strings.HasSuffix(h, ".internal") {
		return fmt.Errorf("%w: %s", ErrDestBlocked, host)
	}
	// If it's an IP literal, check it directly.
	if ip := net.ParseIP(h); ip != nil {
		if b.guardBlocked(ip) {
			return fmt.Errorf("%w: %s", ErrDestBlocked, host)
		}
		return nil
	}
	// Hostname: resolve and check every IP (anti DNS rebinding).
	ips, err := b.lookupIP(h)
	if err != nil || len(ips) == 0 {
		return fmt.Errorf("%w: cannot resolve %s", ErrDestBlocked, host)
	}
	for _, ip := range ips {
		if b.guardBlocked(ip) {
			return fmt.Errorf("%w: %s resolves to private %s", ErrDestBlocked, host, ip)
		}
	}
	return nil
}

// guardBlocked applies the egress guard, honoring the test-only loopback bypass.
func (b *Broker) guardBlocked(ip net.IP) bool {
	if ip == nil {
		return true
	}
	if b.allowLoopback && ip.IsLoopback() {
		return false
	}
	return isBlockedIP(ip)
}

func isBlockedIP(ip net.IP) bool {
	if ip == nil {
		return true
	}
	if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() ||
		ip.IsInterfaceLocalMulticast() || ip.IsMulticast() || ip.IsUnspecified() {
		return true
	}
	// Cloud metadata (AWS/GCP/Azure) lives at 169.254.169.254 (link-local, already covered) but be
	// explicit for IPv4-mapped forms.
	if v4 := ip.To4(); v4 != nil {
		if v4[0] == 169 && v4[1] == 254 {
			return true // link-local / metadata
		}
	}
	return false
}

func hostOf(dest string) (string, error) {
	if dest == "" {
		return "", errors.New("empty destination")
	}
	// Accept bare host or full URL.
	if !strings.Contains(dest, "://") {
		// bare host[:port]
		if h, _, err := net.SplitHostPort(dest); err == nil {
			return h, nil
		}
		return dest, nil
	}
	u, err := url.Parse(dest)
	if err != nil {
		return "", err
	}
	return u.Hostname(), nil
}

func decodeToken(token string) (*crypto.SignedBundle, error) {
	raw, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return nil, ErrGrantMalformed
	}
	var bundle crypto.SignedBundle
	if err := json.Unmarshal(raw, &bundle); err != nil {
		return nil, ErrGrantMalformed
	}
	return &bundle, nil
}

func mustJSON(v any) []byte {
	b, _ := json.Marshal(v)
	return b
}
