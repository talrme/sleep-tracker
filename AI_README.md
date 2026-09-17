# AI Notes

Static GitHub Pages project for Tal and Sophie's newborn sleep tracker.

Repo: https://github.com/talrme/sleep-tracker

Live URL: https://talrme.github.io/sleep-tracker/

## Structure

- Root `index.html`, `app.js`, and `styles.css`: live app using the Night Shift direction by default.
- Root `config.js`: shared Apps Script URL and default sync preference.
- `backend.sample.gs`: Google Apps Script JSONP backend for a Sheet-bound deployment.
- `README.md`: user setup and backend update instructions.

## App Model

- localStorage key: `newborn-sleep-tracker-v1`
- people: `Tal`, `Sophie`
- sleep period: local 9 PM to next 9 PM
- default target: 420 minutes per person
- entries: `id`, `person`, `periodStart`, `minutes`, `createdAt`, `updatedAt`, `deletedAt`
- local settings: `self`, `theme`, `compact`, `reduceMotion`, `autoSync`
- backend-backed settings: `targets.Tal`, `targets.Sophie`
- spreadsheet link: read from `config.js` or from `snapshot.spreadsheetUrl`

## Backend Contract

The frontend uses JSONP through script tags so GitHub Pages can talk to Apps Script without CORS setup.

Supported actions:

- `snapshot`: returns `{ ok, entries, targets, spreadsheetUrl }`
- `upsertEntry`: accepts `{ entry }`
- `deleteEntry`: accepts `{ id, deletedAt }`
- `saveTargets`: accepts `{ targets }` and returns `{ ok, targets }`

The updated backend creates two tabs:

- `Entries`: one row per sleep entry, including soft-deleted entries.
- `Settings`: key/value storage for synced target minutes.

If an older Apps Script is still deployed, entries continue to sync but target changes will show `Targets need backend update`.
