// On-device plant identification. Prefer the larger OpenPlants ViT INT8 model
// served with this PWA; fall back to the smaller PlantNet-300K model if needed.
(() => {
  const ORT_URL = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/ort.min.js';
  const MODEL_CACHE = 'plant-ai-model-v2';
  const PRIMARY = {
    name: 'OpenPlants',
    modelUrl: new URL('models/openplants/model-int8.onnx', document.baseURI).href,
    labelsUrl: new URL('models/openplants/labels.json', document.baseURI).href,
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

  let enginePromise;

  function loadScript(src) {
    if (window.ort) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.crossOrigin = 'anonymous';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Could not load ONNX Runtime Web'));
      document.head.appendChild(script);
    });
  }

  async function cachedArrayBuffer(url) {
    const cache = await caches.open(MODEL_CACHE);
    let response = await cache.match(url);
    if (!response) {
      response = await fetch(url, { mode: 'cors' });
      if (!response.ok) throw new Error(`Download failed: ${response.status}`);
      await cache.put(url, response.clone());
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
    onStatus?.(`מוריד ומכין את מנוע ${definition.name} בפעם הראשונה…`);
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
      try {
        const engine = await buildEngine(PRIMARY, onStatus);
        console.info(`Plant identifier using ${engine.name} (${engine.labels.length} labels)`);
        return engine;
      } catch (primaryError) {
        console.warn('OpenPlants could not be loaded; using PlantNet fallback.', primaryError);
        onStatus?.('המנוע הרחב לא נטען. עובר למנוע הגיבוי…');
        const engine = await buildEngine(FALLBACK, onStatus);
        console.info(`Plant identifier fallback: ${engine.name} (${engine.labels.length} labels)`);
        return engine;
      }
    })();
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
      onStatus?.(`מנתח את התמונה במכשיר באמצעות ${engine.name}…`);
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
