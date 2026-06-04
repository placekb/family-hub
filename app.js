const LOCAL_STORAGE_KEY = "familyHub_v2";
const REMOTE_CACHE_KEY = "familyHub_cloudCache_v1";
const LEGACY_KEY = "familyHubGitHub_v1";
const PEOPLE = ["Family", "Ben", "Wife", "Kids"];
const EVENT_REPEAT_TYPES = new Set(["none", "daily", "weekly", "monthly", "yearly"]);
const WORKSPACE_TITLES = {
  meals: "Dinner plan",
  tasks: "Household tasks",
  groceries: "Shared list"
};
const DEFAULT_AUTH_MESSAGE = "Sign in with the same email and password on your phone and your computer.";

const $ = (id) => document.getElementById(id);

const dom = {
  dateLine: $("dateLine"),
  syncStrip: $("syncStrip"),
  syncDot: $("syncDot"),
  syncLabel: $("syncLabel"),
  seedCloudBtn: $("seedCloudBtn"),
  signOutBtn: $("signOutBtn"),
  authGate: $("authGate"),
  authForm: $("authForm"),
  authEmail: $("authEmail"),
  authPassword: $("authPassword"),
  authMessage: $("authMessage"),
  signUpBtn: $("signUpBtn"),
  monthLabel: $("monthLabel"),
  prevMonth: $("prevMonth"),
  nextMonth: $("nextMonth"),
  calendarGrid: $("calendarGrid"),
  overviewKicker: $("overviewKicker"),
  overviewTitle: $("overviewTitle"),
  todayEvents: $("todayEvents"),
  overviewAddEventBtn: $("overviewAddEventBtn"),
  workspaceTitle: $("workspaceTitle"),
  tabButtons: [...document.querySelectorAll(".tab-button")],
  tabPanels: [...document.querySelectorAll(".tab-panel")],
  weekLabel: $("weekLabel"),
  prevWeekBtn: $("prevWeekBtn"),
  nextWeekBtn: $("nextWeekBtn"),
  copyWeekBtn: $("copyWeekBtn"),
  mealList: $("mealList"),
  taskList: $("taskList"),
  newTaskBtn: $("newTaskBtn"),
  groceryList: $("groceryList"),
  groceryForm: $("groceryForm"),
  groceryInput: $("groceryInput"),
  eventDialog: $("eventDialog"),
  eventDialogTitle: $("eventDialogTitle"),
  eventId: $("eventId"),
  eventTitle: $("eventTitle"),
  eventDate: $("eventDate"),
  eventTime: $("eventTime"),
  eventWho: $("eventWho"),
  eventRepeatType: $("eventRepeatType"),
  eventInterval: $("eventInterval"),
  eventEndType: $("eventEndType"),
  eventEndDate: $("eventEndDate"),
  eventCount: $("eventCount"),
  eventNotes: $("eventNotes"),
  eventWeekdays: $("eventWeekdays"),
  eventDeleteBtn: $("eventDeleteBtn"),
  eventCancelBtn: $("eventCancelBtn"),
  eventCloseBtn: $("eventCloseBtn"),
  eventSaveBtn: $("eventSaveBtn"),
  eventRepeatFields: [...document.querySelectorAll(".event-repeat-only")],
  eventWeeklyFields: [...document.querySelectorAll(".event-weekly-only")],
  eventEndOnFields: [...document.querySelectorAll(".event-end-on-only")],
  eventEndAfterFields: [...document.querySelectorAll(".event-end-after-only")],
  mealDialog: $("mealDialog"),
  mealDialogTitle: $("mealDialogTitle"),
  mealId: $("mealId"),
  mealDate: $("mealDate"),
  mealName: $("mealName"),
  mealNotes: $("mealNotes"),
  mealIngredients: $("mealIngredients"),
  mealDeleteBtn: $("mealDeleteBtn"),
  mealAddGroceriesBtn: $("mealAddGroceriesBtn"),
  mealCancelBtn: $("mealCancelBtn"),
  mealCloseBtn: $("mealCloseBtn"),
  mealSaveBtn: $("mealSaveBtn"),
  taskDialog: $("taskDialog"),
  taskDialogTitle: $("taskDialogTitle"),
  taskId: $("taskId"),
  taskTitle: $("taskTitle"),
  taskDueDate: $("taskDueDate"),
  taskNotes: $("taskNotes"),
  taskDeleteBtn: $("taskDeleteBtn"),
  taskCancelBtn: $("taskCancelBtn"),
  taskCloseBtn: $("taskCloseBtn"),
  taskSaveBtn: $("taskSaveBtn")
};

let state = normalizeState({});
let localSeedState = normalizeState({});
let monthView = startOfMonth(new Date());
let mealWeekView = startOfWeek(new Date());
let overviewDate = atStartOfDay(new Date());
let activeTab = "meals";
let remoteRefreshTimer = null;
let authSessionEpoch = 0;
let syncRuntime = {
  configured: false,
  active: false,
  session: null,
  authUnsubscribe: null,
  realtimeUnsubscribe: null,
  cloudWasEmpty: false,
  message: "Cloud sync is off.",
  tone: "idle"
};

bindEvents();
bootstrapApp();
registerServiceWorker();

function bindEvents() {
  dom.seedCloudBtn.addEventListener("click", seedCloudFromLocal);
  dom.signOutBtn.addEventListener("click", signOutEverywhere);
  dom.authForm.addEventListener("submit", signInWithFamilyLogin);
  dom.signUpBtn.addEventListener("click", createFamilyLogin);

  dom.tabButtons.forEach((button) => {
    button.addEventListener("click", () => setActiveTab(button.dataset.tab));
  });

  dom.prevMonth.addEventListener("click", () => {
    monthView = addMonths(monthView, -1);
    render();
  });

  dom.nextMonth.addEventListener("click", () => {
    monthView = addMonths(monthView, 1);
    render();
  });

  dom.overviewAddEventBtn.addEventListener("click", () => openEventDialog({ date: ymd(overviewDate) }));

  dom.prevWeekBtn.addEventListener("click", () => {
    mealWeekView = addDays(mealWeekView, -7);
    renderWorkspace();
  });

  dom.nextWeekBtn.addEventListener("click", () => {
    mealWeekView = addDays(mealWeekView, 7);
    renderWorkspace();
  });

  dom.copyWeekBtn.addEventListener("click", copyPreviousWeekMeals);
  dom.newTaskBtn.addEventListener("click", () => openTaskDialog());

  dom.groceryForm.addEventListener("submit", addSharedListItem);

  dom.calendarGrid.addEventListener("click", handleCalendarClick);
  dom.mealList.addEventListener("click", handleMealClick);
  dom.taskList.addEventListener("click", handleTaskClick);
  dom.taskList.addEventListener("change", handleTaskChange);
  dom.groceryList.addEventListener("click", handleGroceryClick);
  dom.groceryList.addEventListener("change", handleGroceryChange);

  dom.eventRepeatType.addEventListener("change", toggleEventRepeatFields);
  dom.eventEndType.addEventListener("change", toggleEventRepeatFields);
  dom.eventDate.addEventListener("change", syncWeeklyRepeatSelection);
  dom.eventCloseBtn.addEventListener("click", () => dom.eventDialog.close());
  dom.eventCancelBtn.addEventListener("click", () => dom.eventDialog.close());
  dom.eventDeleteBtn.addEventListener("click", deleteEvent);
  dom.eventSaveBtn.addEventListener("click", saveEvent);

  dom.mealCloseBtn.addEventListener("click", () => dom.mealDialog.close());
  dom.mealCancelBtn.addEventListener("click", () => dom.mealDialog.close());
  dom.mealDeleteBtn.addEventListener("click", deleteMeal);
  dom.mealSaveBtn.addEventListener("click", () => saveMeal(false));
  dom.mealAddGroceriesBtn.addEventListener("click", () => saveMeal(true));

  dom.taskCloseBtn.addEventListener("click", () => dom.taskDialog.close());
  dom.taskCancelBtn.addEventListener("click", () => dom.taskDialog.close());
  dom.taskDeleteBtn.addEventListener("click", deleteTask);
  dom.taskSaveBtn.addEventListener("click", saveTask);
}

async function bootstrapApp() {
  localSeedState = loadLocalSeedState();
  state = loadRemoteCacheState() || localSeedState;
  render();

  if (!window.familyHubSync || typeof window.familyHubSync.init !== "function") {
    syncRuntime.message = "Cloud sync is unavailable in this build.";
    updateSyncUI();
    return;
  }

  try {
    const initResult = await window.familyHubSync.init();
    syncRuntime.configured = Boolean(initResult.configured);

    if (!syncRuntime.configured) {
      state = localSeedState;
      syncRuntime.message = "Cloud sync is not configured. This device is using local data only.";
      syncRuntime.tone = "idle";
      render();
      updateSyncUI();
      return;
    }

    const authListener = window.familyHubSync.onAuthStateChange((_event, session) => {
      handleAuthSession(session).catch((error) => handleSyncFailure(error, "Cloud sync could not refresh after the sign-in state changed."));
    });

    if (authListener && typeof authListener.unsubscribe === "function") {
      syncRuntime.authUnsubscribe = authListener.unsubscribe;
    }

    const session = await window.familyHubSync.getSession();
    await handleAuthSession(session);
  } catch (error) {
    handleSyncFailure(error, "Cloud sync could not start. The app is using local data on this device.");
  }
}

async function handleAuthSession(session) {
  const sessionEpoch = ++authSessionEpoch;
  syncRuntime.session = session || null;
  syncRuntime.active = Boolean(session);
  clearTimeout(remoteRefreshTimer);
  remoteRefreshTimer = null;

  if (syncRuntime.realtimeUnsubscribe) {
    syncRuntime.realtimeUnsubscribe();
    syncRuntime.realtimeUnsubscribe = null;
  }

  if (!syncRuntime.active) {
    state = loadRemoteCacheState() || localSeedState;
    syncRuntime.message = "Sign in with the same family login on every device to keep everything in sync.";
    syncRuntime.tone = "idle";
    setAuthMessage(DEFAULT_AUTH_MESSAGE);
    render();
    updateSyncUI();
    return;
  }

  syncRuntime.message = `Loading cloud data for ${session.user.email}.`;
  syncRuntime.tone = "working";
  setAuthMessage(`Signed in as ${session.user.email}.`);
  updateSyncUI();

  await refreshRemoteState({ authEpoch: sessionEpoch });
  if (sessionEpoch !== authSessionEpoch || !syncRuntime.active) {
    return;
  }

  const realtimeListener = window.familyHubSync.subscribeToChanges(() => {
    clearTimeout(remoteRefreshTimer);
    remoteRefreshTimer = window.setTimeout(() => {
      if (sessionEpoch !== authSessionEpoch || !syncRuntime.active) {
        return;
      }

      refreshRemoteState({ keepMessage: true, authEpoch: sessionEpoch }).catch((error) => handleSyncFailure(error, "Cloud changes could not be refreshed. Showing the last saved data."));
    }, 160);
  });

  if (sessionEpoch !== authSessionEpoch || !syncRuntime.active) {
    if (realtimeListener && typeof realtimeListener.unsubscribe === "function") {
      realtimeListener.unsubscribe();
    }
    return;
  }

  if (realtimeListener && typeof realtimeListener.unsubscribe === "function") {
    syncRuntime.realtimeUnsubscribe = realtimeListener.unsubscribe;
  }

  syncRuntime.message = `Cloud sync is on for ${session.user.email}.`;
  syncRuntime.tone = "ok";
  updateSyncUI();
}

async function refreshRemoteState(options = {}) {
  const requestEpoch = options.authEpoch ?? authSessionEpoch;
  const remoteState = normalizeState(await window.familyHubSync.fetchState());
  if (requestEpoch !== authSessionEpoch || !syncRuntime.active) {
    return remoteState;
  }

  syncRuntime.cloudWasEmpty = !hasAnyData(remoteState);
  state = remoteState;
  cacheRemoteState(state);
  render();
  if (!options.keepMessage && syncRuntime.session) {
    syncRuntime.message = `Cloud sync is on for ${syncRuntime.session.user.email}.`;
    syncRuntime.tone = "ok";
  }
  updateSyncUI();
}

function handleSyncFailure(error, message) {
  console.error(error);
  syncRuntime.message = message;
  syncRuntime.tone = "error";
  updateSyncUI();
}

function updateSyncUI() {
  const shouldShowAuthGate = syncRuntime.configured && !syncRuntime.active;
  const shouldShowSyncStrip = syncRuntime.configured && syncRuntime.active;
  const canSeedCloud = shouldShowSyncStrip && syncRuntime.cloudWasEmpty && hasAnyData(localSeedState);

  dom.authGate.classList.toggle("hidden", !shouldShowAuthGate);
  dom.syncStrip.classList.toggle("hidden", !shouldShowSyncStrip);
  dom.seedCloudBtn.classList.toggle("hidden", !canSeedCloud);
  dom.syncLabel.textContent = syncRuntime.message;

  dom.syncDot.classList.remove("ok", "working", "error");
  if (syncRuntime.tone === "ok") {
    dom.syncDot.classList.add("ok");
  } else if (syncRuntime.tone === "working") {
    dom.syncDot.classList.add("working");
  } else if (syncRuntime.tone === "error") {
    dom.syncDot.classList.add("error");
  }
}

async function signInWithFamilyLogin(event) {
  event.preventDefault();
  if (!syncRuntime.configured) {
    return;
  }

  const email = dom.authEmail.value.trim();
  const password = dom.authPassword.value;
  if (!email || !password) {
    setAuthMessage("Enter the family email and password first.");
    return;
  }

  try {
    setAuthMessage("Signing in...");
    await window.familyHubSync.signIn(email, password);
    setAuthMessage("Signed in. Loading shared family data...");
    dom.authPassword.value = "";
  } catch (error) {
    console.error(error);
    setAuthMessage(error.message || "Sign-in failed.");
  }
}

async function createFamilyLogin() {
  if (!syncRuntime.configured) {
    return;
  }

  const email = dom.authEmail.value.trim();
  const password = dom.authPassword.value;
  if (!email || !password) {
    setAuthMessage("Enter the family email and password first.");
    return;
  }

  try {
    setAuthMessage("Creating the shared family login...");
    const result = await window.familyHubSync.signUp(email, password);
    dom.authPassword.value = "";
    if (!result.session) {
      setAuthMessage("Family login created. If email confirmation is enabled in Supabase, confirm the email first and then sign in.");
    } else {
      setAuthMessage("Family login created. Loading shared family data...");
    }
  } catch (error) {
    console.error(error);
    setAuthMessage(error.message || "Could not create the family login.");
  }
}

async function signOutEverywhere() {
  if (!syncRuntime.active) {
    return;
  }

  try {
    await window.familyHubSync.signOut();
    dom.authPassword.value = "";
    setAuthMessage(DEFAULT_AUTH_MESSAGE);
    syncRuntime.message = "Signed out. Sign in again to resume cloud sync.";
    syncRuntime.tone = "idle";
    updateSyncUI();
  } catch (error) {
    handleSyncFailure(error, "Could not sign out right now.");
  }
}

function setAuthMessage(message) {
  dom.authMessage.textContent = message;
}

async function seedCloudFromLocal() {
  if (!syncRuntime.active) {
    return;
  }

  if (!hasAnyData(localSeedState)) {
    window.alert("This device does not have any local data to upload.");
    return;
  }

  if (!window.confirm("Upload this device's local calendar, dinners, tasks, and shared list to the cloud?")) {
    return;
  }

  try {
    const seedEpoch = authSessionEpoch;
    syncRuntime.message = "Uploading this device's data to the cloud...";
    syncRuntime.tone = "working";
    updateSyncUI();
    await window.familyHubSync.replaceAllState(localSeedState);
    syncRuntime.cloudWasEmpty = false;
    await refreshRemoteState({ authEpoch: seedEpoch });
    if (seedEpoch === authSessionEpoch && syncRuntime.active) {
      clearLocalSeedState();
      updateSyncUI();
    }
  } catch (error) {
    handleSyncFailure(error, "The device data could not be uploaded to the cloud.");
  }
}

function loadLocalSeedState() {
  try {
    const current = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (current) {
      return normalizeState(JSON.parse(current));
    }
  } catch (error) {
    console.warn("Could not read the current local Family Hub data.", error);
  }

  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const migrated = normalizeState({
        ...JSON.parse(legacy),
        meals: []
      });
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch (error) {
    console.warn("Could not migrate legacy Family Hub data.", error);
  }

  return normalizeState({});
}

function loadRemoteCacheState() {
  try {
    const cached = localStorage.getItem(REMOTE_CACHE_KEY);
    return cached ? normalizeState(JSON.parse(cached)) : null;
  } catch (error) {
    console.warn("Could not read the cached cloud Family Hub data.", error);
    return null;
  }
}

function saveLocalState() {
  state = normalizeState(state);
  localSeedState = normalizeState(state);
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("Could not save the local Family Hub data.", error);
  }
  render();
}

function cacheRemoteState(nextState) {
  try {
    localStorage.setItem(REMOTE_CACHE_KEY, JSON.stringify(normalizeState(nextState)));
  } catch (error) {
    console.warn("Could not cache the cloud Family Hub data.", error);
  }
}

function clearLocalSeedState() {
  localSeedState = normalizeState({});
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    localStorage.removeItem(LEGACY_KEY);
  } catch (error) {
    console.warn("Could not clear the local Family Hub seed data.", error);
  }
}

function hasAnyData(candidate) {
  return Boolean(
    candidate &&
    (
      candidate.events.length ||
      candidate.tasks.length ||
      candidate.groceries.length ||
      candidate.meals.length
    )
  );
}

function normalizeState(input = {}) {
  const normalized = {
    version: 3,
    events: Array.isArray(input.events) ? input.events.map(normalizeEvent).filter(Boolean) : [],
    tasks: Array.isArray(input.tasks) ? input.tasks.map(normalizeTask).filter(Boolean) : [],
    groceries: Array.isArray(input.groceries) ? input.groceries.map(normalizeGrocery).filter(Boolean) : [],
    meals: Array.isArray(input.meals) ? input.meals.map(normalizeMeal).filter(Boolean) : []
  };

  const uniqueMeals = new Map();
  normalized.meals.forEach((meal) => uniqueMeals.set(meal.date, meal));
  normalized.meals = [...uniqueMeals.values()].sort((left, right) => left.date.localeCompare(right.date));

  return normalized;
}

function normalizeEvent(event) {
  if (!event || typeof event !== "object") {
    return null;
  }

  const title = String(event.title || "").trim();
  const date = sanitizeDateString(event.date);
  if (!title || !date) {
    return null;
  }

  return {
    id: String(event.id || uid()),
    title,
    date,
    time: sanitizeTimeString(event.time),
    who: PEOPLE.includes(event.who) ? event.who : "Family",
    notes: String(event.notes || "").trim(),
    repeat: normalizeEventRepeat(event.repeat)
  };
}

function normalizeEventRepeat(repeat) {
  if (!repeat || typeof repeat !== "object" || !EVENT_REPEAT_TYPES.has(repeat.type)) {
    return { type: "none" };
  }

  const normalized = {
    type: repeat.type,
    interval: Math.max(1, Number(repeat.interval) || 1),
    endType: ["never", "on", "after"].includes(repeat.endType) ? repeat.endType : "never",
    endDate: sanitizeDateString(repeat.endDate),
    count: Math.max(1, Number(repeat.count) || 1),
    weekdays: Array.isArray(repeat.weekdays)
      ? [...new Set(repeat.weekdays.map((value) => Number(value)).filter((value) => value >= 0 && value <= 6))].sort()
      : []
  };

  if (normalized.type !== "weekly") {
    normalized.weekdays = [];
  }

  return normalized;
}

function normalizeTask(task) {
  if (!task) {
    return null;
  }

  const source = typeof task === "object" ? task : { title: task };
  const title = String(source.title || source.text || "").trim();
  if (!title) {
    return null;
  }

  return {
    id: String(source.id || uid()),
    title,
    dueDate: sanitizeDateString(source.dueDate || source.due_date),
    notes: String(source.notes || "").trim(),
    done: Boolean(source.done)
  };
}

function normalizeGrocery(item) {
  if (!item) {
    return null;
  }

  const source = typeof item === "object" ? item : { text: item };
  const text = String(source.text || "").trim();
  if (!text) {
    return null;
  }

  return {
    id: String(source.id || uid()),
    text,
    done: Boolean(source.done)
  };
}

function normalizeMeal(meal) {
  if (!meal || typeof meal !== "object") {
    return null;
  }

  const date = sanitizeDateString(meal.date);
  const name = String(meal.name || "").trim();
  const notes = String(meal.notes || "").trim();
  const ingredients = String(meal.ingredients || "").trim();

  if (!date || (!name && !notes && !ingredients)) {
    return null;
  }

  return {
    id: String(meal.id || uid()),
    date,
    name,
    notes,
    ingredients
  };
}

function sanitizeDateString(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return "";
  }

  const date = parseDate(value);
  return date ? ymd(date) : "";
}

function sanitizeTimeString(value) {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) {
    return "";
  }

  return value;
}

function render() {
  const now = new Date();
  dom.dateLine.textContent = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  });

  renderCalendar();
  renderOverview();
  renderWorkspace();
  updateSyncUI();
}

function renderCalendar() {
  dom.monthLabel.textContent = monthView.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric"
  });

  const firstOfMonth = startOfMonth(monthView);
  const start = addDays(firstOfMonth, -firstOfMonth.getDay());
  const cells = [];

  for (let index = 0; index < 42; index += 1) {
    const date = addDays(start, index);
    const dateString = ymd(date);
    const meal = getMealByDate(dateString);
    const events = eventsForDate(date);
    const eventMarkup = events
      .slice(0, 3)
      .map(
        (event) => `
          <button class="event-pill ${event.who}" type="button" data-action="edit-event" data-id="${escapeAttribute(event.id)}">
            ${escapeHtml(formatTimeLabel(event.time, true) ? `${formatTimeLabel(event.time, true)} ${event.title}` : event.title)}
          </button>
        `
      )
      .join("");

    const extraMarkup = events.length > 3 ? `<div class="more-note">+${events.length - 3} more</div>` : "";

    cells.push(`
      <article
        class="day-card${date.getMonth() !== monthView.getMonth() ? " other-month" : ""}${sameDay(date, new Date()) ? " today" : ""}${sameDay(date, overviewDate) ? " selected" : ""}"
        data-action="select-day"
        data-date="${dateString}"
      >
        <div class="day-top">
          <span class="day-number">${date.getDate()}</span>
        </div>
        ${meal && meal.name ? `<div class="day-meal">${escapeHtml(meal.name)}</div>` : ""}
        ${eventMarkup}
        ${extraMarkup}
      </article>
    `);
  }

  dom.calendarGrid.innerHTML = cells.join("");
}

function renderOverview() {
  const selectedDate = atStartOfDay(overviewDate);
  const isToday = sameDay(selectedDate, new Date());
  const selectedDateLabel = formatOverviewDate(selectedDate);
  const selectedDateEvents = eventsForDate(selectedDate);

  dom.overviewKicker.textContent = isToday ? "Today" : "Selected day";
  dom.overviewTitle.textContent = isToday ? "Today's events" : `Events for ${selectedDateLabel}`;
  dom.overviewAddEventBtn.setAttribute("aria-label", `Add event for ${selectedDateLabel}`);

  dom.todayEvents.innerHTML = selectedDateEvents.length
    ? selectedDateEvents
        .map(
          (event) => `
            <div class="list-item compact-item">
              <div class="item-copy">
                <span class="item-title">${escapeHtml(event.title)}</span>
                <span class="item-meta">
                  <span class="tag">${escapeHtml(formatTimeLabel(event.time) || "All day")}</span>
                  <span class="tag">${escapeHtml(event.who)}</span>
                  ${event.repeat.type !== "none" ? `<span class="tag">${escapeHtml(repeatSummary(event.repeat.type))}</span>` : ""}
                </span>
                ${event.notes ? `<p class="event-note">${escapeHtml(event.notes)}</p>` : ""}
              </div>
            </div>
          `
        )
        .join("")
    : `<div class="empty">${
        isToday
          ? "No events on the calendar today."
          : `No events scheduled for ${escapeHtml(selectedDateLabel)}.`
      }</div>`;
}

function renderWorkspace() {
  dom.workspaceTitle.textContent = WORKSPACE_TITLES[activeTab];

  dom.tabButtons.forEach((button) => {
    const isActive = button.dataset.tab === activeTab;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  dom.tabPanels.forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.panel !== activeTab);
  });

  renderMeals();
  renderTasks();
  renderGroceries();
}

function renderMeals() {
  const weekStart = startOfWeek(mealWeekView);
  const weekEnd = addDays(weekStart, 6);
  dom.weekLabel.textContent = formatWeekRange(weekStart, weekEnd);

  const rows = [];
  for (let index = 0; index < 7; index += 1) {
    const date = addDays(weekStart, index);
    const dateString = ymd(date);
    const meal = getMealByDate(dateString);
    const ingredientsCount = meal ? splitGroceries(meal.ingredients).length : 0;

    rows.push(`
      <article class="meal-row${sameDay(date, new Date()) ? " current" : ""}" data-action="edit-meal" data-date="${dateString}">
        <div class="meal-day">
          <strong>${date.toLocaleDateString(undefined, { weekday: "short" })}</strong>
          <span>${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
        </div>

        <div class="meal-copy">
          ${
            meal && meal.name
              ? `<p class="meal-name">${escapeHtml(meal.name)}</p>`
              : `<p class="meal-name placeholder">Plan dinner</p>`
          }
          <p class="meal-note">${
            meal && meal.notes
              ? escapeHtml(meal.notes)
              : meal && ingredientsCount
                ? escapeHtml(ingredientsSummary(meal.ingredients))
                : "Add the meal, prep notes, or ingredient list."
          }</p>
        </div>

        <div class="row-actions">
          <button class="secondary small-button" type="button" data-action="edit-meal" data-date="${dateString}">
            ${meal ? "Edit" : "Add"}
          </button>
          ${
            meal && ingredientsCount
              ? `<button class="secondary small-button" type="button" data-action="add-meal-list" data-id="${escapeAttribute(meal.id)}">Add to list</button>`
              : ""
          }
        </div>
      </article>
    `);
  }

  dom.mealList.innerHTML = rows.join("");
}

function renderTasks() {
  const tasks = [...state.tasks].sort(compareTasks);
  dom.taskList.innerHTML = tasks.length
    ? tasks
        .map(
          (task) => `
            <div class="list-item${task.done ? " done" : ""}">
              <label class="check-wrap">
                <input type="checkbox" data-action="toggle-task" data-id="${escapeAttribute(task.id)}" ${task.done ? "checked" : ""}>
                <span class="item-copy">
                  <span class="item-title">${escapeHtml(task.title)}</span>
                  ${task.dueDate ? `<span class="item-meta">${taskDueChip(task.dueDate)}</span>` : ""}
                  ${task.notes ? `<p class="event-note">${escapeHtml(task.notes)}</p>` : ""}
                </span>
              </label>

              <button class="secondary small-button" type="button" data-action="edit-task" data-id="${escapeAttribute(task.id)}">Edit</button>
            </div>
          `
        )
        .join("")
    : `<div class="empty">Add chores, routines, or one-off reminders here.</div>`;
}

function renderGroceries() {
  const groceries = [...state.groceries].sort(compareGroceries);
  dom.groceryList.innerHTML = groceries.length
    ? groceries
        .map(
          (item) => `
            <div class="list-item${item.done ? " done" : ""}">
              <label class="check-wrap">
                <input type="checkbox" data-action="toggle-grocery" data-id="${escapeAttribute(item.id)}" ${item.done ? "checked" : ""}>
                <span class="item-copy">
                  <span class="item-title">${escapeHtml(item.text)}</span>
                </span>
              </label>

              <button class="secondary small-button" type="button" data-action="delete-grocery" data-id="${escapeAttribute(item.id)}">Delete</button>
            </div>
          `
        )
        .join("")
    : `<div class="empty">Keep this simple: one shared list for groceries or other quick errands.</div>`;
}

function setActiveTab(tab) {
  if (!WORKSPACE_TITLES[tab]) {
    return;
  }

  activeTab = tab;
  renderWorkspace();
}

function handleCalendarClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target) {
    return;
  }

  const dayCard = target.closest(".day-card");
  const clickedDate = dayCard ? parseDate(dayCard.dataset.date) : null;

  if (target.dataset.action === "edit-event") {
    const found = state.events.find((item) => item.id === target.dataset.id);
    if (found) {
      if (clickedDate) {
        overviewDate = clickedDate;
        render();
      }
      openEventDialog(found);
    }
    return;
  }

  if (target.dataset.action === "select-day" && clickedDate) {
    overviewDate = clickedDate;
    render();
  }
}

async function handleMealClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target) {
    return;
  }

  if (target.dataset.action === "add-meal-list") {
    event.stopPropagation();
    const meal = state.meals.find((item) => item.id === target.dataset.id);
    if (!meal) {
      return;
    }

    const added = await addItemsToSharedList(meal.ingredients);
    window.alert(added ? `Added ${added} ${added === 1 ? "list item" : "list items"} from this dinner plan.` : "No new list items were added.");
    return;
  }

  if (target.dataset.action === "edit-meal") {
    const meal = getMealByDate(target.dataset.date) || { date: target.dataset.date };
    openMealDialog(meal);
  }
}

function handleTaskClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target) {
    return;
  }

  if (target.dataset.action === "edit-task") {
    const task = state.tasks.find((item) => item.id === target.dataset.id);
    if (task) {
      openTaskDialog(task);
    }
  }
}

async function handleTaskChange(event) {
  const target = event.target.closest("[data-action='toggle-task']");
  if (!target) {
    return;
  }

  const task = state.tasks.find((item) => item.id === target.dataset.id);
  if (!task) {
    return;
  }

  const nextTask = normalizeTask({
    ...task,
    done: target.checked
  });

  if (syncRuntime.active) {
    try {
      const saved = normalizeTask(await window.familyHubSync.saveTask(nextTask));
      upsertTaskInState(saved);
      cacheRemoteState(state);
      render();
    } catch (error) {
      handleSyncFailure(error, "That task could not be updated in the cloud.");
      render();
    }
    return;
  }

  upsertTaskInState(nextTask);
  saveLocalState();
}

async function handleGroceryClick(event) {
  const target = event.target.closest("[data-action='delete-grocery']");
  if (!target) {
    return;
  }

  if (syncRuntime.active) {
    try {
      await window.familyHubSync.deleteListItem(target.dataset.id);
      state.groceries = state.groceries.filter((item) => item.id !== target.dataset.id);
      cacheRemoteState(state);
      render();
    } catch (error) {
      handleSyncFailure(error, "That list item could not be deleted from the cloud.");
    }
    return;
  }

  state.groceries = state.groceries.filter((item) => item.id !== target.dataset.id);
  saveLocalState();
}

async function handleGroceryChange(event) {
  const target = event.target.closest("[data-action='toggle-grocery']");
  if (!target) {
    return;
  }

  const grocery = state.groceries.find((item) => item.id === target.dataset.id);
  if (!grocery) {
    return;
  }

  const nextItem = normalizeGrocery({
    ...grocery,
    done: target.checked
  });

  if (syncRuntime.active) {
    try {
      const saved = normalizeGrocery(await window.familyHubSync.saveListItem(nextItem));
      upsertGroceryInState(saved);
      cacheRemoteState(state);
      render();
    } catch (error) {
      handleSyncFailure(error, "That list item could not be updated in the cloud.");
      render();
    }
    return;
  }

  upsertGroceryInState(nextItem);
  saveLocalState();
}

async function addSharedListItem(event) {
  event.preventDefault();
  const text = dom.groceryInput.value.trim();
  if (!text) {
    return;
  }

  const item = normalizeGrocery({
    id: uid(),
    text,
    done: false
  });

  try {
    if (syncRuntime.active) {
      const saved = normalizeGrocery(await window.familyHubSync.saveListItem(item));
      upsertGroceryInState(saved);
      cacheRemoteState(state);
      render();
    } else {
      state.groceries.push(item);
      saveLocalState();
    }

    dom.groceryInput.value = "";
  } catch (error) {
    handleSyncFailure(error, "That list item could not be saved to the cloud.");
  }
}

function openEventDialog(event = {}) {
  const repeat = normalizeEventRepeat(event.repeat || { type: "none" });
  dom.eventDialogTitle.textContent = event.id ? "Edit event" : "Add event";
  dom.eventId.value = event.id || "";
  dom.eventTitle.value = event.title || "";
  dom.eventDate.value = sanitizeDateString(event.date) || ymd(new Date());
  dom.eventTime.value = sanitizeTimeString(event.time);
  dom.eventWho.value = PEOPLE.includes(event.who) ? event.who : "Family";
  dom.eventRepeatType.value = repeat.type;
  dom.eventInterval.value = repeat.interval || 1;
  dom.eventEndType.value = repeat.endType || "never";
  dom.eventEndDate.value = repeat.endDate || "";
  dom.eventCount.value = repeat.count || 10;
  dom.eventNotes.value = event.notes || "";

  const weeklySelection = repeat.weekdays.length ? repeat.weekdays : [parseDate(dom.eventDate.value).getDay()];
  [...dom.eventWeekdays.querySelectorAll("input")].forEach((checkbox) => {
    checkbox.checked = weeklySelection.includes(Number(checkbox.value));
  });

  dom.eventDeleteBtn.classList.toggle("hidden", !event.id);
  toggleEventRepeatFields();
  dom.eventDialog.showModal();
}

function toggleEventRepeatFields() {
  const repeatType = dom.eventRepeatType.value;
  const endType = dom.eventEndType.value;

  dom.eventRepeatFields.forEach((element) => {
    element.classList.toggle("hidden", repeatType === "none");
  });

  dom.eventWeeklyFields.forEach((element) => {
    element.classList.toggle("hidden", repeatType !== "weekly");
  });

  dom.eventEndOnFields.forEach((element) => {
    element.classList.toggle("hidden", repeatType === "none" || endType !== "on");
  });

  dom.eventEndAfterFields.forEach((element) => {
    element.classList.toggle("hidden", repeatType === "none" || endType !== "after");
  });
}

function syncWeeklyRepeatSelection() {
  if (dom.eventRepeatType.value !== "weekly") {
    return;
  }

  const anyChecked = dom.eventWeekdays.querySelector("input:checked");
  if (anyChecked) {
    return;
  }

  const date = parseDate(dom.eventDate.value) || new Date();
  [...dom.eventWeekdays.querySelectorAll("input")].forEach((checkbox) => {
    checkbox.checked = Number(checkbox.value) === date.getDay();
  });
}

async function saveEvent() {
  const title = dom.eventTitle.value.trim();
  const date = sanitizeDateString(dom.eventDate.value);
  if (!title || !date) {
    dom.eventTitle.focus();
    return;
  }

  const repeatType = dom.eventRepeatType.value;
  const repeat = repeatType === "none"
    ? { type: "none" }
    : {
        type: repeatType,
        interval: Math.max(1, Number(dom.eventInterval.value) || 1),
        endType: dom.eventEndType.value,
        endDate: sanitizeDateString(dom.eventEndDate.value),
        count: Math.max(1, Number(dom.eventCount.value) || 1),
        weekdays: [...dom.eventWeekdays.querySelectorAll("input:checked")].map((input) => Number(input.value))
      };

  if (repeat.type === "weekly" && !repeat.weekdays.length) {
    repeat.weekdays = [parseDate(date).getDay()];
  }

  const nextEvent = normalizeEvent({
    id: dom.eventId.value || uid(),
    title,
    date,
    time: sanitizeTimeString(dom.eventTime.value),
    who: PEOPLE.includes(dom.eventWho.value) ? dom.eventWho.value : "Family",
    notes: dom.eventNotes.value.trim(),
    repeat
  });

  try {
    if (syncRuntime.active) {
      const saved = normalizeEvent(await window.familyHubSync.saveEvent(nextEvent));
      upsertEventInState(saved);
      cacheRemoteState(state);
      render();
    } else {
      upsertEventInState(nextEvent);
      saveLocalState();
    }

    dom.eventDialog.close();
  } catch (error) {
    handleSyncFailure(error, "That calendar event could not be saved to the cloud.");
  }
}

async function deleteEvent() {
  const id = dom.eventId.value;
  if (!id) {
    return;
  }

  try {
    if (syncRuntime.active) {
      await window.familyHubSync.deleteEvent(id);
      state.events = state.events.filter((event) => event.id !== id);
      cacheRemoteState(state);
      render();
    } else {
      state.events = state.events.filter((event) => event.id !== id);
      saveLocalState();
    }

    dom.eventDialog.close();
  } catch (error) {
    handleSyncFailure(error, "That calendar event could not be deleted from the cloud.");
  }
}

function openMealDialog(meal = {}) {
  dom.mealDialogTitle.textContent = meal.id ? "Edit dinner" : "Plan dinner";
  dom.mealId.value = meal.id || "";
  dom.mealDate.value = sanitizeDateString(meal.date) || ymd(new Date());
  dom.mealName.value = meal.name || "";
  dom.mealNotes.value = meal.notes || "";
  dom.mealIngredients.value = meal.ingredients || "";
  dom.mealDeleteBtn.classList.toggle("hidden", !meal.id);
  dom.mealDialog.showModal();
}

async function saveMeal(addListItemsToo) {
  const name = dom.mealName.value.trim();
  const date = sanitizeDateString(dom.mealDate.value);
  const notes = dom.mealNotes.value.trim();
  const ingredients = dom.mealIngredients.value.trim();

  if (!date || !name) {
    dom.mealName.focus();
    return;
  }

  const meal = normalizeMeal({
    id: dom.mealId.value || uid(),
    date,
    name,
    notes,
    ingredients
  });

  try {
    if (syncRuntime.active) {
      const saved = normalizeMeal(await window.familyHubSync.saveMeal(meal));
      upsertMealInState(saved);
      cacheRemoteState(state);
      render();
    } else {
      upsertMealInState(meal);
      saveLocalState();
    }

    dom.mealDialog.close();

    if (addListItemsToo) {
      const added = await addItemsToSharedList(ingredients);
      window.alert(added ? `Added ${added} ${added === 1 ? "list item" : "list items"} from this dinner.` : "No new list items were added.");
    }
  } catch (error) {
    handleSyncFailure(error, "That dinner plan could not be saved to the cloud.");
  }
}

async function deleteMeal() {
  const id = dom.mealId.value;
  if (!id) {
    return;
  }

  try {
    if (syncRuntime.active) {
      await window.familyHubSync.deleteMeal(id);
      state.meals = state.meals.filter((item) => item.id !== id);
      cacheRemoteState(state);
      render();
    } else {
      state.meals = state.meals.filter((item) => item.id !== id);
      saveLocalState();
    }

    dom.mealDialog.close();
  } catch (error) {
    handleSyncFailure(error, "That dinner plan could not be deleted from the cloud.");
  }
}

function openTaskDialog(task = {}) {
  dom.taskDialogTitle.textContent = task.id ? "Edit task" : "Add task";
  dom.taskId.value = task.id || "";
  dom.taskTitle.value = task.title || "";
  dom.taskDueDate.value = sanitizeDateString(task.dueDate);
  dom.taskNotes.value = task.notes || "";
  dom.taskDeleteBtn.classList.toggle("hidden", !task.id);
  dom.taskDialog.showModal();
}

async function saveTask() {
  const title = dom.taskTitle.value.trim();
  if (!title) {
    dom.taskTitle.focus();
    return;
  }

  const existing = state.tasks.find((item) => item.id === dom.taskId.value);
  const nextTask = normalizeTask({
    id: dom.taskId.value || uid(),
    title,
    dueDate: sanitizeDateString(dom.taskDueDate.value),
    notes: dom.taskNotes.value.trim(),
    done: existing ? existing.done : false
  });

  try {
    if (syncRuntime.active) {
      const saved = normalizeTask(await window.familyHubSync.saveTask(nextTask));
      upsertTaskInState(saved);
      cacheRemoteState(state);
      render();
    } else {
      upsertTaskInState(nextTask);
      saveLocalState();
    }

    dom.taskDialog.close();
  } catch (error) {
    handleSyncFailure(error, "That task could not be saved to the cloud.");
  }
}

async function deleteTask() {
  const id = dom.taskId.value;
  if (!id) {
    return;
  }

  try {
    if (syncRuntime.active) {
      await window.familyHubSync.deleteTask(id);
      state.tasks = state.tasks.filter((task) => task.id !== id);
      cacheRemoteState(state);
      render();
    } else {
      state.tasks = state.tasks.filter((task) => task.id !== id);
      saveLocalState();
    }

    dom.taskDialog.close();
  } catch (error) {
    handleSyncFailure(error, "That task could not be deleted from the cloud.");
  }
}

async function copyPreviousWeekMeals() {
  const thisWeekStart = startOfWeek(mealWeekView);
  const previousWeekStart = addDays(thisWeekStart, -7);
  const mealsToCopy = [];
  const currentWeekHasMeals = state.meals.some((meal) => isWithinWeek(parseDate(meal.date), thisWeekStart));

  for (let index = 0; index < 7; index += 1) {
    const source = getMealByDate(ymd(addDays(previousWeekStart, index)));
    if (!source) {
      continue;
    }

    mealsToCopy.push(normalizeMeal({
      id: uid(),
      date: ymd(addDays(thisWeekStart, index)),
      name: source.name,
      notes: source.notes,
      ingredients: source.ingredients
    }));
  }

  if (!mealsToCopy.length) {
    window.alert("No dinners were planned last week to copy.");
    return;
  }

  if (currentWeekHasMeals && !window.confirm("Replace this week's dinners with last week's plan?")) {
    return;
  }

  state.meals = state.meals.filter((meal) => !isWithinWeek(parseDate(meal.date), thisWeekStart));
  state.meals.push(...mealsToCopy);

  if (syncRuntime.active) {
    try {
      await window.familyHubSync.replaceMeals(state.meals);
      state = normalizeState(state);
      cacheRemoteState(state);
      render();
    } catch (error) {
      handleSyncFailure(error, "That weekly dinner plan could not be copied to the cloud.");
      await refreshRemoteState({ keepMessage: true }).catch(() => {});
    }
    return;
  }

  saveLocalState();
}

async function addItemsToSharedList(value) {
  const items = splitGroceries(value);
  if (!items.length) {
    return 0;
  }

  const existing = new Set(state.groceries.map((item) => item.text.toLowerCase()));
  const pending = new Set();
  const newItems = items.reduce((collected, text) => {
    const key = text.toLowerCase();
    if (existing.has(key) || pending.has(key)) {
      return collected;
    }

    pending.add(key);
    collected.push(normalizeGrocery({ id: uid(), text, done: false }));
    return collected;
  }, []);

  if (!newItems.length) {
    return 0;
  }

  if (syncRuntime.active) {
    try {
      const savedItems = await window.familyHubSync.saveListItems(newItems);
      savedItems.map(normalizeGrocery).forEach((item) => upsertGroceryInState(item));
      cacheRemoteState(state);
      render();
      return savedItems.length;
    } catch (error) {
      handleSyncFailure(error, "Those list items could not be saved to the cloud.");
      return 0;
    }
  }

  state.groceries.push(...newItems);
  saveLocalState();
  return newItems.length;
}

function upsertEventInState(event) {
  const index = state.events.findIndex((item) => item.id === event.id);
  if (index >= 0) {
    state.events[index] = event;
  } else {
    state.events.push(event);
  }
  state = normalizeState(state);
}

function upsertMealInState(meal) {
  state.meals = state.meals.filter((item) => item.id !== meal.id && item.date !== meal.date);
  state.meals.push(meal);
  state = normalizeState(state);
}

function upsertTaskInState(task) {
  const index = state.tasks.findIndex((item) => item.id === task.id);
  if (index >= 0) {
    state.tasks[index] = task;
  } else {
    state.tasks.push(task);
  }
  state = normalizeState(state);
}

function upsertGroceryInState(grocery) {
  const index = state.groceries.findIndex((item) => item.id === grocery.id);
  if (index >= 0) {
    state.groceries[index] = grocery;
  } else {
    state.groceries.push(grocery);
  }
  state = normalizeState(state);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) {
        return;
      }

      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker
      .register("sw.js", { updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch(() => {});
  });
}

function eventsForDate(date) {
  return state.events
    .filter((event) => occursOnDate(event, date))
    .sort((left, right) => {
      const timeComparison = (left.time || "99:99").localeCompare(right.time || "99:99");
      if (timeComparison) {
        return timeComparison;
      }

      return left.title.localeCompare(right.title);
    });
}

function occursOnDate(event, date) {
  const start = parseDate(event.date);
  const target = atStartOfDay(date);
  if (!start || target < start) {
    return false;
  }

  const repeat = normalizeEventRepeat(event.repeat);
  if (repeat.type === "none") {
    return sameDay(start, target);
  }

  if (repeat.endType === "on" && repeat.endDate) {
    const endDate = parseDate(repeat.endDate);
    if (endDate && target > endDate) {
      return false;
    }
  }

  const interval = Math.max(1, Number(repeat.interval) || 1);

  if (repeat.type === "weekly") {
    const startWeek = addDays(start, -start.getDay());
    const targetWeek = addDays(target, -target.getDay());
    const weekOffset = Math.round((targetWeek - startWeek) / (7 * 24 * 60 * 60 * 1000));
    const weekdays = repeat.weekdays.length ? repeat.weekdays : [start.getDay()];
    if (weekOffset < 0 || weekOffset % interval !== 0 || !weekdays.includes(target.getDay())) {
      return false;
    }
  } else {
    let cursor = new Date(start);
    let match = false;
    let limit = 1000;

    while (cursor <= target && limit > 0) {
      if (sameDay(cursor, target)) {
        match = true;
        break;
      }

      if (repeat.type === "daily") {
        cursor = addDays(cursor, interval);
      } else if (repeat.type === "monthly") {
        cursor = addMonths(cursor, interval);
      } else {
        cursor = addYears(cursor, interval);
      }

      limit -= 1;
    }

    if (!match) {
      return false;
    }
  }

  if (repeat.endType === "after") {
    let occurrences = 0;
    let cursor = new Date(start);
    let limit = 2500;
    const withoutEnd = {
      ...event,
      repeat: {
        ...repeat,
        endType: "never"
      }
    };

    while (cursor <= target && limit > 0) {
      if (occursOnDate(withoutEnd, cursor)) {
        occurrences += 1;
      }
      cursor = addDays(cursor, 1);
      limit -= 1;
    }

    return occurrences <= repeat.count;
  }

  return true;
}

function getMealByDate(dateString) {
  return state.meals.find((meal) => meal.date === dateString) || null;
}

function compareTasks(left, right) {
  if (left.done !== right.done) {
    return left.done ? 1 : -1;
  }

  const leftHasDueDate = Boolean(left.dueDate);
  const rightHasDueDate = Boolean(right.dueDate);
  if (leftHasDueDate !== rightHasDueDate) {
    return leftHasDueDate ? -1 : 1;
  }

  if (left.dueDate && right.dueDate && left.dueDate !== right.dueDate) {
    return left.dueDate.localeCompare(right.dueDate);
  }

  return left.title.localeCompare(right.title);
}

function compareGroceries(left, right) {
  if (left.done !== right.done) {
    return left.done ? 1 : -1;
  }

  return left.text.localeCompare(right.text);
}

function splitGroceries(value) {
  return String(value || "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function ingredientsSummary(value) {
  const count = splitGroceries(value).length;
  return count ? `${count} ${count === 1 ? "list item" : "list items"} saved with this dinner.` : "";
}

function taskDueChip(dateString) {
  const today = ymd(new Date());
  let extraClass = "";
  if (dateString < today) {
    extraClass = " alert";
  } else if (dateString === today) {
    extraClass = " warm";
  }

  return `<span class="tag${extraClass}">${escapeHtml(humanDueDate(dateString))}</span>`;
}

function humanDueDate(dateString) {
  const date = parseDate(dateString);
  if (!date) {
    return "No due date";
  }

  const today = ymd(new Date());
  const tomorrow = ymd(addDays(new Date(), 1));
  if (dateString === today) {
    return "Due today";
  }
  if (dateString === tomorrow) {
    return "Due tomorrow";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}

function repeatSummary(type) {
  if (type === "daily") {
    return "Repeats daily";
  }
  if (type === "weekly") {
    return "Repeats weekly";
  }
  if (type === "monthly") {
    return "Repeats monthly";
  }
  if (type === "yearly") {
    return "Repeats yearly";
  }
  return "No repeat";
}

function formatWeekRange(start, end) {
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${start.toLocaleDateString(undefined, { month: "long" })} ${start.getDate()}-${end.getDate()}, ${start.getFullYear()}`;
  }

  return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} - ${end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
}

function formatOverviewDate(date) {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  });
}

function formatTimeLabel(value, compact) {
  if (!value) {
    return compact ? "" : "All day";
  }

  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return compact ? "" : "All day";
  }

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: compact && minutes === 0 ? undefined : "2-digit"
  });
}

function isWithinWeek(date, weekStart) {
  if (!date) {
    return false;
  }

  const start = startOfWeek(weekStart);
  const end = addDays(start, 6);
  return atStartOfDay(date) >= start && atStartOfDay(date) <= end;
}

function parseDate(value) {
  if (typeof value !== "string") {
    return null;
  }

  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
    return null;
  }

  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return atStartOfDay(date);
}

function atStartOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date) {
  const copy = atStartOfDay(date);
  return addDays(copy, -copy.getDay());
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date, amount) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return atStartOfDay(copy);
}

function addMonths(date, amount) {
  const copy = new Date(date);
  const originalDay = copy.getDate();
  copy.setMonth(copy.getMonth() + amount);
  if (copy.getDate() < originalDay) {
    copy.setDate(0);
  }
  return atStartOfDay(copy);
}

function addYears(date, amount) {
  const copy = new Date(date);
  copy.setFullYear(copy.getFullYear() + amount);
  return atStartOfDay(copy);
}

function sameDay(left, right) {
  return ymd(left) === ymd(right);
}

function ymd(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function uid() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (match) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[match]);
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
