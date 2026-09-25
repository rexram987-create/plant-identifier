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

async function readRequestBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body, 'base64');
  if (req.body?.type === 'Buffer' && Array.isArray(req.body.data)) return Buffer.from(req.body.data);
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({error: 'method_not_allowed'});
  const apiKey = process.env.PLANTNET_API_KEY;
  if (!apiKey) return res.status(503).json({error: 'plantnet_not_configured'});

  try {
    const contentType = req.headers['content-type'] || 'application/octet-stream';
    if (!/^image\/(jpeg|png)(?:;|$)/i.test(contentType)) {
      return res.status(415).json({error: 'unsupported_image_type'});
    }
    const bytes = await readRequestBody(req);
    if (!bytes.length) return res.status(400).json({error: 'missing_image'});

    const form = new FormData();
    form.append('images', new Blob([bytes], {type: contentType}), 'plant.jpg');
    form.append('organs', 'auto');

    const upstream = await fetch(buildPlantNetUrl(apiKey), {method: 'POST', body: form});
    const payload = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      // Pl@ntNet documents 404 "Species not found" as an identification outcome.
      // Do not log provider response bodies, image contents, or the API key.
      const description = [payload?.message, payload?.error, payload?.detail]
        .filter(value => typeof value === 'string').join(' ');
      const speciesNotFound = upstream.status === 404 && /species not found/i.test(description);
      if (speciesNotFound) {
        console.info('PlantNet identification returned no species (HTTP 404)');
        return res.status(200).json({source: 'Pl@ntNet', results: []});
      }

      let keyCheck = 'not_checked';
      if (upstream.status === 404) {
        try {
          const quotaUrl = new URL('https://my-api.plantnet.org/v2/quota');
          quotaUrl.searchParams.set('api-key', apiKey);
          const quotaResponse = await fetch(quotaUrl, {signal: AbortSignal.timeout(4000)});
          keyCheck = quotaResponse.ok ? 'accepted' :
            [401, 403].includes(quotaResponse.status) ? 'rejected' : 'inconclusive';
        } catch {
          keyCheck = 'unavailable';
        }
      }
      console.error('PlantNet identification failed', JSON.stringify({
        status: upstream.status, keyCheck
      }));
      return res.status(upstream.status).json({
        error: 'plantnet_error',
        upstreamStatus: upstream.status,
        keyCheck
      });
    }
    return res.status(200).json({source: 'Pl@ntNet', results: normaliseResults(payload)});
  } catch (error) {
    console.error('PlantNet proxy error', error);
    return res.status(502).json({error: 'plantnet_unavailable'});
  }
}

module.exports = handler;
module.exports._test = {buildPlantNetUrl, normaliseResults, readRequestBody};
