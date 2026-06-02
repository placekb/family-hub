(function attachFamilyHubSync(windowObject) {
  const SUPABASE_CDN_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
  const config = windowObject.FAMILY_HUB_SUPABASE || {};
  let supabaseClient = null;
  let supabaseLibraryPromise = null;

  function isConfigured() {
    return Boolean(config.url && config.publishableKey);
  }

  async function init() {
    if (!isConfigured()) {
      return { configured: false };
    }

    if (!windowObject.supabase || typeof windowObject.supabase.createClient !== "function") {
      await loadSupabaseLibrary();
    }

    if (!supabaseClient) {
      supabaseClient = windowObject.supabase.createClient(config.url, config.publishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
    }

    return { configured: true };
  }

  async function loadSupabaseLibrary() {
    if (supabaseLibraryPromise) {
      await supabaseLibraryPromise;
      return;
    }

    const existing = document.querySelector("script[data-family-hub-supabase]");
    supabaseLibraryPromise = existing
      ? waitForLibrary(existing)
      : new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = SUPABASE_CDN_URL;
          script.async = true;
          script.dataset.familyHubSupabase = "true";
          script.onload = () => {
            script.dataset.familyHubSupabaseLoaded = "true";
            resolve();
          };
          script.onerror = () => reject(new Error("Supabase could not be loaded from the CDN."));
          document.head.appendChild(script);
        });

    try {
      await supabaseLibraryPromise;
      if (!windowObject.supabase || typeof windowObject.supabase.createClient !== "function") {
        throw new Error("Supabase loaded, but the browser client was unavailable.");
      }
    } catch (error) {
      supabaseLibraryPromise = null;
      throw error;
    }
  }

  async function waitForLibrary(script) {
    if (windowObject.supabase && typeof windowObject.supabase.createClient === "function") {
      return;
    }

    if (script.dataset.familyHubSupabaseLoaded === "true") {
      throw new Error("Supabase loaded, but the browser client was unavailable.");
    }

    await new Promise((resolve, reject) => {
      script.addEventListener("load", () => {
        script.dataset.familyHubSupabaseLoaded = "true";
        resolve();
      }, { once: true });
      script.addEventListener("error", () => reject(new Error("Supabase could not be loaded from the CDN.")), { once: true });
    });
  }

  function getClient() {
    if (!supabaseClient) {
      throw new Error("Supabase has not been initialized yet.");
    }

    return supabaseClient;
  }

  async function getSession() {
    const { data, error } = await getClient().auth.getSession();
    if (error) {
      throw error;
    }

    return data.session;
  }

  async function getCurrentUserId() {
    const session = await getSession();
    if (!session || !session.user) {
      throw new Error("You need to sign in before syncing Family Hub.");
    }

    return session.user.id;
  }

  function onAuthStateChange(callback) {
    const { data } = getClient().auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });

    return {
      unsubscribe() {
        data.subscription.unsubscribe();
      }
    };
  }

  async function signIn(email, password) {
    const { data, error } = await getClient().auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw error;
    }

    return data;
  }

  async function signUp(email, password) {
    const options = {};
    if (config.emailRedirectTo) {
      options.emailRedirectTo = config.emailRedirectTo;
    }

    const payload = {
      email,
      password
    };

    if (Object.keys(options).length) {
      payload.options = options;
    }

    const { data, error } = await getClient().auth.signUp(payload);
    if (error) {
      throw error;
    }

    return data;
  }

  async function signOut() {
    const { error } = await getClient().auth.signOut();
    if (error) {
      throw error;
    }
  }

  async function fetchState() {
    const client = getClient();
    const [events, meals, tasks, listItems] = await Promise.all([
      fetchRows(client, "events"),
      fetchRows(client, "meals"),
      fetchRows(client, "tasks"),
      fetchRows(client, "list_items")
    ]);

    return {
      events: events.map(mapEventFromRow),
      meals: meals.map(mapMealFromRow),
      tasks: tasks.map(mapTaskFromRow),
      groceries: listItems.map(mapListItemFromRow)
    };
  }

  async function fetchRows(client, tableName) {
    const { data, error } = await client.from(tableName).select("*");
    if (error) {
      throw error;
    }

    return data || [];
  }

  async function saveEvent(event) {
    const row = mapEventToRow(event, await getCurrentUserId());
    const { data, error } = await getClient()
      .from("events")
      .upsert(row, { onConflict: "id" })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return mapEventFromRow(data);
  }

  async function deleteEvent(id) {
    const { error } = await getClient().from("events").delete().eq("id", id);
    if (error) {
      throw error;
    }
  }

  async function saveMeal(meal) {
    const client = getClient();
    const ownerId = await getCurrentUserId();
    const row = mapMealToRow(meal, ownerId);
    const { data: existingForDate, error: conflictError } = await client
      .from("meals")
      .select("id")
      .eq("owner_id", ownerId)
      .eq("date", row.date)
      .neq("id", row.id)
      .maybeSingle();

    if (conflictError) {
      throw conflictError;
    }

    const rowToSave = existingForDate ? { ...row, id: existingForDate.id } : row;

    const { data, error } = await client
      .from("meals")
      .upsert(rowToSave, { onConflict: "id" })
      .select()
      .single();

    if (error) {
      throw error;
    }

    if (existingForDate) {
      const { error: cleanupError } = await client.from("meals").delete().eq("id", row.id);
      if (cleanupError) {
        throw cleanupError;
      }
    }

    return mapMealFromRow(data);
  }

  async function deleteMeal(id) {
    const { error } = await getClient().from("meals").delete().eq("id", id);
    if (error) {
      throw error;
    }
  }

  async function replaceMeals(meals) {
    const ownerId = await getCurrentUserId();
    await replaceTableRows("meals", meals.map((meal) => mapMealToRow(meal, ownerId)));
  }

  async function saveTask(task) {
    const row = mapTaskToRow(task, await getCurrentUserId());
    const { data, error } = await getClient()
      .from("tasks")
      .upsert(row, { onConflict: "id" })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return mapTaskFromRow(data);
  }

  async function deleteTask(id) {
    const { error } = await getClient().from("tasks").delete().eq("id", id);
    if (error) {
      throw error;
    }
  }

  async function saveListItem(item) {
    const row = mapListItemToRow(item, await getCurrentUserId());
    const { data, error } = await getClient()
      .from("list_items")
      .upsert(row, { onConflict: "id" })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return mapListItemFromRow(data);
  }

  async function saveListItems(items) {
    if (!items.length) {
      return [];
    }

    const ownerId = await getCurrentUserId();
    const rows = items.map((item) => mapListItemToRow(item, ownerId));
    const { data, error } = await getClient()
      .from("list_items")
      .upsert(rows, { onConflict: "id" })
      .select();

    if (error) {
      throw error;
    }

    return (data || []).map(mapListItemFromRow);
  }

  async function deleteListItem(id) {
    const { error } = await getClient().from("list_items").delete().eq("id", id);
    if (error) {
      throw error;
    }
  }

  async function replaceAllState(state) {
    const ownerId = await getCurrentUserId();
    await replaceTableRows("events", state.events.map((event) => mapEventToRow(event, ownerId)));
    await replaceTableRows("meals", state.meals.map((meal) => mapMealToRow(meal, ownerId)));
    await replaceTableRows("tasks", state.tasks.map((task) => mapTaskToRow(task, ownerId)));
    await replaceTableRows("list_items", state.groceries.map((item) => mapListItemToRow(item, ownerId)));
  }

  async function replaceTableRows(tableName, rows) {
    const client = getClient();
    const { data, error } = await client.from(tableName).select("id");
    if (error) {
      throw error;
    }

    const ids = (data || []).map((row) => row.id);
    if (ids.length) {
      const { error: deleteError } = await client.from(tableName).delete().in("id", ids);
      if (deleteError) {
        throw deleteError;
      }
    }

    if (rows.length) {
      const { error: insertError } = await client.from(tableName).insert(rows);
      if (insertError) {
        throw insertError;
      }
    }
  }

  function subscribeToChanges(onChange) {
    const channel = getClient()
      .channel(`family-hub-sync-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "meals" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "list_items" }, onChange)
      .subscribe();

    return {
      unsubscribe() {
        channel.unsubscribe();
      }
    };
  }

  function mapEventFromRow(row) {
    return {
      id: row.id,
      title: row.title,
      date: row.date,
      time: row.time || "",
      who: row.who || "Family",
      notes: row.notes || "",
      repeat: row.repeat || { type: "none" }
    };
  }

  function mapEventToRow(event, ownerId) {
    return {
      id: event.id,
      owner_id: ownerId,
      title: event.title,
      date: event.date,
      time: event.time || null,
      who: event.who || "Family",
      notes: event.notes || "",
      repeat: event.repeat || { type: "none" }
    };
  }

  function mapMealFromRow(row) {
    return {
      id: row.id,
      date: row.date,
      name: row.name,
      notes: row.notes || "",
      ingredients: row.ingredients || ""
    };
  }

  function mapMealToRow(meal, ownerId) {
    return {
      id: meal.id,
      owner_id: ownerId,
      date: meal.date,
      name: meal.name,
      notes: meal.notes || "",
      ingredients: meal.ingredients || ""
    };
  }

  function mapTaskFromRow(row) {
    return {
      id: row.id,
      title: row.title,
      dueDate: row.due_date || "",
      notes: row.notes || "",
      done: Boolean(row.done)
    };
  }

  function mapTaskToRow(task, ownerId) {
    return {
      id: task.id,
      owner_id: ownerId,
      title: task.title,
      due_date: task.dueDate || null,
      notes: task.notes || "",
      done: Boolean(task.done)
    };
  }

  function mapListItemFromRow(row) {
    return {
      id: row.id,
      text: row.text,
      done: Boolean(row.done)
    };
  }

  function mapListItemToRow(item, ownerId) {
    return {
      id: item.id,
      owner_id: ownerId,
      text: item.text,
      done: Boolean(item.done)
    };
  }

  windowObject.familyHubSync = {
    init,
    isConfigured,
    getSession,
    onAuthStateChange,
    signIn,
    signUp,
    signOut,
    fetchState,
    saveEvent,
    deleteEvent,
    saveMeal,
    deleteMeal,
    replaceMeals,
    saveTask,
    deleteTask,
    saveListItem,
    saveListItems,
    deleteListItem,
    replaceAllState,
    subscribeToChanges
  };
})(window);
