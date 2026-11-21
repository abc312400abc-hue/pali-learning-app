# Changelog

## v2.0.0 — Content foundation
- Separate content cards from personal learning records.
- Migrate v1 IndexedDB learning state on first v2 launch.
- Add versioned JSON content-package import and downloadable template.
- Preserve learning records when an existing card ID is updated.
- Retain deprecated content rather than deleting it.
- Add provenance-aware usage rendering and explicit verification labels.

## v3 — related-word navigation
- Related words are now real buttons and open the selected word's detail sheet.
- Added an in-detail back button to return to the previous related word.
- Learning actions inside a related word's detail sheet apply to that displayed word, not accidentally to the deck's current card.
- Service-worker cache updated to v3.
