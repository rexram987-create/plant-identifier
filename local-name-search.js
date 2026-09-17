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
  const CACHE_KEY = 'plant-local-name-map-v4';

  // Fast built-in aliases used even when the device is offline.
  const KNOWN_LOCAL_NAMES = {
    he: {
      'נענע': 'Mentha', 'מנטה': 'Mentha', 'גרניום': 'Pelargonium', 'פלרגוניום': 'Pelargonium',
      'פטוניה': 'Petunia', 'בזיליקום': 'Ocimum basilicum', 'ריחן': 'Ocimum basilicum',
      'רוזמרין': 'Salvia rosmarinus', 'סוקולנט': 'succulent', 'סוקולנטים': 'succulent',
      'קקטוס': 'Cactaceae', 'קקטוסים': 'Cactaceae', 'בוגנוויליה': 'Bougainvillea',
      'בוגנווילאה': 'Bougainvillea', 'פוטוס': 'Epipremnum aureum', 'לבנדר': 'Lavandula',

      // Israeli Ministry of Agriculture and Food Security / DataGov.
      // Source dataset: "מאגר צמחים חסכניים במים לאנשי המקצוע ולגינה הביתית".
      'אירוס ספרדי': 'Iris xiphium',
      'אלביציה ורדה': 'Albizzia julibrissin',
      'אלביציה צהבה': 'Albizzia lebbeck',
      'אלה אטלנטית': 'Pistacia atlantica',
      'אלה ארץ-ישראלית': 'Pistacia palaestina',
      'אלה סינית': 'Pistacia chinensis',
      'אלוי אמיתי': 'Aloe vera',
      'אלוי נמוך': 'Aloe humilis',
      'אלוי סבוני': 'Aloe saponaria',
      'אלוי עצי': 'Aloe arborescens',
      'אלוי ריסני': 'Aloe ciliaris',
      'אלון הגלעין': 'Quercus ilex',
      'אלון השעם': 'Quercus suber',
      'אלון התבור': 'Quercus ithaburensis',
      'אלון התולע': 'Quercus boissieri',
      'הרדוף הנחלים': 'Nerium oleander',
      'וסטרינגיה שיחנית': 'Westringia fruticosa',
      'ורד הכלב': 'Rosa canina',
      'ושינגטוניה חוטית': 'Washingtonia filifera',
      'ושינגטוניה חסונה': 'Washingtonia robusta',
      'זיפנוצה מחוספסת': 'Pennisetum divisum',
      'זית אירופי': 'Olea europaea',
      'זלזלת מנצה': 'Clematis flammula',
      'חרוב מצוי': 'Ceratonia siliqua',
      'טטרקליניס מפריק': 'Tetraclinis articulata',
      'טיון בשרני': 'Inula crithmoides',
      'טלמון ריסני': 'Drosanthemum hispidum',
      'יוקה אלואית': 'Yucca aloifolia',
      'יוקה סיבית': 'Yucca filamentosa',
      'יוקה פילית': 'Yucca elephantipes',
      'ינבוט המסקיטו': 'Prosopis juliflora',
      'ינבוט לבן': 'Prosopis alba',
      'יסמין גדול-פרחים': 'Jasminum mesnyi',
      'יסמין נמוך': 'Jasminum humile',
      'יסמין שיחני': 'Jasminum fruticans'
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

  function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); }
    catch { return {}; }
  }

  function writeCache(cache) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {}
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

    const cache = readCache();
    const key = `${lang}:${normalized}`;
    if (cache[key]) return cache[key];

    const scientific = await wikipediaResolve(query, lang) || await wikidataResolve(query, lang);
    if (scientific) { cache[key] = scientific; writeCache(cache); }
    return scientific;
  }

  window.PlantNameSearch = {resolveLocalName, detectLanguage};
})();
