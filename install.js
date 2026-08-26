(() => {
  const installButton = document.getElementById('installButton');
  const languageSelect = document.getElementById('languageSelect');
  if (!installButton) return;

  const labels = {
    he: 'התקן יישומון',
    en: 'Install app',
    ar: 'تثبيت التطبيق'
  };

  let deferredPrompt = null;

  function currentLanguage() {
    return languageSelect?.value || document.documentElement.lang || 'he';
  }

  function updateLabel() {
    installButton.textContent = labels[currentLanguage()] || labels.he;
  }

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  updateLabel();
  languageSelect?.addEventListener('change', updateLabel);

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    if (!isStandalone()) installButton.hidden = false;
  });

  installButton.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    installButton.disabled = true;
    try {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } finally {
      deferredPrompt = null;
      installButton.hidden = true;
      installButton.disabled = false;
    }
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installButton.hidden = true;
  });

  if (isStandalone()) installButton.hidden = true;
})();
