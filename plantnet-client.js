(() => {
  async function identify(file) {
    const response = await fetch('/api/plantnet', {
      method: 'POST',
      headers: {'Content-Type': file.type || 'image/jpeg'},
      body: file
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || 'plantnet_request_failed');
      error.status = response.status;
      throw error;
    }
    return payload.results || [];
  }

  window.PlantNetAI = {identify};
})();
