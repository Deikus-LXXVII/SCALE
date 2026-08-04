class AsyncLRUCache {
  constructor({ maxEntries = 100, ttlMs = 0, now = Date.now } = {}) {
    if (!Number.isInteger(maxEntries) || maxEntries <= 0) {
      throw new TypeError('maxEntries must be a positive integer');
    }
    if (typeof now !== 'function') {
      throw new TypeError('now must be a function');
    }
    if (typeof ttlMs !== 'number' || !Number.isFinite(ttlMs) || ttlMs < 0) {
      throw new TypeError('ttlMs must be a non-negative finite number');
    }

    this._maxEntries = maxEntries;
    this._ttlMs = ttlMs;
    this._now = now;
    this._entries = new Map(); // key -> { value, createdAt } in LRU order
    this._pending = new Map(); // key -> { promise } for in-flight loads
    this._blocked = new WeakSet(); // settled loads that must not repopulate
  }

  _isExpired(entry) {
    return this._ttlMs > 0 && this._now() - entry.createdAt >= this._ttlMs;
  }

  _evictExpired() {
    for (const [key, entry] of this._entries) {
      if (this._isExpired(entry)) {
        this._entries.delete(key);
      }
    }
  }

  _evictToMax() {
    for (const key of this._entries.keys()) {
      if (this._entries.size <= this._maxEntries) break;
      this._entries.delete(key);
    }
  }

  get size() {
    this._evictExpired();
    return this._entries.size;
  }

  getOrLoad(key, loader) {
    if (typeof key !== 'string' || key.length === 0) {
      throw new TypeError('key must be a non-empty string');
    }
    if (typeof loader !== 'function') {
      throw new TypeError('loader must be a function');
    }

    this._evictExpired();

    const pending = this._pending.get(key);
    if (pending) {
      return pending.promise;
    }

    const entry = this._entries.get(key);
    if (entry) {
      // Refresh LRU position.
      this._entries.delete(key);
      this._entries.set(key, entry);
      return Promise.resolve(entry.value);
    }

    const record = {};
    const promise = Promise.resolve()
      .then(() => loader(key))
      .then(
        (value) => {
          if (this._pending.get(key) === record) {
            this._pending.delete(key);
          }
          if (!this._blocked.has(record)) {
            this._evictExpired();
            this._entries.delete(key);
            this._entries.set(key, { value, createdAt: this._now() });
            this._evictToMax();
          }
          return value;
        },
        (error) => {
          if (this._pending.get(key) === record) {
            this._pending.delete(key);
          }
          throw error;
        }
      );
    record.promise = promise;
    this._pending.set(key, record);
    return promise;
  }

  invalidate(key) {
    const removed = this._entries.has(key);
    if (removed) {
      this._entries.delete(key);
    }
    const pending = this._pending.get(key);
    if (pending) {
      this._pending.delete(key);
      this._blocked.add(pending);
    }
    return removed;
  }

  clear() {
    this._entries.clear();
    for (const record of this._pending.values()) {
      this._blocked.add(record);
    }
    this._pending.clear();
  }
}

module.exports = { AsyncLRUCache };
