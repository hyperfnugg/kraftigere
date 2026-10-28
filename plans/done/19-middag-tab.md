# Middag tab

**Status:** ready-for-human · enhancement

Nineteenth milestone, from using plan 16's Week tab: planning took too many steps and the tab only served planning. The tab becomes **Middag**, for both planning and cooking: the Menu and Recipes for this week and next are just there, guidance is a Day Note per day, the Menu reads like a list, and a Recipe opens full screen to cook from. Built in quick iterations against the local app, with the plan, glossary and tests caught up at the end. Iverksett is still plan 17.

## Scope

- **Tab**: 🏠 · Middag · Handle. The glossary's Week tab becomes the Meals tab.
- **Weeks**: Middag opens on this week. › goes only to next week. ‹ goes only to earlier weeks that have a Menu.
- **Day Notes** replace Week Notes (Ukeplan): one Note per day, shown on the day's line like a Note on an Entry. Old Week Notes and `accepted` stay on old weeks, can't change, and are no longer shown or sent to the AI.
- **Made on their own**: while Middag is open, this week and next get a Menu if they have none, and every course without a Recipe gets one. No "Lag meny", "Godta meny" or "Lag oppskrift". A course whose name changes, by hand or by the AI, loses its Recipe in the same write and gets a new one. Past weeks never get anything made. Each Menu and course is tried once while the tab is open, and only after the server has answered, so a cached gap isn't remade.
- **Read-only Menu**: each day shows its courses as text. ✏️ opens an accordion under the day with the Meal (one course per line) and the Note, saved together on Lagre or dropped on Avbryt. 🔄 next to the Meal field asks the AI for a new Meal for that day, following the Note as typed, and only fills the field.
- **Outdated**: the Menu is Outdated only when Føringer change ("Utdatert" button as before). A Recipe is Outdated when Føringer, its day's Note or its own Meal change, shown as 🔄 next to the course name. Tapping remakes only the Recipe, after the warning. A changed Note never changes the Meal.
- **Recipe view**: tapping a course opens its Recipe full screen above the tab bar, with "‹ Meny" back. Editing and instructing work as before.
- **Working**: ⏳ on a day while its Meal is being made, and on a course while its Recipe is.
- The whole-Menu instruction box stays.

## Out of scope

- A spinning indicator (CLAUDE.md: no animations), unless the user decides otherwise.
- Making Menus before Middag is opened (from `App.tsx`), which would load the AI on every tab.
- Migrating old Week Notes into Day Notes, or deleting the leftover fields with a script (ADR 0003).
- A cooking view that steps through a Recipe (still a roadmap idea).
- Iverksett (plan 17).

## Steps

- [x] **Rename the tab to Middag.**
- [x] **Day Notes replace Week Notes.** `dayNotes` and `dayNotesAt` (day → text, day → time) on `/weeks/{isoWeek}`. Rules: days only, long text, each changed day stamped now, and `notes`, `notesAt` and `accepted` frozen.
- [x] **Outdated per day.** A Note marks only its own day's Recipes. Føringer still mark the Menu.
- [x] **Narrow the weeks.** Next week at most, and earlier weeks only with a Menu.
- [x] **Menu and Recipes in one step, then on their own.** Drop accepting. Recipes for missing and changed courses are made automatically, then the Menu too, for this week and next while Middag is open.
- [x] **Read-only Menu with ✏️ accordion**, Note on the day's line, course names open the Recipe.
- [x] **Recipe full screen** above the tab bar.
- [x] **🔄** to suggest a Meal in the editor, and instead of "Utdatert" next to a Recipe's course, remaking only the Recipe.
- [x] **⏳ while working.**
- [x] **Cleanup.** Tab renamed to Meals in code (`src/Meals.tsx`, `MealsTab`). Shared `readContext`, `makeWeekMenu`, `makeWeekRecipes` and `useAutoMake`. The editor only saves the Meal if it was edited, since the Menu can arrive while the editor is open.
- [x] **Tests.** Rules tests for Day Notes and the frozen fields. e2e for the week arrows, Day Notes, auto-made Menu and Recipes, the editor and its 🔄, the Recipe view, and Outdated.
- [x] **Glossary, vision and README.** Day Note, Meals tab, Outdated, and the Menu being made on its own.
- [x] **Commit: Middag tab.** *(manual)* (security rules and user-visible). Committed while the user was away, on their go-ahead.
- [x] **Commit: plan and docs for the Middag tab.** *(auto)*
- [x] **Try it on the phone.** Deploy the rules and hosting. Check that old weeks with Week Notes still open, and that this week and next fill in on their own. *(user)* Moved to plan 22.
- [x] **Move plan to `plans/done/`.** `git mv plans/active/19-middag-tab.md plans/done/19-middag-tab.md`, and remove it from **Now** in `ROADMAP.md`.
- [x] **Commit: complete Middag tab milestone.** *(auto)*

## Done when

- Opening Middag shows this week's Menu with a Recipe for every course without tapping anything, and next week's is ready too.
- Notes are per day, and changing one marks only that day's Recipes, which 🔄 remakes without changing the Meal.
- A Recipe can be read full screen while cooking.

## Notes

- 2026-10-24: Decisions from the iteration session: Middag is for planning and cooking. Recipes and Menus are made as early as possible, since it's at most two weeks, so few tokens are wasted. A changed Note updates Recipes only; changing the Meal is the Family Member's call, via ✏️ and its 🔄. Editing moved from a modal to an accordion. The ⏳ is static because of the no-animations rule.
- 2026-10-26: Plan 20 changed the flow: only dish names are made on their own, Recipes wait for "Lag oppskrifter", one dish a day, and the day editor saves without Lagre/Avbryt.
- 2026-10-28: Closed. Its open real-world check moved to plan 22's "Deploy and live a real week", which covers plans 15–22 in one go.
