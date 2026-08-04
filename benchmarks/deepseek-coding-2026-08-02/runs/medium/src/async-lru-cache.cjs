'use strict';

class AsyncLRUCache {
  /**
   * @param {{ maxEntries?: number, ttlMs?: number, now?: () => number }} [options]
   */
  constructor({ maxEntries = 100, ttlMs = 0, now = Date.now } = {}) {
    if (!Number.isInteger(maxEntries) || maxEntries <= 0) {
      throw new TypeError('maxEntries must be a positive integer');
    }
    if (typeof ttlMs !== 'number' || !Number.isFinite(ttlMs) || ttlMs < 0) {
      throw new TypeError('ttlMs must be a non-negative finite number');
    }
    if (typeof now !== 'function') {
      throw new TypeError('now must be a function');
    }

    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
    this._now = now;
    this._fulfilled = new Map(); // key -> { value, createdAt }
    this._pending = new Map(); // key -> { promise, generation }
    this._generation = 0; // global generation, bumped by clear()
    this._keyGenerations = new Map(); // key -> generation, bumped by invalidate()
  }

  _purgeExpired() {
    if (this.ttlMs === 0) return;
    const now = this._now();
    for (const [key, entry] of this._fulfilled) {
      if (now - entry.createdAt >= this.ttlMs) {
        this._fulfilled.delete(key);
      } else {
        // Entries are ordered by insertion/refresh, so everything after this
        // one was created no earlier and cannot be expired either.
        break;
      }
    }
  }

  get size() {
    this._purgeExpired();
    return this._fulfilled.size;
  }

  getOrLoad(key, loader) {
    if (typeof key !== 'string' || key.length === 0) {
      throw new TypeError('key must be a non-empty string');
    }
    if (typeof loader !== 'function') {
      throw new TypeError('loader must be a function');
    }

    this._purgeExpired();

    const hit = this._fulfilled.get(key);
    if (hit !== undefined) {
      // Refresh the LRU position.
      this._fulfilled.delete(key);
      this._fulfilled.set(key, hit);
      return Promise.resolve(hit.value);
    }

    const pending = this._pending.get(key);
    if (pending !== undefined) {
      return pending.promise;
    }

    // Capture the generation before invoking the loader so that a loader
    // which synchronously invalidates/clears cannot repopulate afterwards.
    const generation = this._keyGenerations.get(key) ?? this._generation;
    let promise;
    try {
      promise = Promise.resolve().then(loader);
    } catch {
      // Promise.resolve().then(loader) never throws synchronously; kept as a
      // guard so an unexpected failure still cleans up below.
    }

    const tracked = { promise, generation };
    this._pending.set(key, tracked);

    promise.then(
      (value) => {
        if (this._pending.get(key) === tracked) {
          this._pending.delete(key);
        }
        if ((this._keyGenerations.get(key) ?? this._generation) === generation) {
          this._fulfilled.set(key, { value, createdAt: this._now() });
          while (this._fulfilled.size > this.maxEntries) {
            const oldest = this._fulfilled.keys().next().value;
            this._fulfilled.delete(oldest);
          }
        }
      },
      () => {
        if (this._pending.get(key) === tracked) {
          this._pending.delete(key);
        }
      }
    );

    return promise;
  }

  invalidate(key) {
    this._purgeExpired();
    const removed = this._fulfilled.delete(key);
    this._keyGenerations.set(key, ++this._generation);
    return removed;
  }

  clear() {
    this._fulfilled.clear();
    this._generation += 1;
    this._keyGenerations.clear();
  }
}

module.exports = { AsyncLRUCache };
