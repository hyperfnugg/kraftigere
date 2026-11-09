# Oda in production

**Status:** ready-for-agent · enhancement

The Family fills the Basket from `kraftigere.web.app`, with spending limited, and `oda` is merged into `main`. Until now the Oda functions have only run in the emulator ([ADR 0005](../../docs/adr/0005-oda-route.md)). This means linking billing, which moves the Firebase project to Blaze and makes Gemini paid, so the billing work happens late and in one sitting. It does not add features.

## Scope

- The production Oda client, with `odaCallback` as the redirect URI.
- App Check enforced on the Oda callables.
- CI that builds functions and deploys them from `main`.
- Billing on a Kraft-only account, with a soft budget, a Gemini spend cap and a tested kill switch.
- Merging `oda` into `main`, and proving the whole flow with one real Oda Order.

## Out of scope

- Firestore backups (an idea in `ROADMAP.md`). This plan's local copy is a one-off for the kill switch test.
- App Check on Firestore or Auth (ADR 0004).
- A spend cap on Cloud Functions (ADR 0005, amendment of 2026-11-06).
- Keeping `npm run dev` away from the real Basket. It shares the Basket with production through a separate Oda client. If a dev fill happens during a real Oda Order the packs mix, and Avbryt could take out packs dev added. Accepted.
- A planned rollback of the merge. See "If production breaks" under Notes.

## Prerequisites (user)

- [Shared Oda Products](28-shared-oda-products.md) finished on `oda`.
- A payment method for the billing account, and the Family's Oda login. The user signs in on oda.com and in the billing console. Claude never handles the password or card.

## Steps

- [x] **Production Oda client.** `callbackUrl` in `functions/src/oda.ts` returns `https://europe-west1-kraftigere.cloudfunctions.net/odaCallback` outside the emulator, built from the project and region rather than the request's host. The emulator's URL stays as it is.
- [x] **App Check on the callables.** Every `onCall` gets `enforceAppCheck` from `setGlobalOptions`, off only when `FUNCTIONS_EMULATOR` is `'true'`. `odaCallback` stays unenforced, because oda.com's redirect can't carry a token, and its `state` check guards it.
- [x] **App Check on the client.** Split starting App Check out of `load()` in `src/ai.ts` into `startAppCheck` in `src/firebase.ts`, so Oda calls can start it without the AI SDK, and it starts only once. `src/oda.ts` awaits it before each callable, outside the emulators.
  - The main chunk still has no reCAPTCHA, and neither Hjem nor Shop loads it. `useBasket` only runs in Odabestilling.
- [x] **Try it on the dev server**, iterating on feedback. Linking, filling and Avbryt still work in the emulator. Skipped in AFK mode. *(user)*
- [x] **Tests.** `npx tsc -b`, `npm run lint`, `npm run test:unit`, and the Oda e2e specs. A unit test for `callbackUrl`, if it can be pulled out without an abstraction made only for the test. Enforcement can't be tested against the emulator; production verification below covers it.
- [x] **Commit: Production Oda client and App Check on the callables.** *(manual)* — security control; review first.
- [x] **CI builds functions.** Both workflows run `npm ci --prefix functions`, because `tsc -b` builds `functions` and neither workflow installs its dependencies today. `deploy.yml` deploys `hosting,firestore:rules,functions`. Without `--force`, a function removed from the source stops the functions release before anything is deleted, and it prints the `firebase functions:delete` commands to run (firebase-tools 15.34.1, `deploy/functions/release/index.js`).
- [x] **Commit: Build and deploy functions in CI.** *(manual)* — CI change; review first.
- [x] **Kill switch.** `killSwitch` in `functions/src/index.ts`, triggered by the `kill-switch` Pub/Sub topic. It removes the project's billing account only if the message's `budgetId` is `KILL_SWITCH_BUDGET_ID` and `costAmount` is above `budgetAmount`, since budgets also notify below the limit. The decision and the Billing API call are in `functions/src/killSwitch.ts`, unit tested. It needs no App Check, and its topic isn't public. It runs as its own service account, `kill-switch@kraftigere.iam.gserviceaccount.com`, and the emulator ignores it.
- [x] **Scripts.** Both tried on the emulator first, per ADR 0003, and using the developer's own credentials.
  - `scripts/dump-firestore.mjs`: copies every document to a JSON file at a path given as an argument. The copy holds family data, so it never goes in the repo.
  - `scripts/clear-basket.mjs`: removes `basket` from every Entry. The rules let only the functions do that, so this frees In Basket Entries if the functions are off. It doesn't touch the Basket on oda.com.
- [x] **Commit: Kill switch and production scripts.** *(manual)* — turns billing off; review first.
- [x] **Rebase `oda` onto `main` and open the PR.** History stays linear, as decided in plan 23. Force-pushing `oda` is the user's call. The PR's `check` must pass before billing starts. *(user)*
- [x] **Reopen the billing account, for Kraft only, and link it.** `gcloud` showed the attached account closed and `billingEnabled` false on 2026-11-06. If it can't be reopened, create a new one. From here on, Gemini is pay-as-you-go, so do the next steps in the same sitting. *(user)*
- [x] **Enable the APIs.** Cloud Functions, Cloud Run, Cloud Build, Artifact Registry, Eventarc and Billing Budgets, plus whatever the first deploy asks for. Claude runs this once the user says go.
- [x] **Check prices and caps.** Record under Notes:
  - Gemini's expected monthly cost at family scale for `gemini-3.5-flash-lite`.
  - Whether a spend cap counts gross cost before free tiers. If it does and $10 would pause normal use, choose a new amount.
  - What a flood could cost: `maxInstances: 2` applies per function, so about twenty instances across all of them. Lower it if the soft budget and kill switch would be too slow to catch that.
- [x] **Set the limits.** Use the same amounts in the account's currency if it isn't dollars. *(user)*
  - Soft budget for the project: $20 a month, with emails at 50%, 90% and 100%.
  - Gemini spend cap: $10 a month.
  - Kill switch budget for the project: $200 a month, publishing to a new Pub/Sub topic named `kill-switch`, created while connecting it.
- [x] **The kill switch budget's id.** Put `KILL_SWITCH_BUDGET_ID=<id>` in `functions/.env.kraftigere`. It isn't secret, and it has to be committed, because every deploy, from CI too, sets the function's environment from it. Without it the kill switch never acts, and logs an error on each message.
- [x] **Commit: The kill switch budget's id.** *(auto)*
- [ ] **Widen the deploy service account.** `firebase-deploy` has `firebase.viewer`, `firebasehosting.admin` and `firebaserules.admin`. Add the smallest set of roles a functions deploy needs, including permission to act as the runtime service accounts (the default one and `kill-switch`), and to read Artifact Registry's cleanup policy, which every functions deploy checks. List them in ADR 0002. *(user)*
- [x] **Local copy of Firestore.** `scripts/dump-firestore.mjs`, to a path outside the repo. *(user)*
- [x] **Deploy the kill switch by hand,** from the rebased `oda`, with `--only functions:<name>`, since CI deploys only from `main`. First create the `kill-switch` service account, and give it Project Billing Manager on the project only, which lets it unlink billing, and nothing wider. Accept the cleanup policy for container images that the deploy asks for: without one, every non-interactive deploy from CI fails after deploying, since it can't set the policy without `--force`. *(user)*
- [ ] **Deploy the other functions by hand,** from the rebased `oda`, before the merge: `npx firebase deploy --only functions --project kraftigere`. Creating a function makes firebase-tools set its Cloud Run invoker binding (public for HTTP functions), which needs `run.services.setIamPolicy`, and `cloudfunctions.developer` doesn't have it. Updates don't set the binding (firebase-tools 15.34.1, `release/fabricator.js`), so with every function already created, CI only updates. Nothing in `main`'s app calls them yet. *(user)*
- [x] **Test the kill switch for real.** Publish a message under the limit and see that nothing happens. Then publish a fake over-budget message, see billing removed, and relink by hand. Afterwards compare Firestore with the local copy, and confirm the budgets, the Gemini cap, App Check and the kill switch function are all still there. *(user)*
- [x] **Record what removing billing did.** Put the result in ADR 0005, including whether Google's warning that resources might be irretrievably deleted holds up. It couldn't be found in a search on 2026-11-06.
- [ ] **Commit: What removing billing does.** *(auto)*
- [ ] **Merge the PR.** CI deploys functions, rules and Hosting. If the functions deploy fails, fix CI forward. Oda is behind ⋮, so the rest of Kraft keeps working. *(user)*
- [ ] **Link and try on production.** On `kraftigere.web.app`: sign in, tap "Koble til Oda", and start an Oda Order with one Entry. The right packs show on oda.com, and Avbryt takes out only those. Check the function logs for a missing Firestore index. *(user)*
- [ ] **Check access.** A callable refuses a request with no App Check token, one with no sign-in, and one from an account not on the allowlist. `odaCallback` refuses a wrong `state`. The user signs in with the account not on the allowlist.
- [ ] **Check launch.** On production, opening the app on Hjem doesn't load reCAPTCHA or call an Oda function.
- [ ] **One real Oda Order.** Filled from Kraft, ordered on oda.com, and marked Bestilt. *(user)*
- [ ] **Bring docs up to date.** `README.md`'s stack and sharing notes mention functions and the Oda Link. `ROADMAP.md` drops this plan from **Now**.
- [ ] **Move plan to `plans/done/`.** `git mv plans/active/29-oda-in-production.md plans/done/29-oda-in-production.md`.
- [ ] **Commit: complete Oda in production milestone.** *(auto)*

## Done when

- A Family Member signs in on `kraftigere.web.app` and "Koble til Oda" links the Family's account.
- A trial Oda Order with one Entry fills correctly, and Avbryt takes out only its packs.
- Callables refuse requests with no App Check token, no sign-in, or an account not on the allowlist.
- One real Oda Order is placed and marked Bestilt.
- Hjem still doesn't load reCAPTCHA when the app opens.
- The soft budget, the Gemini cap and the kill switch are in place, and the kill switch has removed billing once for real, with billing relinked and the data compared.
- `oda` is merged, and later functions deploy from CI.

## Notes

- 2026-11-06: Decided in a grilling session. "Paid Firestore" was this item: Blaze covers the whole project, and Firestore can't have its own cap.
- 2026-11-06: Checked with `gcloud`: billing is off and the attached account is closed, so the project is on Spark. Plan 04 is out of date on this; ADRs 0004 and 0005 are right. Gemini's App Check is Enforced, and Firestore's and Auth's are Unenforced. Cloud Functions isn't enabled, and nothing is deployed. Budgets couldn't be read.
- 2026-11-06: Link billing late. No money is at risk today, and caps and the kill switch need Blaze, so an unprotected window can't be avoided, only kept short.
- 2026-11-06: The rules on `oda` only add to those on `main`, and existing Entries and Wares stay valid. No migration is needed.
- 2026-11-06: Plan 27 finished, and plan 28 was already underway on `oda` while this was planned. The grilling said to ship before 28; since it's underway, it's now a prerequisite instead.
- 2026-11-09: Billing is on a new account, "Kraft" (`016724-E3FFE0-1EA2BD`, NOK), with `kraftigere` as its only project. The old account stayed closed. The APIs are enabled.
- 2026-11-09, prices and caps (from aistudio.google.com/docs/pricing and /docs/billing):
  - **Gemini cost.** `gemini-3.5-flash-lite` on the paid tier is $0.30 per 1M input tokens and $2.50 per 1M output tokens, thinking included. A linked project has no free tier, so every call is paid. A week's planning is 10–20 calls, each capped at 4,000–12,000 output tokens. The worst case is about 1M output tokens a month, roughly $2.50; normal use is likely under $1.
  - **Spend cap.** Set per project in AI Studio, under Spend → Monthly spend cap. It's experimental, can be overshot by about 10 minutes of billing lag, and the docs don't say whether it's gross or net. Without a free tier that difference doesn't matter: $10 is about four times the worst case.
  - **Prepay.** New billing accounts default to Prepay: Gemini answers only while the prepaid balance in AI Studio is positive (minimum $5), and returns 402 otherwise. The balance is a hard cap of its own. Tier 1 also caps the account at $250 a month.
  - **Flood.** Ten HTTP functions × `maxInstances: 2` gives 20 instances. Kept busy, each costs about $2 a day in CPU and memory, about $40 a day in all, plus $0.40 per million requests. Callables reject requests without App Check before the code runs, but they're still billed requests. `odaCallback` is public and reads one Firestore document per request. A sustained flood could reach roughly $100 a day. Budget notifications can lag by hours, so the $200 kill switch might act at $300–400.
- 2026-11-09: The limits are set in NOK: `kraft-soft` at 200 NOK (50%, 90%, 100%) and `kraft-kill-switch` at 2,000 NOK, publishing to `kill-switch`. Both cover the whole billing account, which holds only Kraft. `maxInstances` stays at 2.
- 2026-11-09: The first `killSwitch` deploy succeeded, but Pub/Sub got 403s: when the trigger runs as a custom service account, firebase-tools doesn't grant `kill-switch` `roles/run.invoker` on the `killswitch` Cloud Run service. It was granted by hand, on that service only, and took about two minutes to take effect. Queued messages were then delivered, and an under-limit one returned 200 and left billing on. Record this in ADR 0005 with the billing result.
- **If production breaks:** fix forward. Use Hosting rollback in the console for a broken app. If Oda has to be switched off, or the functions stop, run `scripts/clear-basket.mjs` so no In Basket Entry stays locked. Reverting the merge isn't planned.
