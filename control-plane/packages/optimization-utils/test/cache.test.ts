import { describe, expect, it } from 'vitest';
import { LRUCache } from '../src/caching/index.js';

describe('LRUCache', () => {
  it('evicts the least recently used entry at capacity', () => {
    const cache = new LRUCache<string, number>({ maxSize: 2 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a');
    cache.set('c', 3);

    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
    expect(cache.has('c')).toBe(true);
  });
});
