// Auto-generated TypeScript types from ControlPlane contracts
// DO NOT EDIT MANUALLY - regenerate from source

import { z } from 'zod';
import * as schemas from './schemas.js';

// ERRORS types

/**
 * @category errors
 */
export type ErrorSeverity = z.infer<typeof schemas.ErrorSeveritySchema>;

/**
 * @category errors
 */
export type ErrorCategory = z.infer<typeof schemas.ErrorCategorySchema>;

/**
 * @category errors
 */
export type RetryPolicy = z.infer<typeof schemas.RetryPolicySchema>;

/**
 * @category errors
 */
export type ErrorDetail = z.infer<typeof schemas.ErrorDetailSchema>;

/**
 * @category errors
 */
export type ErrorEnvelope = z.infer<typeof schemas.ErrorEnvelopeSchema>;

// VERSIONING types

/**
 * @category versioning
 */
export type ContractVersion = z.infer<typeof schemas.ContractVersionSchema>;

/**
 * @category versioning
 */
export type ContractRange = z.infer<typeof schemas.ContractRangeSchema>;

// TYPES types

/**
 * @category types
 */
export type JobId = z.infer<typeof schemas.JobIdSchema>;

/**
 * @category types
 */
export type JobStatus = z.infer<typeof schemas.JobStatusSchema>;

/**
 * @category types
 */
export type JobPriority = z.infer<typeof schemas.JobPrioritySchema>;

/**
 * @category types
 */
export type JobMetadata = z.infer<typeof schemas.JobMetadataSchema>;

/**
 * @category types
 */
export type JobPayload = z.infer<typeof schemas.JobPayloadSchema>;

/**
 * @category types
 */
export type JobRequest = z.infer<typeof schemas.JobRequestSchema>;

/**
 * @category types
 */
export type JobResult = z.infer<typeof schemas.JobResultSchema>;

/**
 * @category types
 */
export type JobResponse = z.infer<typeof schemas.JobResponseSchema>;

/**
 * @category types
 */
export type RunnerCapability = z.infer<typeof schemas.RunnerCapabilitySchema>;

/**
 * @category types
 */
export type RunnerMetadata = z.infer<typeof schemas.RunnerMetadataSchema>;

/**
 * @category types
 */
export type RunnerRegistrationRequest = z.infer<typeof schemas.RunnerRegistrationRequestSchema>;

/**
 * @category types
 */
export type RunnerRegistrationResponse = z.infer<typeof schemas.RunnerRegistrationResponseSchema>;

/**
 * @category types
 */
export type RunnerHeartbeat = z.infer<typeof schemas.RunnerHeartbeatSchema>;

/**
 * @category types
 */
export type ModuleManifest = z.infer<typeof schemas.ModuleManifestSchema>;

/**
 * @category types
 */
export type RunnerExecutionRequest = z.infer<typeof schemas.RunnerExecutionRequestSchema>;

/**
 * @category types
 */
export type RunnerExecutionResponse = z.infer<typeof schemas.RunnerExecutionResponseSchema>;

/**
 * @category types
 */
export type TruthAssertion = z.infer<typeof schemas.TruthAssertionSchema>;

/**
 * @category types
 */
export type TruthQuery = z.infer<typeof schemas.TruthQuerySchema>;

/**
 * @category types
 */
export type TruthQueryResult = z.infer<typeof schemas.TruthQueryResultSchema>;

/**
 * @category types
 */
export type TruthSubscription = z.infer<typeof schemas.TruthSubscriptionSchema>;

/**
 * @category types
 */
export type TruthCoreRequest = z.infer<typeof schemas.TruthCoreRequestSchema>;

/**
 * @category types
 */
export type TruthCoreResponse = z.infer<typeof schemas.TruthCoreResponseSchema>;

/**
 * @category types
 */
export type ConsistencyLevel = z.infer<typeof schemas.ConsistencyLevelSchema>;

/**
 * @category types
 */
export type TruthValue = z.infer<typeof schemas.TruthValueSchema>;

/**
 * @category types
 */
export type HealthStatus = z.infer<typeof schemas.HealthStatusSchema>;

/**
 * @category types
 */
export type HealthCheck = z.infer<typeof schemas.HealthCheckSchema>;

/**
 * @category types
 */
export type ServiceMetadata = z.infer<typeof schemas.ServiceMetadataSchema>;

/**
 * @category types
 */
export type PaginatedRequest = z.infer<typeof schemas.PaginatedRequestSchema>;

/**
 * @category types
 */
export type PaginatedResponse = z.infer<typeof schemas.PaginatedResponseSchema>;

/**
 * @category types
 */
export type ApiRequest = z.infer<typeof schemas.ApiRequestSchema>;

/**
 * @category types
 */
export type ApiResponse = z.infer<typeof schemas.ApiResponseSchema>;

/**
 * @category types
 */
export type CapabilityRegistry = z.infer<typeof schemas.CapabilityRegistrySchema>;

/**
 * @category types
 */
export type RegisteredRunner = z.infer<typeof schemas.RegisteredRunnerSchema>;

/**
 * @category types
 */
export type ConnectorConfig = z.infer<typeof schemas.ConnectorConfigSchema>;

/**
 * @category types
 */
export type ConnectorType = z.infer<typeof schemas.ConnectorTypeSchema>;

/**
 * @category types
 */
export type ConnectorInstance = z.infer<typeof schemas.ConnectorInstanceSchema>;

/**
 * @category types
 */
export type RunnerCategory = z.infer<typeof schemas.RunnerCategorySchema>;

/**
 * @category types
 */
export type RegistryQuery = z.infer<typeof schemas.RegistryQuerySchema>;

/**
 * @category types
 */
export type RegistryDiff = z.infer<typeof schemas.RegistryDiffSchema>;

/**
 * @category types
 */
export type MarketplaceIndex = z.infer<typeof schemas.MarketplaceIndexSchema>;

/**
 * @category types
 */
export type MarketplaceRunner = z.infer<typeof schemas.MarketplaceRunnerSchema>;

/**
 * @category types
 */
export type MarketplaceConnector = z.infer<typeof schemas.MarketplaceConnectorSchema>;

/**
 * @category types
 */
export type MarketplaceQuery = z.infer<typeof schemas.MarketplaceQuerySchema>;

/**
 * @category types
 */
export type MarketplaceQueryResult = z.infer<typeof schemas.MarketplaceQueryResultSchema>;

/**
 * @category types
 */
export type MarketplaceTrustSignals = z.infer<typeof schemas.MarketplaceTrustSignalsSchema>;

/**
 * @category types
 */
export type TrustStatus = z.infer<typeof schemas.TrustStatusSchema>;

/**
 * @category types
 */
export type SecurityScanStatus = z.infer<typeof schemas.SecurityScanStatusSchema>;

/**
 * @category types
 */
export type ContractTestStatus = z.infer<typeof schemas.ContractTestStatusSchema>;

/**
 * @category types
 */
export type VerificationMethod = z.infer<typeof schemas.VerificationMethodSchema>;
