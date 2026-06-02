const STORAGE_KEY = "familyHub_v2";
const LEGACY_KEY = "familyHubGitHub_v1";
const PEOPLE = ["Family", "Ben", "Wife", "Kids"];
const EVENT_REPEAT_TYPES = new Set(["none", "daily", "weekly", "monthly", "yearly"]);
const TASK_REPEAT_TYPES = new Set(["none", "daily", "weekly", "monthly"]);
const WORKSPACE_TITLES = {
  meals: "Dinner plan",
  tasks: "Household tasks",
  groceries: "Shared list"
};

const $ = (id) => document.getElementById(id);

const dom = {
  dateLine: $("dateLine"),
  newBtn: $("newBtn"),
  monthLabel: $("monthLabel"),
  prevMonth: $("prevMonth"),
  nextMonth: $("nextMonth"),
  calendarGrid: $("calendarGrid"),
  todayEvents: $("todayEvents"),
  workspaceTitle: $("workspaceTitle"),
  tabButtons: [...document.querySelectorAll(".tab-button")],
  tabPanels: [...document.querySelectorAll(".tab-panel")],
  weekLabel: $("weekLabel"),
  prevWeekBtn: $("prevWeekBtn"),
  nextWeekBtn: $("nextWeekBtn"),
  copyWeekBtn: $("copyWeekBtn"),
  clearWeekBtn: $("clearWeekBtn"),
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
  taskAssignee: $("taskAssignee"),
  taskDueDate: $("taskDueDate"),
  taskRepeatType: $("taskRepeatType"),
  taskNotes: $("taskNotes"),
  taskDeleteBtn: $("taskDeleteBtn"),
  taskCancelBtn: $("taskCancelBtn"),
  taskCloseBtn: $("taskCloseBtn"),
  taskSaveBtn: $("taskSaveBtn")
};

let state = loadState();
let monthView = startOfMonth(new Date());
let mealWeekView = startOfWeek(new Date());
let activeTab = "meals";

bindEvents();
render();
registerServiceWorker();

function bindEvents() {
  dom.newBtn.addEventListener("click", () => openEventDialog({ date: ymd(new Date()) }));
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

  dom.prevWeekBtn.addEventListener("click", () => {
    mealWeekView = addDays(mealWeekView, -7);
    renderWorkspace();
  });

  dom.nextWeekBtn.addEventListener("click", () => {
    mealWeekView = addDays(mealWeekView, 7);
    renderWorkspace();
  });

  dom.copyWeekBtn.addEventListener("click", copyPreviousWeekMeals);
  dom.clearWeekBtn.addEventListener("click", clearCurrentWeekMeals);
  dom.newTaskBtn.addEventListener("click", () => openTaskDialog());

  dom.groceryForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = dom.groceryInput.value.trim();
    if (!text) {
      return;
    }

    state.groceries.push({
      id: uid(),
      text,
      done: false
    });

    dom.groceryInput.value = "";
    saveState();
  });

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

function loadState() {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) {
      return normalizeState(JSON.parse(current));
    }
  } catch (error) {
    console.warn("Could not read current Family Hub data.", error);
  }

  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const migrated = normalizeState({
        ...JSON.parse(legacy),
        meals: []
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch (error) {
    console.warn("Could not migrate legacy Family Hub data.", error);
  }

  return normalizeState({});
}

function normalizeState(input = {}) {
  const normalized = {
    version: 2,
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
    assignee: PEOPLE.includes(source.assignee) ? source.assignee : "",
    dueDate: sanitizeDateString(source.dueDate),
    notes: String(source.notes || "").trim(),
    done: Boolean(source.done),
    repeat: normalizeTaskRepeat(source.repeat)
  };
}

function normalizeTaskRepeat(repeat) {
  if (!repeat) {
    return { type: "none" };
  }

  if (typeof repeat === "string") {
    return { type: TASK_REPEAT_TYPES.has(repeat) ? repeat : "none" };
  }

  return { type: TASK_REPEAT_TYPES.has(repeat.type) ? repeat.type : "none" };
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

function saveState() {
  state = normalizeState(state);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
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
        class="day-card${date.getMonth() !== monthView.getMonth() ? " other-month" : ""}${sameDay(date, new Date()) ? " today" : ""}"
        data-action="new-event"
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
  const today = new Date();
  const todayEvents = eventsForDate(today);

  dom.todayEvents.innerHTML = todayEvents.length
    ? todayEvents
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
    : `<div class="empty">No events on the calendar today.</div>`;
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
              ? `<button class="secondary small-button" type="button" data-action="add-meal-groceries" data-id="${escapeAttribute(meal.id)}">Add to list</button>`
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
          (task) => {
            const metadata = [];
            if (task.assignee) {
              metadata.push(`<span class="tag">${escapeHtml(task.assignee)}</span>`);
            }
            if (task.dueDate) {
              metadata.push(taskDueChip(task.dueDate));
            }
            if (task.repeat.type !== "none") {
              metadata.push(`<span class="tag">${escapeHtml(repeatSummary(task.repeat.type))}</span>`);
            }

            return `
            <div class="list-item${task.done ? " done" : ""}">
              <label class="check-wrap">
                <input type="checkbox" data-action="toggle-task" data-id="${escapeAttribute(task.id)}" ${task.done ? "checked" : ""}>
                <span class="item-copy">
                  <span class="item-title">${escapeHtml(task.title)}</span>
                  ${metadata.length ? `<span class="item-meta">${metadata.join("")}</span>` : ""}
                  ${task.notes ? `<p class="event-note">${escapeHtml(task.notes)}</p>` : ""}
                </span>
              </label>

              <button class="secondary small-button" type="button" data-action="edit-task" data-id="${escapeAttribute(task.id)}">Edit</button>
            </div>
          `;
          }
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

  if (target.dataset.action === "edit-event") {
    const found = state.events.find((item) => item.id === target.dataset.id);
    if (found) {
      openEventDialog(found);
    }
    return;
  }

  if (target.dataset.action === "new-event") {
    openEventDialog({ date: target.dataset.date });
  }
}

function handleMealClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target) {
    return;
  }

  if (target.dataset.action === "add-meal-groceries") {
    event.stopPropagation();
    const meal = state.meals.find((item) => item.id === target.dataset.id);
    if (!meal) {
      return;
    }

    const added = addGroceriesFromText(meal.ingredients);
    if (!added) {
      window.alert("No new list items were added.");
      return;
    }

    saveState();
    window.alert(`Added ${added} ${added === 1 ? "list item" : "list items"} from this dinner plan.`);
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

function handleTaskChange(event) {
  const target = event.target.closest("[data-action='toggle-task']");
  if (!target) {
    return;
  }

  const task = state.tasks.find((item) => item.id === target.dataset.id);
  if (!task) {
    return;
  }

  if (target.checked && task.repeat.type !== "none") {
    const basis = parseDate(task.dueDate) || new Date();
    task.dueDate = ymd(nextRepeatedDate(basis, task.repeat.type));
    task.done = false;
  } else {
    task.done = target.checked;
  }

  saveState();
}

function handleGroceryClick(event) {
  const target = event.target.closest("[data-action='delete-grocery']");
  if (!target) {
    return;
  }

  state.groceries = state.groceries.filter((item) => item.id !== target.dataset.id);
  saveState();
}

function handleGroceryChange(event) {
  const target = event.target.closest("[data-action='toggle-grocery']");
  if (!target) {
    return;
  }

  const grocery = state.groceries.find((item) => item.id === target.dataset.id);
  if (!grocery) {
    return;
  }

  grocery.done = target.checked;
  saveState();
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

function saveEvent() {
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

  const nextEvent = {
    id: dom.eventId.value || uid(),
    title,
    date,
    time: sanitizeTimeString(dom.eventTime.value),
    who: PEOPLE.includes(dom.eventWho.value) ? dom.eventWho.value : "Family",
    notes: dom.eventNotes.value.trim(),
    repeat: normalizeEventRepeat(repeat)
  };

  const existingIndex = state.events.findIndex((item) => item.id === nextEvent.id);
  if (existingIndex >= 0) {
    state.events[existingIndex] = nextEvent;
  } else {
    state.events.push(nextEvent);
  }

  dom.eventDialog.close();
  saveState();
}

function deleteEvent() {
  const id = dom.eventId.value;
  if (!id) {
    return;
  }

  state.events = state.events.filter((event) => event.id !== id);
  dom.eventDialog.close();
  saveState();
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

function saveMeal(addGroceriesToo) {
  const name = dom.mealName.value.trim();
  const date = sanitizeDateString(dom.mealDate.value);
  const notes = dom.mealNotes.value.trim();
  const ingredients = dom.mealIngredients.value.trim();

  if (!date || !name) {
    dom.mealName.focus();
    return;
  }

  const meal = {
    id: dom.mealId.value || uid(),
    date,
    name,
    notes,
    ingredients
  };

  state.meals = state.meals.filter((item) => item.id !== meal.id && item.date !== meal.date);
  state.meals.push(meal);

  let added = 0;
  if (addGroceriesToo) {
    added = addGroceriesFromText(ingredients);
  }

  dom.mealDialog.close();
  saveState();

  if (addGroceriesToo) {
    window.alert(added ? `Added ${added} ${added === 1 ? "list item" : "list items"} from this dinner.` : "No new list items were added.");
  }
}

function deleteMeal() {
  const id = dom.mealId.value;
  if (!id) {
    return;
  }

  state.meals = state.meals.filter((item) => item.id !== id);
  dom.mealDialog.close();
  saveState();
}

function openTaskDialog(task = {}) {
  dom.taskDialogTitle.textContent = task.id ? "Edit task" : "Add task";
  dom.taskId.value = task.id || "";
  dom.taskTitle.value = task.title || "";
  dom.taskAssignee.value = task.assignee || "";
  dom.taskDueDate.value = sanitizeDateString(task.dueDate);
  dom.taskRepeatType.value = normalizeTaskRepeat(task.repeat).type;
  dom.taskNotes.value = task.notes || "";
  dom.taskDeleteBtn.classList.toggle("hidden", !task.id);
  dom.taskDialog.showModal();
}

function saveTask() {
  const title = dom.taskTitle.value.trim();
  if (!title) {
    dom.taskTitle.focus();
    return;
  }

  const existing = state.tasks.find((item) => item.id === dom.taskId.value);
  const nextTask = {
    id: dom.taskId.value || uid(),
    title,
    assignee: PEOPLE.includes(dom.taskAssignee.value) ? dom.taskAssignee.value : "",
    dueDate: sanitizeDateString(dom.taskDueDate.value),
    notes: dom.taskNotes.value.trim(),
    done: existing ? existing.done : false,
    repeat: normalizeTaskRepeat({ type: dom.taskRepeatType.value })
  };

  const index = state.tasks.findIndex((item) => item.id === nextTask.id);
  if (index >= 0) {
    state.tasks[index] = nextTask;
  } else {
    state.tasks.push(nextTask);
  }

  dom.taskDialog.close();
  saveState();
}

function deleteTask() {
  const id = dom.taskId.value;
  if (!id) {
    return;
  }

  state.tasks = state.tasks.filter((task) => task.id !== id);
  dom.taskDialog.close();
  saveState();
}

function copyPreviousWeekMeals() {
  const thisWeekStart = startOfWeek(mealWeekView);
  const previousWeekStart = addDays(thisWeekStart, -7);
  const mealsToCopy = [];
  const currentWeekHasMeals = state.meals.some((meal) => isWithinWeek(parseDate(meal.date), thisWeekStart));

  for (let index = 0; index < 7; index += 1) {
    const source = getMealByDate(ymd(addDays(previousWeekStart, index)));
    if (!source) {
      continue;
    }

    mealsToCopy.push({
      id: uid(),
      date: ymd(addDays(thisWeekStart, index)),
      name: source.name,
      notes: source.notes,
      ingredients: source.ingredients
    });
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
  saveState();
}

function clearCurrentWeekMeals() {
  const weekStart = startOfWeek(mealWeekView);
  const weekHasMeals = state.meals.some((meal) => isWithinWeek(parseDate(meal.date), weekStart));
  if (!weekHasMeals) {
    return;
  }

  if (!window.confirm("Clear every planned dinner in this week?")) {
    return;
  }

  state.meals = state.meals.filter((meal) => !isWithinWeek(parseDate(meal.date), weekStart));
  saveState();
}

function addGroceriesFromText(value) {
  const items = splitGroceries(value);
  if (!items.length) {
    return 0;
  }

  const existing = new Set(state.groceries.map((item) => item.text.toLowerCase()));
  let added = 0;

  items.forEach((item) => {
    const key = item.toLowerCase();
    if (existing.has(key)) {
      return;
    }

    existing.add(key);
    state.groceries.push({
      id: uid(),
      text: item,
      done: false
    });
    added += 1;
  });

  return added;
}

function importBackup(event) {
  const [file] = event.target.files || [];
  event.target.value = "";
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || ""));
      const looksLikeFamilyHubBackup = ["events", "tasks", "groceries", "meals"].some((key) => Array.isArray(parsed[key]));
      if (!looksLikeFamilyHubBackup) {
        throw new Error("Backup is missing Family Hub lists.");
      }

      const nextState = normalizeState(parsed);
      if (!window.confirm("Replace the current Family Hub data with this backup?")) {
        return;
      }

      state = nextState;
      saveState();
    } catch (error) {
      window.alert("That file could not be imported.");
    }
  };
  reader.readAsText(file);
}

function exportBackup() {
  const payload = JSON.stringify(normalizeState(state), null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `family-hub-backup-${ymd(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(url);
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

function nextRepeatedDate(date, repeatType) {
  if (repeatType === "daily") {
    return addDays(date, 1);
  }
  if (repeatType === "weekly") {
    return addDays(date, 7);
  }
  return addMonths(date, 1);
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
