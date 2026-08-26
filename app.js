const translations = {
  he: {
    dir: 'rtl', lang: 'he', eyebrow: 'מגדיר צמחים נגיש ורב־לשוני', title: 'מגדיר הצמחים', language: 'שפה', theme: 'מצב כהה', font: 'טקסט גדול',
    heroTitle: 'זהה צמח או חפש מידע לפי שם', heroText: 'אפשר לחפש צמחים לפי שם באמצעות GBIF, ולקבל פרטים נוספים בתוך היישומון עצמו.',
    searchTitle: 'חיפוש לפי שם', searchText: 'אפשר לחפש בשם מקומי, באנגלית או בשם המדעי.', searchLabel: 'שם הצמח', searchPlaceholder: 'למשל: Anemone coronaria', searchButton: 'חפש',
    photoTitle: 'זיהוי לפי תמונה', photoText: 'צלם צמח או בחר תמונה מהגלריה. הזיהוי האוטומטי יחובר בשלב הבא.', photoButton: 'בחר או צלם תמונה',
    plannedTitle: 'מקורות ושירותים', footer: 'מגדיר צמחים נגיש ורב־לשוני', empty: 'יש להקליד שם של צמח.', imageReady: 'התמונה נטענה בהצלחה. בשלב הבא נחבר אותה למנוע זיהוי הצמחים.',
    loading: 'מחפש במאגר GBIF…', noResults: 'לא נמצאו תוצאות מתאימות. נסה שם מדעי או שם באנגלית.', error: 'לא הצלחנו להתחבר כרגע ל־GBIF. כדאי לנסות שוב בעוד רגע.',
    resultsFor: 'תוצאות עבור', scientificName: 'שם מדעי', commonName: 'שם נפוץ', family: 'משפחה', genus: 'סוג', order: 'סדרה', status: 'מעמד', source: 'מקור: GBIF', viewGbif: 'פתח ב־GBIF', unnamed: 'ללא שם נפוץ', unknown: 'לא ידוע',
    detailsButton: 'פרטים מלאים בתוך האתר', detailsLoading: 'טוען פרטים נוספים…', detailsTitle: 'מידע נוסף', description: 'תיאור', otherNames: 'שמות נוספים', wikiSource: 'מקור לתיאור: ויקיפדיה', noDescription: 'לא נמצא כרגע תיאור נוסף בשפה זו.', closeDetails: 'סגור פרטים'
  },
  en: {
    dir: 'ltr', lang: 'en', eyebrow: 'Accessible multilingual plant guide', title: 'Plant Identifier', language: 'Language', theme: 'Dark mode', font: 'Large text',
    heroTitle: 'Identify a plant or search by name', heroText: 'Search plants by name with GBIF and open richer information directly inside the app.',
    searchTitle: 'Search by name', searchText: 'Search by a local name, English name, or scientific name.', searchLabel: 'Plant name', searchPlaceholder: 'For example: Anemone coronaria', searchButton: 'Search',
    photoTitle: 'Identify by photo', photoText: 'Take a photo or choose one from your gallery. Automatic identification will be connected next.', photoButton: 'Choose or take a photo',
    plannedTitle: 'Sources and services', footer: 'Accessible multilingual plant identifier', empty: 'Please enter a plant name.', imageReady: 'Image loaded successfully. Next we will connect it to a plant identification service.',
    loading: 'Searching GBIF…', noResults: 'No matching plants were found. Try a scientific or English name.', error: 'We could not reach GBIF right now. Please try again shortly.',
    resultsFor: 'Results for', scientificName: 'Scientific name', commonName: 'Common name', family: 'Family', genus: 'Genus', order: 'Order', status: 'Status', source: 'Source: GBIF', viewGbif: 'Open in GBIF', unnamed: 'No common name', unknown: 'Unknown',
    detailsButton: 'Full details in the app', detailsLoading: 'Loading more details…', detailsTitle: 'More information', description: 'Description', otherNames: 'Other names', wikiSource: 'Description source: Wikipedia', noDescription: 'No additional description was found in this language.', closeDetails: 'Close details'
  },
  ar: {
    dir: 'rtl', lang: 'ar', eyebrow: 'دليل نباتات سهل الوصول ومتعدد اللغات', title: 'مُعرّف النباتات', language: 'اللغة', theme: 'الوضع الداكن', font: 'نص كبير',
    heroTitle: 'تعرّف على نبات أو ابحث بالاسم', heroText: 'ابحث عن النباتات بالاسم عبر GBIF واعرض معلومات أوسع داخل التطبيق نفسه.',
    searchTitle: 'البحث بالاسم', searchText: 'يمكن البحث بالاسم المحلي أو الإنجليزي أو العلمي.', searchLabel: 'اسم النبات', searchPlaceholder: 'مثال: Anemone coronaria', searchButton: 'بحث',
    photoTitle: 'التعرف بواسطة صورة', photoText: 'التقط صورة أو اختر صورة من المعرض. سيتم ربط التعرف التلقائي في المرحلة التالية.', photoButton: 'اختر أو التقط صورة',
    plannedTitle: 'المصادر والخدمات', footer: 'مُعرّف نباتات ميسّر ومتعدد اللغات', empty: 'يرجى إدخال اسم النبات.', imageReady: 'تم تحميل الصورة بنجاح. في المرحلة التالية سنربطها بخدمة التعرف على النباتات.',
    loading: 'جارٍ البحث في GBIF…', noResults: 'لم يتم العثور على نباتات مطابقة. جرّب الاسم العلمي أو الإنجليزي.', error: 'تعذر الاتصال بـ GBIF الآن. حاول مرة أخرى بعد قليل.',
    resultsFor: 'نتائج البحث عن', scientificName: 'الاسم العلمي', commonName: 'الاسم الشائع', family: 'الفصيلة', genus: 'الجنس', order: 'الرتبة', status: 'الحالة', source: 'المصدر: GBIF', viewGbif: 'افتح في GBIF', unnamed: 'لا يوجد اسم شائع', unknown: 'غير معروف',
    detailsButton: 'تفاصيل كاملة داخل التطبيق', detailsLoading: 'جارٍ تحميل معلومات إضافية…', detailsTitle: 'معلومات إضافية', description: 'الوصف', otherNames: 'أسماء أخرى', wikiSource: 'مصدر الوصف: ويكيبيديا', noDescription: 'لم يتم العثور على وصف إضافي بهذه اللغة.', closeDetails: 'إغلاق التفاصيل'
  }
};

const root = document.documentElement;
const languageSelect = document.getElementById('languageSelect');
const themeToggle = document.getElementById('themeToggle');
const fontToggle = document.getElementById('fontToggle');
const result = document.getElementById('result');
const searchButton = document.querySelector('#nameSearchForm button[type="submit"]');
let lastSearch = '';
let lastResults = [];

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
  if (lastSearch && lastResults.length) renderResults(lastSearch, lastResults);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function plantResult(item) {
  return item.kingdom === 'Plantae' || item.kingdomKey === 6;
}

function renderResults(query, items) {
  const t = translations[languageSelect.value] || translations.he;
  result.hidden = false;

  if (!items.length) {
    result.innerHTML = `<p class="result-message">${escapeHtml(t.noResults)}</p>`;
    return;
  }

  const cards = items.map((item, index) => {
    const key = item.key || item.speciesKey || '';
    const scientific = item.scientificName || item.canonicalName || t.unknown;
    const canonical = item.canonicalName || scientific;
    const common = item.vernacularName || t.unnamed;
    const gbifUrl = key ? `https://www.gbif.org/species/${encodeURIComponent(key)}` : 'https://www.gbif.org/species/search';
    return `
      <article class="plant-result-card" data-result-index="${index}">
        <div class="plant-result-heading">
          <h3>${escapeHtml(canonical)}</h3>
          <span class="source-badge">${escapeHtml(t.source)}</span>
        </div>
        <dl class="plant-facts">
          <div><dt>${escapeHtml(t.scientificName)}</dt><dd><em>${escapeHtml(scientific)}</em></dd></div>
          <div><dt>${escapeHtml(t.commonName)}</dt><dd>${escapeHtml(common)}</dd></div>
          <div><dt>${escapeHtml(t.family)}</dt><dd>${escapeHtml(item.family || t.unknown)}</dd></div>
          <div><dt>${escapeHtml(t.genus)}</dt><dd>${escapeHtml(item.genus || t.unknown)}</dd></div>
          <div><dt>${escapeHtml(t.order)}</dt><dd>${escapeHtml(item.order || t.unknown)}</dd></div>
          <div><dt>${escapeHtml(t.status)}</dt><dd>${escapeHtml(item.taxonomicStatus || item.status || t.unknown)}</dd></div>
        </dl>
        <div class="result-actions">
          <button class="details-button" type="button" data-details-index="${index}">${escapeHtml(t.detailsButton)}</button>
          <a class="gbif-link" href="${gbifUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(t.viewGbif)}</a>
        </div>
        <div class="inline-details" id="details-${index}" hidden></div>
      </article>`;
  }).join('');

  result.innerHTML = `
    <div class="results-header">
      <h2>${escapeHtml(t.resultsFor)}: “${escapeHtml(query)}”</h2>
      <p>${items.length} GBIF</p>
    </div>
    <div class="results-grid">${cards}</div>`;
}

async function searchGbif(query) {
  const endpoint = `https://api.gbif.org/v1/species/search?q=${encodeURIComponent(query)}&limit=20`;
  const response = await fetch(endpoint, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`GBIF ${response.status}`);
  const data = await response.json();
  const raw = Array.isArray(data.results) ? data.results : [];
  const plants = raw.filter(plantResult);
  return (plants.length ? plants : raw).slice(0, 8);
}

async function fetchVernacularNames(key) {
  if (!key) return [];
  try {
    const response = await fetch(`https://api.gbif.org/v1/species/${encodeURIComponent(key)}/vernacularNames`);
    if (!response.ok) return [];
    const data = await response.json();
    const rows = Array.isArray(data.results) ? data.results : [];
    return [...new Set(rows.map(row => row.vernacularName).filter(Boolean))].slice(0, 10);
  } catch {
    return [];
  }
}

async function fetchWikipediaSummary(name, lang) {
  const requested = ['he', 'ar', 'en'].includes(lang) ? lang : 'en';
  const languages = requested === 'en' ? ['en'] : [requested, 'en'];

  for (const code of languages) {
    try {
      const endpoint = `https://${code}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(name)}&gsrnamespace=0&gsrlimit=1&prop=extracts|pageimages&exintro=1&explaintext=1&piprop=thumbnail&pithumbsize=700&format=json&origin=*`;
      const response = await fetch(endpoint);
      if (!response.ok) continue;
      const data = await response.json();
      const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
      const page = pages[0];
      if (!page || !page.extract) continue;
      return {
        title: page.title,
        extract: page.extract,
        image: page.thumbnail?.source || '',
        language: code,
        url: `https://${code}.wikipedia.org/?curid=${page.pageid}`
      };
    } catch {
      // Try the fallback language.
    }
  }
  return null;
}

async function showDetails(index, button) {
  const item = lastResults[index];
  if (!item) return;
  const t = translations[languageSelect.value] || translations.he;
  const panel = document.getElementById(`details-${index}`);
  if (!panel) return;

  if (!panel.hidden && panel.dataset.loaded === 'true') {
    panel.hidden = true;
    button.textContent = t.detailsButton;
    button.setAttribute('aria-expanded', 'false');
    return;
  }

  panel.hidden = false;
  button.setAttribute('aria-expanded', 'true');
  panel.innerHTML = `<p class="result-message" role="status">${escapeHtml(t.detailsLoading)}</p>`;

  const key = item.key || item.speciesKey;
  const canonical = item.canonicalName || item.scientificName || '';
  const [names, wiki] = await Promise.all([
    fetchVernacularNames(key),
    fetchWikipediaSummary(canonical, languageSelect.value)
  ]);

  const otherNames = names.filter(name => name !== item.vernacularName);
  const imageHtml = wiki?.image ? `<img class="details-image" src="${escapeHtml(wiki.image)}" alt="${escapeHtml(wiki.title || canonical)}" loading="lazy">` : '';
  const descriptionHtml = wiki?.extract
    ? `<p>${escapeHtml(wiki.extract)}</p><a class="source-link" href="${escapeHtml(wiki.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t.wikiSource)}</a>`
    : `<p>${escapeHtml(t.noDescription)}</p>`;
  const namesHtml = otherNames.length
    ? `<ul class="other-names">${otherNames.map(name => `<li>${escapeHtml(name)}</li>`).join('')}</ul>`
    : `<p>${escapeHtml(t.unnamed)}</p>`;

  panel.innerHTML = `
    <section class="details-content" aria-label="${escapeHtml(t.detailsTitle)}">
      <h4>${escapeHtml(t.detailsTitle)}</h4>
      ${imageHtml}
      <h5>${escapeHtml(t.description)}</h5>
      ${descriptionHtml}
      <h5>${escapeHtml(t.otherNames)}</h5>
      ${namesHtml}
      <button class="close-details" type="button" data-close-index="${index}">${escapeHtml(t.closeDetails)}</button>
    </section>`;
  panel.dataset.loaded = 'true';
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

document.getElementById('nameSearchForm').addEventListener('submit', async event => {
  event.preventDefault();
  const t = translations[languageSelect.value] || translations.he;
  const query = document.getElementById('plantQuery').value.trim();
  result.hidden = false;

  if (!query) {
    result.innerHTML = `<p class="result-message">${escapeHtml(t.empty)}</p>`;
    return;
  }

  searchButton.disabled = true;
  searchButton.setAttribute('aria-busy', 'true');
  result.innerHTML = `<p class="result-message" role="status">${escapeHtml(t.loading)}</p>`;

  try {
    const items = await searchGbif(query);
    lastSearch = query;
    lastResults = items;
    renderResults(query, items);
  } catch (error) {
    console.error(error);
    lastSearch = '';
    lastResults = [];
    result.innerHTML = `<p class="result-message" role="alert">${escapeHtml(t.error)}</p>`;
  } finally {
    searchButton.disabled = false;
    searchButton.removeAttribute('aria-busy');
  }
});

result.addEventListener('click', event => {
  const detailsButton = event.target.closest('[data-details-index]');
  if (detailsButton) {
    showDetails(Number(detailsButton.dataset.detailsIndex), detailsButton);
    return;
  }

  const closeButton = event.target.closest('[data-close-index]');
  if (closeButton) {
    const index = Number(closeButton.dataset.closeIndex);
    const panel = document.getElementById(`details-${index}`);
    const openButton = result.querySelector(`[data-details-index="${index}"]`);
    if (panel) panel.hidden = true;
    if (openButton) {
      openButton.textContent = (translations[languageSelect.value] || translations.he).detailsButton;
      openButton.setAttribute('aria-expanded', 'false');
      openButton.focus();
    }
  }
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
