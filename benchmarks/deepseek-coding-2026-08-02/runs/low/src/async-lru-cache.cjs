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
    // Fulfilled entries only; Map insertion order is the LRU order.
    this._entries = new Map();
    // key -> { promise, version, epoch } for in-flight loads.
    this._pending = new Map();
    // key -> per-key load generation; incremented by invalidate().
    this._keyVersion = new Map();
    // Global generation; incremented by clear().
    this._epoch = 0;
  }

  get size() {
    this._discardExpired();
    return this._entries.size;
  }

  getOrLoad(key, loader) {
    if (typeof key !== 'string' || key.length === 0) {
      throw new TypeError('key must be a non-empty string');
    }
    if (typeof loader !== 'function') {
      throw new TypeError('loader must be a function');
    }

    this._discardExpired();

    const entry = this._entries.get(key);
    if (entry !== undefined) {
      // Refresh the LRU position on a hit.
      this._entries.delete(key);
      this._entries.set(key, entry);
      return Promise.resolve(entry.value);
    }

    const pending = this._pending.get(key);
    if (pending !== undefined) {
      return pending.promise;
    }

    const epoch = this._epoch;
    const version = this._keyVersion.get(key) ?? 0;
    this._keyVersion.set(key, version);

    let pendingEntry;
    const promise = Promise.resolve()
      .then(loader)
      .then(
        (value) => {
          if (
            this._pending.get(key) === pendingEntry &&
            this._keyVersion.get(key) === version &&
            this._epoch === epoch
          ) {
            this._pending.delete(key);
            this._setFulfilled(key, value);
          }
          return value;
        },
        (error) => {
          if (this._pending.get(key) === pendingEntry) {
            this._pending.delete(key);
          }
          throw error;
        }
      );

    pendingEntry = { promise, version, epoch };
    this._pending.set(key, pendingEntry);
    return promise;
  }

  invalidate(key) {
    const nextVersion = (this._keyVersion.get(key) ?? 0) + 1;
    this._keyVersion.set(key, nextVersion);

    const entry = this._entries.get(key);
    if (entry !== undefined) {
      this._entries.delete(key);
    }
    // Also drop any in-flight load so it cannot repopulate the cache.
    this._pending.delete(key);

    return entry !== undefined;
  }

  clear() {
    this._epoch += 1;
    this._entries.clear();
    this._pending.clear();
    this._keyVersion.clear();
  }

  _setFulfilled(key, value) {
    this._discardExpired();
    this._entries.set(key, { value, createdAt: this._now() });
    while (this._entries.size > this._maxEntries) {
      const oldest = this._entries.keys().next().value;
      this._entries.delete(oldest);
    }
  }

  _discardExpired() {
    if (this._ttlMs === 0) return;
    const cutoff = this._now() - this._ttlMs;
    for (const [key, entry] of this._entries) {
      if (entry.createdAt <= cutoff) {
        this._entries.delete(key);
      }
    }
  }
}

module.exports = { AsyncLRUCache };
