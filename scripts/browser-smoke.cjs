const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..', '_site');
const types = {'.html':'text/html', '.js':'application/javascript', '.mjs':'application/javascript', '.wasm':'application/wasm', '.json':'application/json', '.webmanifest':'application/manifest+json', '.css':'text/css', '.png':'image/png'};
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (!pathname.startsWith('/plant-identifier/')) { res.writeHead(404).end(); return; }
  const relative = decodeURIComponent(pathname.slice('/plant-identifier/'.length)) || 'index.html';
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) { res.writeHead(404).end(); return; }
    res.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream'});
    fs.createReadStream(file).pipe(res);
  });
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({headless:true});
  try {
    const context = await browser.newContext({viewport:{width:390,height:844}});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const url = 'http://127.0.0.1:' + server.address().port + '/plant-identifier/';
    await page.goto(url);
    const initialSize = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
    await page.locator('#fontToggle').click();
    const largeSize = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
    assert(largeSize > initialSize, 'Mobile large-text button must increase font size');
    await page.locator('#languageSelect').selectOption('en');
    await page.locator('[data-i18n="balconyTitle"]').getByText('Common balcony plants in Israel').waitFor();
    assert.equal(await page.locator('[data-photo-input="cameraPhoto"]').textContent(), 'Take a photo');
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    // Exercise the real local ONNX runtime and deployed model, without testing botanical accuracy.
    await page.evaluate(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 224;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#397a45';
      ctx.fillRect(0,0,224,224);
      window.testPhoto = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    });
    const online = await page.evaluate(async () => {
      const rows = await window.PlantLocalAI.identify(window.testPhoto);
      return {engine:rows.engine,count:rows.length,finite:rows.every(r => Number.isFinite(r.probability))};
    });
    assert.equal(online.engine, 'OpenPlants');
    assert.equal(online.count, 3);
    assert(online.finite);
    await context.setOffline(true);
    await page.reload();
    await page.locator('#languageSelect').selectOption('ar');
    assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
    const offline = await page.evaluate(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 224;
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const rows = await window.PlantLocalAI.identify(blob);
      return rows.engine;
    });
    assert.equal(offline, 'OpenPlants', 'Offline reload must retain the runtime and model');
    assert.deepEqual(errors, [], 'No uncaught browser errors');
    console.log('Browser checks passed: mobile text, translation, service worker, real ONNX inference, offline reload and inference.');
    await context.close();
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
