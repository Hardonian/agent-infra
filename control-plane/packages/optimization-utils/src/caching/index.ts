/**
 * Caching Module - High-performance caching utilities
 */

export interface CacheEntry<T> {
  value: T;
  expiresAt?: number;
  accessedAt: number;
  accessCount: number;
}

export interface CacheConfig {
  maxSize: number;
  ttlMs?: number;
  updateAgeOnGet?: boolean;
  allowStale?: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  hitRate: number;
}

/**
 * LRU (Least Recently Used) Cache implementation
 * Optimized for high-frequency access patterns
 */
export class LRUCache<K, V> {
  private cache: Map<K, CacheEntry<V>>;
  private config: Required<CacheConfig>;
  private stats: Omit<CacheStats, 'hitRate'>;

  constructor(config: CacheConfig) {
    this.config = {
      maxSize: config.maxSize,
      ttlMs: config.ttlMs ?? 0,
      updateAgeOnGet: config.updateAgeOnGet ?? true,
      allowStale: config.allowStale ?? false,
    };
    this.cache = new Map();
    this.stats = { hits: 0, misses: 0, evictions: 0, size: 0 };
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // Check expiration
    if (this.config.ttlMs > 0 && entry.expiresAt && Date.now() > entry.expiresAt) {
      if (!this.config.allowStale) {
        this.cache.delete(key);
        this.stats.size--;
        this.stats.misses++;
        return undefined;
      }
    }

    // Update access tracking
    if (this.config.updateAgeOnGet) {
      entry.accessedAt = Date.now();
      entry.accessCount++;
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, entry);
    }

    this.stats.hits++;
    return entry.value;
  }

  set(key: K, value: V, ttlMs?: number): void {
    const effectiveTtl = ttlMs ?? this.config.ttlMs;

    // Evict oldest if at capacity
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const entry: CacheEntry<V> = {
      value,
      accessedAt: Date.now(),
      accessCount: 1,
      ...(effectiveTtl > 0 && { expiresAt: Date.now() + effectiveTtl }),
    };

    if (!this.cache.has(key)) {
      this.stats.size++;
    }

    this.cache.set(key, entry);
  }

  delete(key: K): boolean {
    const existed = this.cache.delete(key);
    if (existed) {
      this.stats.size--;
    }
    return existed;
  }

  has(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (this.config.ttlMs > 0 && entry.expiresAt && Date.now() > entry.expiresAt) {
      return this.config.allowStale;
    }

    return true;
  }

  clear(): void {
    this.cache.clear();
    this.stats.size = 0;
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.evictions = 0;
  }

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  keys(): K[] {
    return Array.from(this.cache.keys());
  }

  values(): V[] {
    return Array.from(this.cache.values()).map((e) => e.value);
  }

  private evictLRU(): void {
    const firstKey = this.cache.keys().next().value;
    if (firstKey !== undefined) {
      this.cache.delete(firstKey);
      this.stats.evictions++;
      this.stats.size--;
    }
  }
}

/**
 * TTL (Time To Live) Cache
 * Optimized for time-based expiration
 */
export class TTLCache<K, V> {
  private cache: Map<K, CacheEntry<V>>;
  private config: Required<CacheConfig>;
  private cleanupInterval: ReturnType<typeof setInterval> | null;

  constructor(config: CacheConfig) {
    this.config = {
      maxSize: config.maxSize,
      ttlMs: config.ttlMs ?? 60_000,
      updateAgeOnGet: config.updateAgeOnGet ?? false,
      allowStale: config.allowStale ?? false,
    };
    this.cache = new Map();
    this.cleanupInterval = null;
    this.startCleanup();
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);

    if (!entry) return undefined;

    // Check expiration
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      if (!this.config.allowStale) {
        this.cache.delete(key);
        return undefined;
      }
    }

    if (this.config.updateAgeOnGet) {
      entry.expiresAt = Date.now() + this.config.ttlMs;
    }

    return entry.value;
  }

  set(key: K, value: V, ttlMs?: number): void {
    const effectiveTtl = ttlMs ?? this.config.ttlMs;

    // Check capacity
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evictExpired();
      if (this.cache.size >= this.config.maxSize) {
        // Still full, remove oldest
        const firstKey = this.cache.keys().next().value;
        if (firstKey !== undefined) {
          this.cache.delete(firstKey);
        }
      }
    }

    const entry: CacheEntry<V> = {
      value,
      accessedAt: Date.now(),
      accessCount: 0,
      expiresAt: Date.now() + effectiveTtl,
    };

    this.cache.set(key, entry);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  has(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      return this.config.allowStale;
    }
    return true;
  }

  clear(): void {
    this.cache.clear();
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }

  private startCleanup(): void {
    // Run cleanup every TTL period / 2
    const interval = Math.max(1000, this.config.ttlMs / 2);
    this.cleanupInterval = setInterval(() => {
      this.evictExpired();
    }, interval);
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * Method decorator for memoization
 * Automatically caches function results
 */
export function Memoize<T>(cacheConfig: Partial<CacheConfig> = {}): MethodDecorator {
  const config: CacheConfig = {
    maxSize: cacheConfig.maxSize ?? 100,
    ttlMs: cacheConfig.ttlMs,
  };

  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;
    const cache = new LRUCache<string, T>(config);

    descriptor.value = function (...args: unknown[]): T {
      const key = JSON.stringify(args);
      const cached = cache.get(key);

      if (cached !== undefined) {
        return cached;
      }

      const result = originalMethod.apply(this, args) as T;
      cache.set(key, result);
      return result;
    };

    // Attach cache for inspection
    (descriptor.value as Record<string, unknown>).cache = cache;

    return descriptor;
  };
}
