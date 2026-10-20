# Fast launch

**Status:** ready-for-agent · enhancement

Eleventh milestone. Make Kraft open faster, especially the installed app on Android. Measurements in `plans/worklogs/launch-performance.md` show that a cached launch spends most of its time waiting on the server before showing anything, and that reCAPTCHA (for App Check) weighs more than the whole app although only the Gemini fun fact needs it. Two changes target those. A third separates library code from app code so deploys stay cheap for phones. Not part of it: swapping out React or Firestore, a timing budget in CI.

## Scope

- App Check and Gemini load only when the fun fact is used, so reCAPTCHA is off the launch path.
- The List shows from the offline cache right away; access is checked in the background.
- Before and after numbers from `npm run perf`, and a check on a real Android phone after deploying.
- Library code in its own chunk, so ordinary deploys don't make phones re-download and recompile it.

## Out of scope

- Preact, Firestore Lite or other replacements (see the worklog's bundle breakdown).
- A CI timing budget.
- Measuring signed-in launch on the live site (real Google sign-in can't be automated).

## Prerequisites (user)

- In the Firebase console under App Check → APIs, check whether Cloud Firestore and Authentication are **Enforced**. Step 1 only works if neither is. If one is, decide before step 1: turn enforcement off for it (the security rules already limit everything to Family Members), or drop step 1.

## Steps

- [x] **Load App Check and Gemini on demand.** `src/firebase.ts` no longer imports or starts App Check. `src/ai.ts` imports `firebase/app-check` and `firebase/ai` dynamically on the first `generate()` call, starts App Check (same reCAPTCHA v3 key, auto refresh) and then the model, and reuses both on later calls. With emulators it still returns the stub without importing anything. Check:
  - `npm run build` emits AI and App Check as separate chunks. The main chunk went from 264 to 252 KB gzip (12 KB rather than the estimated 23 KB; some code is shared with Firestore and Auth).
  - The production build contacts no reCAPTCHA or Google host at launch (checked with `vite preview`).
  - Lint, build, rules and e2e tests pass (the fun-fact e2e covers the stub path).
- [x] **Commit: load App Check and Gemini only for the fun fact.** *(manual)* (App Check is a security control; review before committing)
- [x] **Show the cached List first.** `useAccess` in `src/entries.ts`: read `config/family` from the cache first (`getDocFromCache`). If it's there, report `authorized` at once, then confirm against the server in the background. A `permission-denied` from the server switches to "Not authorized", and any other failure is ignored while the cached answer stands. With nothing cached, behave as today (wait for the server; `permission-denied` → not authorized, other failures → "Can't connect"). Add an e2e test: a Family Member signs in, is then removed from `config/family` (via the seed helpers, rules disabled), reloads, and ends on "Not authorized". Existing offline and not-authorized tests still pass.
- [x] **Commit: show the cached List while access is checked.** *(manual)* (access gate and user-visible behaviour; review before committing)
- [x] **Measure.** `npm run perf`. Add an "After steps 1–2" table to the worklog next to the baseline (local cached, local hard reload, live cached, live hard reload). The live numbers only change after deploying, so measure live after the next step.
- [x] **Deploy and test on the phone.** *(user)* Push; CI deploys. On the Android phone, with the installed app:
  - an ordinary launch: does it feel faster than about 1 s?
  - the first launch after this deploy: how long, compared with the 3–4 s seen before?
  - the fun fact still works (App Check and Gemini load on tap).

  Note the results here. Then Claude runs `npm run perf` for the live numbers and adds them to the worklog.
- [x] **Separate libraries from app code.** In `vite.config.ts`, put the dependencies loaded at launch (React, Firestore, Auth and Firebase's core) in their own chunk, and keep `firebase/ai` and `firebase/app-check` out of it so they still load on demand. An ordinary deploy then changes only the small app chunk: the phone downloads a few KB after a deploy instead of about 880 KB, and Chrome keeps its compiled code for the libraries instead of recompiling them for the first few launches after every deploy (the likely cause of the slow launches after the last deploy). Check: two builds with a trivial app change between them keep the library chunk's file name; the production build still loads no reCAPTCHA at launch; all tests pass.
- [x] **Commit: separate library and app chunks.** *(auto)*
- [x] **Phone test after a trivial deploy.** *(user)* Deploy a small app-only change. On the phone: the first launch after it, and the next few launches. Note the results here.
- [x] **Fold the worklog into this plan.** Copy the baseline and after numbers into the Notes below, then delete `plans/worklogs/launch-performance.md` (and the folder if empty). Keep `npm run perf` and its spec.
- [x] **Move plan to `plans/done/`.** `git mv plans/active/11-fast-launch.md plans/done/11-fast-launch.md`, and remove it from **Now** in `ROADMAP.md`.
- [x] **Commit: complete fast-launch milestone.** *(auto)*

## Done when

- No reCAPTCHA or Gemini code loads until the fun fact is tapped, and the fun fact still works on the live site.
- The installed app shows the cached List without waiting for the server, and a removed Family Member still ends on "Not authorized".
- `npm run perf` numbers before and after are recorded, and the phone test is noted.
- After an app-only deploy, the first launch takes about 3 s and the next ones about 1 s.

## Notes

- 2026-10-20: Made from the launch-performance worklog. Baseline (slow 4G, 4x CPU): local cached 929 ms, local hard reload 2482 ms, live signed-out cached 552 ms, live hard reload 6471 ms / 1016 KB (about 760 KB of it reCAPTCHA). Cached launch is network-bound (846 ms network-only against 322 ms CPU-only). The quieter update depends on the phone test after steps 1–2.
- 2026-10-20: App Check is in monitoring (not enforced) for Firestore and Authentication, so step 1 works. With App Check loaded only for the fun fact, the monitoring graphs will show most Firestore and Auth requests as unverified. Never enforce App Check for them, or the List breaks.
- 2026-10-20: The cached List shows before the server confirms access. The offline cache belongs to the browser, not the person, and isn't cleared on sign-out, so an outsider signing in on a phone a Family Member used briefly sees that cached List before "Not authorized". Accepted; no cache clearing on sign-out.
- 2026-10-20: Phone test after deploying steps 1–2 (Android, installed app): first launch after the deploy about 8 s; closing and reopening about 3 s (slower than the ~1 s before, unexplained so far); fun fact works, maybe a bit slower on first tap. The 8 s confirms the quieter update is needed. The 3 s needs repeated cold launches, and possibly a remote-debugging trace, before drawing conclusions.
- 2026-10-20: The slow launches after the first deploy (3 s, gradually faster) were most likely Chrome recompiling the new 840 KB bundle until its code cache warmed up. Splitting libraries from app code fixed that: after an app-only deploy (the "Add entry" placeholder), the first launch took about 3 s and the next ones about 1 s straight away, against 8 s and a slow warm-up before. The remaining extra time on the first launch is the app starting twice when it picks up the update.
- 2026-10-20: Skipped the quieter update (new versions taking over on a later launch). It would save about 2 s once per deploy, but a phone that's never fully closed could run an old version for days. Updates arriving straight away are worth more. Easy to add later if it bothers anyone.
- 2026-10-20: Final numbers (slow 4G, 4x CPU, `npm run perf`):

  | Case | Baseline | After |
  |---|---|---|
  | Local signed in, cached | 929 ms | 427 ms |
  | Local signed in, hard reload | 2482 ms | 1914 ms |
  | Live signed out, cached | 552 ms | 207 ms |
  | Live signed out, hard reload | 6471 ms / 1016 KB | 1464 ms / 208 KB |

  Bundle by package before the split: Firestore 151 KB gzip, React and Firebase core 71 KB, Auth 21 KB, AI 18 KB, App Check 5 KB. Unused code was already removed by Vite. Further shrinking would mean Preact (about 40 KB) or Firestore Lite (no offline or real-time); neither is worth it.
