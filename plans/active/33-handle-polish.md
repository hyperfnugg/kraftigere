# Handle polish

**Status:** ready-for-agent · enhancement

Small fixes to Handle and the Entry rows from a rapid-feedback session on the dev server. Long Entries no longer squeeze the checkbox. The dishes icon is a cooking pot. Checking off no longer makes the List jump while shopping, and the Checked Entries fold away. Sorting Handle in store order came out of the same session but is its own plan (34).

## Scope

- **Long Entries.** Checkboxes keep their size and long text wraps, even a single long word, on Handle, the Oda Order's Choosing list and the staple picker.
- **Pot.** The dishes icon is a cooking pot instead of a chef's hat, drawn in the text's colour and size. The code's hat names become pot names.
- **In place.** On Handle, an Entry checked off on this device stays where it is, struck through, until the screen sleeps (the page is hidden) or another tab opens. Unchecking it there leaves it in place.
- **Avkrysset.** Checked Entries sit in a fold below the List, "Avkrysset (n)", closed by default, with Fjern avkryssede inside it.

## Out of scope

- Keeping an Entry checked on another device in place: it moves straight to Avkrysset.
- Remembering whether Avkrysset was open.
- Store order on Handle (plan 34).

## Steps

- [x] **Long Entries, pot, in place, Avkrysset.** In `src/App.tsx`: `Pot`, `Shop`, `Choosing`, `StaplePicker`, and the pot names in `Home`'s keyboard handling.
- [x] **Try it on the dev server**, iterating on feedback. Done as the rapid-feedback session. *(user)*
- [x] **e2e.** Update the specs that expect Checked Entries or Fjern avkryssede visible on Handle (`checked.spec.ts`, `app.spec.ts`, `oda-order.spec.ts`). New tests: a checked Entry stays in place, moves to Avkrysset on leaving Handle and on the page hiding, and Avkrysset starts closed with Fjern avkryssede inside.
- [x] **Commit: Handle polish.** *(auto)*
- [ ] **Move plan to `plans/done/`.** `git mv plans/active/33-handle-polish.md plans/done/33-handle-polish.md`.
- [ ] **Commit: complete Handle polish milestone.** *(auto)*

## Done when

- A long Entry on Handle wraps with a full-size checkbox.
- An Entry checked off on Handle stays in place until the page hides or the tab changes, then shows under a closed Avkrysset.
- `npx tsc -b`, `npm run lint`, `npm run test:unit` and the full e2e suite pass.

## Notes

- 2026-11-10: From the rapid-feedback session. The icon went chef's hat (slimmed, taller band) → apron → sheet with a bullet list → pot, which stuck. Checked Entries first stayed in place for 30 seconds, but moving on a timer made the List jump while shopping, so they move on the page hiding or a tab change instead.
