# Faster e2e

**Status:** ready-for-agent · enhancement

The e2e suite takes about 4.5 minutes (242–282 s for 78 tests, in CI and locally) and is about 70% of a PR check. Most of that isn't the tests: signing in through the Auth emulator's Google popup is 176 s of the 254 s of test time, about 2.3 s for each of the 80 sign-ins. This milestone cuts that, then runs the suite in parallel. It doesn't touch what the tests check, the unit or rules suites (0.4 s and about 18 s), or CI's `npm ci` (60–72 s).

## Scope

- **Ready popup.** `completeGooglePopup` (`tests/e2e/helpers.ts`) clicks the account before the popup's script is ready, so every sign-in clicks twice and its `toPass` waits out a 1 s click timeout and a 500 ms interval (1.7 s median, against 0.5 s for opening the page and the popup). Wait until the popup is ready and click once. That should save about 1.5 s for each sign-in, about 2 minutes per run.
- **Sign-in without the popup.** `signIn` signs in directly with the emulator account that `seedAccounts` creates through `signInWithIdp`. At least one test still goes through the popup. That should save about 0.8 s more for each sign-in, leaving e2e at about 1.5 minutes.
- **Parallel e2e.** Run the suite on more than one worker or shard, so that wall time stops being the sum of all tests.

## Out of scope

- Making the slow test bodies faster (`oda-order` "fills the Basket" 12–16 s, `pack-counts` "two devices counting at once" 7–13 s).
- CI install time (`npm ci`, `playwright install --with-deps`).
- The unit and rules suites.

## Steps

No dev-server step: nothing here is user-visible.

- [x] **Baseline.** Note the e2e wall time and the total sign-in time on `main` in Notes, using a reporter that sums the steps in `helpers.ts` lines 8–25 (the analysis used one, see Notes).
- [x] **Ready popup.** In `completeGooglePopup`, wait for the popup to be ready (its load state, or the account's list item being visible and enabled) before one click. Keep a short retry as a fallback against dropped clicks, with intervals of about 100 ms rather than 500/1000. Run the whole suite twice to check it isn't flaky, and record the new numbers in Notes.
- [x] **Commit: wait for the sign-in popup before clicking.** *(auto)*
- [x] **Sign-in without the popup.** Pick a mechanism and record why in Notes. The first choice needs no app change: get the account's tokens from `signInWithIdp`, as `seedAccounts` does, and use `page.addInitScript` to put the Firebase user into the app's persisted auth storage before it loads. If that relies on SDK internals too much, the fallback is an emulator-only hook in `src/firebase.ts` that signs in with `GoogleAuthProvider.credential(idToken)`. Point `signIn` at it, keep `completeGooglePopup` for the sign-in test in `app.spec.ts` and for `warm-up.ts`, and check that `reset()` deleting accounts before each test doesn't break a sign-in made after `seed()`.
- [x] **Commit: sign in e2e tests without the popup.** *(auto)* — *(manual)* instead if it needed the hook in `src/firebase.ts` (auth code).
- [x] **Choose how to run in parallel.** One full stack for each worker on offset ports; see Notes.
- [x] **Parallel e2e.** `tests/e2e/stacks.mjs` starts `E2E_STACKS` stacks (default 2) at once, and each worker picks its own by `TEST_PARALLEL_INDEX`. e2e stays beside `npm run dev`, and CI's `npm run test:e2e` and report upload are unchanged.
- [ ] **Commit: run e2e in parallel.** *(manual)* — CI.
- [ ] **Measure** a PR check end to end, and record the before and after in Notes. Raise `E2E_STACKS` in CI if the runner has room.
- [ ] **Move plan to `plans/done/`.** `git mv plans/active/37-faster-e2e.md plans/done/37-faster-e2e.md`.
- [ ] **Commit: complete faster e2e milestone.** *(auto)*
- [x] **Number the plan** when it merges into `main`: `git mv` it to the next number across `plans/active/` and `plans/done/` there, and update the link in `ROADMAP.md`.

## Done when

- A sign-in clicks the popup once, or skips the popup entirely, except in the test that covers the popup.
- The e2e step of a PR check takes under 2 minutes, down from about 4.5, and passes twice in a row locally.
- `npm run dev` still runs beside `npm run test:e2e`.

## Notes

2026-11-10, analysis (CI runs 42787499173 and 42676079243, plus two local runs, 78 passed):

- e2e 242–282 s. Startup before the first test: 19–24 s. Reset and seed hooks: 68 ms per test. Sign-in: 176 s of 254 s of test time. Test bodies: about 72 s.
- Sign-in breakdown (median): `page.goto` 301 ms, waiting for the popup 188 ms, button click 44 ms, `toPass` 1716 ms with 2 clicks for every sign-in, waiting for "Mer" 9 ms.
- `oda-products` "a pasted link or a tap picks another Ware's Oda Product" failed once and passed on retry in CI run 42787499173. Watch whether the faster sign-in changes that.
- Reporter used to measure: a custom Playwright reporter that, in `onTestEnd`, sums `result.steps` whose `location` is in `helpers.ts` lines 8–25. The JSON reporter doesn't include steps.

2026-11-10, baseline on `main` (d799846), local: 77 passed and 1 failed in 4.6 min (258 s from the reporter's `onBegin`). Sign-in 184.5 s of 255 s of test time. The failure was the `oda-products` race below.

2026-11-10, ready popup, local:

- The popup's click handlers come from an inline script at the end of the page, after `material-components-web` from unpkg and three stylesheets (unpkg and Google Fonts), so `domcontentloaded` means they're attached. One click then lands every time.
- About 1 sign-in in 150 still never closes the popup, however often the account is clicked. The popup shows the list and no error, so the widget sent the event and the Firebase SDK in the opener dropped it; this is the flake `warm-up.ts` mentions. Clicking again doesn't help, so a popup still open 2 s after the click is closed and a new one opened. A probe of 300 sign-ins passed with one second popup (3.2 s).
- Faster sign-ins showed races that were hidden behind the 2.3 s: reads straight from the emulator just after the page showed a write it made itself (the page shows it before the emulator has it), and `hjem` counting chips before the Wares loaded. Those reads poll now (`expect.poll`), as `substitutes` already did once. Reads that check nothing changed after a failure stay as they were. This fixes the `oda-products` failure in the analysis.
- `pack-counts` "two devices counting at once": 40 runs of it alone took 2.5–3.0 s, with a tail of 5.9, 6.4 and 9.0 s, and once in a full run it took over 10 s to finish counting, from the emulator's transactions when both devices count at once. Its wait for what's next is 25 s.
- Two full runs in a row: 78 passed in 2.8 and 2.9 min (153 and 154 s), sign-in 75.7 and 76.0 s, about 0.95 s each.

2026-11-10, sign-in without the popup, local:

- Mechanism: the init script, no app change. `PersistenceUserManager.create` in `@firebase/auth` looks for `firebase:authUser:<apiKey>:<appName>` in every persistence, localStorage among them, rebuilds the user from `User.toJSON()`'s shape (it asserts only `uid`, `stsTokenManager`, and the types of the rest) and checks it with the emulator's `accounts:lookup`. That's a small surface that hasn't changed in years, so the hook in `src/firebase.ts` wasn't needed. If an SDK update breaks it, every `signIn` fails at once, so it can't go unnoticed.
- `signIn` gets the tokens from `signInWithIdp`, now exported from `scripts/seed.mjs` and also used by `seedAccounts`, after `reset()` and `seed()`, so the account it signs in is the one the test runs against. The init script sets the user only on a tab's first load (a `sessionStorage` flag), so sign-out and reload tests behave as before.
- The popup stays in `warm-up.ts` and three `app.spec.ts`/`offline.spec.ts` tests: "a Family Member signs in and sees the List" (switched to it), "a non-member sees the not-authorized screen" and "Firestore unreachable".
- Two full runs in a row: 78 passed in 2.0 min each (104 s), sign-in 29.1 and 28.8 s.

2026-11-10, parallel e2e, local:

- Chose (b), one stack for each worker, over (a) CI shards: shards repeat `npm ci`, the build and the Playwright install in each job (over a minute each), and save nothing locally. (b) needed no fixtures. Each worker loads `playwright.config.ts` again with its own `TEST_PARALLEL_INDEX`, so the config points `baseURL`, `seed.mjs` and the helpers at that worker's stack. Stack i takes every port in `firebase.test.json`, 5273 and 8866, each plus i. Stack 0 is where e2e always ran, and the pwa preview runs once against it. The emulator configs for stacks 1 and up are written next to `firebase.test.json` (gitignored), because Firebase takes the project folder from the config's folder. `.env.e2e` is gone, and `stacks.mjs` gives each Vite its hosts.
- Playwright starts `webServer` entries one after another, so a single entry runs `stacks.mjs`, which starts everything at once and opens port 4299 when every stack answers. Each command runs in its own process group and gets one SIGINT; before that, `sh -c "a && b"` swallowed it and left `vite preview` and Firestore JVMs running.
- `firebase.test.json` now fixes the Eventarc (9310) and Cloud Tasks (9510) ports. Each functions emulator starts both, and without a port each looks for a free one from 9299/9499, so stacks starting together collided.
- Each Vite dev server has its own `cacheDir` (`VITE_CACHE_DIR` in `vite.config.ts`), so the dependency optimizers don't share a folder. `npm run perf` stays on one worker.
- More races that faster tests showed: the Staples picker opened before the Wares loaded, and the fake Basket read right after a count showed on screen (`odaSetPacks` commits Firestore before it calls Oda). Every fake Basket check polls now. The picker takes the Staples there are when it opens and doesn't update, so a Family Member who taps + right at launch sees "Alle basisvarene står allerede på lista". That's app behaviour, left as it is.
- Two stacks, two runs in a row: 78 passed, 79 and 80 s wall clock including startup (stacks ready in about 14 s). Three stacks: 70 s, but test time rose from about 121 to 153 s, so the default stays 2 for CI's 4 vCPUs.
- `npm run dev` beside e2e: `app.spec.ts` and `oda-order.spec.ts` passed (13) with the dev server up, and it still answered afterwards. Unit (107) and rules (60) pass.
