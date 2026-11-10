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

- [ ] **Baseline.** Note the e2e wall time and the total sign-in time on `main` in Notes, using a reporter that sums the steps in `helpers.ts` lines 8–25 (the analysis used one, see Notes).
- [ ] **Ready popup.** In `completeGooglePopup`, wait for the popup to be ready (its load state, or the account's list item being visible and enabled) before one click. Keep a short retry as a fallback against dropped clicks, with intervals of about 100 ms rather than 500/1000. Run the whole suite twice to check it isn't flaky, and record the new numbers in Notes.
- [ ] **Commit: wait for the sign-in popup before clicking.** *(auto)*
- [ ] **Sign-in without the popup.** Pick a mechanism and record why in Notes. The first choice needs no app change: get the account's tokens from `signInWithIdp`, as `seedAccounts` does, and use `page.addInitScript` to put the Firebase user into the app's persisted auth storage before it loads. If that relies on SDK internals too much, the fallback is an emulator-only hook in `src/firebase.ts` that signs in with `GoogleAuthProvider.credential(idToken)`. Point `signIn` at it, keep `completeGooglePopup` for the sign-in test in `app.spec.ts` and for `warm-up.ts`, and check that `reset()` deleting accounts before each test doesn't break a sign-in made after `seed()`.
- [ ] **Commit: sign in e2e tests without the popup.** *(auto)* — *(manual)* instead if it needed the hook in `src/firebase.ts` (auth code).
- [ ] **Choose how to run in parallel.** Every test shares one stack: one Firestore and Auth emulator, a functions emulator that serves only `demo-kraftigere`, one fake Oda basket (`tests/e2e/fake-oda.mjs`), and fixed ports (`firebase.test.json`, 5273, 4273, 8866). Weigh (a) `playwright test --shard` across CI jobs, each with its own stack, which is simple but saves nothing locally, against (b) one full stack for each worker on offset ports. Record the decision and the reason in Notes, and rewrite the steps below to match.
- [ ] **Parallel e2e.** Implement the choice. Keep e2e beside `npm run dev` (ports 5173/8080/9099 untouched), and keep the failure report upload in CI.
- [ ] **Commit: run e2e in parallel.** *(manual)* — CI.
- [ ] **Measure** a PR check end to end, and record the before and after in Notes.
- [ ] **Move plan to `plans/done/`.** `git mv plans/active/XX-faster-e2e.md plans/done/XX-faster-e2e.md`.
- [ ] **Commit: complete faster e2e milestone.** *(auto)*
- [ ] **Number the plan** when it merges into `main`: `git mv` it to the next number across `plans/active/` and `plans/done/` there, and update the link in `ROADMAP.md`.

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
