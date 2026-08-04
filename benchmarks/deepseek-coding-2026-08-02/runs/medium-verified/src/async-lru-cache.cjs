'use strict';

class AsyncLRUCache {
  #maxEntries;
  #ttlMs;
  #now;
  #entries = new Map();
  #pending = new Map();

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
    this.#maxEntries = maxEntries;
    this.#ttlMs = ttlMs;
    this.#now = now;
  }

  get size() {
    if (this.#ttlMs > 0) {
      const cutoff = this.#now();
      for (const [key, entry] of this.#entries) {
        if (cutoff - entry.createdAt >= this.#ttlMs) {
          this.#entries.delete(key);
        }
      }
    }
    return this.#entries.size;
  }

  getOrLoad(key, loader) {
    if (typeof key !== 'string' || key.length === 0) {
      throw new TypeError('key must be a non-empty string');
    }
    if (typeof loader !== 'function') {
      throw new TypeError('loader must be a function');
    }

    if (this.#entries.has(key)) {
      const entry = this.#entries.get(key);
      if (this.#ttlMs > 0 && this.#now() - entry.createdAt >= this.#ttlMs) {
        this.#entries.delete(key);
      } else {
        this.#entries.delete(key);
        this.#entries.set(key, entry);
        return Promise.resolve(entry.value);
      }
    }

    const pending = this.#pending.get(key);
    if (pending !== undefined) {
      return pending.promise;
    }

    let promise;
    try {
      promise = Promise.resolve(loader(key));
    } catch (error) {
      promise = Promise.reject(error);
    }

    const record = { promise };
    this.#pending.set(key, record);
    promise.then(
      (value) => this.#settle(key, record, value),
      () => this.#dropPending(key, record),
    );
    return promise;
  }

  invalidate(key) {
    const removedFulfilled = this.#entries.delete(key);
    this.#pending.delete(key);
    return removedFulfilled;
  }

  clear() {
    this.#entries.clear();
    this.#pending.clear();
  }

  #settle(key, record, value) {
    if (this.#pending.get(key) !== record) return;
    this.#pending.delete(key);
    this.#entries.set(key, { value, createdAt: this.#now() });
    while (this.#entries.size > this.#maxEntries) {
      const oldest = this.#entries.keys().next().value;
      this.#entries.delete(oldest);
    }
  }

  #dropPending(key, record) {
    if (this.#pending.get(key) === record) {
      this.#pending.delete(key);
    }
  }
}

module.exports = { AsyncLRUCache };
