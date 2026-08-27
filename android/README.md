# Native Android Plant Identifier

This directory is the start of the native Android version of Plant Identifier.

## Goal
Run plant photo identification natively on Android with ONNX Runtime Mobile instead of running the large OpenPlants model inside a browser/PWA.

## Architecture
- Kotlin Android application
- ONNX Runtime Mobile for local inference
- OpenPlants ONNX model stored/downloaded for native use
- Existing GBIF, iNaturalist, Wikipedia/Wikidata services remain available over HTTPS
- Hebrew-first accessible UI, with English and Arabic planned
- Existing web/PWA remains unchanged

## First milestone
1. Create Android project shell.
2. Add ONNX Runtime Mobile dependency.
3. Add photo picker/camera input.
4. Load the OpenPlants model locally.
5. Preprocess a selected image and run inference.
6. Display top candidates.
7. Add geographic re-ranking using iNaturalist.

The native version is being developed separately so the working web application is not broken while Android support is added.
