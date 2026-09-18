// Contract tests for the Pl@ntNet server-side proxy.
// These are intentionally dependency-free so they can run with: node tests/plantnet-api.test.js
const assert = require('node:assert/strict');

(async () => {
  const api = require('../api/plantnet.js');

  assert.equal(typeof api._test?.buildPlantNetUrl, 'function', 'exports URL builder for tests');
  const url = api._test.buildPlantNetUrl('secret-test-key');
  assert.equal(url.origin, 'https://my-api.plantnet.org');
  assert.equal(url.pathname, '/v2/identify/all');
  assert.equal(url.searchParams.get('api-key'), 'secret-test-key');
  assert.equal(url.searchParams.get('nb-results'), '3');

  assert.equal(typeof api._test?.readRequestBody, 'function', 'exports raw request reader for tests');
  const chunks = [Buffer.from([1, 2]), Buffer.from([3, 4])];
  const rawReq = {async *[Symbol.asyncIterator]() { for (const chunk of chunks) yield chunk; }};
  assert.deepEqual(await api._test.readRequestBody(rawReq), Buffer.from([1, 2, 3, 4]));

  assert.equal(typeof api._test?.normaliseResults, 'function', 'exports result normaliser for tests');
  const results = api._test.normaliseResults({results: [{score: 0.91, species: {scientificNameWithoutAuthor: 'Nerium oleander', commonNames: ['Oleander']}}]});
  assert.deepEqual(results, [{scientificName: 'Nerium oleander', commonNames: ['Oleander'], score: 0.91}]);

  console.log('PASS plantnet-api contract');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
