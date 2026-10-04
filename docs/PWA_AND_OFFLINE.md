# PWA, saves, and updates

All production URLs are scoped to `/rts-game/`. The manifest uses that path for id, scope, and start URL. Asset URLs use Vite's base. No CDN or backend is needed during single-player play.

## Cache lifecycle

After the build, `scripts/build-sw.mjs` hashes production asset bytes and writes a service worker precaching the shell, bundle, CSS, sprite atlas, icons, manifest, and local music. Source maps are excluded. Installation fails atomically if essential files cannot cache, preserving the previous installed version.

A new worker waits. The app offers **Update & restart** rather than reloading mid-match. Accepting first waits for the current battle save to finish; only then does it send `ACTIVATE_UPDATE`. The new worker takes control and the app reloads. Activation removes only older caches whose names start with this game's exact namespace. It never deletes IndexedDB or local saves and never handles sibling applications outside its path.

Offline navigation falls back to the cached game shell. The first online visit must complete installation before offline launch can work. Browser eviction, private mode, or explicitly clearing site data can remove offline data.

## Storage

`frontier-command-rts-game` IndexedDB stores battle and editor records. Small settings/progression use the `frontier-command:rts-game:v1:` local-storage namespace. Save records and simulation state are versioned. Restore validates input and migrates safe missing fields; unsupported formats fail with a useful error rather than deleting data. IndexedDB failures fall back to local storage; full-storage failures are surfaced.

Battles autosave every 30 seconds and on backgrounding. A completed battle is not offered again as an unfinished save. Storage is local to this browser/device; no account sync or cloud save is claimed.

## Production testing

Use `npm run build`, then `npm run preview -- --host 127.0.0.1` and open `/rts-game/`. Vite development intentionally does not install the service worker. The Playwright PWA project checks scope, controlled offline reload, and explicit save-before-update behavior with a test-only alternate worker release.
