(() => {
  const installButton = document.getElementById('installButton');
  const languageSelect = document.getElementById('languageSelect');
  if (!installButton) return;

  const labels = {
    he: 'התקן יישומון',
    en: 'Install app',
    ar: 'تثبيت التطبيق'
  };
  const manualLabels = {
    he: 'להתקנה: פתח את תפריט Chrome ובחר „הוספה למסך הבית” או „התקנת האפליקציה”.',
    en: 'To install: open the Chrome menu and choose “Add to Home screen” or “Install app”.',
    ar: 'للتثبيت: افتح قائمة Chrome واختر «إضافة إلى الشاشة الرئيسية» أو «تثبيت التطبيق». '
  };

  let deferredPrompt = null;
  if ('serviceWorker' in navigator) {
    const register = () => navigator.serviceWorker.register('./sw.js', {scope: './', updateViaCache: 'none'})
      .catch(error => console.error('Service worker registration failed', error));
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, {once: true});
  }

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
    if (!deferredPrompt) {
      alert(manualLabels[currentLanguage()] || manualLabels.he);
      return;
    }
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
  else installButton.hidden = false;
})();
