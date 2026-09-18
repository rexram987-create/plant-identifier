const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

assert.match(source, /window\.PlantNetAI\.identify\(file\)/, 'photo identification also calls the PlantNet browser client');
assert.match(source, /plantnetResults/, 'photo state keeps PlantNet results separate from local results');
assert.match(source, /Pl@ntNet/, 'renders a clearly labelled PlantNet result section');
assert.match(source, /catch\([^)]*\)\s*=>\s*\[\]/, 'PlantNet failure falls back without breaking local identification');


console.log('PASS PlantNet app integration contract');
