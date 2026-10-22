# Norwegian UI

**Status:** ready-for-agent · enhancement

Fifteenth milestone. The Family works in Norwegian, so all text in the app becomes Norwegian (bokmål). This goes first because the Week tab (plan 16) adds a lot of new text, and it should be written in Norwegian from the start. Code, docs and `CONTEXT.md` keep their English domain terms. Only what the Family sees changes.

## Scope

- Every user-visible string in Norwegian: tabs, buttons, placeholders, offline notice, sign-in, errors, `index.html` `lang` and title, and the PWA manifest.
- The Home tab shows 🏠 instead of a word.
- `CONTEXT.md` records the Norwegian UI word for each term, so later plans use the same words.

## Out of scope

- Translation tooling, i18n libraries, or a language switch. Strings stay inline.
- Renaming anything in code or Firestore.
- The fun fact (plan 16 removes it, so it isn't translated).

## Steps

- [x] **Glossary UI words.** In `CONTEXT.md`, add a `_UI_:` line to each term that appears in the app or soon will. Agreed so far: Home 🏠, Week "Uke", Shop "Handle", Guidelines "Føringer", Week Notes "Ukeplan", Menu "Meny", Meal "Måltid", Recipe "Oppskrift", Ingredient "Ingrediens", Confirm "Iverksett", Note "Notat", Outdated "Utdatert", Remove "Fjern", Checked "Avkrysset". Proposed by the agent, for the user to confirm: List "liste", Groceries "Dagligvarer", Staple "Basisvare", Ware "Vare", Family "Familie", Family Member "Familiemedlem", and Home, Week and Shop as tab terms.
- [x] **Commit: Norwegian UI words in glossary.** *(auto)*
- [x] **Translate the UI.** Every string in `src/`, plus `index.html` and the manifest. Tab bar: 🏠 · Handle. "Remove checked" becomes "Fjern avkryssede".
  - e2e: update selectors and expected text in `tests/e2e/`.
- [x] **Commit: Norwegian UI.** *(manual)* (user-visible text everywhere; review the wording)
- [ ] **Deploy and check.** Push. Read through every screen on the phone, and check the installed app's name. *(user)*
- [ ] **Move plan to `plans/done/`.** `git mv plans/active/15-norwegian-ui.md plans/done/15-norwegian-ui.md`, and remove it from **Now** in `ROADMAP.md`.
- [ ] **Commit: complete norwegian-ui milestone.** *(auto)*

## Done when

- No English text is visible anywhere in the app.
- `CONTEXT.md` gives the Norwegian UI word for each term in use.

## Notes

- 2026-10-23: Decided while planning the meal planner: the whole app is in Norwegian, the Home tab is 🏠, and Guidelines, Week Notes and Confirm are called Føringer, Ukeplan and Iverksett.
