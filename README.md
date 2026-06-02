# Family Hub

This is a static, local-first family planner that can be published with GitHub Pages and added to a phone or tablet home screen.

## What it includes

- Monthly family calendar with recurring events
- Weekly dinner planner with copy-last-week support
- Household task list with assignees, due dates, and simple recurrence
- Simple shared grocery checklist
- Backup and restore for local data
- Offline caching when hosted

## Files

- `index.html`: app markup
- `styles.css`: app styles
- `app.js`: planner logic and local data storage
- `manifest.json`: PWA metadata
- `sw.js`: offline cache service worker
- `icon.svg`: app icon

## Publish with GitHub Pages

1. Create a GitHub repository, for example `family-hub`.
2. Upload:
   - `index.html`
   - `styles.css`
   - `app.js`
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

## Data storage

This version still stores data in the browser on each device. It now supports backup and restore, and it will migrate data from the older single-file version automatically on the same browser. It does not sync data between family devices yet.
