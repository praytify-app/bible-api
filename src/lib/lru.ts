interface Entry<V> {
  value: V;
  size: number;
  expiresAt: number;
}

/**
 * LRU bounded by total bytes (not entry count), with per-entry TTL.
 * Map iteration order is insertion order, so re-inserting on read keeps the
 * least recently used entry at the front for cheap eviction.
 */
export class LruCache<V> {
  private map = new Map<string, Entry<V>>();
  private bytes = 0;

  constructor(
    private readonly maxBytes: number,
    private readonly sizeOf: (value: V) => number
  ) {}

  get(key: string, now = Date.now()): V | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt <= now) {
      this.delete(key);
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, hit);
    return hit.value;
  }

  set(key: string, value: V, ttlMs: number, now = Date.now()): boolean {
    const size = this.sizeOf(value);
    if (size > this.maxBytes || ttlMs <= 0) return false;
    this.delete(key);
    this.map.set(key, { value, size, expiresAt: now + ttlMs });
    this.bytes += size;
    while (this.bytes > this.maxBytes) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.delete(oldest);
    }
    return true;
  }

  delete(key: string): void {
    const hit = this.map.get(key);
    if (!hit) return;
    this.map.delete(key);
    this.bytes -= hit.size;
  }

  /** Remove every entry whose value matches. Used for targeted invalidation. */
  deleteWhere(predicate: (value: V, key: string) => boolean): number {
    let n = 0;
    for (const [k, e] of this.map) {
      if (predicate(e.value, k)) {
        this.delete(k);
        n++;
      }
    }
    return n;
  }

  clear(): void {
    this.map.clear();
    this.bytes = 0;
  }

  get size(): number {
    return this.map.size;
  }

  get totalBytes(): number {
    return this.bytes;
  }
}
