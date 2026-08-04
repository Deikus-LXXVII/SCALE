const assert = require('node:assert/strict');

const run = process.env.RUN;
if (!['low', 'medium', 'high', 'medium-verified'].includes(run)) {
  throw new Error('Set RUN to low, medium, high, or medium-verified.');
}

const { AsyncLRUCache } = require(`../runs/${run}/src/async-lru-cache.cjs`);

async function main() {
  let calls = 0;
  const cache = new AsyncLRUCache({ maxEntries: 2 });
  assert.equal(await cache.getOrLoad('a', async () => ++calls), 1);
  assert.equal(await cache.getOrLoad('a', async () => ++calls), 1);
  assert.equal(calls, 1);

  let resolve;
  const pending = new Promise((r) => { resolve = r; });
  const first = cache.getOrLoad('b', () => pending);
  const second = cache.getOrLoad('b', () => { throw new Error('must coalesce'); });
  resolve('shared');
  assert.equal(await first, 'shared');
  assert.equal(await second, 'shared');

  await cache.getOrLoad('c', async () => 3);
  assert.equal(cache.size, 2);
  assert.equal(await cache.getOrLoad('a', async () => 99), 99);
  assert.equal(cache.size, 2);
  console.log(`public tests passed for ${run}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
