// Contract for the browser-side Pl@ntNet client.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'plantnet-client.js'), 'utf8');
assert.match(source, /fetch\(['"]\/api\/plantnet['"]/, 'posts photos only to our same-origin proxy');
assert.match(source, /window\.PlantNetAI/, 'exposes the browser identification client');
assert.doesNotMatch(source, /PLANTNET_API_KEY|api-key=/, 'never embeds the secret API key in browser code');
console.log('PASS plantnet-client contract');
