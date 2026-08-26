// Experimental on-device plant identification with PlantNet-300K MobileNetV3-Small.
// The model is downloaded on first use and cached by the browser/PWA.
(() => {
  const MODEL_URL = 'https://huggingface.co/cpoisson/plantnet300k-mobilenetv3-small/resolve/main/plantnet_mobilenetv3.onnx';
  const LABELS_URL = 'https://huggingface.co/cpoisson/plantnet300k-mobilenetv3-small/resolve/main/plantnet300K_species_id_2_name.json';
  const ORT_URL = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/ort.min.js';
  const MODEL_CACHE = 'plant-ai-model-v1';
  let sessionPromise;
  let labelsPromise;

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

  async function getLabels() {
    if (!labelsPromise) labelsPromise = (async () => {
      const buffer = await cachedArrayBuffer(LABELS_URL);
      const mapping = JSON.parse(new TextDecoder().decode(buffer));
      return Object.keys(mapping).sort().map(id => mapping[id]);
    })();
    return labelsPromise;
  }

  async function getSession(onStatus) {
    if (!sessionPromise) sessionPromise = (async () => {
      onStatus?.('מוריד ומכין את מנוע הזיהוי בפעם הראשונה…');
      await loadScript(ORT_URL);
      const bytes = await cachedArrayBuffer(MODEL_URL);
      // WASM is the most broadly compatible execution provider on Android PWAs.
      return window.ort.InferenceSession.create(bytes, { executionProviders: ['wasm'] });
    })();
    return sessionPromise;
  }

  async function imageTensor(file) {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const scale = Math.max(256 / bitmap.width, 256 / bitmap.height);
    const w = bitmap.width * scale, h = bitmap.height * scale;
    ctx.drawImage(bitmap, (256 - w) / 2, (256 - h) / 2, w, h);
    bitmap.close?.();
    const crop = document.createElement('canvas');
    crop.width = 224; crop.height = 224;
    crop.getContext('2d').drawImage(canvas, 16, 16, 224, 224, 0, 0, 224, 224);
    const rgba = crop.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, 224, 224).data;
    const data = new Float32Array(3 * 224 * 224);
    const mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225];
    for (let i = 0; i < 224 * 224; i++) {
      data[i] = (rgba[i * 4] / 255 - mean[0]) / std[0];
      data[224 * 224 + i] = (rgba[i * 4 + 1] / 255 - mean[1]) / std[1];
      data[2 * 224 * 224 + i] = (rgba[i * 4 + 2] / 255 - mean[2]) / std[2];
    }
    return new window.ort.Tensor('float32', data, [1, 3, 224, 224]);
  }

  function softmaxTop(logits, labels, k = 3) {
    let max = -Infinity;
    for (const x of logits) if (x > max) max = x;
    const exps = new Float64Array(logits.length);
    let sum = 0;
    for (let i = 0; i < logits.length; i++) { exps[i] = Math.exp(logits[i] - max); sum += exps[i]; }
    return Array.from(logits, (_, i) => ({ index: i, name: labels[i] || `Class ${i}`, probability: exps[i] / sum }))
      .sort((a, b) => b.probability - a.probability).slice(0, k);
  }

  window.PlantLocalAI = {
    async identify(file, onStatus) {
      const [session, labels] = await Promise.all([getSession(onStatus), getLabels()]);
      onStatus?.('מנתח את התמונה במכשיר…');
      const tensor = await imageTensor(file);
      const inputName = session.inputNames[0];
      const output = await session.run({ [inputName]: tensor });
      const logits = output[session.outputNames[0]].data;
      return softmaxTop(logits, labels, 3);
    }
  };
})();
