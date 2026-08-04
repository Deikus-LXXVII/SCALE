const assert = require('node:assert/strict');

const run = process.env.RUN;
if (!['low', 'medium', 'high', 'medium-verified'].includes(run)) {
  throw new Error('Set RUN to low, medium, high, or medium-verified.');
}

const { AsyncLRUCache } = require(`../runs/${run}/src/async-lru-cache.cjs`);

async function expectTypeError(fn) {
  await assert.rejects(async () => fn(), TypeError);
}

function within(promise, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`timed out: ${label}`)), 100)),
  ]);
}

async function main() {
  assert.throws(() => new AsyncLRUCache({ maxEntries: 0 }), TypeError);
  assert.throws(() => new AsyncLRUCache({ ttlMs: -1 }), TypeError);
  assert.throws(() => new AsyncLRUCache({ ttlMs: Infinity }), TypeError);
  assert.throws(() => new AsyncLRUCache({ now: 1 }), TypeError);
  const contractCache = new AsyncLRUCache();
  await expectTypeError(() => contractCache.getOrLoad('', async () => 1));
  await expectTypeError(() => contractCache.getOrLoad('key', null));

  let undefinedCalls = 0;
  const undefinedCache = new AsyncLRUCache();
  assert.equal(await undefinedCache.getOrLoad('u', async () => { undefinedCalls += 1; }), undefined);
  assert.equal(await undefinedCache.getOrLoad('u', async () => { undefinedCalls += 1; return 'wrong'; }), undefined);
  assert.equal(undefinedCalls, 1);

  let rejectedCalls = 0;
  const rejectedCache = new AsyncLRUCache();
  await assert.rejects(() => rejectedCache.getOrLoad('r', async () => { rejectedCalls += 1; throw new Error('first'); }), /first/);
  assert.equal(await rejectedCache.getOrLoad('r', async () => { rejectedCalls += 1; return 'second'; }), 'second');
  assert.equal(rejectedCalls, 2);

  let clock = 100;
  let ttlCalls = 0;
  const ttlCache = new AsyncLRUCache({ ttlMs: 10, now: () => clock });
  assert.equal(await ttlCache.getOrLoad('ttl', async () => ++ttlCalls), 1);
  clock = 109;
  assert.equal(await ttlCache.getOrLoad('ttl', async () => ++ttlCalls), 1);
  clock = 110;
  assert.equal(await ttlCache.getOrLoad('ttl', async () => ++ttlCalls), 2);
  assert.equal(ttlCache.size, 1);

  let lruClock = 0;
  const staleLruCache = new AsyncLRUCache({ ttlMs: 10, now: () => lruClock });
  await staleLruCache.getOrLoad('old', async () => 'old');
  lruClock = 5;
  await staleLruCache.getOrLoad('new', async () => 'new');
  assert.equal(await staleLruCache.getOrLoad('old', async () => 'wrong'), 'old');
  lruClock = 11;
  assert.equal(staleLruCache.size, 1);

  const lruCache = new AsyncLRUCache({ maxEntries: 2 });
  await lruCache.getOrLoad('a', async () => 'a');
  await lruCache.getOrLoad('b', async () => 'b');
  assert.equal(await lruCache.getOrLoad('a', async () => 'wrong'), 'a');
  await lruCache.getOrLoad('c', async () => 'c');
  assert.equal(await lruCache.getOrLoad('b', async () => 'b2'), 'b2');

  let concurrentCalls = 0;
  let resolveConcurrent;
  const concurrentCache = new AsyncLRUCache();
  const gate = new Promise((resolve) => { resolveConcurrent = resolve; });
  const one = concurrentCache.getOrLoad('same', async () => { concurrentCalls += 1; return gate; });
  const two = concurrentCache.getOrLoad('same', async () => { concurrentCalls += 1; return 'wrong'; });
  resolveConcurrent('joined');
  assert.deepEqual(await Promise.all([one, two]), ['joined', 'joined']);
  assert.equal(concurrentCalls, 1);

  let resolveOld;
  const invalidationCache = new AsyncLRUCache();
  const old = invalidationCache.getOrLoad('x', () => new Promise((resolve) => { resolveOld = resolve; }));
  await Promise.resolve();
  assert.equal(invalidationCache.invalidate('x'), false);
  assert.equal(await within(invalidationCache.getOrLoad('x', async () => 'new'), 'load after invalidate'), 'new');
  resolveOld('old');
  assert.equal(await old, 'old');
  assert.equal(await invalidationCache.getOrLoad('x', async () => 'wrong'), 'new');

  let resolveCleared;
  const clearCache = new AsyncLRUCache();
  const cleared = clearCache.getOrLoad('x', () => new Promise((resolve) => { resolveCleared = resolve; }));
  await Promise.resolve();
  clearCache.clear();
  resolveCleared('old');
  assert.equal(await cleared, 'old');
  assert.equal(clearCache.size, 0);
  assert.equal(await clearCache.getOrLoad('x', async () => 'fresh'), 'fresh');

  console.log(`hidden tests passed for ${run}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
