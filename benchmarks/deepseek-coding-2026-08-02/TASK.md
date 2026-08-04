# Async LRU cache benchmark

Implement `AsyncLRUCache` in your assigned `runs/<reasoning>/src/async-lru-cache.cjs`.

## Public contract

- Export `AsyncLRUCache` with CommonJS.
- Constructor: `new AsyncLRUCache({ maxEntries = 100, ttlMs = 0, now = Date.now } = {})`.
- Throw `TypeError` when `maxEntries` is not a positive integer, `ttlMs` is negative or non-finite, or `now` is not a function.
- `getOrLoad(key, loader)` requires a non-empty string key and a function loader; otherwise throw `TypeError`.
- A fulfilled load is cached, including a fulfilled value of `undefined`.
- Concurrent calls for the same uncached key share one in-flight loader invocation and resolve to the same result.
- Rejections are never cached. A later call must run its loader again.
- `ttlMs = 0` means no expiration. Otherwise entries expire when `now() - createdAt >= ttlMs`.
- A cache hit refreshes the LRU position. On insertion, evict the least-recently-used fulfilled entry until `size <= maxEntries`.
- Pending loads do not count toward `size` and must not be evicted before they settle.
- `invalidate(key)` removes a fulfilled entry and prevents an older in-flight load for that key from repopulating the cache. It returns `true` only when it removed a fulfilled entry.
- `clear()` removes fulfilled entries and prevents all already-started loads from repopulating the cache.
- `size` reports the count of unexpired fulfilled entries. Reading it should lazily discard expired entries.

Do not add dependencies or modify files outside your assigned run. Run the public test with:

```bash
RUN=<reasoning> node test/public.test.cjs
```

The final evaluator includes additional hidden edge-case tests.
