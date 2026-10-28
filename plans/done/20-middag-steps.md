# Middag steps

**Status:** ready-for-human · enhancement

Twentieth milestone, from trying plans 19 and 17 together: making every Recipe at once, on its own, cost AI calls on dishes that were about to change, and the Menu had more controls than it needed. Middag now goes in clear steps: the AI names one dish a day, the Family Member adjusts the days, "Lag oppskrifter" makes every Recipe once, then "Iverksett". Built in quick iterations against the local app, with tests and docs caught up at the end.

## Scope

- **One dish a day.** `MAX_COURSES` is 1, the AI is told so, and the day editor has a single "Middag" field. A Meal stays a list of courses in the data and rules, so older weeks with several still show, and more can come back.
- **Names first.** Opening Middag makes only the dish names for this week and next. No Recipe is made on its own.
- **Adjusting days**, until "Lag oppskrifter": tapping a day opens its editor (Notat first, with focus, then Middag). It saves and closes on Enter, on tabbing out or on tapping outside, with no Lagre or Avbryt. A bare black ↻ beside the day asks the AI for a new dish following its Note and saves it at once. No ✏️.
- **"Lag oppskrifter" then "Iverksett"**, side by side under the Menu. "Lag oppskrifter" makes every Recipe and stays, disabled, once any Recipe exists, so the order shows. "Iverksett" is disabled until every dish has a Recipe.
- **After "Lag oppskrifter"**: the days are no longer edited and ↻ goes. Tapping anywhere on a day opens its Recipe. A dish without one (after the Menu was remade) gets "Lag oppskrift" beside it. An Outdated Recipe shows "utdatert" beside its dish, and is remade from ↻ on its screen.
- **No instruction box on the Menu.** The Recipe keeps its own.
- **Icons**: ↻ is a plain black text glyph on a transparent background, and Hjem's 🏠 became ⌂ the same way. A style guide is a roadmap idea.

## Out of scope

- Editing the dish or Note from the Recipe screen (next, as the user said, after "Lag oppskrifter").
- A style guide page (roadmap idea).
- Rules or data changes: none were needed.

## Steps

- [x] **Remove the Menu's instruction box.**
- [x] **One dish a day.**
- [x] **Notat first in the day editor, with focus.**
- [x] **Names first, "Lag oppskrifter" once, Iverksett disabled until ready.** Remaking a Recipe moved to its screen.
- [x] **Day taps**: open the editor before "Lag oppskrifter" and the Recipe after. No day editing after "Lag oppskrifter".
- [x] **Editor saves on Enter or leaving it**, without Lagre or Avbryt.
- [x] **↻ beside the day**, as a bare black glyph, and ⌂ for Hjem.
- [x] **Cleanup.** One click handler per day, a shared `iconStyle`, the Recipe screen's 🔄 as ↻ too, and unused instruction and Menu parameters gone.
- [x] **Tests.** e2e for names first, "Lag oppskrifter", day editing and ↻, the Recipe screen, Outdated and Iverksett with one dish a day.
- [x] **Glossary, vision and README.**
- [x] **Commit: Middag in steps.** *(manual)* (user-visible)
- [x] **Deploy and try a real week.** *(user)* Moved to plan 22.
- [x] **Move plan to `plans/done/`.** `git mv plans/active/20-middag-steps.md plans/done/20-middag-steps.md`, and remove it from **Now** in `ROADMAP.md`.
- [x] **Commit: complete Middag steps milestone.** *(auto)*

## Done when

- Opening Middag shows this week's dish names, the days can be adjusted, and one tap makes every Recipe.
- After that, a day opens its Recipe, and Iverksett is possible once every dish has one.

## Notes

- 2026-10-26: Decisions from the iteration session: Recipes cost the most, so they wait until the days are settled. "Lag oppskrifter" runs once, and is inferred from any Recipe existing rather than stored. Editing after that belongs on the Recipe screen. Icons are plain glyphs, not emoji.
- 2026-10-28: Closed. Its open real-world check moved to plan 22's "Deploy and live a real week", which covers plans 15–22 in one go.
