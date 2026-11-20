# Pāli Learning App — v2 content system

A personal, offline-first Pāli vocabulary learning PWA. No account, server, analytics, ads, or cloud sync.

## What's new in v2

- Content cards are stored separately from personal learning records in IndexedDB.
- Existing v1 learning data is migrated on first launch; the old `appState` store is retained.
- Import a versioned JSON content package from the **导入词汇** button.
- Download an empty package template from **下载词汇模板**.
- Import validates the package before writing. Duplicate IDs inside one package are rejected.
- A matching stable card ID updates its teaching content; it does not overwrite that card's learning record.
- New active cards are added to the current queue. Deprecated/inactive cards are removed from the active queue but retained in the content database and history.
- Usage examples display their source and verification status. Empty examples are explicitly marked as not yet verified; the app does not invent sutta quotations.
- Service-worker cache version is bumped to v2 so the new app shell can replace v1.

## Deploy

Upload the contents of this folder to the root of your GitHub Pages repository, replacing the old files. Keep the same repository and Pages settings. After deployment, open the site in Chrome and refresh once. If the old shell remains cached, close the installed PWA/tab and reopen the site; the service worker uses a new cache name (`pali-learning-shell-v2`).

## Content package format

A package is a UTF-8 JSON file with this top-level structure:

```json
{
  "schemaVersion": 1,
  "packageId": "pali-core-vocabulary",
  "packageVersion": "1.0.0",
  "title": "Pāli core vocabulary",
  "language": "pi",
  "description": "A short description of this package.",
  "cards": []
}
```

Each card must have a stable `id` and a non-empty `headword`. IDs must be 2–80 characters and use only ASCII letters, numbers, `.`, `_`, and `-`. Once published, do not change an ID just because the spelling, gloss, or teaching text changes.

Recommended card fields:

| Field | Purpose |
|---|---|
| `id` | Stable internal identifier, e.g. `dukkha` |
| `headword` | Dictionary lemma / headword |
| `display` | Display form shown on the card, including diacritics |
| `meaning` | Short front-of-card gloss |
| `category`, `hint` | Card grouping and learning prompt |
| `partOfSpeech` | Part of speech, with uncertainty stated where needed |
| `core`, `explanation`, `story` | Core meaning and teaching content |
| `morphology` | Object for root, formation, inflection, grammatical notes, etc. |
| `senses` | Array of contextual senses; do not force one-to-one English/Chinese equivalents |
| `usage` | Array of real examples with text, translation, source, segment ID, and verification status |
| `relations` | Array of typed relations; distinguish derivation, collocation, semantic, teaching, contrast, etc. |
| `provenance` | Sources, editions, dictionary versions, URLs, access dates, and editorial notes |
| `contentStatus` | e.g. `draft`, `needs-review`, `verified`, `teaching-draft` |
| `active` | `false` deprecates the card without deleting it |
| `deprecatedReason` | Why it was deprecated |

Example card (format illustration only; not a claim that the sample content is academically verified):

```json
{
  "id": "example-lemma",
  "headword": "example-lemma",
  "display": "example-lemma",
  "meaning": "short gloss",
  "category": "basic vocabulary",
  "hint": "a learning prompt",
  "partOfSpeech": "noun",
  "core": "A concise core semantic description.",
  "explanation": "A fuller explanation with context and limits.",
  "story": "A teaching scene or observation.",
  "morphology": {
    "root": null,
    "formation": "to be researched",
    "notes": []
  },
  "senses": [],
  "usage": [
    {
      "paliText": "",
      "translation": "",
      "verificationStatus": "needs-review",
      "source": {
        "collection": "",
        "reference": "",
        "segmentId": "",
        "url": ""
      }
    }
  ],
  "relations": [
    {
      "targetId": "another-stable-id",
      "type": "teaching",
      "label": "related term",
      "note": "Teaching association; not a historical derivation."
    }
  ],
  "provenance": [],
  "contentStatus": "draft",
  "active": true
}
```

Allowed relation types currently documented: `synonym`, `antonym`, `derivation`, `collocation`, `semantic`, `teaching`, `contrast`. Do not label a teaching association as an etymological or derivational relationship.

## Storage model

- `contentCards`: versioned teaching content keyed by stable card ID.
- `learningRecords`: personal state keyed by card ID (`NEW`, `LEARNING`, `RECOGNIZED`, `FAMILIAR` as the planned state vocabulary; current first-pass card actions write `LEARNING` or `RECOGNIZED`).
- `appState`: current queue and undo history.
- `metadata`: imported package versions and timestamps.

Content import only writes `contentCards` and package metadata. It does not write to `learningRecords`.

## Research sources and licensing notes

- Digital Pāḷi Dictionary database: https://github.com/digitalpalidictionary/dpd-db. Its data is CC BY-NC-SA 4.0. This app does **not** bundle or redistribute DPD data. Any future use must retain attribution, observe the non-commercial condition, and share adaptations under the same license.
- SuttaCentral Bilara data: https://github.com/suttacentral/bilara-data. Consult the repository's current per-data licensing and attribution information before importing any texts. Do not assume every file in a repository has identical rights without checking.
- Recall flashcard PWA: https://github.com/elijahcroft/flashcards. Used as an architectural reference for local IndexedDB storage, JSON backup/import, and offline PWA patterns; no source code is copied into this project.

## Important limitations of this milestone

- This is a first content-import implementation, not yet the complete vocabulary editor or semantic graph browser.
- The current demo cards are teaching drafts, not source-verified dictionary entries.
- The import validator checks essential structure and IDs; it is not yet a full scholarly validation engine.
- The app remains a static PWA. All content and learning data remain on this device unless exported separately.
