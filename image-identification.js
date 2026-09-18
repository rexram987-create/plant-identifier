// On-device plant identification. Prefer the larger OpenPlants ViT INT8 model
// served with this PWA; fall back to the smaller PlantNet-300K model if needed.
(() => {
  const ORT_BASE = new URL('vendor/onnxruntime-1.22.0/', document.baseURI).href;
  const ORT_URL = ORT_BASE + 'ort.min.js';
  const MODEL_CACHE = 'plant-ai-model-v3';
  const PRIMARY = {
    name: 'OpenPlants',
    modelUrl: new URL('models/openplants/model-int8.onnx?v=dynamic-v2', document.baseURI).href,
    labelsUrl: new URL('models/openplants/labels.json?v=dynamic-v2', document.baseURI).href,
    mean: [0.5, 0.5, 0.5],
    std: [0.5, 0.5, 0.5],
    resizeMode: 'stretch'
  };
  const FALLBACK = {
    name: 'PlantNet-300K',
    modelUrl: 'https://huggingface.co/cpoisson/plantnet300k-mobilenetv3-small/resolve/main/plantnet_mobilenetv3.onnx',
    labelsUrl: 'https://huggingface.co/cpoisson/plantnet300k-mobilenetv3-small/resolve/main/plantnet300K_species_id_2_name.json',
    mean: [0.485, 0.456, 0.406],
    std: [0.229, 0.224, 0.225],
    resizeMode: 'center-crop'
  };

  const MOBILE_SAFE_ENGINE = FALLBACK;

  let enginePromise;
  function status(key, name = '') {
    const code = document.documentElement.lang;
    const messages = {
      he: {prepare: 'מכין את מנוע הזיהוי {name}…', fallback: 'המנוע הראשי לא נטען. מנסה את מנוע הגיבוי…', analyse: 'מנתח את התמונה במכשיר באמצעות {name}…'},
      en: {prepare: 'Preparing the {name} identification engine…', fallback: 'The primary engine did not load. Trying the fallback…', analyse: 'Analysing the image on your device with {name}…'},
      ar: {prepare: 'جارٍ إعداد محرك التعرف {name}…', fallback: 'تعذر تحميل المحرك الأساسي. جارٍ تجربة المحرك البديل…', analyse: 'جارٍ تحليل الصورة على جهازك بواسطة {name}…'}
    };
    return (messages[code] || messages.he)[key].replace('{name}', name);
  }

  function loadScript(src) {
    if (window.ort) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.crossOrigin = 'anonymous';
      const timer = setTimeout(() => { script.remove(); reject(new Error('Runtime load timed out')); }, 60000);
      script.onload = () => { clearTimeout(timer); resolve(); };
      script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('Could not load ONNX Runtime Web')); };
      document.head.appendChild(script);
    });
  }

  async function cachedArrayBuffer(url) {
    let cache;
    try { cache = await caches.open(MODEL_CACHE); } catch (error) { console.warn('Model cache unavailable', error); }
    let response = cache ? await cache.match(url) : null;
    if (!response) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 180000);
      try {
        response = await fetch(url, {mode: 'cors', cache: 'no-store', signal: controller.signal});
        if (!response.ok) throw new Error('Download failed: ' + response.status);
        const bytes = await response.arrayBuffer();
        if (cache) {
          try { await cache.put(url, new Response(bytes, {headers: {'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream'}})); }
          catch (error) { console.warn('Model could not be saved for offline use', error); }
        }
        return bytes;
      } finally { clearTimeout(timer); }
    }
    return response.arrayBuffer();
  }

  async function loadLabels(url) {
    const buffer = await cachedArrayBuffer(url);
    const mapping = JSON.parse(new TextDecoder().decode(buffer));
    return Object.entries(mapping)
      .sort((a, b) => {
        const an = Number(a[0]), bn = Number(b[0]);
        if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
        return String(a[0]).localeCompare(String(b[0]));
      })
      .map(([, label]) => label);
  }

  async function buildEngine(definition, onStatus) {
    onStatus?.(status('prepare', definition.name));
    const [bytes, labels] = await Promise.all([
      cachedArrayBuffer(definition.modelUrl),
      loadLabels(definition.labelsUrl)
    ]);
    const session = await window.ort.InferenceSession.create(bytes, { executionProviders: ['wasm'] });
    return { ...definition, session, labels };
  }

  async function getEngine(onStatus) {
    if (!enginePromise) enginePromise = (async () => {
      await loadScript(ORT_URL);
      window.ort.env.wasm.wasmPaths = ORT_BASE;
      window.ort.env.wasm.numThreads = 1;
      const engine = await buildEngine(MOBILE_SAFE_ENGINE, onStatus);
      console.info(`Plant identifier mobile-safe engine: ${engine.name} (${engine.labels.length} labels)`);
      return engine;
    })().catch(error => {
      enginePromise = null;
      throw error;
    });
    return enginePromise;
  }

  async function imageTensor(file, engine) {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = 224;
    canvas.height = 224;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (engine.resizeMode === 'center-crop') {
      const scale = Math.max(256 / bitmap.width, 256 / bitmap.height);
      const w = bitmap.width * scale, h = bitmap.height * scale;
      const temp = document.createElement('canvas');
      temp.width = 256; temp.height = 256;
      temp.getContext('2d').drawImage(bitmap, (256 - w) / 2, (256 - h) / 2, w, h);
      ctx.drawImage(temp, 16, 16, 224, 224, 0, 0, 224, 224);
    } else {
      ctx.drawImage(bitmap, 0, 0, 224, 224);
    }
    bitmap.close?.();

    const rgba = ctx.getImageData(0, 0, 224, 224).data;
    const data = new Float32Array(3 * 224 * 224);
    const [mr, mg, mb] = engine.mean;
    const [sr, sg, sb] = engine.std;
    for (let i = 0; i < 224 * 224; i++) {
      data[i] = (rgba[i * 4] / 255 - mr) / sr;
      data[224 * 224 + i] = (rgba[i * 4 + 1] / 255 - mg) / sg;
      data[2 * 224 * 224 + i] = (rgba[i * 4 + 2] / 255 - mb) / sb;
    }
    return new window.ort.Tensor('float32', data, [1, 3, 224, 224]);
  }

  function softmaxTop(logits, labels, k = 3) {
    let max = -Infinity;
    for (const x of logits) if (x > max) max = x;
    const exps = new Float64Array(logits.length);
    let sum = 0;
    for (let i = 0; i < logits.length; i++) {
      exps[i] = Math.exp(logits[i] - max);
      sum += exps[i];
    }
    return Array.from(logits, (_, i) => ({
      index: i,
      name: labels[i] || `Class ${i}`,
      probability: exps[i] / sum
    })).sort((a, b) => b.probability - a.probability).slice(0, k);
  }

  window.PlantLocalAI = {
    async identify(file, onStatus) {
      const engine = await getEngine(onStatus);
      onStatus?.(status('analyse', engine.name));
      const tensor = await imageTensor(file, engine);
      const inputName = engine.session.inputNames[0];
      const output = await engine.session.run({ [inputName]: tensor });
      const logits = output[engine.session.outputNames[0]].data;
      const results = softmaxTop(logits, engine.labels, 3);
      results.engine = engine.name;
      results.speciesCount = engine.labels.length;
      return results;
    }
  };
})();
