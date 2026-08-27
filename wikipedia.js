(() => {
  const result = document.getElementById('result');
  if (!result) return;

  const ui = {
    he: { button:'מידע מוויקיפדיה', loading:'טוען מידע מוויקיפדיה…', noMatch:'לא נמצא כרגע ערך מתאים בוויקיפדיה.', title:'מידע מוויקיפדיה', open:'פתח את הערך בוויקיפדיה', note:'ויקיפדיה משמשת כאן למידע משלים. לזיהוי מדעי יש להשוות גם ל־GBIF ול־iNaturalist.' },
    en: { button:'Wikipedia information', loading:'Loading information from Wikipedia…', noMatch:'No suitable Wikipedia article was found.', title:'Wikipedia information', open:'Open article in Wikipedia', note:'Wikipedia is used here for supplementary information. Scientific identification should also be checked against GBIF and iNaturalist.' },
    ar: { button:'معلومات من ويكيبيديا', loading:'جارٍ تحميل معلومات من ويكيبيديا…', noMatch:'لم يتم العثور على مقالة مناسبة في ويكيبيديا.', title:'معلومات من ويكيبيديا', open:'افتح المقالة في ويكيبيديا', note:'تُستخدم ويكيبيديا هنا كمصدر معلومات إضافي. يُفضّل التحقق من التعرف العلمي أيضًا عبر GBIF وiNaturalist.' }
  };

  function lang() {
    const l = document.documentElement.lang;
    return ['he','en','ar'].includes(l) ? l : 'he';
  }
  function text() { return ui[lang()] || ui.he; }
  function esc(v) { return String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }

  async function wikiSearch(name, code) {
    const url = `https://${code}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(name)}&gsrnamespace=0&gsrlimit=3&prop=extracts|pageimages&exintro=1&explaintext=1&piprop=thumbnail&pithumbsize=900&format=json&origin=*`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const data = await r.json();
    const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
    if (!pages.length) return null;
    const needle = name.toLowerCase();
    const page = pages.find(p => (p.title || '').toLowerCase() === needle) || pages.find(p => p.extract) || pages[0];
    if (!page) return null;
    return {
      title: page.title || name,
      extract: page.extract || '',
      image: page.thumbnail?.source || '',
      url: `https://${code}.wikipedia.org/?curid=${page.pageid}`,
      language: code
    };
  }

  async function fetchArticle(name) {
    const preferred = lang();
    const order = preferred === 'en' ? ['en'] : [preferred, 'en'];
    for (const code of order) {
      try {
        const article = await wikiSearch(name, code);
        if (article?.extract || article?.image) return article;
      } catch (e) {
        console.warn('Wikipedia lookup failed', code, e);
      }
    }
    return null;
  }

  function scientificName(card) {
    const em = card.querySelector('h3 em');
    if (em?.textContent.trim()) return em.textContent.trim();
    const h3 = card.querySelector('h3');
    if (h3?.textContent.trim()) return h3.textContent.trim().replace(/^\d+\.\s*/, '');
    return '';
  }

  async function showWikipedia(button, name) {
    const card = button.closest('.plant-result-card');
    if (!card) return;
    let panel = card.querySelector('.wiki-panel');
    if (!panel) {
      panel = document.createElement('section');
      panel.className = 'wiki-panel';
      panel.setAttribute('aria-live','polite');
      card.appendChild(panel);
    }
    const x = text();
    button.disabled = true;
    panel.innerHTML = `<p class="result-message" role="status">${esc(x.loading)}</p>`;
    try {
      const article = await fetchArticle(name);
      if (!article) {
        panel.innerHTML = `<p>${esc(x.noMatch)}</p>`;
        return;
      }
      panel.innerHTML = `
        <h4>${esc(x.title)} — ${esc(article.title)}</h4>
        ${article.image ? `<img class="wiki-image" src="${esc(article.image)}" alt="${esc(article.title)}" loading="lazy">` : ''}
        ${article.extract ? `<p>${esc(article.extract)}</p>` : `<p>${esc(x.noMatch)}</p>`}
        <p class="wiki-note">${esc(x.note)}</p>
        <a class="source-link" href="${esc(article.url)}" target="_blank" rel="noopener noreferrer">${esc(x.open)}</a>`;
    } catch (e) {
      console.error(e);
      panel.innerHTML = `<p>${esc(x.noMatch)}</p>`;
    } finally {
      button.disabled = false;
    }
  }

  function enhance() {
    result.querySelectorAll('.plant-result-card').forEach(card => {
      if (card.querySelector('[data-wiki-info]')) return;
      const name = scientificName(card);
      if (!name) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'wiki-info';
      b.dataset.wikiInfo = name;
      b.textContent = text().button;
      const actions = card.querySelector('.result-actions');
      (actions || card).appendChild(b);
    });
  }

  result.addEventListener('click', e => {
    const b = e.target.closest('[data-wiki-info]');
    if (b) showWikipedia(b, b.dataset.wikiInfo);
  });

  new MutationObserver(enhance).observe(result, { childList:true, subtree:true });
  document.getElementById('languageSelect')?.addEventListener('change', () => setTimeout(() => {
    result.querySelectorAll('[data-wiki-info]').forEach(b => b.textContent = text().button);
  }, 0));
  enhance();
})();
