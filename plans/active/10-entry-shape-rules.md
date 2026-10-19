# Entry shape rules

**Status:** ready-for-agent · enhancement

Tenth milestone. Make `firestore.rules` define the shape of an Entry, as ADR 0003 decides, so the first real data change has a safety net. The app's behaviour doesn't change. Not part of it: migration scripts, installing `gcloud`, an app version check.

## Scope

- Rules for `/entries/{id}`: creates and updates must match the Entry shape the app writes today. Reads and Remove stay as they are.
- A rules test for each accepted and refused case.

## Out of scope

- Migration scripts and `gcloud` (the first real migration brings them).
- A minimum app version check.
- Changing what an Entry is or what the app writes.

## Steps

- [x] **Shape rules.** In `firestore.rules`, split `/entries/{id}` into `read`, `create`, `update` and `delete`, all requiring `isFamily()`:
  - `create`: keys are exactly `text`, `checked`, `createdAt`. `text` is a string, 1 to 500 characters. `checked == false`. `createdAt == request.time` (what `serverTimestamp()` sends).
  - `update`: only `checked` changes, and it is a boolean.
  - `read` and `delete`: unchanged.
  - The add input gets `maxLength={500}`, so the app can't send text the rules refuse (a refused offline add would silently disappear).
- [x] **Rules tests.** In `tests/rules/firestore.test.ts`: the seeded Entry gets a `createdAt`. The existing write case writes a valid Entry. New cases: a valid create succeeds; creates with an extra field, a missing field, an empty or too-long `text`, `checked: true`, or a client-chosen `createdAt` fail; toggling `checked` succeeds; changing `text` or adding a field on update fails. `npm run test:rules`, `npm run test:e2e`, lint and build pass.
- [x] **Commit: Firestore rules define the Entry shape.** *(manual)* (security rules; review before committing)
- [x] **Check production data.** *(user)* In the Firebase console, check that existing Entries in `entries` have only `text`, `checked` and `createdAt`. Updates only check the changed keys, so older extra fields wouldn't block checking off, but note any here.
- [ ] **Deploy and check.** Push. CI deploys the rules. On `https://kraftigere.web.app/`: add, check off, uncheck and remove an Entry. *(user)*
- [ ] **Move plan to `plans/done/`.** `git mv plans/active/10-entry-shape-rules.md plans/done/10-entry-shape-rules.md`, and remove it from **Now** in `ROADMAP.md`.
- [ ] **Commit: complete entry-shape-rules milestone.** *(auto)*

## Done when

- `firestore.rules` refuses Entry creates and updates that don't match the shape, and each case has a passing rules test in the required check.
- The live app still adds, checks off, unchecks and removes Entries.

## Notes

- 2026-10-19: Decided in a grilling session on data shape changes (ADR 0003). Brief disruption is acceptable, losing data isn't. The rules are the schema of record. Migrations are hand-run Admin SDK scripts with the developer's own credentials. No version check until a change needs one.
- 2026-10-19: Production check: existing Entries have only `text`, `checked` and `createdAt`.
