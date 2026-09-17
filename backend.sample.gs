const SHEET_NAME = "Entries";

function doGet(e) {
  const action = e.parameter.action || "snapshot";
  const callback = e.parameter.callback || "callback";
  const payload = e.parameter.payload ? JSON.parse(e.parameter.payload) : {};
  let result;

  try {
    ensureSheet();
    if (action === "snapshot") result = snapshot();
    else if (action === "upsertEntry") result = upsertEntry(payload.entry);
    else if (action === "deleteEntry") result = deleteEntry(payload.id, payload.deletedAt);
    else result = { ok: false, error: "Unknown action: " + action };
  } catch (error) {
    result = { ok: false, error: String(error && error.message ? error.message : error) };
  }

  return ContentService
    .createTextOutput(callback + "(" + JSON.stringify(result) + ");")
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function ensureSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  const headers = ["id", "person", "periodStart", "minutes", "createdAt", "updatedAt", "deletedAt"];
  const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  if (current.join("") !== headers.join("")) {
    sheet.clear();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
}

function snapshot() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const values = sheet.getDataRange().getValues();
  const headers = values.shift() || [];
  const entries = values
    .filter(row => row[0])
    .map(row => {
      const entry = {};
      headers.forEach((header, index) => entry[header] = row[index]);
      return {
        id: String(entry.id || ""),
        person: String(entry.person || ""),
        periodStart: String(entry.periodStart || ""),
        minutes: Number(entry.minutes || 0),
        createdAt: String(entry.createdAt || ""),
        updatedAt: String(entry.updatedAt || ""),
        deletedAt: String(entry.deletedAt || "")
      };
    });
  return { ok: true, entries };
}

function upsertEntry(entry) {
  if (!entry || !entry.id) return { ok: false, error: "Missing entry.id" };
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const rowIndex = findRowById(sheet, entry.id);
  const row = [
    entry.id,
    entry.person || "",
    entry.periodStart || "",
    Number(entry.minutes || 0),
    entry.createdAt || new Date().toISOString(),
    entry.updatedAt || new Date().toISOString(),
    entry.deletedAt || ""
  ];
  if (rowIndex) sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);
  return { ok: true };
}

function deleteEntry(id, deletedAt) {
  if (!id) return { ok: false, error: "Missing id" };
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const rowIndex = findRowById(sheet, id);
  if (!rowIndex) return { ok: true };
  const now = deletedAt || new Date().toISOString();
  sheet.getRange(rowIndex, 6).setValue(now);
  sheet.getRange(rowIndex, 7).setValue(now);
  return { ok: true };
}

function findRowById(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let index = 0; index < ids.length; index += 1) {
    if (String(ids[index][0]) === String(id)) return index + 2;
  }
  return 0;
}