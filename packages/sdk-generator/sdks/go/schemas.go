// Auto-generated schema validation functions
// DO NOT EDIT MANUALLY - regenerate from source

package controlplane

import "fmt"

// SchemaValidator is a function that validates a model
type SchemaValidator func(interface{}) error

// SchemaRegistry maps schema names to their validators
var SchemaRegistry = map[string]SchemaValidator{
	"RetryPolicy": func(m interface{}) error {
		if v, ok := m.(RetryPolicy); ok {
			return validateRetryPolicy(v)
		}
		return fmt.Errorf("invalid type for RetryPolicy")
	},
	"ErrorDetail": func(m interface{}) error {
		if v, ok := m.(ErrorDetail); ok {
			return validateErrorDetail(v)
		}
		return fmt.Errorf("invalid type for ErrorDetail")
	},
	"ErrorEnvelope": func(m interface{}) error {
		if v, ok := m.(ErrorEnvelope); ok {
			return validateErrorEnvelope(v)
		}
		return fmt.Errorf("invalid type for ErrorEnvelope")
	},
	"ContractVersion": func(m interface{}) error {
		if v, ok := m.(ContractVersion); ok {
			return validateContractVersion(v)
		}
		return fmt.Errorf("invalid type for ContractVersion")
	},
	"ContractRange": func(m interface{}) error {
		if v, ok := m.(ContractRange); ok {
			return validateContractRange(v)
		}
		return fmt.Errorf("invalid type for ContractRange")
	},
	"JobMetadata": func(m interface{}) error {
		if v, ok := m.(JobMetadata); ok {
			return validateJobMetadata(v)
		}
		return fmt.Errorf("invalid type for JobMetadata")
	},
	"JobPayload": func(m interface{}) error {
		if v, ok := m.(JobPayload); ok {
			return validateJobPayload(v)
		}
		return fmt.Errorf("invalid type for JobPayload")
	},
	"JobRequest": func(m interface{}) error {
		if v, ok := m.(JobRequest); ok {
			return validateJobRequest(v)
		}
		return fmt.Errorf("invalid type for JobRequest")
	},
	"JobResult": func(m interface{}) error {
		if v, ok := m.(JobResult); ok {
			return validateJobResult(v)
		}
		return fmt.Errorf("invalid type for JobResult")
	},
	"JobResponse": func(m interface{}) error {
		if v, ok := m.(JobResponse); ok {
			return validateJobResponse(v)
		}
		return fmt.Errorf("invalid type for JobResponse")
	},
	"RunnerCapability": func(m interface{}) error {
		if v, ok := m.(RunnerCapability); ok {
			return validateRunnerCapability(v)
		}
		return fmt.Errorf("invalid type for RunnerCapability")
	},
	"RunnerMetadata": func(m interface{}) error {
		if v, ok := m.(RunnerMetadata); ok {
			return validateRunnerMetadata(v)
		}
		return fmt.Errorf("invalid type for RunnerMetadata")
	},
	"RunnerRegistrationRequest": func(m interface{}) error {
		if v, ok := m.(RunnerRegistrationRequest); ok {
			return validateRunnerRegistrationRequest(v)
		}
		return fmt.Errorf("invalid type for RunnerRegistrationRequest")
	},
	"RunnerRegistrationResponse": func(m interface{}) error {
		if v, ok := m.(RunnerRegistrationResponse); ok {
			return validateRunnerRegistrationResponse(v)
		}
		return fmt.Errorf("invalid type for RunnerRegistrationResponse")
	},
	"RunnerHeartbeat": func(m interface{}) error {
		if v, ok := m.(RunnerHeartbeat); ok {
			return validateRunnerHeartbeat(v)
		}
		return fmt.Errorf("invalid type for RunnerHeartbeat")
	},
	"ModuleManifest": func(m interface{}) error {
		if v, ok := m.(ModuleManifest); ok {
			return validateModuleManifest(v)
		}
		return fmt.Errorf("invalid type for ModuleManifest")
	},
	"RunnerExecutionRequest": func(m interface{}) error {
		if v, ok := m.(RunnerExecutionRequest); ok {
			return validateRunnerExecutionRequest(v)
		}
		return fmt.Errorf("invalid type for RunnerExecutionRequest")
	},
	"RunnerExecutionResponse": func(m interface{}) error {
		if v, ok := m.(RunnerExecutionResponse); ok {
			return validateRunnerExecutionResponse(v)
		}
		return fmt.Errorf("invalid type for RunnerExecutionResponse")
	},
	"TruthAssertion": func(m interface{}) error {
		if v, ok := m.(TruthAssertion); ok {
			return validateTruthAssertion(v)
		}
		return fmt.Errorf("invalid type for TruthAssertion")
	},
	"TruthQuery": func(m interface{}) error {
		if v, ok := m.(TruthQuery); ok {
			return validateTruthQuery(v)
		}
		return fmt.Errorf("invalid type for TruthQuery")
	},
	"TruthQueryResult": func(m interface{}) error {
		if v, ok := m.(TruthQueryResult); ok {
			return validateTruthQueryResult(v)
		}
		return fmt.Errorf("invalid type for TruthQueryResult")
	},
	"TruthSubscription": func(m interface{}) error {
		if v, ok := m.(TruthSubscription); ok {
			return validateTruthSubscription(v)
		}
		return fmt.Errorf("invalid type for TruthSubscription")
	},
	"TruthCoreRequest": func(m interface{}) error {
		if v, ok := m.(TruthCoreRequest); ok {
			return validateTruthCoreRequest(v)
		}
		return fmt.Errorf("invalid type for TruthCoreRequest")
	},
	"TruthCoreResponse": func(m interface{}) error {
		if v, ok := m.(TruthCoreResponse); ok {
			return validateTruthCoreResponse(v)
		}
		return fmt.Errorf("invalid type for TruthCoreResponse")
	},
	"HealthCheck": func(m interface{}) error {
		if v, ok := m.(HealthCheck); ok {
			return validateHealthCheck(v)
		}
		return fmt.Errorf("invalid type for HealthCheck")
	},
	"ServiceMetadata": func(m interface{}) error {
		if v, ok := m.(ServiceMetadata); ok {
			return validateServiceMetadata(v)
		}
		return fmt.Errorf("invalid type for ServiceMetadata")
	},
	"PaginatedRequest": func(m interface{}) error {
		if v, ok := m.(PaginatedRequest); ok {
			return validatePaginatedRequest(v)
		}
		return fmt.Errorf("invalid type for PaginatedRequest")
	},
	"PaginatedResponse": func(m interface{}) error {
		if v, ok := m.(PaginatedResponse); ok {
			return validatePaginatedResponse(v)
		}
		return fmt.Errorf("invalid type for PaginatedResponse")
	},
	"ApiRequest": func(m interface{}) error {
		if v, ok := m.(ApiRequest); ok {
			return validateApiRequest(v)
		}
		return fmt.Errorf("invalid type for ApiRequest")
	},
	"ApiResponse": func(m interface{}) error {
		if v, ok := m.(ApiResponse); ok {
			return validateApiResponse(v)
		}
		return fmt.Errorf("invalid type for ApiResponse")
	},
	"CapabilityRegistry": func(m interface{}) error {
		if v, ok := m.(CapabilityRegistry); ok {
			return validateCapabilityRegistry(v)
		}
		return fmt.Errorf("invalid type for CapabilityRegistry")
	},
	"RegisteredRunner": func(m interface{}) error {
		if v, ok := m.(RegisteredRunner); ok {
			return validateRegisteredRunner(v)
		}
		return fmt.Errorf("invalid type for RegisteredRunner")
	},
	"ConnectorConfig": func(m interface{}) error {
		if v, ok := m.(ConnectorConfig); ok {
			return validateConnectorConfig(v)
		}
		return fmt.Errorf("invalid type for ConnectorConfig")
	},
	"ConnectorInstance": func(m interface{}) error {
		if v, ok := m.(ConnectorInstance); ok {
			return validateConnectorInstance(v)
		}
		return fmt.Errorf("invalid type for ConnectorInstance")
	},
	"RegistryQuery": func(m interface{}) error {
		if v, ok := m.(RegistryQuery); ok {
			return validateRegistryQuery(v)
		}
		return fmt.Errorf("invalid type for RegistryQuery")
	},
	"RegistryDiff": func(m interface{}) error {
		if v, ok := m.(RegistryDiff); ok {
			return validateRegistryDiff(v)
		}
		return fmt.Errorf("invalid type for RegistryDiff")
	},
	"MarketplaceIndex": func(m interface{}) error {
		if v, ok := m.(MarketplaceIndex); ok {
			return validateMarketplaceIndex(v)
		}
		return fmt.Errorf("invalid type for MarketplaceIndex")
	},
	"MarketplaceRunner": func(m interface{}) error {
		if v, ok := m.(MarketplaceRunner); ok {
			return validateMarketplaceRunner(v)
		}
		return fmt.Errorf("invalid type for MarketplaceRunner")
	},
	"MarketplaceConnector": func(m interface{}) error {
		if v, ok := m.(MarketplaceConnector); ok {
			return validateMarketplaceConnector(v)
		}
		return fmt.Errorf("invalid type for MarketplaceConnector")
	},
	"MarketplaceQuery": func(m interface{}) error {
		if v, ok := m.(MarketplaceQuery); ok {
			return validateMarketplaceQuery(v)
		}
		return fmt.Errorf("invalid type for MarketplaceQuery")
	},
	"MarketplaceQueryResult": func(m interface{}) error {
		if v, ok := m.(MarketplaceQueryResult); ok {
			return validateMarketplaceQueryResult(v)
		}
		return fmt.Errorf("invalid type for MarketplaceQueryResult")
	},
	"MarketplaceTrustSignals": func(m interface{}) error {
		if v, ok := m.(MarketplaceTrustSignals); ok {
			return validateMarketplaceTrustSignals(v)
		}
		return fmt.Errorf("invalid type for MarketplaceTrustSignals")
	},
}

// validateRetryPolicy validates a RetryPolicy instance
func validateRetryPolicy(m RetryPolicy) error {
	var errs ValidationErrors


	if !errs.IsValid() {
		return errs
	}
	return nil
}

// validateErrorDetail validates a ErrorDetail instance
func validateErrorDetail(m ErrorDetail) error {
	var errs ValidationErrors

	if m.Message == "" {
		errs.Add("message", "is required")
	}

	if !errs.IsValid() {
		return errs
	}
	return nil
}

// validateErrorEnvelope validates a ErrorEnvelope instance
func validateErrorEnvelope(m ErrorEnvelope) error {
	var errs ValidationErrors

	if m.Id == "" {
		errs.Add("id", "is required")
	}
	if m.Category == "" {
		errs.Add("category", "is required")
	}
	if m.Severity == "" {
		errs.Add("severity", "is required")
	}
	if m.Code == "" {
		errs.Add("code", "is required")
	}
	if m.Message == "" {
		errs.Add("message", "is required")
	}
	if m.Service == "" {
		errs.Add("service", "is required")
	}

	if !errs.IsValid() {
		return errs
	}
	return nil
}

// validateContractVersion validates a ContractVersion instance
func validateContractVersion(m ContractVersion) error {
	var errs ValidationErrors

	if m.Major == 0 {
		errs.Add("major", "is required")
	}
	if m.Minor == 0 {
		errs.Add("minor", "is required")
	}
	if m.Patch == 0 {
		errs.Add("patch", "is required")
	}

	if !errs.IsValid() {
		return errs
	}
	return nil
}

// validateContractRange validates a ContractRange instance
func validateContractRange(m ContractRange) error {
	var errs ValidationErrors


	if !errs.IsValid() {
		return errs
	}
	return nil
}

// validateJobMetadata validates a JobMetadata instance
func validateJobMetadata(m JobMetadata) error {
	var errs ValidationErrors

	if m.Source == "" {
		errs.Add("source", "is required")
	}

	if !errs.IsValid() {
		return errs
	}
	return nil
}

// validateJobPayload validates a JobPayload instance
func validateJobPayload(m JobPayload) error {
	var errs ValidationErrors

	if m.Type == "" {
		errs.Add("type", "is required")
	}

	if !errs.IsValid() {
		return errs
	}
	return nil
}

// validateJobRequest validates a JobRequest instance
func validateJobRequest(m JobRequest) error {
	var errs ValidationErrors

	if m.Id == "" {
		errs.Add("id", "is required")
	}
	if m.Type == "" {
		errs.Add("type", "is required")
	}

	if !errs.IsValid() {
		return errs
	}
	return nil
}

// validateJobResult validates a JobResult instance
func validateJobResult(m JobResult) error {
	var errs ValidationErrors


	if !errs.IsValid() {
		return errs
	}
	return nil
}

// validateJobResponse validates a JobResponse instance
func validateJobResponse(m JobResponse) error {
	var errs ValidationErrors

	if m.Id == "" {
		errs.Add("id", "is required")
	}
	if m.Status == "" {
		errs.Add("status", "is required")
	}

	if !errs.IsValid() {
		return errs
	}
	return nil
}

// validateRunnerCapability validates a RunnerCapability instance
func validateRunnerCapability(m RunnerCapability) error {
	var errs ValidationErrors

	if m.Id == "" {
		errs.Add("id", "is required")
	}
	if m.Name == "" {
		errs.Add("name", "is required")
	}
	if m.Version == "" {
		errs.Add("version", "is required")
	}
	if m.Description == "" {
		errs.Add("description", "is required")
	}

	if !errs.IsValid() {
		return errs
	}
	return nil
}

// validateRunnerMetadata validates a RunnerMetadata instance
func validateRunnerMetadata(m RunnerMetadata) error {
	var errs ValidationErrors

	if m.Id == "" {
		errs.Add("id", "is required")
	}
	if m.Name == "" {
		errs.Add("name", "is required")
	}
	if m.Version == "" {
		errs.Add("version", "is required")
	}
	if m.HealthCheckEndpoint == "" {
		errs.Add("healthCheckEndpoint", "is required")
	}

	if !errs.IsValid() {
		return errs
	}
	return nil
}

// validateRunnerRegistrationRequest validates a RunnerRegistrationRequest instance
func validateRunnerRegistrationRequest(m RunnerRegistrationRequest) error {
	var errs ValidationErrors

	if m.Name == "" {
		errs.Add("name", "is required")
	}
	if m.Version == "" {
		errs.Add("version", "is required")
	}
	if m.HealthCheckEndpoint == "" {
		errs.Add("healthCheckEndpoint", "is required")
	}

	if !errs.IsValid() {
		return errs
	}
	return nil
}

// validateRunnerRegistrationResponse validates a RunnerRegistrationResponse instance
func validateRunnerRegistrationResponse(m RunnerRegistrationResponse) error {
	var errs ValidationErrors

	if m.RunnerId == "" {
		errs.Add("runnerId", "is required")
	}

	if !errs.IsValid() {
		return errs
	}
	return nil
}

// validateRunnerHeartbeat validates a RunnerHeartbeat instance
func validateRunnerHeartbeat(m RunnerHeartbeat) error {
	var errs ValidationErrors

	if m.RunnerId == "" {
		errs.Add("runnerId", "is required")
	}
	if m.Status == "" {
		errs.Add("status", "is required")
	}

	if !errs.IsValid() {
		return errs
	}
	return nil
}

// validateModuleManifest validates a ModuleManifest instance
func validateModuleManifest(m ModuleManifest) error {
	var errs ValidationErrors

	if m.Id == "" {
		errs.Add("id", "is required")
	}
	if m.Name == "" {
		errs.Add("name", "is required")
	}
	if m.Version == "" {
		errs.Add("version", "is required")
	}
	if m.Description == "" {
		errs.Add("description", "is required")
	}
	if m.EntryPoint == "" {
		errs.Add("entryPoint", "is required")
	}

	if !errs.IsValid() {
		return errs
	}
	return nil
}

// validateRunnerExecutionRequest validates a RunnerExecutionRequest instance
func validateRunnerExecutionRequest(m RunnerExecutionRequest) error {
	var errs ValidationErrors

	if m.JobId == "" {
		errs.Add("jobId", "is required")
	}
	if m.ModuleId == "" {
		errs.Add("moduleId", "is required")
	}
	if m.CapabilityId == "" {
		errs.Add("capabilityId", "is required")
	}

	if !errs.IsValid() {
		return errs
	}
	return nil
}

// validateRunnerExecutionResponse validates a RunnerExecutionResponse instance
func validateRunnerExecutionResponse(m RunnerExecutionResponse) error {
	var errs ValidationErrors

	if m.JobId == "" {
		errs.Add("jobId", "is required")
	}
	if m.ExecutionTimeMs == 0 {
		errs.Add("executionTimeMs", "is required")
	}
	if m.RunnerId == "" {
		errs.Add("runnerId", "is required")
	}

	if !errs.IsValid() {
		return errs
	}
	return nil
}

// validateTruthAssertion validates a TruthAssertion instance
func validateTruthAssertion(m TruthAssertion) error {
	var errs ValidationErrors

	if m.Id == "" {
		errs.Add("id", "is required")
	}
	if m.Subject == "" {
		errs.Add("subject", "is required")
	}
	if m.Predicate == "" {
		errs.Add("predicate", "is required")
	}
	if m.Source == "" {
		errs.Add("source", "is required")
	}

	if !errs.IsValid() {
		return errs
	}
	return nil
}

// validateTruthQuery validates a TruthQuery instance
func validateTruthQuery(m TruthQuery) error {
	var errs ValidationErrors

	if m.Id == "" {
		errs.Add("id", "is required")
	}

	if !errs.IsValid() {
		return errs
	}
	return nil
}

// validateTruthQueryResult validates a TruthQueryResult instance
func validateTruthQueryResult(m TruthQueryResult) error {
	var errs ValidationErrors

	if m.QueryId == "" {
		errs.Add("queryId", "is required")
	}
	if m.TotalCount == 0 {
		errs.Add("totalCount", "is required")
	}
	if m.QueryTimeMs == 0 {
		errs.Add("queryTimeMs", "is required")
	}

	if !errs.IsValid() {
		return errs
	}
	return nil
}

// validateTruthSubscription validates a TruthSubscription instance
func validateTruthSubscription(m TruthSubscription) error {
	var errs ValidationErrors

	if m.Id == "" {
		errs.Add("id", "is required")
	}

	if !errs.IsValid() {
		return errs
	}
	return nil
}

// validateTruthCoreRequest validates a TruthCoreRequest instance
func validateTruthCoreRequest(m TruthCoreRequest) error {
	var errs ValidationErrors

	if m.Id == "" {
		errs.Add("id", "is required")
	}
	if m.Type == "" {
		errs.Add("type", "is required")
	}

	if !errs.IsValid() {
		return errs
	}
	return nil
}

// validateTruthCoreResponse validates a TruthCoreResponse instance
func validateTruthCoreResponse(m TruthCoreResponse) error {
	var errs ValidationErrors

	if m.RequestId == "" {
		errs.Add("requestId", "is required")
	}

	if !errs.IsValid() {
		return errs
	}
	return nil
}

// validateHealthCheck validates a HealthCheck instance
func validateHealthCheck(m HealthCheck) error {
	var errs ValidationErrors

	if m.Service == "" {
		errs.Add("service", "is required")
	}
	if m.Status == "" {
		errs.Add("status", "is required")
	}
	if m.Version == "" {
		errs.Add("version", "is required")
	}
	if m.Uptime == 0 {
		errs.Add("uptime", "is required")
	}

	if !errs.IsValid() {
		return errs
	}
	return nil
}

// validateServiceMetadata validates a ServiceMetadata instance
func validateServiceMetadata(m ServiceMetadata) error {
	var errs ValidationErrors

	if m.Name == "" {
		errs.Add("name", "is required")
	}
	if m.Version == "" {
		errs.Add("version", "is required")
	}
	if m.ContractVersion == "" {
		errs.Add("contractVersion", "is required")
	}

	if !errs.IsValid() {
		return errs
	}
	return nil
}

// validatePaginatedRequest validates a PaginatedRequest instance
func validatePaginatedRequest(m PaginatedRequest) error {
	var errs ValidationErrors


	if !errs.IsValid() {
		return errs
	}
	return nil
}

// validatePaginatedResponse validates a PaginatedResponse instance
func validatePaginatedResponse(m PaginatedResponse) error {
	var errs ValidationErrors

	if m.Total == 0 {
		errs.Add("total", "is required")
	}
	if m.Limit == 0 {
		errs.Add("limit", "is required")
	}
	if m.Offset == 0 {
		errs.Add("offset", "is required")
	}

	if !errs.IsValid() {
		return errs
	}
	return nil
}

// validateApiRequest validates a ApiRequest instance
func validateApiRequest(m ApiRequest) error {
	var errs ValidationErrors

	if m.Id == "" {
		errs.Add("id", "is required")
	}
	if m.Method == "" {
		errs.Add("method", "is required")
	}
	if m.Path == "" {
		errs.Add("path", "is required")
	}

	if !errs.IsValid() {
		return errs
	}
	return nil
}

// validateApiResponse validates a ApiResponse instance
func validateApiResponse(m ApiResponse) error {
	var errs ValidationErrors

	if m.RequestId == "" {
		errs.Add("requestId", "is required")
	}
	if m.StatusCode == 0 {
		errs.Add("statusCode", "is required")
	}

	if !errs.IsValid() {
		return errs
	}
	return nil
}

// validateCapabilityRegistry validates a CapabilityRegistry instance
func validateCapabilityRegistry(m CapabilityRegistry) error {
	var errs ValidationErrors

	if m.Version == "" {
		errs.Add("version", "is required")
	}

	if !errs.IsValid() {
		return errs
	}
	return nil
}

// validateRegisteredRunner validates a RegisteredRunner instance
func validateRegisteredRunner(m RegisteredRunner) error {
	var errs ValidationErrors

	if m.Category == "" {
		errs.Add("category", "is required")
	}

	if !errs.IsValid() {
		return errs
	}
	return nil
}

// validateConnectorConfig validates a ConnectorConfig instance
func validateConnectorConfig(m ConnectorConfig) error {
	var errs ValidationErrors

	if m.Id == "" {
		errs.Add("id", "is required")
	}
	if m.Name == "" {
		errs.Add("name", "is required")
	}
	if m.Type == "" {
		errs.Add("type", "is required")
	}
	if m.Version == "" {
		errs.Add("version", "is required")
	}
	if m.Description == "" {
		errs.Add("description", "is required")
	}

	if !errs.IsValid() {
		return errs
	}
	return nil
}

// validateConnectorInstance validates a ConnectorInstance instance
func validateConnectorInstance(m ConnectorInstance) error {
	var errs ValidationErrors

	if m.Status == "" {
		errs.Add("status", "is required")
	}

	if !errs.IsValid() {
		return errs
	}
	return nil
}

// validateRegistryQuery validates a RegistryQuery instance
func validateRegistryQuery(m RegistryQuery) error {
	var errs ValidationErrors


	if !errs.IsValid() {
		return errs
	}
	return nil
}

// validateRegistryDiff validates a RegistryDiff instance
func validateRegistryDiff(m RegistryDiff) error {
	var errs ValidationErrors

	if m.PreviousChecksum == "" {
		errs.Add("previousChecksum", "is required")
	}
	if m.CurrentChecksum == "" {
		errs.Add("currentChecksum", "is required")
	}

	if !errs.IsValid() {
		return errs
	}
	return nil
}

// validateMarketplaceIndex validates a MarketplaceIndex instance
func validateMarketplaceIndex(m MarketplaceIndex) error {
	var errs ValidationErrors

	if m.Version == "" {
		errs.Add("version", "is required")
	}

	if !errs.IsValid() {
		return errs
	}
	return nil
}

// validateMarketplaceRunner validates a MarketplaceRunner instance
func validateMarketplaceRunner(m MarketplaceRunner) error {
	var errs ValidationErrors

	if m.Id == "" {
		errs.Add("id", "is required")
	}
	if m.Category == "" {
		errs.Add("category", "is required")
	}
	if m.Description == "" {
		errs.Add("description", "is required")
	}
	if m.License == "" {
		errs.Add("license", "is required")
	}

	if !errs.IsValid() {
		return errs
	}
	return nil
}

// validateMarketplaceConnector validates a MarketplaceConnector instance
func validateMarketplaceConnector(m MarketplaceConnector) error {
	var errs ValidationErrors

	if m.Id == "" {
		errs.Add("id", "is required")
	}
	if m.Description == "" {
		errs.Add("description", "is required")
	}
	if m.License == "" {
		errs.Add("license", "is required")
	}

	if !errs.IsValid() {
		return errs
	}
	return nil
}

// validateMarketplaceQuery validates a MarketplaceQuery instance
func validateMarketplaceQuery(m MarketplaceQuery) error {
	var errs ValidationErrors


	if !errs.IsValid() {
		return errs
	}
	return nil
}

// validateMarketplaceQueryResult validates a MarketplaceQueryResult instance
func validateMarketplaceQueryResult(m MarketplaceQueryResult) error {
	var errs ValidationErrors

	if m.Total == 0 {
		errs.Add("total", "is required")
	}

	if !errs.IsValid() {
		return errs
	}
	return nil
}

// validateMarketplaceTrustSignals validates a MarketplaceTrustSignals instance
func validateMarketplaceTrustSignals(m MarketplaceTrustSignals) error {
	var errs ValidationErrors

	if m.OverallTrust == "" {
		errs.Add("overallTrust", "is required")
	}
	if m.ContractTestStatus == "" {
		errs.Add("contractTestStatus", "is required")
	}
	if m.VerificationMethod == "" {
		errs.Add("verificationMethod", "is required")
	}
	if m.SecurityScanStatus == "" {
		errs.Add("securityScanStatus", "is required")
	}

	if !errs.IsValid() {
		return errs
	}
	return nil
}
