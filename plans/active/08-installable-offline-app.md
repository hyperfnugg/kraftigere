# Installable offline app

**Status:** ready-for-agent · enhancement

Eighth milestone. Make the web app feel like an app on phones: installable to the home screen with a 🙈 icon, opening full screen, and usable offline (the List opens and changes sync later). It works on Android and iPhone without a native app. It is named "Kraft". The final domain (`kraftigere.web.app`) comes from plan 09, which must land before the install step. Push notifications are not part of it.

## Scope

- Web app manifest (standalone, theme `#FFF3D6`) and icons from the Noto Emoji 🙈 (U+1F648), named "Kraft".
- A service worker (via `vite-plugin-pwa`) that caches the app's files and updates silently.
- Firestore's persistent offline cache, an "Offline: changes will sync" line, and a "Can't connect" screen when authorization can't be checked.
- E2E coverage for offline behaviour and installability.

## Out of scope

- Push notifications.
- Native wrappers.
- Hosting and naming (plan 09).
- A custom install button or install instructions in the app.
- Marking individual unsynced Entries.

## Steps

- [x] **Icons.** Download `2D/svg/emoji_u1f648.svg` from `googlefonts/noto-emoji`, pinned to a commit, into `public/icons/`, and add the Apache 2.0 notice as `public/icons/NOTICE`. Render PNGs with the Playwright Chromium already installed (no new dependency): 192 and 512 (`any`, emoji on cream), 512 maskable (emoji inside the central ~60% safe zone on cream), and a 180 `apple-touch-icon` (cream, no transparency). Keep the render script in `scripts/`.
- [x] **Manifest and service worker.** Add `vite-plugin-pwa` (with the ADR 0001 cooldown). Configure:
  - `registerType: 'autoUpdate'`.
  - Manifest: `name`/`short_name` "Kraft", `display: standalone`, `theme_color` and `background_color` `#FFF3D6`, the icons above, scope and start URL under the app's base path (plan 09 moves it to the root).
  - `index.html`: title "Kraft", `theme-color` meta, `apple-touch-icon` link.
  - Service worker disabled in dev (default).
  - `npm run build` emits `manifest.webmanifest` and `sw.js`.
- [x] **Commit: installable as Kraft with offline app shell.** *(auto)*
- [x] **Emulator flag for builds.** Make `src/firebase.ts` and `src/ai.ts` use emulators and the stub whenever `import.meta.env.MODE !== 'production'` instead of `DEV`, so that `vite build --mode e2e` gives a build that runs against emulators. Production `npm run build` must be unchanged; check that `dist/` contains no `demo-kraftigere`.
- [x] **Offline data and UI.**
  - `src/firebase.ts`: `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })` in place of `getFirestore`.
  - "Offline: changes will sync" line at the top of the List while `navigator.onLine` is false (listen to `online`/`offline`).
  - `useAuthorized`: only `permission-denied` means not authorized. Any other failure gives a "Can't connect" screen (with a sign-out button) instead of "Not authorized".
  - Lint, build, and existing tests pass.
- [x] **Commit: offline cache, offline indicator, can't-connect screen.** *(manual)* (user-visible behaviour; review before committing)
- [x] **E2E: offline.** In `tests/e2e/`, using `context.setOffline()` against the dev server:
  - Going offline shows the offline line, and coming back online hides it.
  - An Entry added offline appears in a second browser after reconnecting.
  - Signed in with Firestore unreachable (Chrome blocks `127.0.0.1:8080` via the DevTools protocol before sign-in) shows "Can't connect", not "Not authorized".
- [x] **E2E: installability.** A second Playwright project, with its own `webServer`: `vite build --mode e2e && vite preview` on port 4173.
  - The manifest is linked and has a name, `display: standalone` and the icons, all of which load. The test doesn't pin the name, so plan 09's rename needs no test change.
  - The service worker registers and controls the page.
  - After going offline, a reload still renders the app (sign-in screen).
  - `pr-check.yml` needs no change: `npm run test:e2e` runs both projects.
- [x] **Commit: e2e tests for offline and installability.** *(auto)*
- [ ] **Install.** (blocked by: plan 09) On `https://kraftigere.web.app/`: install on an Android phone (Chrome's install prompt or menu → Install app) and on an iPhone (Share → Add to Home Screen). Check the icon, the name "Kraft", full-screen launch, sign-in, and that the List opens in airplane mode. *(user)* If iPhone sign-in still fails after plan 09's same-domain move, note it here; plan 09 names `signInWithRedirect` as the next thing to try.
- [ ] **Move plan to `plans/done/`.** `git mv plans/active/08-installable-offline-app.md plans/done/08-installable-offline-app.md`.
- [ ] **Commit: complete installable-offline-app milestone.** *(auto)*

## Done when

- `https://kraftigere.web.app/` installs as "Kraft" with the 🙈 icon on Android and iPhone and opens full screen.
- After one online launch, the installed app opens and shows the List in airplane mode. Changes made offline sync after reconnecting.
- The offline line and the "Can't connect" screen behave as specified, covered by e2e tests in the required CI check.
- The production build still contains no emulator config.

## Notes

- 2026-10-13: Decided in a grilling session: a home-screen web app rather than a native wrapper (Capacitor would need an Apple developer account and TestFlight or App Store builds). The family uses both Android and iPhone. Silent updates. Noto over Twemoji (Apache 2.0, no credit needed in the app) and over Apple's emoji (not licensed for reuse). Known risk: Google sign-in in iPhone standalone mode can fail because the app (`hyperfnugg.github.io`) and sign-in (`kraftigere.firebaseapp.com`) are on different sites. The usual fix is serving both from the same domain (Firebase Hosting); deferred until it actually breaks.
- 2026-10-13: Noto's root `LICENSE` became OFL in 2024 (for the fonts), but `2D/svg/LICENSE` is still Apache 2.0, which covers the SVG we use. `public/icons/NOTICE` records the source commit and that licence. The old Vite `favicon.svg` was replaced by the emoji SVG.
- 2026-10-13: Adjusted for plan 09 (Firebase Hosting at `kraftigere.web.app`, name "kraftigere"). The install step now waits for plan 09, so the family installs once, on the final domain. Nobody has used the app on the old GitHub Pages URL, so no installed copies or offline caches need migrating. Everything before the install step is done and committed.
- 2026-10-14: The user-facing name is "Kraft" again (plan 09 pivot). Only the repo, package, Firebase project and domain are "kraftigere".
