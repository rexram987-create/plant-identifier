# Plant Identifier

Accessible Hebrew, English and Arabic plant guide.

- Web application: https://rexram987-create.github.io/plant-identifier/
- `android/`: separate native Kotlin app. Web changes do not update the installed APK.
- Image inference runs locally with OpenPlants; PlantNet-300K is the fallback.
- Name search uses GBIF, with local names resolved through Wikipedia/Wikidata.
- iNaturalist observations can reorder candidates. Displayed model scores remain unchanged and are not calibrated probabilities.

## Offline use

First open the website online and complete an image identification. The service worker caches the interface and pinned ONNX runtime; model files are cached on first use. Offline availability depends on successful storage and the browser retaining site data. Name search, regional observations and supplementary articles require internet.

## Development and deployment

The Pages workflow builds/restores the OpenPlants model, downloads the pinned ONNX Runtime 1.22.0 files and stages only public web files in `_site/`. It runs regression checks and a Chromium smoke test including real model inference and offline reload before deployment.

Run code regressions with:

```sh
node scripts/test-web.cjs
```

For the browser smoke test, prepare `_site/` as in the workflow, install Playwright and Chromium, then run `node scripts/browser-smoke.cjs`.

The repository's Pages source should be **GitHub Actions**, so the separate branch/Jekyll deployment does not run alongside the custom workflow.
