const STORAGE_KEY = "newborn-sleep-tracker-v1";
const PEOPLE = ["Tal", "Sophie"];
const GOAL_MINUTES = 7 * 60;
const QUICK_MINUTES = [30, 45, 60, 90, 120, 180];
const DELETE_MARKER = "__DELETE__";

const state = {
  selectedStart: "",
  editMode: {},
  editingEntryId: "",
  entries: [],
  settings: {
    autoSync: window.SLEEP_TRACKER_CONFIG?.autoSync ?? true,
    reduceMotion: false
  }
};

const els = {
  periodTitle: document.querySelector("[data-period-title]"),
  periodRange: document.querySelector("[data-period-range]"),
  todayGrid: document.querySelector("[data-today-grid]"),
  historyList: document.querySelector("[data-history-list]"),
  settingsBackdrop: document.querySelector("[data-settings-backdrop]"),
  settingsModal: document.querySelector("[data-settings-modal]"),
  autoSync: document.querySelector("[data-auto-sync]"),
  reduceMotion: document.querySelector("[data-reduce-motion]"),
  syncNote: document.querySelector("[data-sync-note]"),
  entryBackdrop: document.querySelector("[data-entry-backdrop]"),
  entryModal: document.querySelector("[data-entry-modal]"),
  entryPersonLabel: document.querySelector("[data-entry-person-label]"),
  entryTitle: document.querySelector("[data-entry-title]"),
  entryPerson: document.querySelector("[data-entry-person]"),
  entryPeriod: document.querySelector("[data-entry-period]"),
  entryMinutes: document.querySelector("[data-entry-minutes]"),
  deleteEntry: document.querySelector("[data-delete-entry]")
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (Array.isArray(saved.entries)) state.entries = saved.entries;
    Object.assign(state.settings, saved.settings || {});
    delete state.settings.backendUrl;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  state.selectedStart = currentPeriodStart();
  if (!state.entries.length) seedSampleEntries();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    entries: state.entries,
    settings: state.settings
  }));
}

function seedSampleEntries() {
  const current = currentPeriodStart();
  const yesterday = addDaysString(current, -1);
  const twoAgo = addDaysString(current, -2);
  const now = new Date().toISOString();
  state.entries = [
    sampleEntry("Tal", current, 90, now),
    sampleEntry("Tal", current, 45, now),
    sampleEntry("Sophie", current, 120, now),
    sampleEntry("Sophie", current, 60, now),
    sampleEntry("Tal", yesterday, 210, now),
    sampleEntry("Tal", yesterday, 180, now),
    sampleEntry("Sophie", yesterday, 240, now),
    sampleEntry("Sophie", yesterday, 150, now),
    sampleEntry("Tal", twoAgo, 360, now),
    sampleEntry("Sophie", twoAgo, 390, now)
  ];
}

function sampleEntry(person, periodStart, minutes, createdAt) {
  return {
    id: "sample-" + person.toLowerCase() + "-" + periodStart + "-" + minutes + "-" + Math.random().toString(36).slice(2, 7),
    person,
    periodStart,
    minutes,
    createdAt,
    updatedAt: createdAt,
    _sample: true
  };
}

function render() {
  document.body.classList.toggle("reduce-motion", state.settings.reduceMotion);
  renderSettings();
  renderDurationSelects();
  renderPeriod();
  renderCards();
  renderHistory();
}

function renderSettings() {
  els.autoSync.checked = Boolean(state.settings.autoSync);
  els.reduceMotion.checked = Boolean(state.settings.reduceMotion);
}

function renderDurationSelects() {
  if (els.entryMinutes.dataset.ready) return;
  els.entryMinutes.innerHTML = durationOptionsHtml();
  els.entryMinutes.dataset.ready = "true";
}

function durationOptionsHtml() {
  const options = [];
  for (let minutes = 15; minutes <= 9 * 60; minutes += 15) {
    options.push('<option value="' + minutes + '">' + formatDuration(minutes) + '</option>');
  }
  return options.join("");
}

function renderPeriod() {
  const start = parseLocalDate(state.selectedStart);
  const end = addDays(start, 1);
  const current = currentPeriodStart();
  els.periodTitle.textContent = state.selectedStart === current ? "Today" : formatPeriodTitle(start);
  els.periodRange.textContent = formatRange(start, end);
}

function renderCards() {
  els.todayGrid.innerHTML = PEOPLE.map((person) => personCard(person, state.selectedStart, true)).join("");
}

function renderHistory() {
  const starts = [-1, -2, -3, -4].map((offset) => addDaysString(state.selectedStart, offset));
  els.historyList.innerHTML = starts.map((periodStart) => {
    const start = parseLocalDate(periodStart);
    return '<section class="history-day"><h3>' + escapeHtml(formatRange(start, addDays(start, 1))) + '</h3><div class="mini-pair">' + PEOPLE.map((person) => miniCard(person, periodStart)).join("") + '</div></section>';
  }).join("");
}

function personCard(person, periodStart, isPrimary) {
  const entries = visibleEntries(person, periodStart);
  const total = entries.reduce((sum, entry) => sum + Number(entry.minutes || 0), 0);
  const remaining = Math.max(0, GOAL_MINUTES - total);
  const percent = Math.min(100, Math.round((total / GOAL_MINUTES) * 100));
  const key = cardKey(person, periodStart);
  const editing = Boolean(state.editMode[key]);
  const toneClass = person === "Tal" ? "tal-card" : "sophie-card";
  const entryHtml = entries.length ? entries.map((entry) => entryChip(entry, editing)).join("") : '<span class="empty-chip">No entries yet</span>';
  const quickHtml = QUICK_MINUTES.map((minutes) => '<button type="button" data-quick-add="' + person + '" data-minutes="' + minutes + '">' + formatDurationShort(minutes) + '</button>').join("");
  return '<article class="sleep-card ' + toneClass + (isPrimary ? ' primary-card' : '') + '" style="--progress:' + percent + '%">' +
    '<div class="card-top"><div><p class="eyebrow">' + escapeHtml(person) + '</p><h2>' + formatDuration(total) + '</h2></div><div class="goal-badge"><strong>' + percent + '%</strong><span>of 7h</span></div></div>' +
    '<div class="progress-track" aria-label="' + escapeHtml(person) + ' sleep progress"><span></span></div>' +
    '<p class="sleep-status">' + (remaining ? formatDuration(remaining) + ' left to 7 hours' : 'Goal hit for this 9 PM day') + '</p>' +
    '<div class="entry-list">' + entryHtml + '</div>' +
    '<div class="quick-add"><span>Quick add</span><div>' + quickHtml + '</div></div>' +
    '<div class="custom-add"><select data-custom-duration="' + person + '">' + durationOptionsHtml() + '</select><button type="button" data-custom-add="' + person + '">Add</button></div>' +
    '<div class="card-actions"><button type="button" data-open-entry="' + person + '">Manual</button><button type="button" data-toggle-edit="' + person + '">' + (editing ? "Done" : "Edit") + '</button></div>' +
  '</article>';
}

function miniCard(person, periodStart) {
  const total = visibleEntries(person, periodStart).reduce((sum, entry) => sum + Number(entry.minutes || 0), 0);
  const percent = Math.min(100, Math.round((total / GOAL_MINUTES) * 100));
  return '<button type="button" class="mini-card ' + (person === "Tal" ? "tal-card" : "sophie-card") + '" data-jump-period="' + periodStart + '"><span>' + escapeHtml(person) + '</span><strong>' + formatDuration(total) + '</strong><small>' + percent + '% of goal</small></button>';
}

function entryChip(entry, editing) {
  return '<span class="entry-chip">' +
    '<button type="button" data-edit-entry="' + escapeHtml(entry.id) + '">' + formatDurationShort(entry.minutes) + '</button>' +
    (editing ? '<button type="button" class="chip-icon" data-edit-entry="' + escapeHtml(entry.id) + '" aria-label="Edit entry">✎</button><button type="button" class="chip-icon danger-chip" data-delete-entry-id="' + escapeHtml(entry.id) + '" aria-label="Delete entry">×</button>' : '') +
  '</span>';
}

function visibleEntries(person, periodStart) {
  return state.entries
    .filter((entry) => entry.person === person && entry.periodStart === periodStart && !entry.deletedAt && entry.note !== DELETE_MARKER)
    .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
}

function cardKey(person, periodStart) {
  return person + "::" + periodStart;
}

function quickAdd(person, minutes) {
  const now = new Date().toISOString();
  const entry = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random(),
    person,
    periodStart: state.selectedStart,
    minutes: Number(minutes),
    createdAt: now,
    updatedAt: now
  };
  state.entries.push(entry);
  saveState();
  render();
  syncEntry(entry);
}

function openEntryModal(person, entryId = "") {
  const entry = entryId ? state.entries.find((item) => item.id === entryId) : null;
  state.editingEntryId = entryId;
  els.entryPersonLabel.textContent = entry ? "Edit entry" : "Add sleep";
  els.entryTitle.textContent = entry ? "Edit sleep" : "Add sleep";
  els.entryPerson.value = entry?.person || person || "Tal";
  els.entryPeriod.value = entry?.periodStart || state.selectedStart;
  els.entryMinutes.value = String(entry?.minutes || 60);
  els.deleteEntry.hidden = !entry;
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
  const now = new Date().toISOString();
  const existing = state.editingEntryId ? state.entries.find((entry) => entry.id === state.editingEntryId) : null;
  if (existing) {
    existing.person = els.entryPerson.value;
    existing.periodStart = normalizePeriodStart(els.entryPeriod.value);
    existing.minutes = Number(els.entryMinutes.value);
    existing.updatedAt = now;
    saveState();
    closeEntryModal();
    render();
    syncEntry(existing);
    return;
  }
  const added = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random(),
    person: els.entryPerson.value,
    periodStart: normalizePeriodStart(els.entryPeriod.value),
    minutes: Number(els.entryMinutes.value),
    createdAt: now,
    updatedAt: now
  };
  state.entries.push(added);
  saveState();
  closeEntryModal();
  render();
  syncEntry(added);
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
  els.settingsBackdrop.hidden = false;
  els.settingsModal.hidden = false;
  document.body.classList.add("is-modal-open");
}

function closeSettings() {
  els.settingsBackdrop.hidden = true;
  els.settingsModal.hidden = true;
  document.body.classList.remove("is-modal-open");
}

function saveSettings() {
  state.settings.autoSync = els.autoSync.checked;
  state.settings.reduceMotion = els.reduceMotion.checked;
  saveState();
  closeSettings();
  render();
  if (state.settings.autoSync) syncNow();
}

function resetLocal() {
  if (!window.confirm("Clear sleep entries saved on this phone?")) return;
  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
}

async function syncNow() {
  if (!configuredBackendUrl()) {
    setSyncNote("Backend URL needed in config.js");
    return;
  }
  setSyncNote("Syncing...");
  try {
    const response = await backendRequest("snapshot");
    if (response?.ok && Array.isArray(response.entries)) {
      mergeEntries(response.entries);
      saveState();
      render();
      setSyncNote("Synced");
    } else {
      setSyncNote("Sync issue");
    }
  } catch (error) {
    console.warn(error);
    setSyncNote("Offline");
  }
}

function syncEntry(entry) {
  if (!configuredBackendUrl() || entry._sample) return;
  backendRequest("upsertEntry", { entry }).then(() => setSyncNote("Synced")).catch((error) => {
    console.warn(error);
    setSyncNote("Saved locally");
  });
}

function syncDelete(entry) {
  if (!configuredBackendUrl() || entry._sample) return;
  backendRequest("deleteEntry", { id: entry.id, deletedAt: entry.deletedAt }).then(() => setSyncNote("Synced")).catch((error) => {
    console.warn(error);
    setSyncNote("Saved locally");
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
    if (!entry.id) return;
    const current = byId.get(entry.id);
    if (!current || String(entry.updatedAt || "") >= String(current.updatedAt || "")) byId.set(entry.id, entry);
  });
  state.entries = Array.from(byId.values());
}

function setSyncNote(message) {
  els.syncNote.textContent = message;
}

function currentPeriodStart() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(21, 0, 0, 0);
  if (now < start) start.setDate(start.getDate() - 1);
  return isoDate(start);
}

function normalizePeriodStart(value) {
  return isoDate(parseLocalDate(value || currentPeriodStart()));
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

function formatPeriodTitle(date) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "numeric", day: "numeric" }).format(date);
}

function formatRange(start, end) {
  const startLabel = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "numeric", day: "numeric" }).format(start);
  const endLabel = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "numeric", day: "numeric" }).format(end);
  return startLabel + " 9 PM to " + endLabel + " 9 PM";
}

function formatDuration(minutes) {
  const hrs = Math.floor(Number(minutes || 0) / 60);
  const mins = Number(minutes || 0) % 60;
  return hrs + "h " + String(mins).padStart(2, "0") + "m";
}

function formatDurationShort(minutes) {
  minutes = Number(minutes || 0);
  if (minutes < 60) return minutes + "m";
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins ? hrs + "h " + mins + "m" : hrs + "h";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function bindEvents() {
  document.querySelector("[data-open-settings]").addEventListener("click", openSettings);
  document.querySelector("[data-close-settings]").addEventListener("click", closeSettings);
  document.querySelector("[data-save-settings]").addEventListener("click", saveSettings);
  document.querySelector("[data-reset-local]").addEventListener("click", resetLocal);
  document.querySelector("[data-sync-now]").addEventListener("click", syncNow);
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
  els.deleteEntry.addEventListener("click", () => deleteEntry(state.editingEntryId));
  els.entryBackdrop.addEventListener("click", closeEntryModal);

  document.addEventListener("click", (event) => {
    const quick = event.target.closest("[data-quick-add]");
    if (quick) {
      quickAdd(quick.dataset.quickAdd, quick.dataset.minutes);
      return;
    }

    const custom = event.target.closest("[data-custom-add]");
    if (custom) {
      const select = document.querySelector('[data-custom-duration="' + CSS.escape(custom.dataset.customAdd) + '"]');
      quickAdd(custom.dataset.customAdd, select?.value || 60);
      return;
    }

    const toggle = event.target.closest("[data-toggle-edit]");
    if (toggle) {
      const key = cardKey(toggle.dataset.toggleEdit, state.selectedStart);
      state.editMode[key] = !state.editMode[key];
      render();
      return;
    }

    const openEntry = event.target.closest("[data-open-entry]");
    if (openEntry) {
      openEntryModal(openEntry.dataset.openEntry);
      return;
    }

    const editEntry = event.target.closest("[data-edit-entry]");
    if (editEntry) {
      const entry = state.entries.find((item) => item.id === editEntry.dataset.editEntry);
      openEntryModal(entry?.person || "Tal", editEntry.dataset.editEntry);
      return;
    }

    const deleteButton = event.target.closest("[data-delete-entry-id]");
    if (deleteButton) {
      deleteEntry(deleteButton.dataset.deleteEntryId);
      return;
    }

    const jump = event.target.closest("[data-jump-period]");
    if (jump) {
      state.selectedStart = jump.dataset.jumpPeriod;
      window.scrollTo({ top: 0, behavior: state.settings.reduceMotion ? "auto" : "smooth" });
      render();
    }
  });
}

function init() {
  loadState();
  bindEvents();
  render();
  setSyncNote(configuredBackendUrl() ? "Ready to sync" : "Backend URL needed in config.js");
  if (state.settings.autoSync) syncNow();
}

init();
