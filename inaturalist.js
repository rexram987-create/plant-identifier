(() => {
  const API = 'https://api.inaturalist.org/v1';
  const result = document.getElementById('result');
  if (!result) return;

  const ui = {
    he: { compare:'השווה לתצפיות iNaturalist', loading:'טוען תמונות ותצפיות מ־iNaturalist…', noMatch:'לא נמצאה התאמה מתאימה ב־iNaturalist.', observations:'תצפיות אמיתיות להשוואה', open:'פתח ב־iNaturalist', common:'שם נפוץ', seen:'תצפיות מחקריות', note:'השווה את צורת הפרח, העלים והגבעול לתמונות. זו בדיקת עזר ולא זיהוי ודאי.' },
    en: { compare:'Compare with iNaturalist', loading:'Loading iNaturalist observations and photos…', noMatch:'No suitable iNaturalist match was found.', observations:'Real observations for comparison', open:'Open in iNaturalist', common:'Common name', seen:'research observations', note:'Compare flower, leaf and stem shape with these photos. This is supporting evidence, not a certain identification.' },
    ar: { compare:'قارن مع iNaturalist', loading:'جارٍ تحميل صور ومشاهدات من iNaturalist…', noMatch:'لم يتم العثور على تطابق مناسب في iNaturalist.', observations:'مشاهدات حقيقية للمقارنة', open:'افتح في iNaturalist', common:'الاسم الشائع', seen:'مشاهدات بحثية', note:'قارن شكل الزهرة والأوراق والساق بالصور. هذه أداة مساعدة وليست تعريفًا مؤكدًا.' }
  };

  function lang() { return ['he','en','ar'].includes(document.documentElement.lang) ? document.documentElement.lang : 'he'; }
  function text() { return ui[lang()] || ui.he; }
  function esc(v) { return String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }

  async function findTaxon(name) {
    const r = await fetch(`${API}/taxa?q=${encodeURIComponent(name)}&rank=species&per_page=8`);
    if (!r.ok) throw new Error(`iNaturalist taxa ${r.status}`);
    const rows = (await r.json()).results || [];
    const exact = rows.find(x => (x.name || '').toLowerCase() === name.toLowerCase());
    return exact || rows[0] || null;
  }

  async function observations(taxonId) {
    const r = await fetch(`${API}/observations?taxon_id=${encodeURIComponent(taxonId)}&photos=true&quality_grade=research&per_page=12&order_by=votes&order=desc`);
    if (!r.ok) throw new Error(`iNaturalist observations ${r.status}`);
    return (await r.json()).results || [];
  }

  function photoUrl(photo) {
    const u = photo?.url || '';
    return u.replace('/square.', '/medium.');
  }

  async function showComparison(button, name) {
    const card = button.closest('.plant-result-card');
    if (!card) return;
    let panel = card.querySelector('.inat-panel');
    if (!panel) {
      panel = document.createElement('section');
      panel.className = 'inat-panel';
      panel.setAttribute('aria-live','polite');
      card.appendChild(panel);
    }
    const x = text();
    button.disabled = true;
    panel.innerHTML = `<p class="result-message" role="status">${esc(x.loading)}</p>`;
    try {
      const taxon = await findTaxon(name);
      if (!taxon) { panel.innerHTML = `<p>${esc(x.noMatch)}</p>`; return; }
      const obs = await observations(taxon.id);
      const photos = [];
      if (taxon.default_photo?.medium_url || taxon.default_photo?.url) photos.push({url: taxon.default_photo.medium_url || photoUrl(taxon.default_photo), by: taxon.default_photo.attribution || ''});
      for (const o of obs) {
        for (const p of (o.photos || [])) {
          const url = photoUrl(p);
          if (url && !photos.some(z => z.url === url)) photos.push({url, by: p.attribution || ''});
          if (photos.length >= 5) break;
        }
        if (photos.length >= 5) break;
      }
      const common = taxon.preferred_common_name || '';
      const taxonUrl = `https://www.inaturalist.org/taxa/${taxon.id}`;
      panel.innerHTML = `
        <h4>${esc(x.observations)} — <em>${esc(taxon.name)}</em></h4>
        ${common ? `<p><strong>${esc(x.common)}:</strong> ${esc(common)}</p>` : ''}
        <p>${esc(x.note)}</p>
        ${photos.length ? `<div class="inat-gallery">${photos.map(p => `<figure><img src="${esc(p.url)}" alt="${esc(taxon.name)}" loading="lazy">${p.by ? `<figcaption>${esc(p.by)}</figcaption>` : ''}</figure>`).join('')}</div>` : ''}
        <p>${obs.length} ${esc(x.seen)}</p>
        <a class="source-link" href="${taxonUrl}" target="_blank" rel="noopener noreferrer">${esc(x.open)}</a>`;
    } catch (e) {
      console.error(e);
      panel.innerHTML = `<p>${esc(x.noMatch)}</p>`;
    } finally {
      button.disabled = false;
    }
  }

  function enhance() {
    result.querySelectorAll('.plant-result-card').forEach(card => {
      const em = card.querySelector('h3 em');
      if (!em || card.querySelector('[data-inat-compare]')) return;
      const name = em.textContent.trim();
      if (!name) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'inat-compare';
      b.dataset.inatCompare = name;
      b.textContent = text().compare;
      const actions = card.querySelector('.result-actions');
      (actions || card).appendChild(b);
    });
  }

  result.addEventListener('click', e => {
    const b = e.target.closest('[data-inat-compare]');
    if (b) showComparison(b, b.dataset.inatCompare);
  });

  new MutationObserver(enhance).observe(result, {childList:true, subtree:true});
  document.getElementById('languageSelect')?.addEventListener('change', () => setTimeout(() => {
    result.querySelectorAll('[data-inat-compare]').forEach(b => b.textContent = text().compare);
  }, 0));
  enhance();
})();
