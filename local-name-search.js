(() => {
  const originalFetch = window.fetch.bind(window);
  const CACHE_KEY = 'plant-local-name-map-v1';

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

  async function wikipediaResolve(query, lang) {
    try {
      const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=0&gsrlimit=3&prop=pageprops&format=json&origin=*`;
      const response = await originalFetch(searchUrl);
      if (!response.ok) return null;
      const data = await response.json();
      const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
      for (const page of pages) {
        const entityId = page?.pageprops?.wikibase_item;
        const scientific = await wikidataScientificName(entityId);
        if (scientific) return scientific;
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
        if (!scientific) continue;
        try {
          const gbif = await originalFetch(`https://api.gbif.org/v1/species/search?q=${encodeURIComponent(scientific)}&limit=5`);
          if (!gbif.ok) continue;
          const gbifData = await gbif.json();
          const isPlant = (gbifData.results || []).some(row => row.kingdom === 'Plantae' || row.kingdomKey === 6);
          if (isPlant) return scientific;
        } catch {}
      }
    } catch {}
    return null;
  }

  async function resolveLocalName(query, lang) {
    const cache = readCache();
    const key = `${lang}:${query.trim().toLowerCase()}`;
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
