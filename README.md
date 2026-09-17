# sleep-tracker

**Live site:** [https://talrme.github.io/sleep-tracker/](https://talrme.github.io/sleep-tracker/)

Phone-first newborn sleep tracker staging project for Tal and Sophie.

## Staging Options

- [Option 1 - Moon Cards](option-1/)
- [Option 2 - Night Shift](option-2/)
- [Option 3 - Soft Ledger](option-3/)
- [Option 4 - Baby Monitor](option-4/)
- [Option 5 - Split Shift](option-5/)

Each option is fully functional with local browser storage. Each one uses the same data model and the same optional Google Apps Script backend, so the selected visual direction can be promoted without rethinking the storage layer.

## Behavior

- Sleep day runs from 9 PM to 9 PM.
- Goal is 7 hours per person per sleep day.
- People are fixed as Tal and Sophie.
- Quick-add buttons: 30m, 45m, 1h, 1h 30m, 2h, 3h.
- Custom duration dropdown runs in 15-minute increments up to 9 hours.
- Edit mode exposes edit/delete controls for entries in each person card.
- The Apps Script URL is configured once in `config.js` in the repo, so neither phone needs URL setup.
- Settings stores only phone-local preferences like sync-on-open and reduce motion.

## Google Sheet Backend Setup

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
14. Once GitHub Pages updates, both phones can just open the live site. No phone needs the URL pasted into Settings.

The Google Sheet itself can stay private. The Apps Script writes to it as the sheet owner.

## Where The Backend URL Goes

The shared backend is configured in one checked-in file:

```js
window.SLEEP_TRACKER_CONFIG = {
  defaultBackendUrl: "https://script.google.com/macros/s/AKfycbyP_lu_mAzXexuXQx5C0XKTU5srlKaGGSlFlcg9ZU6_s58gg2BxMuUfqxEkJWp9lV8t6w/exec",
  autoSync: true
};
```

The checked-in site is already configured with the current Apps Script deployment URL.

## Security Note

This is intentionally simple. Anyone with the Apps Script URL can write to the backend sheet. That is probably fine for this family sleep tracker, but it is not a secure general-purpose backend.
