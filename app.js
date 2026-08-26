const translations = {
  he: {
    dir: 'rtl', lang: 'he', eyebrow: 'מגדיר צמחים נגיש ורב־לשוני', title: 'מגדיר הצמחים', language: 'שפה', theme: 'מצב כהה', font: 'טקסט גדול',
    heroTitle: 'זהה צמח או חפש מידע לפי שם', heroText: 'הגרסה הראשונה כוללת ממשק נגיש, חיפוש בסיסי והעלאת תמונה. בהמשך נחבר את מנועי הזיהוי ומאגרי המידע.',
    searchTitle: 'חיפוש לפי שם', searchText: 'אפשר לחפש בעברית, באנגלית או בשם המדעי.', searchLabel: 'שם הצמח', searchPlaceholder: 'למשל: כלנית מצויה', searchButton: 'חפש',
    photoTitle: 'זיהוי לפי תמונה', photoText: 'צלם צמח או בחר תמונה מהגלריה. הזיהוי האוטומטי יחובר בשלב הבא.', photoButton: 'בחר או צלם תמונה',
    plannedTitle: 'מה נחבר בהמשך', footer: 'גרסת אב־טיפוס ראשונית', empty: 'יש להקליד שם של צמח.', searchDemo: 'בשלב זה החיפוש הוא הדגמה בלבד. חיפשת: ', imageReady: 'התמונה נטענה בהצלחה. בשלב הבא נחבר אותה למנוע זיהוי הצמחים.'
  },
  en: {
    dir: 'ltr', lang: 'en', eyebrow: 'Accessible multilingual plant guide', title: 'Plant Identifier', language: 'Language', theme: 'Dark mode', font: 'Large text',
    heroTitle: 'Identify a plant or search by name', heroText: 'This first version includes an accessible interface, basic search and photo upload. Data and identification services will be connected next.',
    searchTitle: 'Search by name', searchText: 'Search in your language, English, or by scientific name.', searchLabel: 'Plant name', searchPlaceholder: 'For example: Anemone coronaria', searchButton: 'Search',
    photoTitle: 'Identify by photo', photoText: 'Take a photo or choose one from your gallery. Automatic identification will be connected next.', photoButton: 'Choose or take a photo',
    plannedTitle: 'Coming next', footer: 'Initial prototype', empty: 'Please enter a plant name.', searchDemo: 'Search is a prototype for now. You searched for: ', imageReady: 'Image loaded successfully. Next we will connect it to a plant identification service.'
  },
  ar: {
    dir: 'rtl', lang: 'ar', eyebrow: 'دليل نباتات سهل الوصول ومتعدد اللغات', title: 'مُعرّف النباتات', language: 'اللغة', theme: 'الوضع الداكن', font: 'نص كبير',
    heroTitle: 'تعرّف على نبات أو ابحث بالاسم', heroText: 'تتضمن النسخة الأولى واجهة ميسّرة وبحثًا أساسيًا ورفع صورة. سنربط خدمات التعرف وقواعد البيانات لاحقًا.',
    searchTitle: 'البحث بالاسم', searchText: 'يمكن البحث بلغتك أو بالإنجليزية أو بالاسم العلمي.', searchLabel: 'اسم النبات', searchPlaceholder: 'مثال: شقائق النعمان', searchButton: 'بحث',
    photoTitle: 'التعرف بواسطة صورة', photoText: 'التقط صورة أو اختر صورة من المعرض. سيتم ربط التعرف التلقائي في المرحلة التالية.', photoButton: 'اختر أو التقط صورة',
    plannedTitle: 'ما سنضيفه لاحقًا', footer: 'نسخة أولية', empty: 'يرجى إدخال اسم النبات.', searchDemo: 'البحث تجريبي حاليًا. بحثت عن: ', imageReady: 'تم تحميل الصورة بنجاح. في المرحلة التالية سنربطها بخدمة التعرف على النباتات.'
  }
};

const root = document.documentElement;
const languageSelect = document.getElementById('languageSelect');
const themeToggle = document.getElementById('themeToggle');
const fontToggle = document.getElementById('fontToggle');
const result = document.getElementById('result');

function applyLanguage(code) {
  const t = translations[code] || translations.he;
  root.lang = t.lang;
  root.dir = t.dir;
  document.title = t.title;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (t[key]) el.textContent = t[key];
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    if (t[key]) el.placeholder = t[key];
  });
  localStorage.setItem('plant-language', code);
}

languageSelect.addEventListener('change', () => applyLanguage(languageSelect.value));

themeToggle.addEventListener('click', () => {
  const light = root.dataset.theme !== 'light';
  root.dataset.theme = light ? 'light' : 'dark';
  themeToggle.setAttribute('aria-pressed', String(!light));
  localStorage.setItem('plant-theme', light ? 'light' : 'dark');
});

fontToggle.addEventListener('click', () => {
  const enabled = root.dataset.largeText !== 'true';
  root.dataset.largeText = String(enabled);
  fontToggle.setAttribute('aria-pressed', String(enabled));
  localStorage.setItem('plant-large-text', String(enabled));
});

document.getElementById('nameSearchForm').addEventListener('submit', event => {
  event.preventDefault();
  const code = languageSelect.value;
  const t = translations[code];
  const query = document.getElementById('plantQuery').value.trim();
  result.hidden = false;
  result.textContent = query ? `${t.searchDemo}${query}` : t.empty;
  result.focus?.();
});

document.getElementById('plantPhoto').addEventListener('change', event => {
  const file = event.target.files?.[0];
  if (!file) return;
  const preview = document.getElementById('preview');
  preview.src = URL.createObjectURL(file);
  preview.alt = file.name;
  preview.hidden = false;
  result.hidden = false;
  result.textContent = translations[languageSelect.value].imageReady;
});

const savedLanguage = localStorage.getItem('plant-language') || 'he';
languageSelect.value = savedLanguage;
applyLanguage(savedLanguage);
root.dataset.theme = localStorage.getItem('plant-theme') || 'dark';
root.dataset.largeText = localStorage.getItem('plant-large-text') || 'false';
fontToggle.setAttribute('aria-pressed', root.dataset.largeText);
themeToggle.setAttribute('aria-pressed', String(root.dataset.theme === 'dark'));

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
}
