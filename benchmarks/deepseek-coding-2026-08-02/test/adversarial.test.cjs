const assert = require('node:assert/strict');

const run = process.env.RUN;
if (!['low', 'medium', 'high', 'medium-verified'].includes(run)) {
  throw new Error('Set RUN to low, medium, high, or medium-verified.');
}

const { AsyncLRUCache } = require(`../runs/${run}/src/async-lru-cache.cjs`);

function within(promise, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`timed out: ${label}`)), 100)),
  ]);
}

async function main() {
  let resolveOld;
  const cache = new AsyncLRUCache();
  const old = cache.getOrLoad('key', () => new Promise((resolve) => { resolveOld = resolve; }));
  await Promise.resolve();
  assert.equal(cache.invalidate('key'), false);
  assert.equal(await within(cache.getOrLoad('key', async () => 'fresh'), 'load after invalidate'), 'fresh');
  resolveOld('stale');
  assert.equal(await old, 'stale');
  assert.equal(await cache.getOrLoad('key', async () => 'wrong'), 'fresh');
  console.log(`adversarial tests passed for ${run}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
