// Auto-generated ControlPlane SDK Client
// DO NOT EDIT MANUALLY - regenerate from source

package controlplane

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// ClientConfig holds configuration for the ControlPlane client
type ClientConfig struct {
	BaseURL    string
	APIKey     string
	Timeout    time.Duration
	HTTPClient *http.Client
}

// ControlPlaneClient is the main SDK client
type ControlPlaneClient struct {
	config          ClientConfig
	contractVersion ContractVersion
	client          *http.Client
}

// NewClient creates a new ControlPlane SDK client
func NewClient(config ClientConfig) *ControlPlaneClient {
	if config.Timeout == 0 {
		config.Timeout = 30 * time.Second
	}
	if config.HTTPClient == nil {
		config.HTTPClient = &http.Client{Timeout: config.Timeout}
	}

	return &ControlPlaneClient{
		config: config,
		contractVersion: ContractVersion{
			Major: 1,
			Minor: 0,
			Patch: 0,
		},
		client: config.HTTPClient,
	}
}

// GetContractVersion returns the contract version used by this client
func (c *ControlPlaneClient) GetContractVersion() ContractVersion {
	return c.contractVersion
}

func (c *ControlPlaneClient) serializeVersion(v ContractVersion) string {
	return fmt.Sprintf("%d.%d.%d", v.Major, v.Minor, v.Patch)
}

func (c *ControlPlaneClient) defaultHeaders() map[string]string {
	headers := map[string]string{
		"Content-Type":       "application/json",
		"X-Contract-Version": c.serializeVersion(c.contractVersion),
	}
	if c.config.APIKey != "" {
		headers["Authorization"] = fmt.Sprintf("Bearer %s", c.config.APIKey)
	}
	return headers
}

// Request makes an HTTP request to the ControlPlane API
func (c *ControlPlaneClient) Request(ctx context.Context, method, path string, body interface{}) (*http.Response, error) {
	var bodyReader *bytes.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		bodyReader = bytes.NewReader(jsonBody)
	} else {
		bodyReader = bytes.NewReader([]byte{})
	}

	url := fmt.Sprintf("%s%s", c.config.BaseURL, path)
	req, err := http.NewRequestWithContext(ctx, method, url, bodyReader)
	if err != nil {
		return nil, err
	}

	for key, value := range c.defaultHeaders() {
		req.Header.Set(key, value)
	}

	return c.client.Do(req)
}

// Validate validates a model using the generated validators
func (c *ControlPlaneClient) Validate(model Validatable) error {
	return model.Validate()
}

// Validatable interface for models that can be validated
type Validatable interface {
	Validate() error
}
