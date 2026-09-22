# @controlplane/optimization-utils

Frontend optimization and feature hardening utilities for ControlPlane-compatible applications.

## Features

- **Caching**: LRU and TTL cache implementations with memoization decorators
- **Hardening**: Circuit breaker, rate limiter, retry policy, and bulkhead patterns
- **Monitoring**: Performance tracking, hot path analysis, and optimization suggestions

## Installation

```bash
pnpm add @controlplane/optimization-utils
```

## Usage

### Caching

```typescript
import { LRUCache, TTLCache, Memoize } from '@controlplane/optimization-utils';

// LRU Cache
const cache = new LRUCache<string, User>({ maxSize: 1000, ttlMs: 60000 });
cache.set('user:123', user);
const user = cache.get('user:123');

// TTL Cache with automatic cleanup
const ttlCache = new TTLCache<string, Session>({ maxSize: 10000, ttlMs: 300000 });

// Memoization decorator
class UserService {
  @Memoize<User>({ maxSize: 100, ttlMs: 60000 })
  async getUser(id: string): Promise<User> {
    return fetchUserFromDatabase(id);
  }
}
```

### Hardening

```typescript
import { CircuitBreaker, RateLimiter, RetryPolicy, Bulkhead } from '@controlplane/optimization-utils';

// Circuit Breaker
const breaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeoutMs: 30000,
});

const result = await breaker.execute(async () => {
  return await callExternalService();
});

// Rate Limiter
const limiter = new RateLimiter({
  maxRequests: 100,
  windowMs: 60000,
});

const { allowed, remaining } = limiter.tryAcquire({ userId });

// Retry Policy with exponential backoff
const retry = new RetryPolicy({
  maxRetries: 3,
  baseDelayMs: 1000,
  backoffMultiplier: 2,
});

const result = await retry.execute(async () => {
  return await flakyOperation();
});

// Bulkhead (concurrency limiter)
const bulkhead = new Bulkhead({
  maxConcurrent: 10,
  maxQueue: 100,
});

const result = await bulkhead.execute(async () => {
  return await limitedResourceOperation();
});
```

### Monitoring

```typescript
import { PerformanceMonitor, HotPathTracker } from '@controlplane/optimization-utils';

// Performance monitoring
const monitor = new PerformanceMonitor();

const result = await monitor.track('database.query', async () => {
  return await db.query('SELECT * FROM users');
});

// Get performance report
const report = monitor.getReport();
console.table(report);

// Get optimization suggestions
const suggestions = monitor.getSuggestions();
for (const suggestion of suggestions) {
  console.log(`${suggestion.severity}: ${suggestion.description}`);
  console.log(`  → ${suggestion.recommendation}`);
}

// Hot path tracking
const tracker = new HotPathTracker();

const exit = tracker.enter('userController.getProfile');
try {
  await processProfile();
} finally {
  exit(); // Records duration
}

// Get hot paths
const hotPaths = tracker.getHotPaths(5);
console.table(hotPaths);
```

## API Reference

### Caching

#### LRUCache<K, V>

Least Recently Used cache with configurable size and TTL.

**Constructor options:**
- `maxSize`: Maximum number of entries
- `ttlMs`: Time to live in milliseconds (optional)
- `updateAgeOnGet`: Reset TTL on access (default: true)
- `allowStale`: Return expired entries (default: false)

#### TTLCache<K, V>

Time-based expiration cache with automatic cleanup.

**Constructor options:**
- `maxSize`: Maximum number of entries
- `ttlMs`: Time to live in milliseconds (default: 60000)

### Hardening

#### CircuitBreaker

Prevents cascading failures in distributed systems.

**Constructor options:**
- `failureThreshold`: Failures before opening (default: 5)
- `resetTimeoutMs`: Time before retry (default: 30000)
- `halfOpenMaxCalls`: Max calls in half-open state (default: 3)
- `successThreshold`: Successes to close (default: 2)

#### RateLimiter

Token bucket rate limiter with burst support.

**Constructor options:**
- `maxRequests`: Requests per window
- `windowMs`: Time window in milliseconds
- `burstSize`: Burst capacity (default: maxRequests)

#### RetryPolicy

Exponential backoff retry mechanism.

**Constructor options:**
- `maxRetries`: Maximum retry attempts (default: 3)
- `baseDelayMs`: Initial delay (default: 1000)
- `backoffMultiplier`: Delay multiplier (default: 2)

#### Bulkhead

Isolates failures by limiting concurrency.

**Constructor options:**
- `maxConcurrent`: Max concurrent operations (default: 10)
- `maxQueue`: Max queued operations (default: 100)
- `queueTimeoutMs`: Queue timeout (default: 5000)

### Monitoring

#### PerformanceMonitor

Tracks operation performance and suggests optimizations.

**Methods:**
- `track<T>(name, fn)`: Track async operation
- `trackSync<T>(name, fn)`: Track sync operation
- `getReport()`: Get performance report
- `getSuggestions()`: Get optimization suggestions

#### HotPathTracker

Identifies code paths consuming the most resources.

**Methods:**
- `enter(path)`: Start tracking a path
- `record(path, durationMs)`: Record path duration
- `getHotPaths(limit)`: Get top resource consumers
- `getPathDetails(path)`: Get detailed metrics for a path

## License

Apache-2.0
