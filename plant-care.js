(() => {
  const result = document.getElementById('result');
  if (!result) return;
  // Only species with reviewed, species-specific horticultural references appear here.
  // Never infer care requirements from an AI confidence score or another species.
  const care = {
    'nephrolepis biserrata': {
      source: 'https://www.nparks.gov.sg/florafaunaweb/flora/1/5/1554',
      secondary: 'https://plants.ces.ncsu.edu/plants/nephrolepis-biserrata/',
      he: {
        light: 'חצי צל ואור מסונן. בישראל כדאי להגן משמש צהריים חזקה.',
        water: 'לשמור על מצע לח אך לא רווי מים. לבדוק את לחות המצע לפני כל השקיה; לא לקבוע מספר השקיות קבוע בשבוע.',
        humidity: 'מעדיף סביבה לחה; להרחיק מרוח יבשה וממזגן ישיר.',
        temperature: 'שרך טרופי רגיש לכפור; להגן מקור ומחום קיצוני בשמש ישירה.',
        soil: 'מצע עשיר בחומר אורגני ומנוקז היטב; לרוקן מים עומדים מהתחתית.',
        location: 'עציץ בבית מואר או במרפסת מוצלת ומוגנת; עשוי להתפשט ולדרוש מקום.',
        season: 'בקיץ הישראלי לבדוק לחות לעיתים קרובות יותר; בחורף להשקות לפי מצב המצע ולא לפי לוח זמנים.'
      },
      en: {
        light: 'Bright filtered light or partial shade; protect from intense midday sun.',
        water: 'Keep soil moist but not waterlogged; check the potting mix before watering, not a fixed weekly schedule.',
        humidity: 'Prefers a humid setting; avoid drying winds and direct air-conditioning.',
        temperature: 'Tropical, frost-sensitive fern; protect from frost and extreme direct-sun heat.',
        soil: 'Organic-rich, well-drained potting mix; empty standing water from the saucer.',
        location: 'Bright indoor spot or sheltered shaded balcony; allow room to spread.',
        season: 'Check soil more often in hot summers; water less frequently in cool weather as needed.'
      },
      ar: {
        light: 'ضوء ساطع غير مباشر أو ظل جزئي؛ احمه من شمس الظهيرة القوية.',
        water: 'حافظ على تربة رطبة دون إغراق؛ افحص رطوبتها قبل الري بدل جدول أسبوعي ثابت.',
        humidity: 'يفضل الرطوبة؛ أبعده عن الرياح الجافة والتكييف المباشر.',
        temperature: 'سرخس استوائي حساس للصقيع؛ احمه من البرد والحر الشديد تحت الشمس.',
        soil: 'تربة غنية بالمواد العضوية وجيدة التصريف؛ أفرغ الماء الراكد من الصحن.',
        location: 'مكان داخلي مضيء أو شرفة مظللة ومحمية؛ اترك مساحة للنمو.',
        season: 'افحص الرطوبة أكثر صيفًا، وقلل الري شتاءً بحسب حالة التربة.'
      }
    },
    'nephrolepis exaltata': {
      source: 'https://www.rhs.org.uk/plants/11508/nephrolepis-exaltata/details',
      secondary: 'https://plants.ces.ncsu.edu/plants/nephrolepis-exaltata/',
      he: {
        light: 'אור בהיר מסונן או חצי צל; להימנע משמש צהריים חזקה.',
        water: 'לשמור על מצע לח אך לא מוצף; בחורף להפחית השקיה לפי קצב ההתייבשות.',
        humidity: 'לחות בינונית עד גבוהה ואוורור טוב; להרחיק ממזגן ישיר.',
        temperature: 'מעדיף חמימות; להגן מכפור ומקור ממושך.',
        soil: 'מצע עציצים מאוורר ומנוקז היטב, עם חומר אורגני.',
        location: 'מתאים לבית מואר ללא שמש חזקה או למרפסת מוצלת ומוגנת.',
        season: 'בקיץ לבדוק את המצע לעיתים קרובות; בחורף להיזהר מעודף מים.'
      },
      en: {
        light: 'Bright filtered light or partial shade; avoid harsh midday sun.',
        water: 'Keep soil moist but not soggy; reduce watering in winter as growth slows.',
        humidity: 'Moderate to high humidity with good ventilation; avoid direct air-conditioning.',
        temperature: 'Prefers warmth; protect from frost and prolonged cold.',
        soil: 'Airy, well-drained potting mix with organic material.',
        location: 'Bright indoor room or sheltered shaded balcony.',
        season: 'Check soil more often in summer; avoid overwatering in winter.'
      },
      ar: {
        light: 'ضوء ساطع مرشح أو ظل جزئي؛ تجنب شمس الظهيرة الحادة.',
        water: 'حافظ على رطوبة التربة دون إغراق؛ قلل الري شتاءً بحسب الحاجة.',
        humidity: 'رطوبة متوسطة إلى مرتفعة مع تهوية جيدة؛ تجنب التكييف المباشر.',
        temperature: 'يفضل الدفء؛ احمه من الصقيع والبرد الطويل.',
        soil: 'تربة أصص جيدة التصريف وغنية بالمواد العضوية.',
        location: 'غرفة مضيئة أو شرفة مظللة ومحمية.',
        season: 'افحص التربة أكثر صيفًا وتجنب الإفراط في الري شتاءً.'
      }
    }
  };
  const labels = {
    he: {title:'תנאי גידול וטיפול', light:'תאורה',water:'השקיה',humidity:'לחות',temperature:'טמפרטורה',soil:'מצע וניקוז',location:'מיקום',season:'התאמה לעונות בישראל',sources:'מקורות בוטניים',caution:'ההנחיות הן נקודת התחלה למין המזוהה, לא אבחון של מצב הצמח. יש להתאים השקיה לעציץ, למצע ולעונה.'},
    en: {title:'Growing conditions and care',light:'Light',water:'Water',humidity:'Humidity',temperature:'Temperature',soil:'Soil and drainage',location:'Placement',season:'Seasonal adjustment',sources:'Botanical sources',caution:'These are species-specific starting points, not a diagnosis of your plant. Adjust watering to the pot, soil and season.'},
    ar: {title:'ظروف النمو والعناية',light:'الإضاءة',water:'الري',humidity:'الرطوبة',temperature:'الحرارة',soil:'التربة والتصريف',location:'المكان',season:'التكيف الموسمي',sources:'مصادر نباتية',caution:'هذه إرشادات أولية للنوع وليست تشخيصًا لحالة النبتة. اضبط الري حسب الأصيص والتربة والموسم.'}
  };
  const escapeHtml = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  const enhanced = new WeakSet();
  function enhance() {
    result.querySelectorAll('.plant-result-card').forEach(card => {
      if (enhanced.has(card)) return;
      const name = (card.dataset.scientificName || '').toLowerCase().trim().replace(/\\s+/g, ' ');
      if (!name) return;
      enhanced.add(card);
      const record = care[name];
      if (!record) return; // Never fabricate a guide for unknown taxa.
      const language = ['he','en','ar'].includes(document.documentElement.lang) ? document.documentElement.lang : 'he';
      const x = labels[language], info = record[language];
      const details = document.createElement('details');
      details.className = 'plant-care-guide';
      const rows = ['light','water','humidity','temperature','soil','location','season'];
      details.innerHTML = '<summary>' + escapeHtml(x.title) + '</summary>' +
        '<div class="plant-care-content">' +
        rows.map(key => '<p><strong>' + escapeHtml(x[key]) + ':</strong> ' + escapeHtml(info[key]) + '</p>').join('') +
        '<p class="wiki-note">' + escapeHtml(x.caution) + '</p>' +
        '<p><strong>' + escapeHtml(x.sources) + ':</strong> <a href="' + record.source + '" target="_blank" rel="noopener noreferrer">NParks / RHS</a> · <a href="' + record.secondary + '" target="_blank" rel="noopener noreferrer">NC State Extension</a></p>' +
        '</div>';
      card.appendChild(details);
    });
  }
  new MutationObserver(enhance).observe(result, {childList:true,subtree:true});
  enhance();
})();
