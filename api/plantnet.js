const PLANTNET_ENDPOINT = 'https://my-api.plantnet.org/v2/identify/all';

function buildPlantNetUrl(apiKey) {
  const url = new URL(PLANTNET_ENDPOINT);
  url.searchParams.set('api-key', apiKey);
  url.searchParams.set('nb-results', '3');
  url.searchParams.set('lang', 'en');
  return url;
}

function normaliseResults(payload) {
  return (payload?.results || []).slice(0, 3).map(result => ({
    scientificName: result?.species?.scientificNameWithoutAuthor || result?.species?.scientificName || '',
    commonNames: Array.isArray(result?.species?.commonNames) ? result.species.commonNames : [],
    score: Number(result?.score) || 0
  })).filter(result => result.scientificName);
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({error: 'method_not_allowed'});
  const apiKey = process.env.PLANTNET_API_KEY;
  if (!apiKey) return res.status(503).json({error: 'plantnet_not_configured'});

  try {
    const contentType = req.headers['content-type'] || 'application/octet-stream';
    const body = req.body;
    if (!body) return res.status(400).json({error: 'missing_image'});

    let bytes;
    if (Buffer.isBuffer(body)) bytes = body;
    else if (typeof body === 'string') bytes = Buffer.from(body, 'base64');
    else if (body?.type === 'Buffer' && Array.isArray(body.data)) bytes = Buffer.from(body.data);
    else return res.status(400).json({error: 'invalid_image'});

    const form = new FormData();
    form.append('images', new Blob([bytes], {type: contentType}), 'plant.jpg');
    form.append('organs', 'auto');

    const upstream = await fetch(buildPlantNetUrl(apiKey), {method: 'POST', body: form});
    const payload = await upstream.json().catch(() => ({}));
    if (!upstream.ok) return res.status(upstream.status).json({error: 'plantnet_error'});
    return res.status(200).json({source: 'Pl@ntNet', results: normaliseResults(payload)});
  } catch (error) {
    console.error('PlantNet proxy error', error);
    return res.status(502).json({error: 'plantnet_unavailable'});
  }
}

module.exports = handler;
module.exports._test = {buildPlantNetUrl, normaliseResults};
