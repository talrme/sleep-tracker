# sleep-tracker

**Live site:** [https://talrme.github.io/sleep-tracker/](https://talrme.github.io/sleep-tracker/)

Phone-first newborn sleep tracker for Tal and Sophie.

## What It Does

- Tracks sleep in 9 PM to 9 PM windows.
- Shows Tal and Sophie as the main two tiles.
- Quick-adds common sleep chunks: 30m, 45m, 1h, 1h 30m, 2h, and 3h.
- Supports a quieter custom add flow where choosing a duration from `More...` immediately adds it.
- Lets each phone choose who appears first with the local `Who am I?` setting.
- Lets each phone choose its own theme and compact mode.
- Syncs entries through a Google Sheet-backed Apps Script.
- Syncs Tal and Sophie target times through the same backend once the updated script is deployed.

## Backend Sync

The Apps Script URL is configured once in `config.js`, so neither phone needs to paste a URL:

```js
window.SLEEP_TRACKER_CONFIG = {
  defaultBackendUrl: "https://script.google.com/macros/s/AKfycbyP_lu_mAzXexuXQx5C0XKTU5srlKaGGSlFlcg9ZU6_s58gg2BxMuUfqxEkJWp9lV8t6w/exec",
  spreadsheetUrl: "",
  autoSync: true
};
```

Entries write to the backend immediately. Other phones pick up changes when the page opens, when it returns to the foreground, or during the quiet background sync about once per minute.

Local-only settings:

- Who appears first
- Theme
- Compact mode

Shared settings:

- Tal target sleep time
- Sophie target sleep time

The Settings modal also shows an `Open spreadsheet` link. The updated backend returns the backing Google Sheet URL automatically during sync. If needed, the link can also be hard-coded in `config.js` as `spreadsheetUrl`.

## Update The Current Apps Script

Target syncing needs the newer script in `backend.sample.gs`. The `/exec` URL can stay the same.

1. Open the Google Sheet backing this app.
2. Click `Extensions -> Apps Script`.
3. Open `Code.gs`.
4. Replace the full contents of `Code.gs` with the current contents of `backend.sample.gs`.
5. Click Save.
6. Click `Deploy -> Manage deployments`.
7. Click the pencil/edit icon for the existing web app deployment.
8. Set `Version` to `New version`.
9. Click `Deploy`.
10. Open the live site and let it sync once.

The script will create a new `Settings` tab in the Sheet for target times, and it will return the Sheet URL so the app can show the spreadsheet link in Settings. Existing sleep entries stay in the `Entries` tab.

## New Backend Setup

1. Create a blank Google Sheet.
2. Name it something like `newborn sleep tracker backend`.
3. In the Sheet, click `Extensions -> Apps Script`.
4. Delete the starter code in `Code.gs`.
5. Paste in all of `backend.sample.gs` from this repo.
6. Save the Apps Script project.
7. Click `Deploy -> New deployment`.
8. Choose deployment type `Web app`.
9. Use:
   - Execute as: `Me`
   - Who has access: `Anyone`
10. Click `Deploy` and authorize the script when Google asks.
11. Copy the Web app URL ending in `/exec`.
12. Put that `/exec` URL in the repo's root `config.js` as `defaultBackendUrl`.
13. Push the change to GitHub.
14. Once GitHub Pages updates, both phones can open the live site.

The Google Sheet itself can stay private. The Apps Script writes to it as the sheet owner.

## Security Note

This is intentionally simple. Anyone with the Apps Script URL can write to the backend sheet. That is probably fine for this family sleep tracker, but it is not a secure general-purpose backend.
