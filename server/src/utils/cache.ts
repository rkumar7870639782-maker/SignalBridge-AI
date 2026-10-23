/**
 * High-Performance Thread-Safe In-Memory TTL & O(1) LRU Cache
 * 
 * Provides sub-millisecond response times for recurring incident report analyses,
 * dramatically saving API tokens, lowering server compute, and protecting against quota exhaustion.
 */

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class MemoryCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly maxEntries: number;
  private readonly defaultTtlMs: number;

  private hits = 0;
  private misses = 0;

  constructor(maxEntries: number = 200, defaultTtlMs: number = 5 * 60 * 1000) {
    this.maxEntries = maxEntries;
    this.defaultTtlMs = defaultTtlMs;
  }

  /**
   * Retrieves an entry if present and not expired.
   * Re-inserts at end of Map to maintain O(1) LRU ordering.
   */
  public get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    // Re-insert at the end of the Map so it becomes most recently used
    this.cache.delete(key);
    this.cache.set(key, entry);

    this.hits++;
    return entry.value;
  }

  /**
   * Stores a value in cache, evicting the least recently used entry (first Map key) if capacity is reached.
   */
  public set(key: string, value: T, ttlMs?: number): void {
    const expiresAt = Date.now() + (ttlMs ?? this.defaultTtlMs);

    // If already exists, delete first so new entry goes to the end
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxEntries) {
      // Evict least recently used (first item in Map iterator) in O(1) time
      const lruKey = this.cache.keys().next().value;
      if (lruKey !== undefined) {
        this.cache.delete(lruKey);
      }
    }

    this.cache.set(key, {
      value,
      expiresAt,
    });
  }

  /**
   * Clears a specific key or all entries.
   */
  public delete(key: string): boolean {
    return this.cache.delete(key);
  }

  public clear(): void {
    this.cache.clear();
  }

  public getStats(): { size: number; hits: number; misses: number; hitRatio: number } {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRatio: total > 0 ? Number((this.hits / total).toFixed(4)) : 0,
    };
  }
}

// Global singleton cache instance for report intelligence
export const reportCache = new MemoryCache<any>(250, 10 * 60 * 1000); // 10 minutes TTL
