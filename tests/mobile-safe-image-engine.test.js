const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'image-identification.js'), 'utf8');

assert.match(source, /const MOBILE_SAFE_ENGINE = FALLBACK/, 'mobile-safe diagnostic uses the smaller fallback model');
assert.match(source, /buildEngine\(MOBILE_SAFE_ENGINE, onStatus\)/, 'engine loader starts directly with the mobile-safe model');
assert.doesNotMatch(source, /buildEngine\(PRIMARY, onStatus\)/, 'diagnostic path must not instantiate the heavy OpenPlants model');

console.log('PASS mobile-safe local engine contract');
