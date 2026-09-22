/**
 * Optimization Utils - Main Entry Point
 *
 * Provides frontend optimization and feature hardening utilities
 * for ControlPlane-compatible applications.
 */

// Caching utilities
export {
  LRUCache,
  TTLCache,
  Memoize,
  type CacheConfig,
  type CacheEntry,
  type CacheStats,
} from './caching/index.js';

// Feature hardening utilities
export {
  CircuitBreaker,
  RateLimiter,
  RetryPolicy,
  Bulkhead,
  WebhookSecurity,
  webhookSecurityMiddleware,
  createWebhookHandler,
  createWebhookSignature,
  type WebhookSecurityConfig,
  type SignatureVerificationResult,
  type IdempotencyRecord,
  type WebhookContext,
  type CircuitBreakerConfig,
  type RateLimitConfig,
  type RetryConfig,
  type BulkheadConfig,
} from './hardening/index.js';

// Performance monitoring
export {
  PerformanceMonitor,
  HotPathTracker,
  type PerformanceMetrics,
  type HotPathReport,
  type OptimizationSuggestion,
} from './monitoring/index.js';

// Version
export const VERSION = '1.0.0';
