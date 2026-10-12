# Item to Entry

**Status:** ready-for-agent · enhancement

Fifth milestone. Bring the code in line with the glossary in `CONTEXT.md`: what the code calls an `Item` is an **Entry**. This is done now, before the multiple-lists work, so that milestone starts from the right vocabulary. It covers identifiers, the module name and the Firestore collection. It does not change the data model: there is still one List, and Entries keep their current fields.

## Scope

- Rename `Item` → `Entry` throughout `src/` (type, functions, hooks, variables), and `src/items.ts` → `src/entries.ts`.
- Move the Firestore collection from `/items` to `/entries`, and update `firestore.rules` to match.

## Out of scope

- Multiple Lists, List Kinds, Personal Lists.
- Renaming Entry fields (`text`, `checked`, `createdAt` stay as they are).
- UI copy. The "Add item" placeholder is fine wording for a shopping List.
- README prose.

## Prerequisites (user)

- Decide when to cut over. No data is copied (see Notes), so do it when the List is nearly empty.

## Steps

- [ ] **Allow `/entries` in `firestore.rules`** alongside `/items`, using the same `isFamily()` rule, so old and new clients both work during the cutover.
- [ ] **Commit: allow /entries collection in security rules.** *(manual)* (security rules; review before committing)
- [ ] **Deploy rules.** Paste `firestore.rules` into Firebase console → Firestore → Rules, publish. *(user)*
- [ ] **Rename in code.** `git mv src/items.ts src/entries.ts`. Then `Item` → `Entry`, `addItem`/`toggleItem`/`removeItem`/`useItems` → `addEntry`/`toggleEntry`/`removeEntry`/`useEntries`, collection `'items'` → `'entries'`, and update local names in `App.tsx`. `useAuthorized` moves with the module unchanged.
  - `npm run build` and lint pass.
- [ ] **Commit: rename Item to Entry, use /entries collection.** *(auto)*
- [ ] **Deploy and verify.** Push. On the live URL, add, check off and remove an Entry, and confirm it syncs to a second device. *(user)*
- [ ] **Drop `/items`.** Remove the `/items` match from `firestore.rules`. *(user: deploy rules, then delete the `items` collection in the console)*
- [ ] **Commit: remove /items from security rules.** *(manual)* (security rules)
- [ ] **Move plan to `plans/done/`.** `git mv plans/active/05-item-to-entry.md plans/done/05-item-to-entry.md`.
- [ ] **Commit: complete item-to-entry milestone.** *(auto)*

## Done when

- `grep -rni item src/` finds only UI copy.
- The app reads and writes `/entries`. `/items` is gone from the database and the rules.
- Sign-in, allowlist gating, Entry CRUD, real-time sync and the fun-fact button still work.

## Notes

- 2026-10-12: Entries are not migrated. Shopping Entries are short-lived and there's no backend to run a copy job, so the cutover happens when the List is nearly empty and anything left is re-added by hand. If that turns out to be unacceptable, add a one-off in-app copy step before "Rename in code".
