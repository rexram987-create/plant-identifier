# Pl@ntNet Image Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Pl@ntNet as a second, independent photo-identification source without changing or weakening the existing local identifier.

**Architecture:** Keep `PlantLocalAI` as the primary on-device path. Send the same selected JPEG/PNG to the same-origin `/api/plantnet` proxy through `PlantNetAI`; keep the secret server-side; render Pl@ntNet results separately; treat Pl@ntNet network/API failure as optional enrichment failure.

**Tech Stack:** Static HTML/CSS/JavaScript PWA, Vercel Node Function, Node 24 contract tests, GitHub Actions.

**Spec:** Approved conversation design for Pl@ntNet integration.

## Global Constraints

- Do not merge to `main` before Preview/mobile verification and explicit approval.
- Do not expose `PLANTNET_API_KEY` in browser code or GitHub.
- Existing local photo identification must continue independently if Pl@ntNet fails.
- Preserve Hebrew, English, and Arabic UI support.

---

### Task 1: Verify RED integration contract
- [ ] Run the three PlantNet Node contract tests in GitHub Actions.
- [ ] Confirm the app integration test fails because `app.js` does not yet call `PlantNetAI`.

### Task 2: Integrate Pl@ntNet in photo flow
- [ ] Update `app.js` so a selected image starts Pl@ntNet independently of local inference.
- [ ] Keep Pl@ntNet results in a separate `plantnetResults` state field.
- [ ] Render a separate Pl@ntNet section with scientific name, common names, confidence, and existing details search action.
- [ ] Catch Pl@ntNet failure and preserve local results.

### Task 3: PWA and translations
- [ ] Add concise Hebrew/English/Arabic labels for Pl@ntNet loading/results/unavailable state.
- [ ] Update service-worker cached assets/version so installed PWAs receive `plantnet-client.js` and updated app code.

### Task 4: Verify GREEN and Preview
- [ ] Run all PlantNet contract tests and confirm zero failures.
- [ ] Compare feature branch against `main` for unintended changes.
- [ ] Confirm Vercel Preview is READY.
- [ ] Test a real photo in Preview on Android before merge.
