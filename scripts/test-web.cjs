const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const files = Object.fromEntries(["app.js","translations-extra.js","image-identification.js","inaturalist.js","wikipedia.js","local-name-search.js","install.js","sw.js","index.html","mobile-fix.css"].map(p => [p, fs.readFileSync(path.join(root,p), 'utf8')]));

async function runChecks(files) {
  let checks = 0;
  const assert = (condition, message) => { if (!condition) throw new Error(message); checks++; };
  for (const [path, content] of Object.entries(files)) {
    if (path.endsWith('.js')) { new Function(content); checks++; }
  }
  function element() {
    return {dataset: {}, value: '', innerHTML: '', textContent: '', hidden: true, disabled: false,
      handlers: {}, attributes: {}, setAttribute(k,v) { this.attributes[k] = v; },
      addEventListener(k,fn) { this.handlers[k] = fn; },
      querySelectorAll() { return []; }, scrollIntoView() {}};
  }
  const nodes = {};
  const get = id => nodes[id] || (nodes[id] = element());
  const root = element();
  const document = {documentElement: root, getElementById: get, querySelector: () => get('submit'),
    querySelectorAll: () => [], addEventListener() {}};
  const window = {matchMedia: () => ({matches: false}), PlantNameSearch: {detectLanguage: () => null}};
  new Function('window', files['translations-extra.js'])(window);
  let responseData = {results: []};
  const fetch = async () => ({ok: true, json: async () => responseData});
  const storage = {getItem: () => null, setItem() {}};
  class AbortController { constructor() { this.signal = {}; } abort() {} }
  const silentConsole = {error() {}, warn() {}, info() {}};
  const fakeURL = class { constructor(path, base) { this.href = (base || '') + path; } static createObjectURL() { return 'blob:test'; } static revokeObjectURL() {} };
  const exports = '\nreturn {searchGbif, renderPhoto, applyLanguage, setView(value) { view = value; }, translations, async geography(top, counts) { getLocation = async () => ({lat: 1, lng: 1}); nearbyCount = async name => counts[name]; return rerankByGeography(top); }, identifyPhoto, isBusy() { return photoBusy; }};';
  const app = new Function('window','document','navigator','localStorage','fetch','AbortController','setTimeout','clearTimeout','console','URL',
    files['app.js'] + exports)(window,document,{onLine:true},storage,fetch,AbortController,() => 1,() => {},silentConsole,fakeURL);
  responseData = {results: [{kingdom:'Animalia',canonicalName:'Panthera leo'}]};
  assert((await app.searchGbif('lion')).length === 0, 'Non-plant fallback must be removed');
  responseData = {results: [{kingdom:'Plantae',canonicalName:'Mentha'}, {kingdomKey:6,canonicalName:'Mentha'}, {kingdomKey:6,canonicalName:'Petunia'}]};
  assert((await app.searchGbif('plants')).length === 2, 'Plant results must be deduplicated');
  for (const code of ['he','en','ar']) {
    const keys = Array.from(files['index.html'].matchAll(/data-i18n(?:-aria|-placeholder)?="([^"]+)"/g), m => m[1]);
    for (const key of keys) assert(!!app.translations[code][key], code + ' missing translation: ' + key);
  }
  const photo = {type:'photo',engine:'PlantNet-300K',geo:{items:[{name:'Mentha',probability:0.12}],used:false},pending:false};
  app.setView(photo);
  get('languageSelect').value = 'en';
  app.applyLanguage('en');
  assert(get('result').innerHTML.includes('12.0%'), 'Original model score must be retained');
  assert(get('result').innerHTML.includes('PlantNet-300K'), 'Actual fallback engine must be displayed');
  assert(get('result').innerHTML.includes('data-ai-search'), 'Language changes must retain the photo view');
  app.setView({type:'names',query:'nothing',items:[]});
  get('languageSelect').value = 'ar';
  app.applyLanguage('ar');
  assert(get('result').innerHTML.includes(app.translations.ar.noResults), 'Empty results must translate too');
  const top = [{name:'A',probability:.10},{name:'B',probability:.09},{name:'C',probability:.08}];
  const geo = await app.geography(top,{A:0,B:100,C:0});
  assert(geo.items[0].name === 'B', 'Geographic support should still influence ordering');
  assert(geo.items[0].probability === .09 && !('adjustedProbability' in geo.items[0]), 'Geography must not inflate model probabilities');
  const partial = await app.geography(top,{A:null,B:100,C:0});
  assert(partial.items[0].name === 'A' && partial.incomplete, 'Incomplete observations must not reorder candidates');
  let inferCalls = 0;
  window.PlantLocalAI = {identify: async () => { inferCalls++; throw new Error('download failed'); }};
  await app.identifyPhoto({name:'a.jpg'});
  await app.identifyPhoto({name:'a.jpg'});
  assert(inferCalls === 2 && !app.isBusy() && !get('plantPhoto').disabled, 'Image controls must recover after failure');
  get('themeToggle').handlers.click();
  assert(get('themeToggle').attributes['aria-pressed'] === 'false', 'Theme accessibility state must change');
  const css = files['mobile-fix.css'];
  assert(!/:root,\s*:root\[data-large-text="true"\]/.test(css), 'Mobile CSS must not force both sizes equal');
  assert((css.match(/data-large-text="true"\] \{ font-size: 22px;/g) || []).length === 2, 'Large text must survive both mobile breakpoints');
  const swSelf = {addEventListener() {}};
  const assets = new Function('self', files['sw.js'] + '\nreturn OFFLINE_ASSETS;')(swSelf);
  for (const m of files['index.html'].matchAll(/<script src="([^"]+)"/g)) {
    assert(assets.includes('./' + m[1]), 'Script missing from precache: ' + m[1]);
  }
  assert(assets.some(x => x.endsWith('.wasm')) && assets.some(x => x.endsWith('.mjs')), 'Runtime dependencies must be precached');
  assert(files['install.js'].includes("serviceWorker.register('./sw.js'"), 'PWA must register its service worker');
  assert(!files['local-name-search.js'].includes('window.fetch ='), 'Name search must not override global fetch');
  assert(!files['inaturalist.js'].includes("return exact || rows[0]"), 'Comparison must reject unrelated taxa');
  let attempts = 0;
  const aiWindow = {ort:{env:{wasm:{}}}};
  const aiDocument = {baseURI:'https://example.test/',documentElement:{lang:'en'}};
  const failingFetch = async () => { attempts++; throw new Error('network unavailable'); };
  const cacheMock = {open:async () => ({match:async () => null})};
  const engineSource = files['image-identification.js'].replace('  window.PlantLocalAI = {','  window.testGetEngine = getEngine;\n  window.PlantLocalAI = {');
  new Function('window','document','URL','caches','fetch','AbortController','setTimeout','clearTimeout','console',engineSource)(
    aiWindow,aiDocument,fakeURL,cacheMock,failingFetch,AbortController,() => 1,() => {},silentConsole);
  for (let i=0;i<2;i++) { try { await aiWindow.testGetEngine(); } catch {} }
  assert(attempts === 8, 'Both engines must be retried after failed loading');
  return checks;
}

runChecks(files).then(count => console.log(count + ' regression checks passed')).catch(error => { console.error(error); process.exitCode = 1; });
