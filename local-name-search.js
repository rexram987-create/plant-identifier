(() => {
  const originalFetch = window.fetch.bind(window);
  const CACHE_KEY = 'plant-local-name-map-v2';

  const KNOWN_LOCAL_NAMES = {
    he: {
      'נענע': 'Mentha',
      'מנטה': 'Mentha',
      'גרניום': 'Pelargonium',
      'פלרגוניום': 'Pelargonium',
      'פטוניה': 'Petunia',
      'בזיליקום': 'Ocimum basilicum',
      'ריחן': 'Ocimum basilicum',
      'רוזמרין': 'Salvia rosmarinus',
      'סוקולנט': 'succulent',
      'סוקולנטים': 'succulent',
      'קקטוס': 'Cactaceae',
      'קקטוסים': 'Cactaceae',
      'בוגנוויליה': 'Bougainvillea',
      'בוגנווילאה': 'Bougainvillea',
      'פוטוס': 'Epipremnum aureum',
      'לבנדר': 'Lavandula'
    },
    ar: {}
  };

  function normalize(text) {
    return String(text || '').trim().toLowerCase().replace(/\s+/g, ' ');
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

      const exact = plants.find(row =>
        normalize(row.canonicalName) === wanted ||
        normalize(row.scientificName) === wanted
      );
      return exact?.canonicalName || exact?.scientificName || plants[0]?.canonicalName || plants[0]?.scientificName || scientific;
    } catch {
      return null;
    }
  }

  async function wikipediaResolve(query, lang) {
    try {
      const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=0&gsrlimit=5&prop=pageprops&format=json&origin=*`;
      const response = await originalFetch(searchUrl);
      if (!response.ok) return null;
      const data = await response.json();
      const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
      for (const page of pages) {
        const entityId = page?.pageprops?.wikibase_item;
        const scientific = await wikidataScientificName(entityId);
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
    const known = KNOWN_LOCAL_NAMES[lang]?.[normalized];
    if (known) return known;

    const cache = readCache();
    const key = `${lang}:${normalized}`;
    if (cache[key]) return cache[key];

    const scientific = await wikipediaResolve(query, lang) || await wikidataResolve(query, lang);
    if (scientific) {
      cache[key] = scientific;
      writeCache(cache);
    }
    return scientific;
  }

  window.fetch = async function(input, init) {
    const requestUrl = typeof input === 'string' ? input : input?.url;
    if (!requestUrl) return originalFetch(input, init);

    let url;
    try { url = new URL(requestUrl, window.location.href); }
    catch { return originalFetch(input, init); }

    if (url.hostname !== 'api.gbif.org' || !url.pathname.endsWith('/v1/species/search')) {
      return originalFetch(input, init);
    }

    const query = url.searchParams.get('q') || '';
    const lang = detectLanguage(query);
    if (!lang) return originalFetch(input, init);

    const scientific = await resolveLocalName(query, lang);
    if (!scientific) return originalFetch(input, init);

    const translatedUrl = new URL(url.toString());
    translatedUrl.searchParams.set('q', scientific);
    const response = await originalFetch(translatedUrl.toString(), init);
    if (!response.ok) return response;

    try {
      const data = await response.clone().json();
      if (Array.isArray(data.results) && data.results.length) {
        data.results = data.results.map((row, index) => index === 0 ? { ...row, vernacularName: row.vernacularName || query } : row);
      }
      const headers = new Headers(response.headers);
      headers.set('content-type', 'application/json; charset=utf-8');
      return new Response(JSON.stringify(data), {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    } catch {
      return response;
    }
  };
})();
