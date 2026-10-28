# AGENTS.md

## Stack
- Static web app built with plain HTML, CSS, and JavaScript.
- Firebase Web SDK for Authentication and Cloud Firestore.
- No framework build step is required for the main app; the browser loads the Firebase SDK directly.
- The app is designed for a browser and relies on browser APIs such as camera access and local HTTPS or localhost.

## Build approach
- Tracer Bullet (livrer un parcours complet et réel de l’interface jusqu’aux données).

## Git
- integration: on
- branch policy: keep work on feature branches until the code is reviewed and ready to merge
- commit: milestone based, with a clear summary of the user facing change

## Project map
- `index.html`: main application UI, login, search, scan, and Firestore reads.
- `firebase-config.js`: browser safe Firebase configuration for the app. Keep secrets out of source control; only public config belongs here.
- `docs/scope/scope.md`: the feature scope for the product and next slices.
- Firestore collection in use: `stockPositions`.

## Known data conventions
- Search and barcode lookup are driven by the `stockPositions` collection.
- Relevant fields already used in the app include `articlecode`, `barcodes`, `storename`, `divisionname`, `address`, `currentqy`, `quantity`, `inventorydate`, and `dateinventaire`.
- The app expects one row per stock position, not one row per article aggregated across stores or locations.
- A barcode may be stored as a plain string or as an array of strings; the code handles both.
- Respect Firebase Auth and Firestore security rules; only read data that the signed in user is allowed to access.

## Rules for work in this repo
- Do not delete existing functionality. Keep login, search, and barcode scan behavior working.
- Do not mutate Firestore during read-only workflows such as export.
- Respect user permissions and security rules before reading or exporting any record.
- Do not expose real secrets, tokens, private keys, or privileged Firebase credentials in the codebase or in generated files.
- Prefer browser side logic for exports and UI actions, with no server side secret material.
- When adding exports, preserve pagination or batched reads so large datasets are fully exported without silently truncating results.
- If a feature depends on a new decision, capture it in a spec before implementation; do not infer a new architecture silently.

## Commands and local checks
- Open the app in a browser from the project folder, or serve it with a simple local static server for local testing.
- Validate UI changes in the browser and check that Firestore reads still work with the signed in user.
- Before a public Git push, verify that no secret or private configuration is included in tracked files.

## Context files
- [docs/scope/scope.md](docs/scope/scope.md) (current feature scope for the stock application)

---

Drafted by: /audit
