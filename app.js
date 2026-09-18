const STORAGE_KEY = "newborn-sleep-tracker-v1";
const PEOPLE = ["Tal", "Sophie"];
const DEFAULT_TARGETS = { Tal: 420, Sophie: 420 };
const QUICK_MINUTES = [30, 45, 60, 90, 120, 180];
const DELETE_MARKER = "__DELETE__";
const SYNC_INTERVAL_MS = 60000;
const HISTORY_LOOKBACK_DAYS = 60;
const RECENT_DAYS_TO_SHOW = 4;

const state = {
  selectedStart: "",
  editingEntryId: "",
  entries: [],
  targets: { ...DEFAULT_TARGETS },
  spreadsheetUrl: window.SLEEP_TRACKER_CONFIG?.spreadsheetUrl || "",
  editMode: {},
  settings: {
    self: "Tal",
    theme: "night",
    compact: false,
    reduceMotion: false,
    autoSync: window.SLEEP_TRACKER_CONFIG?.autoSync ?? true
  }
};

const els = {
  periodTitle: document.querySelector("[data-period-title]"),
  periodRange: document.querySelector("[data-period-range]"),
  todayGrid: document.querySelector("[data-today-grid]"),
  historyList: document.querySelector("[data-history-list]"),
  settingsBackdrop: document.querySelector("[data-settings-backdrop]"),
  settingsModal: document.querySelector("[data-settings-modal]"),
  selfToggle: document.querySelector("[data-person-toggle]"),
  selfButtons: Array.from(document.querySelectorAll("[data-self-option]")),
  themeButtons: Array.from(document.querySelectorAll("[data-theme-option]")),
  compact: document.querySelector("[data-setting-compact]"),
  targetTal: document.querySelector("[data-target-tal]"),
  targetSophie: document.querySelector("[data-target-sophie]"),
  spreadsheetLink: document.querySelector("[data-spreadsheet-link]"),
  spreadsheetMissing: document.querySelector("[data-spreadsheet-missing]"),
  syncNote: document.querySelector("[data-sync-note]"),
  historyBackdrop: document.querySelector("[data-history-backdrop]"),
  historyModal: document.querySelector("[data-history-modal]"),
  historyChart: document.querySelector("[data-history-chart]"),
  entryBackdrop: document.querySelector("[data-entry-backdrop]"),
  entryModal: document.querySelector("[data-entry-modal]"),
  entryMinutes: document.querySelector("[data-entry-minutes]")
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (Array.isArray(saved.entries)) {
      state.entries = saved.entries.filter((entry) => !entry._sample).map(normalizeEntry);
    }
    if (saved.targets && typeof saved.targets === "object") {
      state.targets = { ...DEFAULT_TARGETS, ...normalizeTargets(saved.targets) };
    }
    if (typeof saved.spreadsheetUrl === "string" && saved.spreadsheetUrl) {
      state.spreadsheetUrl = saved.spreadsheetUrl;
    }
    Object.assign(state.settings, saved.settings || {});
    delete state.settings.backendUrl;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  if (!PEOPLE.includes(state.settings.self)) state.settings.self = "Tal";
  if (!["night", "moon", "ledger", "sunrise"].includes(state.settings.theme)) state.settings.theme = "night";
  state.selectedStart = currentPeriodStart();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    entries: state.entries,
    targets: state.targets,
    spreadsheetUrl: state.spreadsheetUrl,
    settings: state.settings
  }));
}

function render() {
  document.body.classList.toggle("reduce-motion", state.settings.reduceMotion);
  document.body.classList.toggle("compact-mode", state.settings.compact);
  document.body.dataset.theme = state.settings.theme;
  renderSelectOptions();
  renderSettings();
  renderPeriod();
  renderCards();
  renderHistory();
  if (els.historyModal && !els.historyModal.hidden) renderHistoryChart();
}

function renderSelectOptions() {
  if (!els.entryMinutes.dataset.ready) {
    els.entryMinutes.innerHTML = durationOptionsHtml(15, 9 * 60, true);
    els.entryMinutes.dataset.ready = "true";
  }
  if (!els.targetTal.dataset.ready) {
    const targetOptions = durationOptionsHtml(4 * 60, 10 * 60, true);
    els.targetTal.innerHTML = targetOptions;
    els.targetSophie.innerHTML = targetOptions;
    els.targetTal.dataset.ready = "true";
    els.targetSophie.dataset.ready = "true";
  }
}

function renderSettings() {
  renderSelfButtons();
  renderThemeButtons();
  els.compact.checked = Boolean(state.settings.compact);
  els.targetTal.value = String(targetFor("Tal"));
  els.targetSophie.value = String(targetFor("Sophie"));
  renderSpreadsheetLink();
}

function renderSelfButtons() {
  if (els.selfToggle) els.selfToggle.dataset.selected = state.settings.self;
  els.selfButtons.forEach((button) => {
    const selected = button.dataset.selfOption === state.settings.self;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
  });
}

function renderThemeButtons() {
  els.themeButtons.forEach((button) => {
    const selected = button.dataset.themeOption === state.settings.theme;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function renderSpreadsheetLink() {
  const url = state.spreadsheetUrl || window.SLEEP_TRACKER_CONFIG?.spreadsheetUrl || "";
  if (url) {
    els.spreadsheetLink.href = url;
    els.spreadsheetLink.hidden = false;
    els.spreadsheetMissing.hidden = true;
  } else {
    els.spreadsheetLink.hidden = true;
    els.spreadsheetMissing.hidden = false;
  }
}

function durationOptionsHtml(start, end, includeZero = false) {
  const options = [];
  if (includeZero) options.push('<option value="">Select</option>');
  for (let minutes = start; minutes <= end; minutes += 15) {
    options.push('<option value="' + minutes + '">' + formatDuration(minutes) + '</option>');
  }
  return options.join("");
}

function renderPeriod() {
  const start = parseLocalDate(state.selectedStart);
  const end = addDays(start, 1);
  els.periodTitle.textContent = formatShortRange(start, end);
  els.periodRange.textContent = formatLongRange(start, end);
}

function renderCards() {
  els.todayGrid.innerHTML = orderedPeople().map((person) => personCard(person, state.selectedStart)).join("");
}

function renderHistory() {
  const starts = recentNonEmptyPeriodStarts();
  if (!starts.length) {
    els.historyList.innerHTML = '<p class="empty-history">No recent sleep entries yet</p>';
    return;
  }
  els.historyList.innerHTML = starts.map((periodStart) => {
    const start = parseLocalDate(periodStart);
    const end = addDays(start, 1);
    return '<section class="history-day"><h3>' + escapeHtml(formatShortRange(start, end)) + '</h3><div class="mini-pair">' + orderedPeople().map((person) => miniCard(person, periodStart)).join("") + '</div></section>';
  }).join("");
}

function personCard(person, periodStart) {
  const entries = visibleEntries(person, periodStart);
  const total = totalFor(person, periodStart);
  const target = targetFor(person);
  const remaining = Math.max(0, target - total);
  const percent = target ? Math.min(100, Math.round((total / target) * 100)) : 100;
  const targetMet = total > 0 && total >= target;
  const editing = Boolean(state.editMode[cardKey(person, periodStart)]);
  const toneClass = person === "Tal" ? "tal-card" : "sophie-card";
  const entryHtml = entryListHtml(entries, editing);
  const quickHtml = QUICK_MINUTES.map((minutes) => '<button type="button" data-quick-add="' + person + '" data-minutes="' + minutes + '">' + formatDurationCompact(minutes) + '</button>').join("");
  const editLabel = editing ? "Done Editing" : "Edit entries";

  return '<article class="sleep-card ' + toneClass + (targetMet ? ' target-met' : '') + '" style="--progress:' + percent + '%">' +
    '<div class="card-top"><div><p class="person-name">' + escapeHtml(person) + (targetMet ? '<span class="target-star" aria-label="Target met" title="Target met">★</span>' : '') + '</p><h2>' + formatDuration(total) + '</h2></div><div class="goal-badge"><strong>' + percent + '%</strong><span>of ' + formatDurationCompact(target) + '</span></div></div>' +
    '<div class="progress-track" aria-label="' + escapeHtml(person) + ' sleep progress"><span></span></div>' +
    '<div class="sleep-status"><span></span><strong>' + (remaining ? formatDuration(remaining) + ' to go' : 'done') + '</strong></div>' +
    '<div class="entry-row ' + (editing ? 'is-editing' : '') + '"><div class="entry-list ' + (editing ? 'is-editing' : '') + '">' + entryHtml + '</div><button type="button" class="' + (editing ? 'done-editing-button' : 'edit-icon') + '" data-toggle-edit="' + person + '" aria-label="' + editLabel + ' for ' + escapeHtml(person) + '">' + (editing ? editLabel : '✎') + '</button></div>' +
    '<div class="quick-add"><div>' + quickHtml + '</div></div>' +
    '<div class="custom-add"><select data-custom-duration="' + person + '" aria-label="Add custom sleep duration for ' + escapeHtml(person) + '"><option value="">More...</option>' + durationOptionsHtml(15, 9 * 60) + '</select></div>' +
  '</article>';
}

function entryListHtml(entries, editing) {
  if (!entries.length) return '<span class="empty-entry">No entries yet</span>';
  if (editing) {
    return entries.map((entry) => {
      return '<div class="entry-edit-row">' +
        '<button type="button" class="entry-edit-duration" data-edit-entry="' + escapeHtml(entry.id) + '">+' + formatDurationClock(entry.minutes) + '</button>' +
        '<div class="entry-edit-actions">' +
          '<button type="button" class="entry-action-button" data-edit-entry="' + escapeHtml(entry.id) + '" aria-label="Edit +' + formatDurationClock(entry.minutes) + '">✎</button>' +
          '<button type="button" class="entry-action-button danger" data-delete-entry="' + escapeHtml(entry.id) + '" aria-label="Delete +' + formatDurationClock(entry.minutes) + '">×</button>' +
        '</div>' +
      '</div>';
    }).join("");
  }
  return entries.map((entry, index) => {
    const separator = index < entries.length - 1 ? '<span class="entry-separator">;</span>' : '';
    return '<span class="entry-piece"><button type="button" class="entry-link" data-edit-entry="' + escapeHtml(entry.id) + '">+' + formatDurationClock(entry.minutes) + '</button>' + separator + '</span>';
  }).join(" ");
}

function miniCard(person, periodStart) {
  const total = totalFor(person, periodStart);
  const target = targetFor(person);
  const percent = target ? Math.min(100, Math.round((total / target) * 100)) : 100;
  const targetMet = total > 0 && total >= target;
  const empty = total <= 0;
  return '<button type="button" class="mini-card ' + (person === "Tal" ? "tal-card" : "sophie-card") + (targetMet ? ' target-met' : '') + (empty ? ' is-empty' : '') + '" data-jump-period="' + periodStart + '" style="--mini-progress:' + percent + '%"><span>' + escapeHtml(person) + (targetMet ? '<i class="mini-star" aria-hidden="true">★</i>' : '') + '</span><strong>' + formatDuration(total) + '</strong><small>' + (empty ? 'no entry' : percent + '% of target') + '</small></button>';
}

function visibleEntries(person, periodStart) {
  return state.entries
    .filter((entry) => entry.person === person && entry.periodStart === periodStart && !entry.deletedAt && entry.note !== DELETE_MARKER)
    .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
}

function totalFor(person, periodStart) {
  return visibleEntries(person, periodStart).reduce((sum, entry) => sum + Number(entry.minutes || 0), 0);
}

function hasAnySleep(periodStart) {
  return PEOPLE.some((person) => totalFor(person, periodStart) > 0);
}

function recentNonEmptyPeriodStarts() {
  const starts = [];
  for (let offset = -1; offset >= -HISTORY_LOOKBACK_DAYS && starts.length < RECENT_DAYS_TO_SHOW; offset -= 1) {
    const periodStart = addDaysString(state.selectedStart, offset);
    if (hasAnySleep(periodStart)) starts.push(periodStart);
  }
  return starts;
}

function chartPeriodStarts() {
  const fromEntries = state.entries
    .filter((entry) => !entry.deletedAt && entry.note !== DELETE_MARKER && Number(entry.minutes || 0) > 0)
    .map((entry) => entry.periodStart);
  return Array.from(new Set(fromEntries))
    .filter((periodStart) => PEOPLE.some((person) => totalFor(person, periodStart) > 0))
    .sort();
}

function targetFor(person) {
  return Number(state.targets[person] || DEFAULT_TARGETS[person] || 420);
}

function orderedPeople() {
  return [state.settings.self, ...PEOPLE.filter((person) => person !== state.settings.self)];
}

function cardKey(person, periodStart) {
  return person + "::" + periodStart;
}

function quickAdd(person, minutes) {
  addEntry(person, Number(minutes));
}

function customAddFromSelect(select) {
  if (!select?.value) return;
  addEntry(select.dataset.customDuration, Number(select.value));
}

function addEntry(person, minutes) {
  const now = new Date().toISOString();
  const entry = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random(),
    person,
    periodStart: state.selectedStart,
    minutes,
    createdAt: now,
    updatedAt: now
  };
  state.entries.push(entry);
  saveState();
  render();
  syncEntry(entry);
}

function openEntryModal(entryId) {
  const entry = state.entries.find((item) => item.id === entryId);
  if (!entry) return;
  state.editingEntryId = entryId;
  els.entryMinutes.value = String(entry.minutes || 60);
  els.entryBackdrop.hidden = false;
  els.entryModal.hidden = false;
  document.body.classList.add("is-modal-open");
}

function closeEntryModal() {
  state.editingEntryId = "";
  els.entryBackdrop.hidden = true;
  els.entryModal.hidden = true;
  document.body.classList.remove("is-modal-open");
}

function saveEntryModal() {
  const entry = state.entries.find((item) => item.id === state.editingEntryId);
  if (!entry || !els.entryMinutes.value) return;
  entry.minutes = Number(els.entryMinutes.value);
  entry.updatedAt = new Date().toISOString();
  saveState();
  closeEntryModal();
  render();
  syncEntry(entry);
}

function deleteCurrentEntry() {
  deleteEntry(state.editingEntryId);
}

function deleteEntry(entryId) {
  const entry = state.entries.find((item) => item.id === entryId);
  if (!entry) return;
  entry.deletedAt = new Date().toISOString();
  entry.updatedAt = entry.deletedAt;
  saveState();
  closeEntryModal();
  render();
  syncDelete(entry);
}

function openSettings() {
  renderSettings();
  els.settingsBackdrop.hidden = false;
  els.settingsModal.hidden = false;
  document.body.classList.add("is-modal-open");
}

function closeSettings() {
  els.settingsBackdrop.hidden = true;
  els.settingsModal.hidden = true;
  document.body.classList.remove("is-modal-open");
}

function openHistory() {
  renderHistoryChart();
  els.historyBackdrop.hidden = false;
  els.historyModal.hidden = false;
  document.body.classList.add("is-modal-open");
  window.requestAnimationFrame(() => scrollHistoryChartToLatest());
}

function closeHistory() {
  els.historyBackdrop.hidden = true;
  els.historyModal.hidden = true;
  document.body.classList.remove("is-modal-open");
}

function scrollHistoryChartToLatest() {
  const scroller = els.historyChart.querySelector("[data-history-scroll]");
  if (scroller) scroller.scrollLeft = scroller.scrollWidth;
}

function renderHistoryChart() {
  const periods = chartPeriodStarts();
  if (!periods.length) {
    els.historyChart.innerHTML = '<p class="empty-history chart-empty">No sleep entries to graph yet</p>';
    return;
  }

  const totals = periods.flatMap((periodStart) => PEOPLE.map((person) => totalFor(person, periodStart)));
  const maxMinutes = Math.max(...totals, ...PEOPLE.map(targetFor), 420);
  const yMax = Math.max(420, Math.ceil(maxMinutes / 60) * 60);
  const chartHeight = 250;
  const chartTop = 20;
  const chartBottom = 40;
  const chartLeft = 18;
  const chartRight = 24;
  const pointGap = 58;
  const plotHeight = chartHeight - chartTop - chartBottom;
  const chartWidth = Math.max(340, chartLeft + chartRight + Math.max(1, periods.length - 1) * pointGap);
  const ticks = [yMax, Math.round(yMax / 2 / 15) * 15, 0];

  const yFor = (minutes) => chartTop + plotHeight - (Math.min(minutes, yMax) / yMax) * plotHeight;
  const xFor = (index) => chartLeft + index * pointGap;
  const grid = ticks.map((minutes) => '<line class="chart-grid" x1="' + chartLeft + '" x2="' + (chartWidth - chartRight) + '" y1="' + yFor(minutes).toFixed(1) + '" y2="' + yFor(minutes).toFixed(1) + '"></line>').join("");
  const yAxis = '<div class="history-y-axis" style="height:' + chartHeight + 'px">' + ticks.map((minutes) => '<span style="top:' + yFor(minutes).toFixed(1) + 'px">' + escapeHtml(minutes ? formatDurationCompact(minutes) : "0") + '</span>').join("") + '</div>';
  const xLabels = periods.map((periodStart, index) => '<text class="chart-date-label" x="' + xFor(index) + '" y="' + (chartHeight - 12) + '">' + escapeHtml(formatNumericDate(parseLocalDate(periodStart))) + '</text>').join("");
  const personLines = PEOPLE.map((person) => historyLineSvg(person, periods, xFor, yFor));

  els.historyChart.innerHTML =
    '<div class="history-chart-frame">' +
      yAxis +
      '<div class="history-scroll" data-history-scroll tabindex="0" aria-label="Scrollable sleep history chart">' +
        '<svg class="history-svg" width="' + chartWidth + '" height="' + chartHeight + '" viewBox="0 0 ' + chartWidth + ' ' + chartHeight + '" role="img" aria-label="Sleep hours over time">' +
          grid +
          '<line class="chart-axis" x1="' + chartLeft + '" x2="' + (chartWidth - chartRight) + '" y1="' + (chartHeight - chartBottom) + '" y2="' + (chartHeight - chartBottom) + '"></line>' +
          personLines.join("") +
          xLabels +
        '</svg>' +
      '</div>' +
    '</div>';
}

function historyLineSvg(person, periods, xFor, yFor) {
  const target = targetFor(person);
  const points = periods
    .map((periodStart, index) => ({
      periodStart,
      x: xFor(index),
      y: yFor(totalFor(person, periodStart)),
      minutes: totalFor(person, periodStart)
    }))
    .filter((point) => point.minutes > 0);
  if (!points.length) return "";

  const path = points.map((point, index) => (index ? "L" : "M") + point.x.toFixed(1) + " " + point.y.toFixed(1)).join(" ");
  const dots = points.map((point) => {
    const met = point.minutes >= target;
    const title = escapeHtml(person + ": " + formatDuration(point.minutes) + " on " + formatShortRange(parseLocalDate(point.periodStart), addDays(parseLocalDate(point.periodStart), 1)));
    return '<g class="chart-point ' + (met ? 'target-met' : '') + '">' +
      '<title>' + title + '</title>' +
      (met ? '<text class="chart-star" x="' + point.x.toFixed(1) + '" y="' + Math.max(12, point.y - 9).toFixed(1) + '">★</text>' : '') +
      '<circle class="chart-dot ' + person.toLowerCase() + '-dot" cx="' + point.x.toFixed(1) + '" cy="' + point.y.toFixed(1) + '" r="4.2"></circle>' +
    '</g>';
  }).join("");

  return '<path class="history-line ' + person.toLowerCase() + '-line" d="' + path + '"></path>' + dots;
}

function saveSettings() {
  state.settings.compact = els.compact.checked;
  state.targets = {
    Tal: Number(els.targetTal.value || DEFAULT_TARGETS.Tal),
    Sophie: Number(els.targetSophie.value || DEFAULT_TARGETS.Sophie)
  };
  saveState();
  closeSettings();
  render();
  syncTargets();
}

function setTheme(theme) {
  if (!["night", "moon", "ledger", "sunrise"].includes(theme)) return;
  state.settings.theme = theme;
  saveState();
  render();
}

function setSelf(person) {
  if (!PEOPLE.includes(person)) return;
  state.settings.self = person;
  saveState();
  render();
}

function resetLocal() {
  if (!window.confirm("Clear sleep entries and settings saved on this phone?")) return;
  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
}

async function syncNow(options = {}) {
  if (!configuredBackendUrl()) {
    if (!options.quiet) setSyncNote("Backend URL needed in config.js");
    return;
  }
  if (!options.quiet) setSyncNote("Syncing...");
  try {
    const response = await backendRequest("snapshot");
    if (response?.ok && Array.isArray(response.entries)) {
      mergeEntries(response.entries);
      if (response.targets) state.targets = { ...state.targets, ...normalizeTargets(response.targets) };
      if (response.spreadsheetUrl) state.spreadsheetUrl = response.spreadsheetUrl;
      saveState();
      render();
      if (!options.quiet) setSyncNote("Synced");
    } else if (!options.quiet) {
      setSyncNote("Sync issue");
    }
  } catch (error) {
    console.warn(error);
    if (!options.quiet) setSyncNote("Offline");
  }
}

function syncEntry(entry) {
  if (!configuredBackendUrl()) return;
  backendRequest("upsertEntry", { entry }).then((response) => {
    setSyncNote(response?.ok ? "Synced" : "Sync issue");
  }).catch((error) => {
    console.warn(error);
    setSyncNote("Saved locally");
  });
}

function syncDelete(entry) {
  if (!configuredBackendUrl()) return;
  backendRequest("deleteEntry", { id: entry.id, deletedAt: entry.deletedAt }).then((response) => {
    setSyncNote(response?.ok ? "Synced" : "Sync issue");
  }).catch((error) => {
    console.warn(error);
    setSyncNote("Saved locally");
  });
}

function syncTargets() {
  if (!configuredBackendUrl()) {
    setSyncNote("Targets saved here");
    return;
  }
  backendRequest("saveTargets", { targets: state.targets }).then((response) => {
    if (response?.ok) {
      if (response.targets) state.targets = { ...state.targets, ...normalizeTargets(response.targets) };
      saveState();
      renderSettings();
      setSyncNote("Targets synced");
    } else {
      setSyncNote("Targets need backend update");
    }
  }).catch((error) => {
    console.warn(error);
    setSyncNote("Targets saved here");
  });
}

function backendRequest(action, payload = {}) {
  return new Promise((resolve, reject) => {
    const callbackName = "sleepTrackerCallback_" + Date.now() + "_" + Math.random().toString(36).slice(2);
    const url = new URL(configuredBackendUrl());
    url.searchParams.set("action", action);
    url.searchParams.set("callback", callbackName);
    if (Object.keys(payload).length) url.searchParams.set("payload", JSON.stringify(payload));

    const script = document.createElement("script");
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Backend request timed out"));
    }, 10000);

    window[callbackName] = (data) => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Backend request failed"));
    };

    function cleanup() {
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }

    script.src = url.toString();
    document.body.appendChild(script);
  });
}

function configuredBackendUrl() {
  return window.SLEEP_TRACKER_CONFIG?.defaultBackendUrl || "";
}

function mergeEntries(incoming) {
  const byId = new Map(state.entries.map((entry) => [entry.id, entry]));
  incoming.forEach((entry) => {
    const normalized = normalizeEntry(entry);
    if (!normalized.id) return;
    const current = byId.get(normalized.id);
    if (!current || String(normalized.updatedAt || "") >= String(current.updatedAt || "")) {
      byId.set(normalized.id, normalized);
    }
  });
  state.entries = Array.from(byId.values()).filter((entry) => !entry._sample);
}

function normalizeEntry(entry) {
  return {
    ...entry,
    id: String(entry?.id || ""),
    person: String(entry?.person || ""),
    periodStart: normalizePeriodStart(entry?.periodStart),
    minutes: Number(entry?.minutes || 0),
    createdAt: String(entry?.createdAt || ""),
    updatedAt: String(entry?.updatedAt || ""),
    deletedAt: String(entry?.deletedAt || "")
  };
}

function normalizeTargets(targets) {
  return PEOPLE.reduce((result, person) => {
    const value = Number(targets[person]);
    if (Number.isFinite(value) && value > 0) result[person] = value;
    return result;
  }, {});
}

function setSyncNote(message) {
  if (els.syncNote) els.syncNote.textContent = message;
}

function currentPeriodStart() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(21, 0, 0, 0);
  if (now < start) start.setDate(start.getDate() - 1);
  return isoDate(start);
}

function normalizePeriodStart(value, fallback = currentPeriodStart()) {
  if (!value) return fallback;
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return isoDate(parsed);
  return fallback;
}

function parseLocalDate(value) {
  const parts = String(value).split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2], 21, 0, 0, 0);
}

function isoDate(date) {
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function addDaysString(dateText, days) {
  return isoDate(addDays(parseLocalDate(dateText), days));
}

function formatShortRange(start, end) {
  return formatNumericDate(start) + " to " + formatNumericDate(end);
}

function formatLongRange(start, end) {
  return formatWeekdayDate(start) + " 9 PM to " + formatWeekdayDate(end) + " 9 PM";
}

function formatNumericDate(date) {
  return (date.getMonth() + 1) + "/" + date.getDate();
}

function formatWeekdayDate(date) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "numeric", day: "numeric" }).format(date);
}

function formatDuration(minutes) {
  minutes = Math.max(0, Number(minutes || 0));
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (!hrs && !mins) return "--";
  if (!mins) return hrs + "h";
  if (!hrs) return mins + "m";
  return hrs + "h " + String(mins).padStart(2, "0") + "m";
}

function formatDurationCompact(minutes) {
  minutes = Math.max(0, Number(minutes || 0));
  if (!minutes) return "--";
  if (minutes < 60) return minutes + "m";
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins ? hrs + "h " + mins + "m" : hrs + "h";
}

function formatDurationClock(minutes) {
  minutes = Math.max(0, Number(minutes || 0));
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hrs + ":" + String(mins).padStart(2, "0");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function bindEvents() {
  document.querySelector("[data-open-history]").addEventListener("click", openHistory);
  document.querySelector("[data-close-history]").addEventListener("click", closeHistory);
  document.querySelector("[data-open-settings]").addEventListener("click", openSettings);
  document.querySelector("[data-close-settings]").addEventListener("click", closeSettings);
  document.querySelector("[data-save-settings]").addEventListener("click", saveSettings);
  const resetLocalButton = document.querySelector("[data-reset-local]");
  if (resetLocalButton) resetLocalButton.addEventListener("click", resetLocal);
  const syncNowButton = document.querySelector("[data-sync-now]");
  if (syncNowButton) syncNowButton.addEventListener("click", () => syncNow());
  els.historyBackdrop.addEventListener("click", closeHistory);
  els.settingsBackdrop.addEventListener("click", closeSettings);

  document.querySelector("[data-prev-period]").addEventListener("click", () => {
    state.selectedStart = addDaysString(state.selectedStart, -1);
    render();
  });

  document.querySelector("[data-next-period]").addEventListener("click", () => {
    state.selectedStart = addDaysString(state.selectedStart, 1);
    render();
  });

  document.querySelector("[data-close-entry]").addEventListener("click", closeEntryModal);
  document.querySelector("[data-save-entry]").addEventListener("click", saveEntryModal);
  document.querySelector("[data-delete-entry]").addEventListener("click", deleteCurrentEntry);
  els.entryBackdrop.addEventListener("click", closeEntryModal);

  document.addEventListener("change", (event) => {
    const customSelect = event.target.closest("[data-custom-duration]");
    if (customSelect) {
      customAddFromSelect(customSelect);
    }
  });

  document.addEventListener("click", (event) => {
    const quick = event.target.closest("[data-quick-add]");
    if (quick) {
      quickAdd(quick.dataset.quickAdd, quick.dataset.minutes);
      return;
    }

    const self = event.target.closest("[data-self-option]");
    if (self) {
      setSelf(self.dataset.selfOption);
      return;
    }

    const toggle = event.target.closest("[data-toggle-edit]");
    if (toggle) {
      const key = cardKey(toggle.dataset.toggleEdit, state.selectedStart);
      state.editMode[key] = !state.editMode[key];
      render();
      return;
    }

    const theme = event.target.closest("[data-theme-option]");
    if (theme) {
      setTheme(theme.dataset.themeOption);
      return;
    }

    const editEntry = event.target.closest("[data-edit-entry]");
    if (editEntry) {
      const entry = state.entries.find((item) => item.id === editEntry.dataset.editEntry);
      if (entry) openEntryModal(editEntry.dataset.editEntry);
      return;
    }

    const deleteEntryButton = event.target.closest("[data-delete-entry]");
    if (deleteEntryButton) {
      deleteEntry(deleteEntryButton.dataset.deleteEntry);
      return;
    }

    const jump = event.target.closest("[data-jump-period]");
    if (jump) {
      state.selectedStart = jump.dataset.jumpPeriod;
      window.scrollTo({ top: 0, behavior: state.settings.reduceMotion ? "auto" : "smooth" });
      render();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && state.settings.autoSync) syncNow({ quiet: true });
  });
}

function init() {
  loadState();
  bindEvents();
  render();
  setSyncNote(configuredBackendUrl() ? "Ready to sync" : "Backend URL needed in config.js");
  if (state.settings.autoSync) {
    syncNow({ quiet: true });
    window.setInterval(() => syncNow({ quiet: true }), SYNC_INTERVAL_MS);
  }
}

init();
