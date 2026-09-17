# AI Notes

Static GitHub Pages staging project for a newborn sleep tracker.

Repo: https://github.com/talrme/sleep-tracker

Live URL convention: https://talrme.github.io/sleep-tracker/

## Structure

- Root `index.html`: staging chooser.
- `option-1` through `option-5`: standalone staging websites.
- Root `config.js`: shared backend URL and default sync preference for every option.
- `backend.sample.gs`: Google Apps Script JSONP backend for a Sheet-bound deployment.
- `README.md`: user setup instructions.

## Shared App Model

All options share identical app logic in `app.js`.

- localStorage key: `newborn-sleep-tracker-v1`
- people: `Tal`, `Sophie`
- sleep period: local 9 PM to next 9 PM
- goal: 420 minutes per person per period
- entries: `id`, `person`, `periodStart`, `minutes`, `createdAt`, `updatedAt`, `deletedAt`
- backend actions: `snapshot`, `upsertEntry`, `deleteEntry`

The staging options differ primarily in CSS and microcopy. When the user chooses one, promote that option's files to the root, keep `backend.sample.gs`, and remove the unselected options.

## Backend Notes

The frontend uses JSONP via a script tag so it can talk to Apps Script from GitHub Pages without CORS setup.

Backend URL is intentionally configured in root `config.js`, not pasted into phones. Each option loads `../config.js`; update `defaultBackendUrl` there if the Apps Script deployment changes. Phone Settings should not expose URL entry.
