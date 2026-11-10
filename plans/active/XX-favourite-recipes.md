# Favourite recipes

**Status:** ready-for-agent · enhancement

The Family keeps the Recipes it likes as Favourites and puts them on a day of a Menu again, without the AI. A Favourite is a copy, so it keeps the version that was liked whatever happens to the week it came from. Terms follow the **Favourite** entry in `CONTEXT.md`, which records the decisions from grilling. Not covered: a screen listing the Favourites, the AI suggesting them when making a Menu, and rescaling servings.

## Scope

- **Favourite.** Shared by the Family: a name, servings and Steps, and a count of uses. No two share a name.
- **☆ / ★ on the Recipe.** In the Recipe view, in any week, past ones included. ☆ copies the Recipe into a Favourite; on a name a Favourite already has, it asks "Erstatt favoritten?" and replaces its contents, keeping its uses. ★ shows on a Recipe placed from a Favourite that still exists (or just made into one); tapping it removes the Favourite after a confirm. The week's Recipe stays.
- **★ on the Menu.** Next to a dish placed from a Favourite. Display only.
- **Combobox on the dish name.** Typing a Meal's dish name on the Menu lists matching Favourites, most used first. Picking one sets the Meal and copies its Recipe onto that day at once, no AI. "Lag oppskrifter" skips days that have a Recipe, as now. Free text works as today.
- **Never Outdated by Guidelines or a Day Note.** A Recipe placed from a Favourite. Changing the Meal's name still replaces it, and ↻ still remakes it with the AI, after which it is no longer from the Favourite.
- **"Lagre".** On a Recipe placed from a Favourite whose servings or Steps now differ from the Favourite's: copies them over the Favourite.
- **Uses counted at Confirm.** Once for each Meal of the week placed from a Favourite.

## Out of scope

- A list of Favourites (on `ROADMAP.md` as an idea).
- The AI offering Favourites when it makes a Menu.
- Rescaling a Favourite's servings for the day it's put on.
- Recipes from a pasted link (its own roadmap item); such a Recipe can be ☆'d like any other.

## Steps

- [ ] **Data and rules.** A `favourites` collection (name, servings, steps, uses), readable and writable by the Family, shaped like `isRecipe`. Uses change only by +1. A week's Recipe may carry `favourite` (the Favourite's id). Functions in a new `src/favourites.ts`: `useFavourites`, `makeFavourite` (or replace by name), `removeFavourite`, `saveToFavourite`, and `placeFavourite`, which in one batch sets the day's Meal (stamping `mealsAt`) and the Recipe with `favourite` and `madeAt`. `setMadeRecipe` leaves `favourite` off, so ↻ unlinks.
- [ ] **Rules tests** in `tests/rules/` for `favourites` and the `favourite` field on a Recipe.
- [ ] **Commit: Favourites in Firestore.** *(manual)* — security rules.
- [ ] **Not Outdated.** `recipeOutdatedSince` in `src/weeks.ts` ignores Guidelines and Day Notes for a Recipe with `favourite`. Unit test.
- [ ] **☆ / ★ and "Lagre" in `RecipeView`**, and ★ next to the dish in `MenuSection`, in `src/Meals.tsx`. "Lagre" shows when the Recipe's servings or Steps differ from its Favourite's.
- [ ] **Combobox in `DayEditor`.** Matching Favourites under the field, most used first, picking one calls `placeFavourite`. Keyboard like Hjem's chips (Up/Down with focus kept in the field, Enter picks a highlighted one).
- [ ] **Uses at Confirm.** In the Confirm batch in `src/matching.ts`, +1 on each Favourite a Meal of the week was placed from.
- [ ] **Try it on the dev server**, iterating on feedback. Skipped in AFK mode. *(user)*
- [ ] **e2e** in a new `tests/e2e/favourites.spec.ts`: ☆ makes one, the combobox places it with no AI call, ★ on the Menu, a Day Note doesn't make it Outdated, "Lagre" after a hand edit, ★ removes it, replacing by name, and uses counted at Confirm (ordering in the combobox).
- [ ] **Commit: favourite recipes.** *(manual)* — user-visible.
- [ ] **Move plan to `plans/done/`.** `git mv plans/active/XX-favourite-recipes.md plans/done/XX-favourite-recipes.md`.
- [ ] **Commit: complete favourite recipes milestone.** *(auto)*
- [ ] **Number the plan** when it merges into `main`: `git mv` it to the next number across `plans/active/` and `plans/done/` there, and update the link in `ROADMAP.md`.

## Done when

- A Recipe ☆'d in one week can be picked by name on another week's day and appears there at once, without the AI.
- That Recipe stays un-Outdated through Guidelines and Day Note changes, and shows ★ on the Recipe and the Menu.
- A hand edit to it can be saved back with "Lagre", and the Favourite can be removed with ★.
- Confirming a week raises the uses of its Favourites, and the combobox orders by them.
- `npx tsc -b`, `npm run lint`, `npm run test:unit`, `npm run test:rules` and the full e2e suite pass.

## Notes

- 2026-11-10: Grilled. A Favourite is a copy rather than a link to the week's Recipe, since that one can be remade, edited or go Outdated. Shared by the Family. ★ follows where a Recipe came from, not its name, so an AI-made "Lasagne" isn't shown as the Favourite "Lasagne". Uses count at Confirm rather than on picking, so a pick changed later doesn't count. "Lagre" chosen over a menu on ★ for saving an edit back.
