# Staples

**Status:** ready-for-agent · enhancement

Twelfth milestone. Today's List becomes the Groceries List, and every Entry added to it refers to a Staple. Typing shows autocomplete over the Family's Staples, ranked by text match and how often each is added. This is the first real data shape change, so it also brings the first migration script and `gcloud`, as ADR 0003 describes. Not part of it: Wares, free-text amounts, removing Checked Entries (plan 13), tabs (plan 14). See `docs/vision/groceries-and-meals.md#groceries`.

## Scope

- A `staples` collection: one document per Staple, named the way the Family says it, unique within the Family, remembering how often it's added.
- Adding an Entry picks or creates a Staple and counts the add. The Entry refers to its Staple.
- Autocomplete under the add input.
- A one-off script giving existing Entries a Staple.

## Out of scope

- Wares, Substitutes, Oda references.
- Recent adds weighing more than old ones (frequency decay). Counting comes first, and decay waits until the ranking feels wrong.
- Renaming, aliases and merging Staples.
- Removing Checked Entries, amounts (plan 13).

## Prerequisites (user)

- `gcloud` installed and `gcloud auth application-default login` done, for the production migration (ADR 0003).

## Steps

- [ ] **Glossary.** In `CONTEXT.md`, the List Kind entry says Groceries is the only List Kind today, and today's List is the Groceries List.
- [ ] **Staple data and rules.** A Staple is `/staples/{id}` with `name` (string, 1–100 characters), `addCount` (int) and `lastAddedAt` (timestamp). The document id is the normalized name (trimmed, lower case, inner whitespace collapsed, `/` replaced), so uniqueness costs no query and works offline. An Entry gains `staple` (the Staple id) and keeps `text` as the Staple's name at the time it was added, so the List renders without looking up Staples.
  - Adding is one `writeBatch`: create the Entry, and set the Staple with `merge` and `addCount: increment(1)`, `lastAddedAt: serverTimestamp()`.
  - Rules: Staple create must have exactly these fields with `addCount == 1` and `lastAddedAt == request.time`. Staple update may only raise `addCount` by 1 and set `lastAddedAt == request.time`. Staples can't be deleted. Entry create requires `staple`, and `existsAfter` on that Staple. Entry updates stay as they are.
  - Rules tests for each accepted and refused case, in `tests/rules/firestore.test.ts`.
- [ ] **Commit: Staples in data and rules.** *(manual)* (security rules; review before committing)
- [ ] **Autocomplete.** The app listens to `staples` (the persistent cache makes it instant and keeps it fresh, so no separate side-loading is needed). While typing, up to 5 suggestions show under the input: Staples whose name starts with the text first, then ones containing it, each group ordered by `addCount`. Tapping a suggestion adds an Entry for it. Submitting text adds the Staple whose normalized name matches, or creates a new one.
  - e2e: adding "Melk" twice and "melk " once gives one Staple with `addCount` 3. Typing "me" suggests it. Tapping the suggestion adds an Entry.
- [ ] **Commit: autocomplete over Staples.** *(auto)*
- [ ] **Migration script.** `scripts/migrate-12-staples.mjs` using the Admin SDK: for each Entry without `staple`, create or count its Staple from `text` and set `staple`. It's idempotent: Entries that already have a Staple are skipped. Run it against the emulator with seeded data first. Running it against production is the next step. Update `scripts/seed.mjs` so seeded Entries have Staples.
- [ ] **Commit: migration script for Staples.** *(auto)*
- [ ] **Deploy and migrate.** Push. CI deploys the rules and the app. Run the script against production with your own credentials. On `https://kraftigere.web.app/`: old Entries still show, adding "melk" suggests and counts. *(user)*
- [ ] **Move plan to `plans/done/`.** `git mv plans/active/12-staples.md plans/done/12-staples.md`, and remove it from **Now** in `ROADMAP.md`.
- [ ] **Commit: complete staples milestone.** *(auto)*

## Done when

- Every Entry refers to a Staple, in production too.
- Typing shows Staples ranked by match and frequency. Tapping one adds it.
- Rules refuse Staples and Entries in the wrong shape, with a passing rules test for each case.

## Notes

- 2026-10-22: Comes out of the grilling session that produced `docs/vision/groceries-and-meals.md`. Decisions made while planning, to confirm in triage:
  - Using the normalized name as the document id means a Staple can't be renamed without a new document. That's acceptable until aliases and merging arrive.
  - Two Family Members adding the same new Staple offline at once both "create" it. The second write becomes an update with `addCount` 1 instead of 2. Accepted.
  - Between deploying and running the migration, old Entries have no `staple`. Updates (check off) still work, since update rules only check `checked`.
