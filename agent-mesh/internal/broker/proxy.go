package broker

import (
	"fmt"
	"io"
	"net/http"
	"strings"
)

// AuthProxy is the external credential broker / auth proxy. It holds the privileged downstream
// credentials (the "downstream credential owner") and forwards only narrowly-authorized operations.
// Generated code / sandboxes never see these credentials — they present an opaque grant token, and
// the proxy injects the real credential only after authorizing the exact operation+destination.
type AuthProxy struct {
	broker *Broker
	// creds maps an integration name to its privileged credential (e.g. API token). Held server-side
	// only; never returned to or embedded in a grant.
	creds map[string]string
	// header names the credential is injected as, per integration (default Authorization: Bearer).
	headers map[string]string
	client  *http.Client
}

func NewAuthProxy(b *Broker) *AuthProxy {
	return &AuthProxy{
		broker:  b,
		creds:   make(map[string]string),
		headers: make(map[string]string),
		client:  &http.Client{},
	}
}

// HoldCredential stores a privileged credential for an integration, injected as headerName (default
// "Authorization" with "Bearer <cred>").
func (p *AuthProxy) HoldCredential(integration, credential, headerName string) {
	p.creds[integration] = credential
	if headerName != "" {
		p.headers[integration] = headerName
	}
}

// ForwardResult is the outcome of a proxied call.
type ForwardResult struct {
	StatusCode int
	Body       []byte
	Forwarded  bool
	Reason     string
}

// Forward authorizes (grantToken, op, destination) and, only if allowed, performs the downstream
// request with the privileged credential injected. On any denial it returns Forwarded=false and does
// NOT contact the destination (no credential or request leaves the proxy).
func (p *AuthProxy) Forward(grantToken, op, destination, method string, body io.Reader, extraHeaders map[string]string) (*ForwardResult, error) {
	dec, err := p.broker.Authorize(grantToken, op, destination)
	if err != nil || !dec.Allowed {
		reason := dec.Reason
		if reason == "" {
			reason = "denied"
		}
		return &ForwardResult{StatusCode: http.StatusForbidden, Forwarded: false, Reason: reason}, err
	}

	integration := dec.Grant.Integration
	cred, ok := p.creds[integration]
	if !ok {
		return &ForwardResult{StatusCode: http.StatusBadGateway, Forwarded: false,
			Reason: fmt.Sprintf("no privileged credential held for integration %q", integration)}, nil
	}

	req, err := http.NewRequest(method, destination, body)
	if err != nil {
		return nil, err
	}
	// Inject the privileged credential (server-side held; NOT from the grant).
	if hdr, ok := p.headers[integration]; ok && hdr != "" {
		req.Header.Set(hdr, cred)
	} else {
		req.Header.Set("Authorization", "Bearer "+cred)
	}
	for k, v := range extraHeaders {
		req.Header.Set(k, v)
	}

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	return &ForwardResult{StatusCode: resp.StatusCode, Body: b, Forwarded: true, Reason: "forwarded"}, nil
}

// integrationFromGrant is a tiny helper used by tests to assert scope.
func integrationFromGrant(p GrantPayload) string { return strings.ToLower(p.Integration) }
