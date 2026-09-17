const ENTRIES_SHEET_NAME = "Entries";
const SETTINGS_SHEET_NAME = "Settings";
const DEFAULT_TARGETS = {
  Tal: 420,
  Sophie: 420
};

function doGet(e) {
  const action = e.parameter.action || "snapshot";
  const callback = e.parameter.callback || "callback";
  const payload = e.parameter.payload ? JSON.parse(e.parameter.payload) : {};
  let result;

  try {
    ensureSheets();
    if (action === "snapshot") result = snapshot();
    else if (action === "upsertEntry") result = upsertEntry(payload.entry);
    else if (action === "deleteEntry") result = deleteEntry(payload.id, payload.deletedAt);
    else if (action === "saveTargets") result = saveTargets(payload.targets);
    else result = { ok: false, error: "Unknown action: " + action };
  } catch (error) {
    result = { ok: false, error: String(error && error.message ? error.message : error) };
  }

  return ContentService
    .createTextOutput(callback + "(" + JSON.stringify(result) + ");")
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function ensureSheets() {
  ensureEntriesSheet();
  ensureSettingsSheet();
}

function ensureEntriesSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(ENTRIES_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(ENTRIES_SHEET_NAME);
  const headers = ["id", "person", "periodStart", "minutes", "createdAt", "updatedAt", "deletedAt"];
  const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  if (current.join("") !== headers.join("")) {
    sheet.clear();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
}

function ensureSettingsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SETTINGS_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SETTINGS_SHEET_NAME);
  const headers = ["key", "value", "updatedAt"];
  const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  if (current.join("") !== headers.join("")) {
    sheet.clear();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  if (!findSettingRow(sheet, "target_Tal")) sheet.appendRow(["target_Tal", DEFAULT_TARGETS.Tal, new Date().toISOString()]);
  if (!findSettingRow(sheet, "target_Sophie")) sheet.appendRow(["target_Sophie", DEFAULT_TARGETS.Sophie, new Date().toISOString()]);
}

function snapshot() {
  return {
    ok: true,
    entries: readEntries(),
    targets: readTargets(),
    spreadsheetUrl: SpreadsheetApp.getActiveSpreadsheet().getUrl()
  };
}

function readEntries() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ENTRIES_SHEET_NAME);
  const values = sheet.getDataRange().getValues();
  const headers = values.shift() || [];
  return values
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
}

function readTargets() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETTINGS_SHEET_NAME);
  const values = sheet.getDataRange().getValues();
  const targets = Object.assign({}, DEFAULT_TARGETS);

  values.slice(1).forEach(row => {
    const key = String(row[0] || "");
    const value = Number(row[1] || 0);
    if (key === "target_Tal" && value > 0) targets.Tal = value;
    if (key === "target_Sophie" && value > 0) targets.Sophie = value;
  });

  return targets;
}

function upsertEntry(entry) {
  if (!entry || !entry.id) return { ok: false, error: "Missing entry.id" };
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ENTRIES_SHEET_NAME);
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
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ENTRIES_SHEET_NAME);
  const rowIndex = findRowById(sheet, id);
  if (!rowIndex) return { ok: true };
  const now = deletedAt || new Date().toISOString();
  sheet.getRange(rowIndex, 6).setValue(now);
  sheet.getRange(rowIndex, 7).setValue(now);
  return { ok: true };
}

function saveTargets(targets) {
  if (!targets) return { ok: false, error: "Missing targets" };
  const cleaned = Object.assign({}, DEFAULT_TARGETS);
  ["Tal", "Sophie"].forEach(person => {
    const value = Number(targets[person] || 0);
    if (value > 0) cleaned[person] = value;
  });
  upsertSetting("target_Tal", cleaned.Tal);
  upsertSetting("target_Sophie", cleaned.Sophie);
  return { ok: true, targets: readTargets() };
}

function upsertSetting(key, value) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETTINGS_SHEET_NAME);
  const rowIndex = findSettingRow(sheet, key);
  const row = [key, value, new Date().toISOString()];
  if (rowIndex) sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);
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

function findSettingRow(sheet, key) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  const keys = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let index = 0; index < keys.length; index += 1) {
    if (String(keys[index][0]) === String(key)) return index + 2;
  }
  return 0;
}
