# Auto-generated schema registry
# DO NOT EDIT MANUALLY - regenerate from source

from typing import Dict, Type
from pydantic import BaseModel
from . import models

# Schema registry for runtime lookup
SCHEMA_REGISTRY: Dict[str, Type[BaseModel]] = {
    "RetryPolicy": models.RetryPolicy,
    "ErrorDetail": models.ErrorDetail,
    "ErrorEnvelope": models.ErrorEnvelope,
    "ContractVersion": models.ContractVersion,
    "ContractRange": models.ContractRange,
    "JobMetadata": models.JobMetadata,
    "JobPayload": models.JobPayload,
    "JobRequest": models.JobRequest,
    "JobResult": models.JobResult,
    "JobResponse": models.JobResponse,
    "RunnerCapability": models.RunnerCapability,
    "RunnerMetadata": models.RunnerMetadata,
    "RunnerRegistrationRequest": models.RunnerRegistrationRequest,
    "RunnerRegistrationResponse": models.RunnerRegistrationResponse,
    "RunnerHeartbeat": models.RunnerHeartbeat,
    "ModuleManifest": models.ModuleManifest,
    "RunnerExecutionRequest": models.RunnerExecutionRequest,
    "RunnerExecutionResponse": models.RunnerExecutionResponse,
    "TruthAssertion": models.TruthAssertion,
    "TruthQuery": models.TruthQuery,
    "TruthQueryResult": models.TruthQueryResult,
    "TruthSubscription": models.TruthSubscription,
    "TruthCoreRequest": models.TruthCoreRequest,
    "TruthCoreResponse": models.TruthCoreResponse,
    "HealthCheck": models.HealthCheck,
    "ServiceMetadata": models.ServiceMetadata,
    "PaginatedRequest": models.PaginatedRequest,
    "PaginatedResponse": models.PaginatedResponse,
    "ApiRequest": models.ApiRequest,
    "ApiResponse": models.ApiResponse,
    "CapabilityRegistry": models.CapabilityRegistry,
    "RegisteredRunner": models.RegisteredRunner,
    "ConnectorConfig": models.ConnectorConfig,
    "ConnectorInstance": models.ConnectorInstance,
    "RegistryQuery": models.RegistryQuery,
    "RegistryDiff": models.RegistryDiff,
    "MarketplaceIndex": models.MarketplaceIndex,
    "MarketplaceRunner": models.MarketplaceRunner,
    "MarketplaceConnector": models.MarketplaceConnector,
    "MarketplaceQuery": models.MarketplaceQuery,
    "MarketplaceQueryResult": models.MarketplaceQueryResult,
    "MarketplaceTrustSignals": models.MarketplaceTrustSignals,
}

def get_schema(name: str) -> Type[BaseModel]:
    """Get a schema by name."""
    if name not in SCHEMA_REGISTRY:
        raise KeyError(f"Unknown schema: {name}")
    return SCHEMA_REGISTRY[name]

def list_schemas() -> list[str]:
    """List all available schema names."""
    return list(SCHEMA_REGISTRY.keys())