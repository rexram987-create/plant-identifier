(() => {
  const originalFetch = async (url) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await window.fetch(url, {signal: controller.signal});
      const body = await response.text();
      return new Response(body, {status: response.status, headers: response.headers});
    } finally { clearTimeout(timer); }
  };

  const CACHE_KEY = 'plant-local-name-map-v5';
  const AGRICULTURE_CACHE_KEY = 'israel-agriculture-plant-names-v1';
  const AGRICULTURE_RESOURCE_ID = '94b22c64-5c80-4eb4-b5e5-79cc9bb89814';
  const AGRICULTURE_API = `https://data.gov.il/api/3/action/datastore_search?resource_id=${AGRICULTURE_RESOURCE_ID}&limit=1000`;
  let agricultureSyncPromise = null;

  // Fast built-in aliases used even before the government dataset has been cached.
  const KNOWN_LOCAL_NAMES = {
    he: {
      'נענע': 'Mentha', 'מנטה': 'Mentha', 'גרניום': 'Pelargonium', 'פלרגוניום': 'Pelargonium',
      'פטוניה': 'Petunia', 'בזיליקום': 'Ocimum basilicum', 'ריחן': 'Ocimum basilicum',
      'רוזמרין': 'Salvia rosmarinus', 'סוקולנט': 'succulent', 'סוקולנטים': 'succulent',
      'קקטוס': 'Cactaceae', 'קקטוסים': 'Cactaceae', 'בוגנוויליה': 'Bougainvillea',
      'בוגנווילאה': 'Bougainvillea', 'פוטוס': 'Epipremnum aureum', 'לבנדר': 'Lavandula',
      'אירוס ספרדי': 'Iris xiphium', 'אלביציה ורדה': 'Albizzia julibrissin',
      'אלביציה צהבה': 'Albizzia lebbeck', 'אלה אטלנטית': 'Pistacia atlantica',
      'אלה ארץ-ישראלית': 'Pistacia palaestina', 'אלה סינית': 'Pistacia chinensis',
      'אלוי אמיתי': 'Aloe vera', 'אלוי נמוך': 'Aloe humilis', 'אלוי סבוני': 'Aloe saponaria',
      'אלוי עצי': 'Aloe arborescens', 'אלוי ריסני': 'Aloe ciliaris', 'אלון הגלעין': 'Quercus ilex',
      'אלון השעם': 'Quercus suber', 'אלון התבור': 'Quercus ithaburensis', 'אלון התולע': 'Quercus boissieri',
      'הרדוף הנחלים': 'Nerium oleander', 'וסטרינגיה שיחנית': 'Westringia fruticosa',
      'ורד הכלב': 'Rosa canina', 'ושינגטוניה חוטית': 'Washingtonia filifera',
      'ושינגטוניה חסונה': 'Washingtonia robusta', 'זיפנוצה מחוספסת': 'Pennisetum divisum',
      'זית אירופי': 'Olea europaea', 'זלזלת מנצה': 'Clematis flammula', 'חרוב מצוי': 'Ceratonia siliqua',
      'טטרקליניס מפריק': 'Tetraclinis articulata', 'טיון בשרני': 'Inula crithmoides',
      'טלמון ריסני': 'Drosanthemum hispidum', 'יוקה אלואית': 'Yucca aloifolia',
      'יוקה סיבית': 'Yucca filamentosa', 'יוקה פילית': 'Yucca elephantipes',
      'ינבוט המסקיטו': 'Prosopis juliflora', 'ינבוט לבן': 'Prosopis alba',
      'יסמין גדול-פרחים': 'Jasminum mesnyi', 'יסמין נמוך': 'Jasminum humile', 'יסמין שיחני': 'Jasminum fruticans'
    },
    ar: {'النعناع':'Mentha','نعناع':'Mentha','الريحان':'Ocimum basilicum','ريحان':'Ocimum basilicum','إكليل الجبل':'Salvia rosmarinus','الخزامى':'Lavandula','الجهنمية':'Bougainvillea'}
  };

  function normalize(text) {
    return String(text || '').trim().toLowerCase().replace(/[־–—]/g, '-').replace(/\s+/g, ' ');
  }

  function detectLanguage(text) {
    if (/[֐-׿]/.test(text)) return 'he';
    if (/[؀-ۿ]/.test(text)) return 'ar';
    return null;
  }

  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || '{}'); }
    catch { return {}; }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  function readCache() { return readJson(CACHE_KEY); }
  function writeCache(cache) { writeJson(CACHE_KEY, cache); }
  function readAgricultureNames() { return readJson(AGRICULTURE_CACHE_KEY); }

  async function syncAgricultureNames() {
    if (agricultureSyncPromise) return agricultureSyncPromise;
    agricultureSyncPromise = (async () => {
      try {
        const response = await originalFetch(AGRICULTURE_API);
        if (!response.ok) return Object.keys(readAgricultureNames()).length;
        const data = await response.json();
        const records = data?.result?.records || [];
        const names = {};
        for (const row of records) {
          const hebrew = normalize(row?.plant_name);
          const scientific = String(row?.scientific_name || '').trim();
          if (hebrew && scientific) names[hebrew] = scientific;
        }
        if (Object.keys(names).length) writeJson(AGRICULTURE_CACHE_KEY, names);
        return Object.keys(names).length || Object.keys(readAgricultureNames()).length;
      } catch {
        return Object.keys(readAgricultureNames()).length;
      } finally {
        agricultureSyncPromise = null;
      }
    })();
    return agricultureSyncPromise;
  }

  async function wikidataScientificName(entityId) {
    if (!entityId) return null;
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(entityId)}&props=claims&format=json&origin=*`;
    const response = await originalFetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    return data?.entities?.[entityId]?.claims?.P225?.[0]?.mainsnak?.datavalue?.value || null;
  }

  async function validatedPlantName(scientific) {
    if (!scientific) return null;
    try {
      const response = await originalFetch(`https://api.gbif.org/v1/species/search?q=${encodeURIComponent(scientific)}&limit=10`);
      if (!response.ok) return null;
      const data = await response.json();
      const wanted = normalize(scientific);
      const plants = (data.results || []).filter(row => row.kingdom === 'Plantae' || row.kingdomKey === 6);
      if (!plants.length) return null;
      const exact = plants.find(row => normalize(row.canonicalName) === wanted || normalize(row.scientificName) === wanted);
      return exact?.canonicalName || exact?.scientificName || null;
    } catch { return null; }
  }

  async function wikipediaResolve(query, lang) {
    try {
      const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=0&gsrlimit=5&prop=pageprops&format=json&origin=*`;
      const response = await originalFetch(searchUrl);
      if (!response.ok) return null;
      const data = await response.json();
      const pages = data?.query?.pages ? Object.values(data.query.pages).sort((a, b) => (a.index || 0) - (b.index || 0)) : [];
      for (const page of pages) {
        const scientific = await wikidataScientificName(page?.pageprops?.wikibase_item);
        const verified = await validatedPlantName(scientific);
        if (verified) return verified;
      }
    } catch {}
    return null;
  }

  async function wikidataResolve(query, lang) {
    try {
      const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=${lang}&uselang=${lang}&type=item&limit=8&format=json&origin=*`;
      const response = await originalFetch(searchUrl);
      if (!response.ok) return null;
      const data = await response.json();
      for (const item of data?.search || []) {
        const scientific = await wikidataScientificName(item.id);
        const verified = await validatedPlantName(scientific);
        if (verified) return verified;
      }
    } catch {}
    return null;
  }

  async function resolveLocalName(query, lang) {
    const normalized = normalize(query);
    const names = KNOWN_LOCAL_NAMES[lang] || {};
    const directKey = Object.keys(names).find(key => normalize(key) === normalized);
    if (directKey) return names[directKey];

    if (lang === 'he') {
      let agricultureNames = readAgricultureNames();
      if (agricultureNames[normalized]) return agricultureNames[normalized];
      await syncAgricultureNames();
      agricultureNames = readAgricultureNames();
      if (agricultureNames[normalized]) return agricultureNames[normalized];
    }

    const cache = readCache();
    const key = `${lang}:${normalized}`;
    if (cache[key]) return cache[key];

    const scientific = await wikipediaResolve(query, lang) || await wikidataResolve(query, lang);
    if (scientific) { cache[key] = scientific; writeCache(cache); }
    return scientific;
  }

  function commonNameForScientific(scientific, lang = 'he') {
    const wanted = normalize(scientific).replace(/×/g, 'x').replace(/\\s+/g, ' ');
    if (!wanted) return '';
    const aliases = KNOWN_LOCAL_NAMES[lang] || {};
    const agriculture = lang === 'he' ? readAgricultureNames() : {};
    const known = lang === 'he' ? {'fragaria x ananassa': 'תות שדה', 'fragaria ananassa': 'תות שדה'} : {};
    if (known[wanted]) return known[wanted];
    for (const [local, latin] of Object.entries({...agriculture, ...aliases})) {
      if (normalize(latin).replace(/×/g, 'x') === wanted) return local;
    }
    return '';
  }

  // Warm the official Israeli dataset in the background; cached names remain available offline afterwards.
  if (typeof navigator === 'undefined' || navigator.onLine !== false) syncAgricultureNames();

  window.PlantNameSearch = {resolveLocalName, detectLanguage, syncAgricultureNames, commonNameForScientific};
})();