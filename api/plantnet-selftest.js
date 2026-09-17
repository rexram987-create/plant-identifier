const PLANTNET_ENDPOINT = 'https://my-api.plantnet.org/v2/identify/all';
const TEST_IMAGE = 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Chrysanthemum%20weyrichii%202.jpg';

function normaliseResults(payload) {
  return (payload?.results || []).slice(0, 3).map(result => ({
    scientificName: result?.species?.scientificNameWithoutAuthor || result?.species?.scientificName || '',
    commonNames: Array.isArray(result?.species?.commonNames) ? result.species.commonNames : [],
    score: Number(result?.score) || 0
  })).filter(result => result.scientificName);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({error: 'method_not_allowed'});
  const apiKey = process.env.PLANTNET_API_KEY;
  if (!apiKey) return res.status(503).json({error: 'plantnet_not_configured'});

  try {
    const imageResponse = await fetch(TEST_IMAGE, {redirect: 'follow'});
    if (!imageResponse.ok) return res.status(502).json({error: 'test_image_unavailable', status: imageResponse.status});
    const bytes = await imageResponse.arrayBuffer();
    const form = new FormData();
    form.append('images', new Blob([bytes], {type: 'image/jpeg'}), 'Chrysanthemum-weyrichii-2.jpg');
    form.append('organs', 'flower');

    const url = new URL(PLANTNET_ENDPOINT);
    url.searchParams.set('api-key', apiKey);
    url.searchParams.set('nb-results', '3');
    url.searchParams.set('lang', 'en');
    const upstream = await fetch(url, {method: 'POST', body: form});
    const payload = await upstream.json().catch(() => ({}));
    if (!upstream.ok) return res.status(upstream.status).json({error: 'plantnet_error', upstreamStatus: upstream.status});
    return res.status(200).json({ok: true, source: 'Pl@ntNet', expected: 'Chrysanthemum weyrichii', results: normaliseResults(payload)});
  } catch (error) {
    console.error('PlantNet self-test error', error);
    return res.status(502).json({error: 'plantnet_selftest_unavailable'});
  }
};
