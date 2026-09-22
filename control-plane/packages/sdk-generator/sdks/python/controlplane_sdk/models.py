# Auto-generated Pydantic models from ControlPlane contracts
# DO NOT EDIT MANUALLY - regenerate from source

from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, List, Optional, Union, Literal, TypeVar, Generic
from pydantic import BaseModel, Field, ConfigDict

# ERRORS models

class ErrorSeverity(BaseModel):
    """errors schema: ErrorSeverity"""
    value: Literal['fatal', 'error', 'warning', 'info']

class ErrorCategory(BaseModel):
    """errors schema: ErrorCategory"""
    value: Literal['VALIDATION_ERROR', 'SCHEMA_MISMATCH', 'RUNTIME_ERROR', 'TIMEOUT', 'NETWORK_ERROR', 'AUTHENTICATION_ERROR', 'AUTHORIZATION_ERROR', 'RESOURCE_NOT_FOUND', 'RESOURCE_CONFLICT', 'RATE_LIMITED', 'SERVICE_UNAVAILABLE', 'RUNNER_ERROR', 'TRUTHCORE_ERROR', 'INTERNAL_ERROR']

class RetryPolicy(BaseModel):
    """errors schema: RetryPolicy"""
    maxRetries: int = Field(default=3)
    backoffMs: float = Field(default=1000)
    maxBackoffMs: float = Field(default=30000)
    backoffMultiplier: float = Field(default=2)
    retryableCategories: List[Literal['VALIDATION_ERROR', 'SCHEMA_MISMATCH', 'RUNTIME_ERROR', 'TIMEOUT', 'NETWORK_ERROR', 'AUTHENTICATION_ERROR', 'AUTHORIZATION_ERROR', 'RESOURCE_NOT_FOUND', 'RESOURCE_CONFLICT', 'RATE_LIMITED', 'SERVICE_UNAVAILABLE', 'RUNNER_ERROR', 'TRUTHCORE_ERROR', 'INTERNAL_ERROR']] = Field(default=["TIMEOUT","NETWORK_ERROR","SERVICE_UNAVAILABLE","RUNTIME_ERROR"])
    nonRetryableCategories: List[Literal['VALIDATION_ERROR', 'SCHEMA_MISMATCH', 'RUNTIME_ERROR', 'TIMEOUT', 'NETWORK_ERROR', 'AUTHENTICATION_ERROR', 'AUTHORIZATION_ERROR', 'RESOURCE_NOT_FOUND', 'RESOURCE_CONFLICT', 'RATE_LIMITED', 'SERVICE_UNAVAILABLE', 'RUNNER_ERROR', 'TRUTHCORE_ERROR', 'INTERNAL_ERROR']] = Field(default=["VALIDATION_ERROR","SCHEMA_MISMATCH","AUTHENTICATION_ERROR","AUTHORIZATION_ERROR","RESOURCE_NOT_FOUND"])

class ErrorDetail(BaseModel):
    """errors schema: ErrorDetail"""
    model_config = ConfigDict(
        json_schema_extra={"required": ["message"]}
    )

    path: Optional[List[str]] = None
    message: str
    code: Optional[str] = None
    value: Optional[Any] = None

class ErrorEnvelope(BaseModel):
    """errors schema: ErrorEnvelope"""
    model_config = ConfigDict(
        json_schema_extra={"required": ["id", "timestamp", "category", "severity", "code", "message", "service", "contractVersion"]}
    )

    id: str
    timestamp: datetime
    category: Literal['VALIDATION_ERROR', 'SCHEMA_MISMATCH', 'RUNTIME_ERROR', 'TIMEOUT', 'NETWORK_ERROR', 'AUTHENTICATION_ERROR', 'AUTHORIZATION_ERROR', 'RESOURCE_NOT_FOUND', 'RESOURCE_CONFLICT', 'RATE_LIMITED', 'SERVICE_UNAVAILABLE', 'RUNNER_ERROR', 'TRUTHCORE_ERROR', 'INTERNAL_ERROR']
    severity: Literal['fatal', 'error', 'warning', 'info']
    code: str
    message: str
    details: List[Dict[str, Any]] = Field(default=[])
    service: str
    operation: Optional[str] = None
    correlationId: Optional[str] = None
    causationId: Optional[str] = None
    retryable: bool = Field(default=false)
    retryAfter: Optional[float] = None
    contractVersion: Dict[str, Any]

# VERSIONING models

class ContractVersion(BaseModel):
    """versioning schema: ContractVersion"""
    model_config = ConfigDict(
        json_schema_extra={"required": ["major", "minor", "patch"]}
    )

    major: int
    minor: int
    patch: int
    preRelease: Optional[str] = None

class ContractRange(BaseModel):
    """versioning schema: ContractRange"""
    model_config = ConfigDict(
        json_schema_extra={"required": ["min"]}
    )

    min: Dict[str, Any]
    max: Optional[Dict[str, Any]] = None
    exact: Optional[Dict[str, Any]] = None

# TYPES models

class JobId(BaseModel):
    """types schema: JobId"""
    value: Any

class JobStatus(BaseModel):
    """types schema: JobStatus"""
    value: Literal['pending', 'queued', 'running', 'completed', 'failed', 'cancelled', 'retrying']

class JobPriority(BaseModel):
    """types schema: JobPriority"""
    value: Any

class JobMetadata(BaseModel):
    """types schema: JobMetadata"""
    model_config = ConfigDict(
        json_schema_extra={"required": ["source", "createdAt"]}
    )

    source: str
    userId: Optional[str] = None
    sessionId: Optional[str] = None
    correlationId: Optional[str] = None
    causationId: Optional[str] = None
    tags: List[str] = Field(default=[])
    createdAt: datetime
    scheduledAt: Optional[datetime] = None
    expiresAt: Optional[datetime] = None

class JobPayload(BaseModel):
    """types schema: JobPayload"""
    model_config = ConfigDict(
        json_schema_extra={"required": ["type", "data"]}
    )

    type: str
    version: str = Field(default="1.0.0")
    data: Dict[str, Any]
    options: Dict[str, Any] = Field(default={})

class JobRequest(BaseModel):
    """types schema: JobRequest"""
    model_config = ConfigDict(
        json_schema_extra={"required": ["id", "type", "payload", "metadata"]}
    )

    id: str
    type: str
    priority: int = Field(default=50)
    payload: Dict[str, Any]
    metadata: Dict[str, Any]
    retryPolicy: Dict[str, Any] = Field(default={"maxRetries":3,"backoffMs":1000,"maxBackoffMs":30000,"backoffMultiplier":2,"retryableCategories":[],"nonRetryableCategories":[]})
    timeoutMs: float = Field(default=30000)

class JobResult(BaseModel):
    """types schema: JobResult"""
    model_config = ConfigDict(
        json_schema_extra={"required": ["success", "metadata"]}
    )

    success: bool
    data: Optional[Any] = None
    error: Optional[Dict[str, Any]] = None
    metadata: Dict[str, Any]

class JobResponse(BaseModel):
    """types schema: JobResponse"""
    model_config = ConfigDict(
        json_schema_extra={"required": ["id", "status", "request", "updatedAt"]}
    )

    id: str
    status: Literal['pending', 'queued', 'running', 'completed', 'failed', 'cancelled', 'retrying']
    request: Dict[str, Any]
    result: Optional[Dict[str, Any]] = None
    error: Optional[Dict[str, Any]] = None
    updatedAt: datetime

class RunnerCapability(BaseModel):
    """types schema: RunnerCapability"""
    model_config = ConfigDict(
        json_schema_extra={"required": ["id", "name", "version", "description", "inputSchema", "outputSchema", "supportedJobTypes"]}
    )

    id: str
    name: str
    version: str
    description: str
    inputSchema: Dict[str, Any]
    outputSchema: Dict[str, Any]
    supportedJobTypes: List[str]
    maxConcurrency: int = Field(default=1)
    timeoutMs: float = Field(default=30000)
    resourceRequirements: Dict[str, Any] = Field(default={})

class RunnerMetadata(BaseModel):
    """types schema: RunnerMetadata"""
    model_config = ConfigDict(
        json_schema_extra={"required": ["id", "name", "version", "contractVersion", "capabilities", "supportedContracts", "healthCheckEndpoint", "registeredAt", "lastHeartbeatAt"]}
    )

    id: str
    name: str
    version: str
    contractVersion: Dict[str, Any]
    capabilities: List[Dict[str, Any]]
    supportedContracts: List[str]
    healthCheckEndpoint: str
    registeredAt: datetime
    lastHeartbeatAt: datetime
    status: Literal['healthy', 'degraded', 'unhealthy', 'offline'] = Field(default="healthy")
    tags: List[str] = Field(default=[])

class RunnerRegistrationRequest(BaseModel):
    """types schema: RunnerRegistrationRequest"""
    model_config = ConfigDict(
        json_schema_extra={"required": ["name", "version", "contractVersion", "capabilities", "healthCheckEndpoint"]}
    )

    name: str
    version: str
    contractVersion: Dict[str, Any]
    capabilities: List[Dict[str, Any]]
    healthCheckEndpoint: str
    tags: List[str] = Field(default=[])

class RunnerRegistrationResponse(BaseModel):
    """types schema: RunnerRegistrationResponse"""
    model_config = ConfigDict(
        json_schema_extra={"required": ["runnerId", "registeredAt"]}
    )

    runnerId: str
    registeredAt: datetime
    heartbeatIntervalMs: float = Field(default=30000)

class RunnerHeartbeat(BaseModel):
    """types schema: RunnerHeartbeat"""
    model_config = ConfigDict(
        json_schema_extra={"required": ["runnerId", "timestamp", "status"]}
    )

    runnerId: str
    timestamp: datetime
    status: Literal['healthy', 'degraded', 'unhealthy']
    activeJobs: int = Field(default=0)
    queuedJobs: int = Field(default=0)
    metrics: Dict[str, Any] = Field(default={})

class ModuleManifest(BaseModel):
    """types schema: ModuleManifest"""
    model_config = ConfigDict(
        json_schema_extra={"required": ["id", "name", "version", "description", "entryPoint", "contractVersion", "capabilities"]}
    )

    id: str
    name: str
    version: str
    description: str
    entryPoint: str
    contractVersion: Dict[str, Any]
    capabilities: List[Dict[str, Any]]
    dependencies: List[str] = Field(default=[])
    configSchema: Optional[Dict[str, Any]] = None
    defaultConfig: Dict[str, Any] = Field(default={})

class RunnerExecutionRequest(BaseModel):
    """types schema: RunnerExecutionRequest"""
    model_config = ConfigDict(
        json_schema_extra={"required": ["jobId", "moduleId", "capabilityId", "payload"]}
    )

    jobId: str
    moduleId: str
    capabilityId: str
    payload: Dict[str, Any]
    timeoutMs: float = Field(default=30000)
    metadata: Dict[str, Any] = Field(default={})

class RunnerExecutionResponse(BaseModel):
    """types schema: RunnerExecutionResponse"""
    model_config = ConfigDict(
        json_schema_extra={"required": ["jobId", "success", "executionTimeMs", "runnerId"]}
    )

    jobId: str
    success: bool
    data: Optional[Any] = None
    error: Optional[Dict[str, Any]] = None
    executionTimeMs: float
    runnerId: str

class TruthAssertion(BaseModel):
    """types schema: TruthAssertion"""
    model_config = ConfigDict(
        json_schema_extra={"required": ["id", "subject", "predicate", "object", "timestamp", "source"]}
    )

    id: str
    subject: str
    predicate: str
    object: Union[str, float, bool, None, List[Any], Dict[str, Any]]
    confidence: float = Field(default=1)
    timestamp: datetime
    source: str
    expiresAt: Optional[datetime] = None
    metadata: Dict[str, Any] = Field(default={})

class TruthQuery(BaseModel):
    """types schema: TruthQuery"""
    model_config = ConfigDict(
        json_schema_extra={"required": ["id", "pattern"]}
    )

    id: str
    pattern: Dict[str, Any]
    filters: Dict[str, Any] = Field(default={})
    limit: int = Field(default=100)
    offset: int = Field(default=0)

class TruthQueryResult(BaseModel):
    """types schema: TruthQueryResult"""
    model_config = ConfigDict(
        json_schema_extra={"required": ["queryId", "assertions", "totalCount", "queryTimeMs"]}
    )

    queryId: str
    assertions: List[Dict[str, Any]]
    totalCount: int
    hasMore: bool = Field(default=false)
    queryTimeMs: float

class TruthSubscription(BaseModel):
    """types schema: TruthSubscription"""
    model_config = ConfigDict(
        json_schema_extra={"required": ["id", "pattern", "createdAt"]}
    )

    id: str
    pattern: Dict[str, Any]
    filters: Dict[str, Any] = Field(default={})
    webhookUrl: Optional[str] = None
    createdAt: datetime

class TruthCoreRequest(BaseModel):
    """types schema: TruthCoreRequest"""
    model_config = ConfigDict(
        json_schema_extra={"required": ["id", "type", "payload", "metadata"]}
    )

    id: str
    type: Literal['assert', 'query', 'subscribe', 'unsubscribe']
    payload: Dict[str, Any]
    metadata: Dict[str, Any]

class TruthCoreResponse(BaseModel):
    """types schema: TruthCoreResponse"""
    model_config = ConfigDict(
        json_schema_extra={"required": ["requestId", "success", "timestamp"]}
    )

    requestId: str
    success: bool
    data: Optional[Any] = None
    error: Optional[Dict[str, Any]] = None
    timestamp: datetime

class ConsistencyLevel(BaseModel):
    """types schema: ConsistencyLevel"""
    value: Literal['strict', 'eventual', 'best_effort']

class TruthValue(BaseModel):
    """types schema: TruthValue"""
    value: Any

class HealthStatus(BaseModel):
    """types schema: HealthStatus"""
    value: Literal['healthy', 'degraded', 'unhealthy', 'unknown']

class HealthCheck(BaseModel):
    """types schema: HealthCheck"""
    model_config = ConfigDict(
        json_schema_extra={"required": ["service", "status", "timestamp", "version", "uptime"]}
    )

    service: str
    status: Literal['healthy', 'degraded', 'unhealthy', 'unknown']
    timestamp: datetime
    version: str
    uptime: float
    checks: List[Dict[str, Any]] = Field(default=[])

class ServiceMetadata(BaseModel):
    """types schema: ServiceMetadata"""
    model_config = ConfigDict(
        json_schema_extra={"required": ["name", "version", "contractVersion", "startTime"]}
    )

    name: str
    version: str
    contractVersion: str
    environment: Literal['development', 'staging', 'production'] = Field(default="development")
    startTime: datetime
    features: List[str] = Field(default=[])

class PaginatedRequest(BaseModel):
    """types schema: PaginatedRequest"""
    limit: int = Field(default=100)
    offset: int = Field(default=0)
    cursor: Optional[str] = None
    sortBy: Optional[str] = None
    sortOrder: Literal['asc', 'desc'] = Field(default="asc")

class PaginatedResponse(BaseModel):
    """types schema: PaginatedResponse"""
    model_config = ConfigDict(
        json_schema_extra={"required": ["items", "total", "limit", "offset", "hasMore"]}
    )

    items: List[Any]
    total: int
    limit: int
    offset: int
    hasMore: bool
    nextCursor: Optional[str] = None

class ApiRequest(BaseModel):
    """types schema: ApiRequest"""
    model_config = ConfigDict(
        json_schema_extra={"required": ["id", "method", "path", "body", "metadata"]}
    )

    id: str
    method: Literal['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
    path: str
    headers: Dict[str, str] = Field(default={})
    query: Dict[str, Any] = Field(default={})
    body: Any
    metadata: Dict[str, Any]

class ApiResponse(BaseModel):
    """types schema: ApiResponse"""
    model_config = ConfigDict(
        json_schema_extra={"required": ["requestId", "statusCode", "body", "metadata"]}
    )

    requestId: str
    statusCode: int
    headers: Dict[str, str] = Field(default={})
    body: Any
    error: Optional[Dict[str, Any]] = None
    metadata: Dict[str, Any]

class CapabilityRegistry(BaseModel):
    """types schema: CapabilityRegistry"""
    model_config = ConfigDict(
        json_schema_extra={"required": ["version", "generatedAt", "system", "truthcore", "runners", "connectors", "summary"]}
    )

    version: str
    generatedAt: datetime
    system: Dict[str, Any]
    truthcore: Dict[str, Any]
    runners: List[Dict[str, Any]]
    connectors: List[Dict[str, Any]]
    summary: Dict[str, Any]

class RegisteredRunner(BaseModel):
    """types schema: RegisteredRunner"""
    model_config = ConfigDict(
        json_schema_extra={"required": ["metadata", "category", "connectors", "health", "capabilities"]}
    )

    metadata: Dict[str, Any]
    category: Literal['ops', 'finops', 'support', 'growth', 'analytics', 'security', 'infrastructure', 'custom']
    connectors: List[str]
    health: Dict[str, Any]
    capabilities: List[Dict[str, Any]]

class ConnectorConfig(BaseModel):
    """types schema: ConnectorConfig"""
    model_config = ConfigDict(
        json_schema_extra={"required": ["id", "name", "type", "version", "description", "configSchema"]}
    )

    id: str
    name: str
    type: Literal['database', 'queue', 'storage', 'api', 'webhook', 'stream', 'cache', 'messaging']
    version: str
    description: str
    configSchema: Dict[str, Any]
    required: bool = Field(default=false)
    healthCheckable: bool = Field(default=true)

class ConnectorType(BaseModel):
    """types schema: ConnectorType"""
    value: Literal['database', 'queue', 'storage', 'api', 'webhook', 'stream', 'cache', 'messaging']

class ConnectorInstance(BaseModel):
    """types schema: ConnectorInstance"""
    model_config = ConfigDict(
        json_schema_extra={"required": ["config", "status"]}
    )

    config: Dict[str, Any]
    status: Literal['connected', 'disconnected', 'error', 'unknown']
    lastConnectedAt: Optional[datetime] = None
    lastErrorAt: Optional[datetime] = None
    errorMessage: Optional[str] = None
    metadata: Dict[str, Any] = Field(default={})

class RunnerCategory(BaseModel):
    """types schema: RunnerCategory"""
    value: Literal['ops', 'finops', 'support', 'growth', 'analytics', 'security', 'infrastructure', 'custom']

class RegistryQuery(BaseModel):
    """types schema: RegistryQuery"""
    category: Optional[Literal['ops', 'finops', 'support', 'growth', 'analytics', 'security', 'infrastructure', 'custom']] = None
    connectorType: Optional[Literal['database', 'queue', 'storage', 'api', 'webhook', 'stream', 'cache', 'messaging']] = None
    healthStatus: Literal['healthy', 'degraded', 'unhealthy', 'offline', 'any'] = Field(default="any")
    includeCapabilities: bool = Field(default=true)
    includeConnectors: bool = Field(default=true)

class RegistryDiff(BaseModel):
    """types schema: RegistryDiff"""
    model_config = ConfigDict(
        json_schema_extra={"required": ["added", "removed", "modified", "timestamp", "previousChecksum", "currentChecksum"]}
    )

    added: List[Dict[str, Any]]
    removed: List[Dict[str, Any]]
    modified: List[Dict[str, Any]]
    timestamp: datetime
    previousChecksum: str
    currentChecksum: str

class MarketplaceIndex(BaseModel):
    """types schema: MarketplaceIndex"""
    model_config = ConfigDict(
        json_schema_extra={"required": ["version", "generatedAt", "schema", "system", "stats", "runners", "connectors", "filters"]}
    )

    version: str
    generatedAt: datetime
    schema: Dict[str, Any]
    system: Dict[str, Any]
    stats: Dict[str, Any]
    runners: List[Dict[str, Any]]
    connectors: List[Dict[str, Any]]
    filters: Dict[str, Any]

class MarketplaceRunner(BaseModel):
    """types schema: MarketplaceRunner"""
    model_config = ConfigDict(
        json_schema_extra={"required": ["id", "metadata", "category", "description", "author", "license", "capabilities", "compatibility", "trustSignals", "publishedAt", "updatedAt"]}
    )

    id: str
    metadata: Dict[str, Any]
    category: Literal['ops', 'finops', 'support', 'growth', 'analytics', 'security', 'infrastructure', 'custom']
    description: str
    longDescription: Optional[str] = None
    author: Dict[str, Any]
    repository: Optional[Dict[str, Any]] = None
    documentation: Dict[str, Any] = Field(default={})
    license: str
    keywords: List[str] = Field(default=[])
    capabilities: List[Dict[str, Any]]
    compatibility: Dict[str, Any]
    trustSignals: Dict[str, Any]
    deprecation: Dict[str, Any] = Field(default={"isDeprecated":false})
    status: Literal['active', 'deprecated', 'pending_review', 'rejected', 'delisted'] = Field(default="active")
    publishedAt: datetime
    updatedAt: datetime
    versionHistory: List[Dict[str, Any]] = Field(default=[])
    installation: Dict[str, Any] = Field(default={})

class MarketplaceConnector(BaseModel):
    """types schema: MarketplaceConnector"""
    model_config = ConfigDict(
        json_schema_extra={"required": ["id", "config", "description", "author", "license", "inputSchema", "outputSchema", "compatibility", "trustSignals", "publishedAt", "updatedAt"]}
    )

    id: str
    config: Dict[str, Any]
    description: str
    longDescription: Optional[str] = None
    author: Dict[str, Any]
    repository: Optional[Dict[str, Any]] = None
    documentation: Dict[str, Any] = Field(default={})
    license: str
    keywords: List[str] = Field(default=[])
    inputSchema: Dict[str, Any]
    outputSchema: Dict[str, Any]
    compatibility: Dict[str, Any]
    trustSignals: Dict[str, Any]
    deprecation: Dict[str, Any] = Field(default={"isDeprecated":false})
    status: Literal['active', 'deprecated', 'pending_review', 'rejected', 'delisted'] = Field(default="active")
    publishedAt: datetime
    updatedAt: datetime
    versionHistory: List[Dict[str, Any]] = Field(default=[])
    installation: Dict[str, Any] = Field(default={})

class MarketplaceQuery(BaseModel):
    """types schema: MarketplaceQuery"""
    type: Literal['runner', 'connector', 'all'] = Field(default="all")
    category: Optional[str] = None
    connectorType: Optional[str] = None
    status: Literal['active', 'deprecated', 'pending_review', 'all'] = Field(default="active")
    trustLevel: Literal['verified', 'community', 'all'] = Field(default="all")
    search: Optional[str] = None
    compatibilityVersion: Optional[Dict[str, Any]] = None
    author: Optional[str] = None
    keywords: List[str] = Field(default=[])
    sortBy: Literal['relevance', 'name', 'published', 'updated', 'rating', 'downloads'] = Field(default="relevance")
    sortOrder: Literal['asc', 'desc'] = Field(default="desc")
    limit: float = Field(default=20)
    offset: float = Field(default=0)

class MarketplaceQueryResult(BaseModel):
    """types schema: MarketplaceQueryResult"""
    model_config = ConfigDict(
        json_schema_extra={"required": ["query", "total", "hasMore", "items", "facets"]}
    )

    query: Dict[str, Any]
    total: float
    hasMore: bool
    items: List[Union[Dict[str, Any], Dict[str, Any]]]
    facets: Dict[str, Any]

class MarketplaceTrustSignals(BaseModel):
    """types schema: MarketplaceTrustSignals"""
    model_config = ConfigDict(
        json_schema_extra={"required": ["overallTrust", "contractTestStatus", "verificationMethod", "securityScanStatus"]}
    )

    overallTrust: Literal['verified', 'pending', 'failed', 'unverified']
    contractTestStatus: Literal['passing', 'failing', 'not_tested', 'stale']
    lastContractTestAt: Optional[datetime] = None
    lastVerifiedVersion: Optional[str] = None
    verificationMethod: Literal['automated_ci', 'manual_review', 'community_verified', 'official_publisher']
    securityScanStatus: Literal['passed', 'failed', 'pending', 'not_scanned']
    lastSecurityScanAt: Optional[datetime] = None
    securityScanDetails: Dict[str, Any] = Field(default={})
    codeQualityScore: Optional[float] = None
    maintainerReputation: Literal['official', 'verified', 'community', 'unknown'] = Field(default="unknown")
    downloadCount: float = Field(default=0)
    rating: Dict[str, Any] = Field(default={})

class TrustStatus(BaseModel):
    """types schema: TrustStatus"""
    value: Literal['verified', 'pending', 'failed', 'unverified']

class SecurityScanStatus(BaseModel):
    """types schema: SecurityScanStatus"""
    value: Literal['passed', 'failed', 'pending', 'not_scanned']

class ContractTestStatus(BaseModel):
    """types schema: ContractTestStatus"""
    value: Literal['passing', 'failing', 'not_tested', 'stale']

class VerificationMethod(BaseModel):
    """types schema: VerificationMethod"""
    value: Literal['automated_ci', 'manual_review', 'community_verified', 'official_publisher']
