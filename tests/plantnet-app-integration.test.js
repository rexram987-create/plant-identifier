const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

assert.match(source, /window\.PlantNetAI\.identify\(file\)/, 'photo path must call PlantNet identification');
assert.match(source, /plantnetResults/, 'photo state keeps PlantNet results separate from local results');
assert.match(source, /Pl@ntNet/, 'renders a clearly labelled PlantNet result section');


console.log('PASS PlantNet app integration contract');

assert.doesNotMatch(source, /window\.PlantLocalAI\.identify\(file/, 'mobile-safe PlantNet flow must not invoke local ONNX inference');
assert.match(source, /URL\.createObjectURL\(file\)/, 'PlantNet flow previews the selected photo');
