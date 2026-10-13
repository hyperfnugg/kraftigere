# Installable offline app

**Status:** ready-for-agent · enhancement

Eighth milestone. Make the web app feel like an app on phones: installable to the home screen as "Kraft" with a 🙈 icon, opening full screen, and usable offline (the List opens and changes sync later). It works on Android and iPhone without a native app. Push notifications, iPhone sign-in problems and hosting changes are not part of it.

## Scope

- Web app manifest ("Kraft", standalone, theme `#FFF3D6`) and icons from the Noto Emoji 🙈 (U+1F648).
- A service worker (via `vite-plugin-pwa`) that caches the app's files and updates silently.
- Firestore's persistent offline cache, an "Offline: changes will sync" line, and a "Can't connect" screen when authorization can't be checked.
- E2E coverage for offline behaviour and installability.

## Out of scope

- Push notifications.
- iPhone sign-in problems in standalone mode (separate debug session if they show up).
- Moving hosting off GitHub Pages; native wrappers.
- A custom install button or install instructions in the app.
- Marking individual unsynced Entries.

## Steps

- [ ] **Icons.** Download `emoji_u1f648.svg` from `googlefonts/noto-emoji`, pinned to a commit, into `public/icons/`, and add the Apache 2.0 notice as `public/icons/NOTICE`. Render PNGs with the Playwright Chromium already installed (no new dependency): 192 and 512 (`any`, emoji on cream), 512 maskable (emoji inside the central ~60% safe zone on cream), and a 180 `apple-touch-icon` (cream, no transparency). Keep the render script in `scripts/`.
- [ ] **Manifest and service worker.** Add `vite-plugin-pwa` (with the ADR 0001 cooldown). Configure:
  - `registerType: 'autoUpdate'`.
  - Manifest: `name`/`short_name` "Kraft", `display: standalone`, `theme_color` and `background_color` `#FFF3D6`, the icons above, scope and start URL under the `/webapp_poc/` base.
  - `index.html`: title "Kraft", `theme-color` meta, `apple-touch-icon` link.
  - Service worker disabled in dev (default).
  - `npm run build` emits `manifest.webmanifest` and `sw.js`.
- [ ] **Commit: installable as Kraft with offline app shell.** *(auto)*
- [ ] **Emulator flag for builds.** Make `src/firebase.ts` and `src/ai.ts` use emulators and the stub whenever `import.meta.env.MODE !== 'production'` instead of `DEV`, so that `vite build --mode e2e` gives a build that runs against emulators. Production `npm run build` must be unchanged; check that `dist/` contains no `demo-kraftigere`.
- [ ] **Offline data and UI.**
  - `src/firebase.ts`: `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })` in place of `getFirestore`.
  - "Offline: changes will sync" line at the top of the List while `navigator.onLine` is false (listen to `online`/`offline`).
  - `useAuthorized`: only `permission-denied` means not authorized. Any other failure gives a "Can't connect" screen (with a sign-out button) instead of "Not authorized".
  - Lint, build, and existing tests pass.
- [ ] **Commit: offline cache, offline indicator, can't-connect screen.** *(manual)* (user-visible behaviour; review before committing)
- [ ] **E2E: offline.** In `tests/e2e/`, using `context.setOffline()` against the dev server:
  - Going offline shows the offline line, and coming back online hides it.
  - An Entry added offline appears in a second browser after reconnecting.
  - Signed in with Firestore unreachable (route-abort requests to `127.0.0.1:8080` before sign-in) shows "Can't connect", not "Not authorized".
- [ ] **E2E: installability.** A second Playwright project, with its own `webServer`: `vite build --mode e2e && vite preview` on port 4173.
  - The manifest is linked and has name "Kraft", `display: standalone` and the icons.
  - The service worker registers and controls the page.
  - After going offline, a reload still renders the app (sign-in screen).
  - `pr-check.yml` needs no change: `npm run test:e2e` runs both projects.
- [ ] **Commit: e2e tests for offline and installability.** *(auto)*
- [ ] **Deploy and install.** Push. On the live URL: install on an Android phone (Chrome's install prompt or menu → Install app) and on an iPhone (Share → Add to Home Screen). Check the icon, the name "Kraft", full-screen launch, sign-in, and that the List opens in airplane mode. *(user)* If iPhone sign-in fails, note it here and open a separate debug session.
- [ ] **Move plan to `plans/done/`.** `git mv plans/active/08-installable-offline-app.md plans/done/08-installable-offline-app.md`.
- [ ] **Commit: complete installable-offline-app milestone.** *(auto)*

## Done when

- The live site installs as "Kraft" with the 🙈 icon on Android and iPhone and opens full screen.
- After one online launch, the installed app opens and shows the List in airplane mode. Changes made offline sync after reconnecting.
- The offline line and the "Can't connect" screen behave as specified, covered by e2e tests in the required CI check.
- The production build still contains no emulator config.

## Notes

- 2026-10-13: Decided in a grilling session: a home-screen web app rather than a native wrapper (Capacitor would need an Apple developer account and TestFlight or App Store builds). The family uses both Android and iPhone. Silent updates. Noto over Twemoji (Apache 2.0, no credit needed in the app) and over Apple's emoji (not licensed for reuse). Known risk: Google sign-in in iPhone standalone mode can fail because the app (`hyperfnugg.github.io`) and sign-in (`kraftigere.firebaseapp.com`) are on different sites. The usual fix is serving both from the same domain (Firebase Hosting); deferred until it actually breaks.
