(() => {
  const result = document.getElementById('result');
  if (!result) return;

  const ui = {
    he: { common:'שם נפוץ', button:'מידע מוויקיפדיה', loading:'טוען מידע מוויקיפדיה…', noMatch:'לא נמצא כרגע ערך מתאים בוויקיפדיה.', title:'מידע מוויקיפדיה', open:'פתח את הערך בוויקיפדיה', note:'ויקיפדיה משמשת כאן למידע משלים. לזיהוי מדעי יש להשוות גם ל־GBIF ול־iNaturalist.' },
    en: { common:'Common name', button:'Wikipedia information', loading:'Loading information from Wikipedia…', noMatch:'No suitable Wikipedia article was found.', title:'Wikipedia information', open:'Open article in Wikipedia', note:'Wikipedia is used here for supplementary information. Scientific identification should also be checked against GBIF and iNaturalist.' },
    ar: { common:'الاسم الشائع', button:'معلومات من ويكيبيديا', loading:'جارٍ تحميل معلومات من ويكيبيديا…', noMatch:'لم يتم العثور على مقالة مناسبة في ويكيبيديا.', title:'معلومات من ويكيبيديا', open:'افتح المقالة في ويكيبيديا', note:'تُستخدم ويكيبيديا هنا كمصدر معلومات إضافي. يُفضّل التحقق من التعرف العلمي أيضًا عبر GBIF وiNaturalist.' }
  };

  function lang() {
    const l = document.documentElement.lang;
    return ['he','en','ar'].includes(l) ? l : 'he';
  }
  function text() { return ui[lang()] || ui.he; }
  function esc(v) { return String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }

  // Require an exact scientific taxon match, not a fuzzy Wikipedia search hit.
  const normalizeTaxon = value => String(value || '').toLowerCase().replace(/×/g, 'x').replace(/\s+/g, ' ').trim();
  const articleCache = new Map();

  async function lookupTaxon(name) {
    const wanted = normalizeTaxon(name);
    const variants = [...new Set([name, name.replace(/×/g, 'x'), name.replace(/×/g, '')])];
    for (const variant of variants) {
      const response = await fetch('https://www.wikidata.org/w/api.php?action=wbsearchentities&search=' + encodeURIComponent(variant) + '&language=en&type=item&limit=15&format=json&origin=*');
      if (!response.ok) continue;
      const ids = ((await response.json()).search || []).map(item => item.id);
      if (!ids.length) continue;
      const entitiesResponse = await fetch('https://www.wikidata.org/w/api.php?action=wbgetentities&ids=' + encodeURIComponent(ids.join('|')) + '&props=claims|sitelinks&format=json&origin=*');
      if (!entitiesResponse.ok) continue;
      const entities = Object.values((await entitiesResponse.json()).entities || {});
      const match = entities.find(entity => (entity.claims?.P225 || []).some(claim =>
        normalizeTaxon(claim.mainsnak?.datavalue?.value) === wanted
      ));
      if (match) return match;
    }
    return null;
  }

  async function fetchWikiPage(title, code) {
    const response = await fetch('https://' + code + '.wikipedia.org/w/api.php?action=query&titles=' + encodeURIComponent(title) + '&redirects=1&prop=extracts|pageimages&exintro=1&explaintext=1&piprop=thumbnail&pithumbsize=900&format=json&origin=*');
    if (!response.ok) return null;
    const pages = (await response.json()).query?.pages || {};
    const page = Object.values(pages).find(p => p.pageid > 0);
    if (!page) return null;
    return {title: page.title, extract: page.extract || '', image: page.thumbnail?.source || '', url: 'https://' + code + '.wikipedia.org/?curid=' + page.pageid, language: code};
  }

  async function fetchPlantDetails(name, code = lang()) {
    const key = code + ':' + normalizeTaxon(name);
    if (!articleCache.has(key)) articleCache.set(key, (async () => {
      const entity = await lookupTaxon(name);
      if (!entity) return {article: null, commonName: ''};
      const commonName = entity.sitelinks?.[code + 'wiki']?.title || '';
      const order = code === 'en' ? ['en'] : [code, 'en'];
      let article = null;
      for (const language of order) {
        const title = entity.sitelinks?.[language + 'wiki']?.title;
        if (!title) continue;
        try {
          const found = await fetchWikiPage(title, language);
          if (found?.extract) { article = found; break; }
        } catch (error) { console.warn('Wikipedia lookup failed', language, error); }
      }
      return {article, commonName: commonName && normalizeTaxon(commonName) !== normalizeTaxon(name) ? commonName : ''};
    })().catch(error => {
      articleCache.delete(key);
      console.warn('Plant details lookup failed', error);
      return {article: null, commonName: ''};
    }));
    return articleCache.get(key);
  }

  function scientificName(card) {
    return card.dataset.scientificName || '';
  }

  function renderArticle(panel, article, x) {
    if (!article) {
      panel.innerHTML = '<p>' + esc(x.noMatch) + '</p>';
      return;
    }
    panel.innerHTML = '<h4>' + esc(x.title) + ' — ' + esc(article.title) + '</h4>' +
      (article.image ? '<img class="wiki-image" src="' + esc(article.image) + '" alt="' + esc(article.title) + '" loading="lazy">' : '') +
      '<p>' + esc(article.extract) + '</p>' +
      '<p class="wiki-note">' + esc(x.note) + '</p>' +
      '<a class="source-link" href="' + esc(article.url) + '" target="_blank" rel="noopener noreferrer">' + esc(x.open) + '</a>';
  }

  async function enrichCard(card, name) {
    const code = lang();
    const x = text();
    const panel = document.createElement('section');
    panel.className = 'wiki-panel';
    panel.setAttribute('aria-live', 'polite');
    panel.innerHTML = '<p class="result-message" role="status">' + esc(x.loading) + '</p>';
    card.appendChild(panel);
    const localName = window.PlantNameSearch?.commonNameForScientific?.(name, code) || '';
    const {article, commonName} = await fetchPlantDetails(name, code);
    if (!card.isConnected) return;
    const displayName = localName || commonName;
    if (displayName && !card.querySelector('.plant-common-name')) {
      const p = document.createElement('p');
      p.className = 'plant-common-name';
      p.textContent = x.common + ': ' + displayName;
      const heading = card.querySelector('.plant-result-heading') || card.querySelector('h3');
      if (heading) heading.after(p);
      else card.prepend(p);
    }
    renderArticle(panel, article, x);
  }

  const enhancedCards = new WeakSet();
  function enhance() {
    result.querySelectorAll('.plant-result-card').forEach(card => {
      if (enhancedCards.has(card)) return;
      enhancedCards.add(card);
      const name = scientificName(card);
      if (!name) return;
      enrichCard(card, name);
    });
  }

  new MutationObserver(enhance).observe(result, { childList:true, subtree:true });
  document.getElementById('languageSelect')?.addEventListener('change', () => setTimeout(() => {
    // Newly rendered cards use the selected language; existing cards refresh on next search.
  }, 0));
  enhance();
})();
