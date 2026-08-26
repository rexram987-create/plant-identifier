(() => {
  const cameraInput = document.getElementById('cameraPhoto');
  const galleryInput = document.getElementById('plantPhoto');
  if (!cameraInput || !galleryInput) return;

  cameraInput.addEventListener('change', () => {
    const file = cameraInput.files?.[0];
    if (!file) return;
    try {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      galleryInput.files = transfer.files;
      galleryInput.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (error) {
      console.error('Could not forward camera photo', error);
    }
  });
})();
