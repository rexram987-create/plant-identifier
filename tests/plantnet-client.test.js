// Contract for the browser-side Pl@ntNet client.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'plantnet-client.js'), 'utf8');
assert.match(source, /fetch\(['"]\/api\/plantnet['"]/, 'posts photos only to our same-origin proxy');
assert.match(source, /window\.PlantNetAI/, 'exposes the browser identification client');
assert.doesNotMatch(source, /PLANTNET_API_KEY|api-key=/, 'never embeds the secret API key in browser code');
assert.match(source, /createImageBitmap\(file\)/, 'decodes the uploaded photo for resizing');
assert.match(source, /MAX_EDGE = 1600/, 'limits photo dimensions');
assert.match(source, /MAX_BYTES = 3 \* 1024 \* 1024/, 'limits the upload below Vercel request size cap');
assert.match(source, /canvas\.toBlob\(resolve, 'image\/jpeg', quality\)/, 'compresses photos to JPEG');
assert.match(source, /body: image/, 'uploads the prepared photo, not the original');
assert.match(source, /response\.status === 413/, 'recognizes oversized server requests');
console.log('PASS plantnet-client contract');
