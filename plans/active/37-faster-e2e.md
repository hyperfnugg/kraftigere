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
- [ ] **Choose how to run in parallel.** Every test shares one stack: one Firestore and Auth emulator, a functions emulator that serves only `demo-kraftigere`, one fake Oda basket (`tests/e2e/fake-oda.mjs`), and fixed ports (`firebase.test.json`, 5273, 4273, 8866). Weigh (a) `playwright test --shard` across CI jobs, each with its own stack, which is simple but saves nothing locally, against (b) one full stack for each worker on offset ports. Record the decision and the reason in Notes, and rewrite the steps below to match.
- [ ] **Parallel e2e.** Implement the choice. Keep e2e beside `npm run dev` (ports 5173/8080/9099 untouched), and keep the failure report upload in CI.
- [ ] **Commit: run e2e in parallel.** *(manual)* — CI.
- [ ] **Measure** a PR check end to end, and record the before and after in Notes.
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
