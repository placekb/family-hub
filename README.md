# Family Hub

Family Hub is a static planner that can still be hosted on GitHub Pages, but it now has optional Supabase-based cloud sync so the same family data can appear on multiple devices.

## What it includes

- Monthly family calendar with recurring events
- Weekly dinner planner with copy-last-week support
- Household task list with due dates and notes
- Simple shared checklist for groceries or other errands
- Tabbed workspace to keep the planner from feeling crowded
- Optional cloud sync using one shared family login
- Offline caching for the app shell when hosted

## Files

- `index.html`: app markup
- `styles.css`: app styles
- `app.js`: planner logic, rendering, local fallback, and sync bootstrap
- `supabase-config.js`: frontend sync config
- `supabase-api.js`: Supabase auth, CRUD, and realtime wrapper
- `supabase-schema.sql`: SQL schema and row-level security policies
- `manifest.json`: PWA metadata
- `sw.js`: offline cache service worker
- `icon.svg`: app icon

## Local-only mode

If `supabase-config.js` is left blank, the app still works in local-only mode and stores data in the browser on that device.

## Launch it

- GitHub Pages: push the repo, then open the Pages URL.
- Local browser testing: use any simple static server in this folder instead of opening `index.html` directly, because the service worker only works over `http://`, `https://`, or `localhost`.

## Supabase setup

1. Create a Supabase project.
2. In the Supabase SQL editor, run `supabase-schema.sql`.
3. In **Authentication**, make sure email/password sign-in is enabled.
4. If you want sign-up to require email confirmation, leave that enabled and be ready to confirm the email before signing in. If you want the simplest household setup, disable email confirmation for this project.
5. Edit `supabase-config.js` and fill in:

```js
window.FAMILY_HUB_SUPABASE = {
  url: "https://YOUR_PROJECT.supabase.co",
  publishableKey: "YOUR_PUBLISHABLE_ANON_KEY",
  emailRedirectTo: "https://YOUR_PAGES_URL/"
};
```

`emailRedirectTo` is optional for password sign-in, but it is useful if email confirmation is enabled. If you use GitHub Pages, use the exact deployed URL, including the trailing slash. The SQL file is safe to rerun if you need to apply it again later.

## How sync works

- Use one shared family email/password on every device.
- The app writes calendar events, dinners, tasks, and shared-list items to Supabase.
- If a browser already has local data from the older version, sign in and then use **Upload this device data** once to seed the cloud data.
- After that, the cloud copy becomes the shared source of truth.

## Publish with GitHub Pages

1. Create a GitHub repository, for example `family-hub`.
2. Upload:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `supabase-config.js`
   - `supabase-api.js`
   - `supabase-schema.sql`
   - `manifest.json`
   - `sw.js`
   - `icon.svg`
3. In the repository, open **Settings -> Pages**.
4. Under **Build and deployment**, set:
   - Source: **Deploy from a branch**
   - Branch: **main**
   - Folder: **/root**
5. Save, then open the GitHub Pages URL on your phone or tablet.
6. Use **Share -> Add to Home Screen** on iPhone or iPad if you want it to behave more like an installed app.
7. If a browser still shows an older version after deploy, refresh once. If that does not work, clear the site data for the Pages URL and reopen it so the new service worker cache is picked up.

## Use sync on both devices

1. Deploy the updated files, including `supabase-config.js`, `supabase-api.js`, and `sw.js`.
2. Open the app on the first device and create the shared family login or sign in.
3. If that device already had local planner data, click **Upload this device data** once.
4. Open the app on the second device and sign in with the same family email and password.
5. After that, calendar events, dinners, tasks, and shared-list changes should flow through Supabase instead of staying only in one browser.

## Current limitations

- Sync uses one shared family login in this version. There is no invite system or per-person account model yet.
- The app still keeps a local cache in the browser for faster startup and as a fallback if cloud data cannot be reached.
- The app shell is cached by the service worker, so after deploys you may need a refresh if a browser is holding onto an older build.
