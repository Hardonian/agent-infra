// Auto-generated Go types from ControlPlane contracts
// DO NOT EDIT MANUALLY - regenerate from source

package controlplane

import (
	"encoding/json"
	"time"
)

// ERRORS types

// ErrorSeverity represents a errors schema
type ErrorSeverity struct {
	Value string `json:"value"`
}

// ErrorSeverity valid values
const (
	ErrorSeverityFATAL = "fatal"
	ErrorSeverityERROR = "error"
	ErrorSeverityWARNING = "warning"
	ErrorSeverityINFO = "info"
)

// ErrorCategory represents a errors schema
type ErrorCategory struct {
	Value string `json:"value"`
}

// ErrorCategory valid values
const (
	ErrorCategoryVALIDATION_ERROR = "VALIDATION_ERROR"
	ErrorCategorySCHEMA_MISMATCH = "SCHEMA_MISMATCH"
	ErrorCategoryRUNTIME_ERROR = "RUNTIME_ERROR"
	ErrorCategoryTIMEOUT = "TIMEOUT"
	ErrorCategoryNETWORK_ERROR = "NETWORK_ERROR"
	ErrorCategoryAUTHENTICATION_ERROR = "AUTHENTICATION_ERROR"
	ErrorCategoryAUTHORIZATION_ERROR = "AUTHORIZATION_ERROR"
	ErrorCategoryRESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND"
	ErrorCategoryRESOURCE_CONFLICT = "RESOURCE_CONFLICT"
	ErrorCategoryRATE_LIMITED = "RATE_LIMITED"
	ErrorCategorySERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE"
	ErrorCategoryRUNNER_ERROR = "RUNNER_ERROR"
	ErrorCategoryTRUTHCORE_ERROR = "TRUTHCORE_ERROR"
	ErrorCategoryINTERNAL_ERROR = "INTERNAL_ERROR"
)

// RetryPolicy represents a errors schema
type RetryPolicy struct {
	MaxRetries int `json:"maxRetries,omitempty"`
	BackoffMs float64 `json:"backoffMs,omitempty"`
	MaxBackoffMs float64 `json:"maxBackoffMs,omitempty"`
	BackoffMultiplier float64 `json:"backoffMultiplier,omitempty"`
	RetryableCategories []string `json:"retryableCategories,omitempty"`
	NonRetryableCategories []string `json:"nonRetryableCategories,omitempty"`
}

// Validate checks if the RetryPolicy is valid
func (m RetryPolicy) Validate() error {
	return validateRetryPolicy(m)
}

// ErrorDetail represents a errors schema
type ErrorDetail struct {
	Path []string `json:"path,omitempty"`
	Message string `json:"message"`
	Code string `json:"code,omitempty"`
	Value interface{} `json:"value,omitempty"`
}

// Validate checks if the ErrorDetail is valid
func (m ErrorDetail) Validate() error {
	return validateErrorDetail(m)
}

// ErrorEnvelope represents a errors schema
type ErrorEnvelope struct {
	Id string `json:"id"`
	Timestamp time.Time `json:"timestamp"`
	Category string `json:"category"`
	Severity string `json:"severity"`
	Code string `json:"code"`
	Message string `json:"message"`
	Details []map[string]interface{} `json:"details,omitempty"`
	Service string `json:"service"`
	Operation string `json:"operation,omitempty"`
	CorrelationId string `json:"correlationId,omitempty"`
	CausationId string `json:"causationId,omitempty"`
	Retryable bool `json:"retryable,omitempty"`
	RetryAfter float64 `json:"retryAfter,omitempty"`
	ContractVersion map[string]interface{} `json:"contractVersion"`
}

// Validate checks if the ErrorEnvelope is valid
func (m ErrorEnvelope) Validate() error {
	return validateErrorEnvelope(m)
}

// VERSIONING types

// ContractVersion represents a versioning schema
type ContractVersion struct {
	Major int `json:"major"`
	Minor int `json:"minor"`
	Patch int `json:"patch"`
	PreRelease string `json:"preRelease,omitempty"`
}

// Validate checks if the ContractVersion is valid
func (m ContractVersion) Validate() error {
	return validateContractVersion(m)
}

// ContractRange represents a versioning schema
type ContractRange struct {
	Min map[string]interface{} `json:"min"`
	Max map[string]interface{} `json:"max,omitempty"`
	Exact map[string]interface{} `json:"exact,omitempty"`
}

// Validate checks if the ContractRange is valid
func (m ContractRange) Validate() error {
	return validateContractRange(m)
}

// TYPES types

// JobId represents a types schema
type JobId struct {
	Value interface{} `json:"value"`
}

// Validate checks if the JobId is valid
func (m JobId) Validate() error {
	return validateJobId(m)
}

// JobStatus represents a types schema
type JobStatus struct {
	Value string `json:"value"`
}

// JobStatus valid values
const (
	JobStatusPENDING = "pending"
	JobStatusQUEUED = "queued"
	JobStatusRUNNING = "running"
	JobStatusCOMPLETED = "completed"
	JobStatusFAILED = "failed"
	JobStatusCANCELLED = "cancelled"
	JobStatusRETRYING = "retrying"
)

// JobPriority represents a types schema
type JobPriority struct {
	Value interface{} `json:"value"`
}

// Validate checks if the JobPriority is valid
func (m JobPriority) Validate() error {
	return validateJobPriority(m)
}

// JobMetadata represents a types schema
type JobMetadata struct {
	Source string `json:"source"`
	UserId string `json:"userId,omitempty"`
	SessionId string `json:"sessionId,omitempty"`
	CorrelationId string `json:"correlationId,omitempty"`
	CausationId string `json:"causationId,omitempty"`
	Tags []string `json:"tags,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
	ScheduledAt time.Time `json:"scheduledAt,omitempty"`
	ExpiresAt time.Time `json:"expiresAt,omitempty"`
}

// Validate checks if the JobMetadata is valid
func (m JobMetadata) Validate() error {
	return validateJobMetadata(m)
}

// JobPayload represents a types schema
type JobPayload struct {
	Type string `json:"type"`
	Version string `json:"version,omitempty"`
	Data map[string]interface{} `json:"data"`
	Options map[string]interface{} `json:"options,omitempty"`
}

// Validate checks if the JobPayload is valid
func (m JobPayload) Validate() error {
	return validateJobPayload(m)
}

// JobRequest represents a types schema
type JobRequest struct {
	Id string `json:"id"`
	Type string `json:"type"`
	Priority int `json:"priority,omitempty"`
	Payload map[string]interface{} `json:"payload"`
	Metadata map[string]interface{} `json:"metadata"`
	RetryPolicy map[string]interface{} `json:"retryPolicy,omitempty"`
	TimeoutMs float64 `json:"timeoutMs,omitempty"`
}

// Validate checks if the JobRequest is valid
func (m JobRequest) Validate() error {
	return validateJobRequest(m)
}

// JobResult represents a types schema
type JobResult struct {
	Success bool `json:"success"`
	Data interface{} `json:"data,omitempty"`
	Error map[string]interface{} `json:"error,omitempty"`
	Metadata map[string]interface{} `json:"metadata"`
}

// Validate checks if the JobResult is valid
func (m JobResult) Validate() error {
	return validateJobResult(m)
}

// JobResponse represents a types schema
type JobResponse struct {
	Id string `json:"id"`
	Status string `json:"status"`
	Request map[string]interface{} `json:"request"`
	Result map[string]interface{} `json:"result,omitempty"`
	Error map[string]interface{} `json:"error,omitempty"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// Validate checks if the JobResponse is valid
func (m JobResponse) Validate() error {
	return validateJobResponse(m)
}

// RunnerCapability represents a types schema
type RunnerCapability struct {
	Id string `json:"id"`
	Name string `json:"name"`
	Version string `json:"version"`
	Description string `json:"description"`
	InputSchema map[string]interface{} `json:"inputSchema"`
	OutputSchema map[string]interface{} `json:"outputSchema"`
	SupportedJobTypes []string `json:"supportedJobTypes"`
	MaxConcurrency int `json:"maxConcurrency,omitempty"`
	TimeoutMs float64 `json:"timeoutMs,omitempty"`
	ResourceRequirements map[string]interface{} `json:"resourceRequirements,omitempty"`
}

// Validate checks if the RunnerCapability is valid
func (m RunnerCapability) Validate() error {
	return validateRunnerCapability(m)
}

// RunnerMetadata represents a types schema
type RunnerMetadata struct {
	Id string `json:"id"`
	Name string `json:"name"`
	Version string `json:"version"`
	ContractVersion map[string]interface{} `json:"contractVersion"`
	Capabilities []map[string]interface{} `json:"capabilities"`
	SupportedContracts []string `json:"supportedContracts"`
	HealthCheckEndpoint string `json:"healthCheckEndpoint"`
	RegisteredAt time.Time `json:"registeredAt"`
	LastHeartbeatAt time.Time `json:"lastHeartbeatAt"`
	Status string `json:"status,omitempty"`
	Tags []string `json:"tags,omitempty"`
}

// Validate checks if the RunnerMetadata is valid
func (m RunnerMetadata) Validate() error {
	return validateRunnerMetadata(m)
}

// RunnerRegistrationRequest represents a types schema
type RunnerRegistrationRequest struct {
	Name string `json:"name"`
	Version string `json:"version"`
	ContractVersion map[string]interface{} `json:"contractVersion"`
	Capabilities []map[string]interface{} `json:"capabilities"`
	HealthCheckEndpoint string `json:"healthCheckEndpoint"`
	Tags []string `json:"tags,omitempty"`
}

// Validate checks if the RunnerRegistrationRequest is valid
func (m RunnerRegistrationRequest) Validate() error {
	return validateRunnerRegistrationRequest(m)
}

// RunnerRegistrationResponse represents a types schema
type RunnerRegistrationResponse struct {
	RunnerId string `json:"runnerId"`
	RegisteredAt time.Time `json:"registeredAt"`
	HeartbeatIntervalMs float64 `json:"heartbeatIntervalMs,omitempty"`
}

// Validate checks if the RunnerRegistrationResponse is valid
func (m RunnerRegistrationResponse) Validate() error {
	return validateRunnerRegistrationResponse(m)
}

// RunnerHeartbeat represents a types schema
type RunnerHeartbeat struct {
	RunnerId string `json:"runnerId"`
	Timestamp time.Time `json:"timestamp"`
	Status string `json:"status"`
	ActiveJobs int `json:"activeJobs,omitempty"`
	QueuedJobs int `json:"queuedJobs,omitempty"`
	Metrics map[string]interface{} `json:"metrics,omitempty"`
}

// Validate checks if the RunnerHeartbeat is valid
func (m RunnerHeartbeat) Validate() error {
	return validateRunnerHeartbeat(m)
}

// ModuleManifest represents a types schema
type ModuleManifest struct {
	Id string `json:"id"`
	Name string `json:"name"`
	Version string `json:"version"`
	Description string `json:"description"`
	EntryPoint string `json:"entryPoint"`
	ContractVersion map[string]interface{} `json:"contractVersion"`
	Capabilities []map[string]interface{} `json:"capabilities"`
	Dependencies []string `json:"dependencies,omitempty"`
	ConfigSchema map[string]interface{} `json:"configSchema,omitempty"`
	DefaultConfig map[string]interface{} `json:"defaultConfig,omitempty"`
}

// Validate checks if the ModuleManifest is valid
func (m ModuleManifest) Validate() error {
	return validateModuleManifest(m)
}

// RunnerExecutionRequest represents a types schema
type RunnerExecutionRequest struct {
	JobId string `json:"jobId"`
	ModuleId string `json:"moduleId"`
	CapabilityId string `json:"capabilityId"`
	Payload map[string]interface{} `json:"payload"`
	TimeoutMs float64 `json:"timeoutMs,omitempty"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// Validate checks if the RunnerExecutionRequest is valid
func (m RunnerExecutionRequest) Validate() error {
	return validateRunnerExecutionRequest(m)
}

// RunnerExecutionResponse represents a types schema
type RunnerExecutionResponse struct {
	JobId string `json:"jobId"`
	Success bool `json:"success"`
	Data interface{} `json:"data,omitempty"`
	Error map[string]interface{} `json:"error,omitempty"`
	ExecutionTimeMs float64 `json:"executionTimeMs"`
	RunnerId string `json:"runnerId"`
}

// Validate checks if the RunnerExecutionResponse is valid
func (m RunnerExecutionResponse) Validate() error {
	return validateRunnerExecutionResponse(m)
}

// TruthAssertion represents a types schema
type TruthAssertion struct {
	Id string `json:"id"`
	Subject string `json:"subject"`
	Predicate string `json:"predicate"`
	Object interface{} `json:"object"`
	Confidence float64 `json:"confidence,omitempty"`
	Timestamp time.Time `json:"timestamp"`
	Source string `json:"source"`
	ExpiresAt time.Time `json:"expiresAt,omitempty"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// Validate checks if the TruthAssertion is valid
func (m TruthAssertion) Validate() error {
	return validateTruthAssertion(m)
}

// TruthQuery represents a types schema
type TruthQuery struct {
	Id string `json:"id"`
	Pattern map[string]interface{} `json:"pattern"`
	Filters map[string]interface{} `json:"filters,omitempty"`
	Limit int `json:"limit,omitempty"`
	Offset int `json:"offset,omitempty"`
}

// Validate checks if the TruthQuery is valid
func (m TruthQuery) Validate() error {
	return validateTruthQuery(m)
}

// TruthQueryResult represents a types schema
type TruthQueryResult struct {
	QueryId string `json:"queryId"`
	Assertions []map[string]interface{} `json:"assertions"`
	TotalCount int `json:"totalCount"`
	HasMore bool `json:"hasMore,omitempty"`
	QueryTimeMs float64 `json:"queryTimeMs"`
}

// Validate checks if the TruthQueryResult is valid
func (m TruthQueryResult) Validate() error {
	return validateTruthQueryResult(m)
}

// TruthSubscription represents a types schema
type TruthSubscription struct {
	Id string `json:"id"`
	Pattern map[string]interface{} `json:"pattern"`
	Filters map[string]interface{} `json:"filters,omitempty"`
	WebhookUrl string `json:"webhookUrl,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
}

// Validate checks if the TruthSubscription is valid
func (m TruthSubscription) Validate() error {
	return validateTruthSubscription(m)
}

// TruthCoreRequest represents a types schema
type TruthCoreRequest struct {
	Id string `json:"id"`
	Type string `json:"type"`
	Payload map[string]interface{} `json:"payload"`
	Metadata map[string]interface{} `json:"metadata"`
}

// Validate checks if the TruthCoreRequest is valid
func (m TruthCoreRequest) Validate() error {
	return validateTruthCoreRequest(m)
}

// TruthCoreResponse represents a types schema
type TruthCoreResponse struct {
	RequestId string `json:"requestId"`
	Success bool `json:"success"`
	Data interface{} `json:"data,omitempty"`
	Error map[string]interface{} `json:"error,omitempty"`
	Timestamp time.Time `json:"timestamp"`
}

// Validate checks if the TruthCoreResponse is valid
func (m TruthCoreResponse) Validate() error {
	return validateTruthCoreResponse(m)
}

// ConsistencyLevel represents a types schema
type ConsistencyLevel struct {
	Value string `json:"value"`
}

// ConsistencyLevel valid values
const (
	ConsistencyLevelSTRICT = "strict"
	ConsistencyLevelEVENTUAL = "eventual"
	ConsistencyLevelBEST_EFFORT = "best_effort"
)

// TruthValue represents a types schema
type TruthValue struct {
	Value interface{} `json:"value"`
}

// Validate checks if the TruthValue is valid
func (m TruthValue) Validate() error {
	return validateTruthValue(m)
}

// HealthStatus represents a types schema
type HealthStatus struct {
	Value string `json:"value"`
}

// HealthStatus valid values
const (
	HealthStatusHEALTHY = "healthy"
	HealthStatusDEGRADED = "degraded"
	HealthStatusUNHEALTHY = "unhealthy"
	HealthStatusUNKNOWN = "unknown"
)

// HealthCheck represents a types schema
type HealthCheck struct {
	Service string `json:"service"`
	Status string `json:"status"`
	Timestamp time.Time `json:"timestamp"`
	Version string `json:"version"`
	Uptime float64 `json:"uptime"`
	Checks []map[string]interface{} `json:"checks,omitempty"`
}

// Validate checks if the HealthCheck is valid
func (m HealthCheck) Validate() error {
	return validateHealthCheck(m)
}

// ServiceMetadata represents a types schema
type ServiceMetadata struct {
	Name string `json:"name"`
	Version string `json:"version"`
	ContractVersion string `json:"contractVersion"`
	Environment string `json:"environment,omitempty"`
	StartTime time.Time `json:"startTime"`
	Features []string `json:"features,omitempty"`
}

// Validate checks if the ServiceMetadata is valid
func (m ServiceMetadata) Validate() error {
	return validateServiceMetadata(m)
}

// PaginatedRequest represents a types schema
type PaginatedRequest struct {
	Limit int `json:"limit,omitempty"`
	Offset int `json:"offset,omitempty"`
	Cursor string `json:"cursor,omitempty"`
	SortBy string `json:"sortBy,omitempty"`
	SortOrder string `json:"sortOrder,omitempty"`
}

// Validate checks if the PaginatedRequest is valid
func (m PaginatedRequest) Validate() error {
	return validatePaginatedRequest(m)
}

// PaginatedResponse represents a types schema
type PaginatedResponse struct {
	Items []interface{} `json:"items"`
	Total int `json:"total"`
	Limit int `json:"limit"`
	Offset int `json:"offset"`
	HasMore bool `json:"hasMore"`
	NextCursor string `json:"nextCursor,omitempty"`
}

// Validate checks if the PaginatedResponse is valid
func (m PaginatedResponse) Validate() error {
	return validatePaginatedResponse(m)
}

// ApiRequest represents a types schema
type ApiRequest struct {
	Id string `json:"id"`
	Method string `json:"method"`
	Path string `json:"path"`
	Headers map[string]string `json:"headers,omitempty"`
	Query map[string]interface{} `json:"query,omitempty"`
	Body interface{} `json:"body"`
	Metadata map[string]interface{} `json:"metadata"`
}

// Validate checks if the ApiRequest is valid
func (m ApiRequest) Validate() error {
	return validateApiRequest(m)
}

// ApiResponse represents a types schema
type ApiResponse struct {
	RequestId string `json:"requestId"`
	StatusCode int `json:"statusCode"`
	Headers map[string]string `json:"headers,omitempty"`
	Body interface{} `json:"body"`
	Error map[string]interface{} `json:"error,omitempty"`
	Metadata map[string]interface{} `json:"metadata"`
}

// Validate checks if the ApiResponse is valid
func (m ApiResponse) Validate() error {
	return validateApiResponse(m)
}

// CapabilityRegistry represents a types schema
type CapabilityRegistry struct {
	Version string `json:"version"`
	GeneratedAt time.Time `json:"generatedAt"`
	System map[string]interface{} `json:"system"`
	Truthcore map[string]interface{} `json:"truthcore"`
	Runners []map[string]interface{} `json:"runners"`
	Connectors []map[string]interface{} `json:"connectors"`
	Summary map[string]interface{} `json:"summary"`
}

// Validate checks if the CapabilityRegistry is valid
func (m CapabilityRegistry) Validate() error {
	return validateCapabilityRegistry(m)
}

// RegisteredRunner represents a types schema
type RegisteredRunner struct {
	Metadata map[string]interface{} `json:"metadata"`
	Category string `json:"category"`
	Connectors []string `json:"connectors"`
	Health map[string]interface{} `json:"health"`
	Capabilities []map[string]interface{} `json:"capabilities"`
}

// Validate checks if the RegisteredRunner is valid
func (m RegisteredRunner) Validate() error {
	return validateRegisteredRunner(m)
}

// ConnectorConfig represents a types schema
type ConnectorConfig struct {
	Id string `json:"id"`
	Name string `json:"name"`
	Type string `json:"type"`
	Version string `json:"version"`
	Description string `json:"description"`
	ConfigSchema map[string]interface{} `json:"configSchema"`
	Required bool `json:"required,omitempty"`
	HealthCheckable bool `json:"healthCheckable,omitempty"`
}

// Validate checks if the ConnectorConfig is valid
func (m ConnectorConfig) Validate() error {
	return validateConnectorConfig(m)
}

// ConnectorType represents a types schema
type ConnectorType struct {
	Value string `json:"value"`
}

// ConnectorType valid values
const (
	ConnectorTypeDATABASE = "database"
	ConnectorTypeQUEUE = "queue"
	ConnectorTypeSTORAGE = "storage"
	ConnectorTypeAPI = "api"
	ConnectorTypeWEBHOOK = "webhook"
	ConnectorTypeSTREAM = "stream"
	ConnectorTypeCACHE = "cache"
	ConnectorTypeMESSAGING = "messaging"
)

// ConnectorInstance represents a types schema
type ConnectorInstance struct {
	Config map[string]interface{} `json:"config"`
	Status string `json:"status"`
	LastConnectedAt time.Time `json:"lastConnectedAt,omitempty"`
	LastErrorAt time.Time `json:"lastErrorAt,omitempty"`
	ErrorMessage string `json:"errorMessage,omitempty"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// Validate checks if the ConnectorInstance is valid
func (m ConnectorInstance) Validate() error {
	return validateConnectorInstance(m)
}

// RunnerCategory represents a types schema
type RunnerCategory struct {
	Value string `json:"value"`
}

// RunnerCategory valid values
const (
	RunnerCategoryOPS = "ops"
	RunnerCategoryFINOPS = "finops"
	RunnerCategorySUPPORT = "support"
	RunnerCategoryGROWTH = "growth"
	RunnerCategoryANALYTICS = "analytics"
	RunnerCategorySECURITY = "security"
	RunnerCategoryINFRASTRUCTURE = "infrastructure"
	RunnerCategoryCUSTOM = "custom"
)

// RegistryQuery represents a types schema
type RegistryQuery struct {
	Category string `json:"category,omitempty"`
	ConnectorType string `json:"connectorType,omitempty"`
	HealthStatus string `json:"healthStatus,omitempty"`
	IncludeCapabilities bool `json:"includeCapabilities,omitempty"`
	IncludeConnectors bool `json:"includeConnectors,omitempty"`
}

// Validate checks if the RegistryQuery is valid
func (m RegistryQuery) Validate() error {
	return validateRegistryQuery(m)
}

// RegistryDiff represents a types schema
type RegistryDiff struct {
	Added []map[string]interface{} `json:"added"`
	Removed []map[string]interface{} `json:"removed"`
	Modified []map[string]interface{} `json:"modified"`
	Timestamp time.Time `json:"timestamp"`
	PreviousChecksum string `json:"previousChecksum"`
	CurrentChecksum string `json:"currentChecksum"`
}

// Validate checks if the RegistryDiff is valid
func (m RegistryDiff) Validate() error {
	return validateRegistryDiff(m)
}

// MarketplaceIndex represents a types schema
type MarketplaceIndex struct {
	Version string `json:"version"`
	GeneratedAt time.Time `json:"generatedAt"`
	Schema map[string]interface{} `json:"schema"`
	System map[string]interface{} `json:"system"`
	Stats map[string]interface{} `json:"stats"`
	Runners []map[string]interface{} `json:"runners"`
	Connectors []map[string]interface{} `json:"connectors"`
	Filters map[string]interface{} `json:"filters"`
}

// Validate checks if the MarketplaceIndex is valid
func (m MarketplaceIndex) Validate() error {
	return validateMarketplaceIndex(m)
}

// MarketplaceRunner represents a types schema
type MarketplaceRunner struct {
	Id string `json:"id"`
	Metadata map[string]interface{} `json:"metadata"`
	Category string `json:"category"`
	Description string `json:"description"`
	LongDescription string `json:"longDescription,omitempty"`
	Author map[string]interface{} `json:"author"`
	Repository map[string]interface{} `json:"repository,omitempty"`
	Documentation map[string]interface{} `json:"documentation,omitempty"`
	License string `json:"license"`
	Keywords []string `json:"keywords,omitempty"`
	Capabilities []map[string]interface{} `json:"capabilities"`
	Compatibility map[string]interface{} `json:"compatibility"`
	TrustSignals map[string]interface{} `json:"trustSignals"`
	Deprecation map[string]interface{} `json:"deprecation,omitempty"`
	Status string `json:"status,omitempty"`
	PublishedAt time.Time `json:"publishedAt"`
	UpdatedAt time.Time `json:"updatedAt"`
	VersionHistory []map[string]interface{} `json:"versionHistory,omitempty"`
	Installation map[string]interface{} `json:"installation,omitempty"`
}

// Validate checks if the MarketplaceRunner is valid
func (m MarketplaceRunner) Validate() error {
	return validateMarketplaceRunner(m)
}

// MarketplaceConnector represents a types schema
type MarketplaceConnector struct {
	Id string `json:"id"`
	Config map[string]interface{} `json:"config"`
	Description string `json:"description"`
	LongDescription string `json:"longDescription,omitempty"`
	Author map[string]interface{} `json:"author"`
	Repository map[string]interface{} `json:"repository,omitempty"`
	Documentation map[string]interface{} `json:"documentation,omitempty"`
	License string `json:"license"`
	Keywords []string `json:"keywords,omitempty"`
	InputSchema map[string]interface{} `json:"inputSchema"`
	OutputSchema map[string]interface{} `json:"outputSchema"`
	Compatibility map[string]interface{} `json:"compatibility"`
	TrustSignals map[string]interface{} `json:"trustSignals"`
	Deprecation map[string]interface{} `json:"deprecation,omitempty"`
	Status string `json:"status,omitempty"`
	PublishedAt time.Time `json:"publishedAt"`
	UpdatedAt time.Time `json:"updatedAt"`
	VersionHistory []map[string]interface{} `json:"versionHistory,omitempty"`
	Installation map[string]interface{} `json:"installation,omitempty"`
}

// Validate checks if the MarketplaceConnector is valid
func (m MarketplaceConnector) Validate() error {
	return validateMarketplaceConnector(m)
}

// MarketplaceQuery represents a types schema
type MarketplaceQuery struct {
	Type string `json:"type,omitempty"`
	Category string `json:"category,omitempty"`
	ConnectorType string `json:"connectorType,omitempty"`
	Status string `json:"status,omitempty"`
	TrustLevel string `json:"trustLevel,omitempty"`
	Search string `json:"search,omitempty"`
	CompatibilityVersion map[string]interface{} `json:"compatibilityVersion,omitempty"`
	Author string `json:"author,omitempty"`
	Keywords []string `json:"keywords,omitempty"`
	SortBy string `json:"sortBy,omitempty"`
	SortOrder string `json:"sortOrder,omitempty"`
	Limit float64 `json:"limit,omitempty"`
	Offset float64 `json:"offset,omitempty"`
}

// Validate checks if the MarketplaceQuery is valid
func (m MarketplaceQuery) Validate() error {
	return validateMarketplaceQuery(m)
}

// MarketplaceQueryResult represents a types schema
type MarketplaceQueryResult struct {
	Query map[string]interface{} `json:"query"`
	Total float64 `json:"total"`
	HasMore bool `json:"hasMore"`
	Items []interface{} `json:"items"`
	Facets map[string]interface{} `json:"facets"`
}

// Validate checks if the MarketplaceQueryResult is valid
func (m MarketplaceQueryResult) Validate() error {
	return validateMarketplaceQueryResult(m)
}

// MarketplaceTrustSignals represents a types schema
type MarketplaceTrustSignals struct {
	OverallTrust string `json:"overallTrust"`
	ContractTestStatus string `json:"contractTestStatus"`
	LastContractTestAt time.Time `json:"lastContractTestAt,omitempty"`
	LastVerifiedVersion string `json:"lastVerifiedVersion,omitempty"`
	VerificationMethod string `json:"verificationMethod"`
	SecurityScanStatus string `json:"securityScanStatus"`
	LastSecurityScanAt time.Time `json:"lastSecurityScanAt,omitempty"`
	SecurityScanDetails map[string]interface{} `json:"securityScanDetails,omitempty"`
	CodeQualityScore float64 `json:"codeQualityScore,omitempty"`
	MaintainerReputation string `json:"maintainerReputation,omitempty"`
	DownloadCount float64 `json:"downloadCount,omitempty"`
	Rating map[string]interface{} `json:"rating,omitempty"`
}

// Validate checks if the MarketplaceTrustSignals is valid
func (m MarketplaceTrustSignals) Validate() error {
	return validateMarketplaceTrustSignals(m)
}

// TrustStatus represents a types schema
type TrustStatus struct {
	Value string `json:"value"`
}

// TrustStatus valid values
const (
	TrustStatusVERIFIED = "verified"
	TrustStatusPENDING = "pending"
	TrustStatusFAILED = "failed"
	TrustStatusUNVERIFIED = "unverified"
)

// SecurityScanStatus represents a types schema
type SecurityScanStatus struct {
	Value string `json:"value"`
}

// SecurityScanStatus valid values
const (
	SecurityScanStatusPASSED = "passed"
	SecurityScanStatusFAILED = "failed"
	SecurityScanStatusPENDING = "pending"
	SecurityScanStatusNOT_SCANNED = "not_scanned"
)

// ContractTestStatus represents a types schema
type ContractTestStatus struct {
	Value string `json:"value"`
}

// ContractTestStatus valid values
const (
	ContractTestStatusPASSING = "passing"
	ContractTestStatusFAILING = "failing"
	ContractTestStatusNOT_TESTED = "not_tested"
	ContractTestStatusSTALE = "stale"
)

// VerificationMethod represents a types schema
type VerificationMethod struct {
	Value string `json:"value"`
}

// VerificationMethod valid values
const (
	VerificationMethodAUTOMATED_CI = "automated_ci"
	VerificationMethodMANUAL_REVIEW = "manual_review"
	VerificationMethodCOMMUNITY_VERIFIED = "community_verified"
	VerificationMethodOFFICIAL_PUBLISHER = "official_publisher"
)
