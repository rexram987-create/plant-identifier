(() => {
  // Vercel Functions reject large request bodies before the API handler runs.
  // Keep the original photo untouched for the on-screen preview.
  const MAX_EDGE = 1600;
  const MAX_BYTES = 3 * 1024 * 1024;

  async function prepareImage(file) {
    if (!file || !file.type.startsWith('image/')) throw new Error('unsupported_image_type');
    const bitmap = await createImageBitmap(file);
    try {
      const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.85, 0.72, 0.6, 0.45]) {
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
        if (!blob) throw new Error('image_conversion_failed');
        if (blob.size <= MAX_BYTES) return blob;
      }
      throw new Error('image_too_large');
    } finally {
      bitmap.close?.();
    }
  }

  async function identify(file) {
    const image = await prepareImage(file);
    let response;
    try {
      response = await fetch('/api/plantnet', {
        method: 'POST',
        headers: {'Content-Type': 'image/jpeg'},
        body: image
      });
    } catch {
      throw new Error('network_error');
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(response.status === 413 ? 'image_too_large' : payload.error || 'plantnet_request_failed');
      error.status = response.status;
      throw error;
    }
    return payload.results || [];
  }

  window.PlantNetAI = {identify};
})();
