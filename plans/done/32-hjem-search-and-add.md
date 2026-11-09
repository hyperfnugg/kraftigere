# Hjem as search and add

**Status:** ready-for-agent · enhancement

Hjem's field becomes the one place to find and add Groceries: what's typed filters the List, and adding is picking a chip, never just Enter, since adding by accident was too easy. The List is alphabetical and works from the keyboard. Who's signed in moves out of the way into the ⋮ menu. The work came out of an exploratory UX session on the dev server; this plan records its decisions and adds the tests and commits.

## Scope

- **Filter.** What's typed narrows the List, matched like the Suggestions. Punctuation and spaces at the ends of what's typed are dropped. Esc or × in the field clears it, and so does adding.
- **Chips.** The Suggestions stay a row of chips under the field, as many as fit whole in one row. A green "+ <typed>" chip comes first and adds what's typed as it is, unless it's already suggested or waiting. With nothing typed, "+" opens the 30 most added Staples not waiting, most added first, to tick several and add them all on closing. Staples already waiting are never suggested. There's no Legg til button.
- **Keyboard.** Up/Down highlight chips from the field, with focus kept in the field (combobox with a horizontal listbox). Enter adds only a highlighted chip; otherwise it goes to the List. The List is one Tab stop with Up/Down/Home/End, Enter or Space opening a row, Esc going back to it, and typing going back to the field. Right/Left move between a row's name and its chef's hat, and Up/Down stay on the hats.
- **List.** Alphabetical. An open Entry closes on a tap outside or Esc, keeping the Note; with its Oda search open, Esc closes the search first. Fjern is on the Entry's title line.
- **Sticky.** The field and chips stay at the top while the List scrolls.
- **Account.** The header line is gone. The ⋮ menu's top row has the signed-in user's initials, unfolding to name, email and Logg ut.

## Out of scope

- Opening the only matching Entry on Enter.
- Clearing the filter when an Entry found through it is closed.
- A Norwegian word for Staple in the UI beyond the picker's label.

## Steps

- [x] **Filter, chips, "+", staple picker, keyboard, sticky field, Fjern on the title line.** In `Home` in `src/App.tsx`, and `suggest` in `src/entries.ts`.
- [x] **Account in the ⋮ menu.** `Account` in `src/App.tsx`.
- [x] **Try it on the dev server**, iterating on feedback. Done as the exploratory session. *(user)*
- [x] **Edge cleanup testable.** Move stripping edge punctuation into `typedName` in `src/entries.ts`.
- [x] **Unit tests** for `typedName` and `suggest`.
- [x] **e2e.** Update the helpers (`signIn`, `addEntry`) and the specs that relied on Legg til, buttons as Suggestions, newest-first order and the header's Logg ut. New tests in `hjem.spec.ts` for the filter, "+", the staple picker, chips in one row, keyboard on the List and closing an open Entry, and in `oda-products.spec.ts` for Esc with the Oda search open.
- [x] **Commit: Hjem as search and add.** *(auto)*
- [x] **Account tests.** Logg ut through the ⋮ menu, in `app.spec.ts`.
- [x] **Commit: account in the ⋮ menu.** *(auto)*
- [x] **Move plan to `plans/done/`.** `git mv plans/active/32-hjem-search-and-add.md plans/done/32-hjem-search-and-add.md`.
- [x] **Commit: complete Hjem as search and add milestone.** *(auto)*
- [x] **Push.** The user asked for it, AFK.

## Done when

- Adding on Hjem takes picking a chip, and the List filters as the field is typed in.
- The List, chips and chef's hats work from the keyboard alone.
- Logg ut is reached from the ⋮ menu only.
- `npx tsc -b`, `npm run lint`, `npm run test:unit` and the full e2e suite pass.

## Notes

- 2026-11-10: Decided in the exploratory session. Chips under the field, like a phone keyboard's suggestions, rather than a dropdown, to keep vertical space. Two-mode filtering (active and passive) was dropped for one rule: text in the field filters. Sideways-scrolling chips felt off, so the row shows what fits. The "+" chip goes first so it's never cut off. The account badge was tried beside the field, then settled in the ⋮ menu's top row, unfolding inline rather than as a popover in a menu.
- 2026-11-10: Writing the tests found a bug: an open Entry closed on pointerdown, which moved the rows below it before the click, so a tap on a lower row missed. It now closes on click, judged by the click's composed path, since the button tapped (Velg Oda-produkt) may be gone by then. The chef's hat arrows (Right, Left, Up/Down on the hats) have no e2e test, as they need Dishes from Iverksett; tried on the dev server only.
