# Home and Shop tabs

**Status:** ready-for-agent · enhancement

Fourteenth milestone. Split today's single screen into the first two tabs for usage scenarios: **Home** for "quick, before I forget" (adding and editing Groceries) and **Shop** for "I'm in the store". Not part of it: Week, Lists and Trip tabs, which arrive with the meal planner, Several Lists and trips. See `docs/vision/groceries-and-meals.md#tabs-and-home`.

## Scope

- A tab bar with Home and Shop. Home is the default.
- **Home:** add with autocomplete, Groceries sorted by most recently added, amounts editable, Remove. Check-off is there but takes two steps (tap the Entry, then a "Check off" button) to avoid misclicks.
- **Shop:** Groceries with unchecked Entries first in larger text, check-off and uncheck, "Remove checked".

## Out of scope

- Store-walk ordering.
- Quick-add to Lists other than Groceries.
- Routing or URLs per tab. The tab is component state, opening on Home.

## Steps

- [ ] **Tab bar.** A plain row of two buttons at the bottom of the screen. The current tab is marked with weight and colour, without icons. Moves the header and offline notice above both tabs.
- [ ] **Home and Shop.** Split the List component into the two views as described in Scope. The fun-fact feature stays on Home.
  - e2e: existing tests updated for the tab each one needs. Adding on Home shows up on Shop. Checking off on Shop greys the Entry out.
- [ ] **Commit: Home and Shop tabs.** *(manual)* (user-visible layout change; review first)
- [ ] **Deploy and check.** Push. Try both tabs in the store once. *(user)*
- [ ] **Move plan to `plans/done/`.** `git mv plans/active/14-home-and-shop-tabs.md plans/done/14-home-and-shop-tabs.md`, and remove it from **Now** in `ROADMAP.md`.
- [ ] **Commit: complete home-and-shop-tabs milestone.** *(auto)*

## Done when

- The app opens on Home. Shop is one tap away and is what you use in the store.

## Notes

- 2026-10-22: Comes after plans 12 and 13 so the tabs get split once, with Staples and Remove checked already in place. Home keeps check-off, but behind a second tap to avoid misclicks (user decision).
