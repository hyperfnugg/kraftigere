# Recipe cooking view

**Status:** ready-for-agent · enhancement

Twenty-first milestone: the Recipe screen becomes something to cook from, in the style of Modernist Cuisine. Each step is a row group with its Ingredients on the left and its instruction on the right, made mainly for a tablet held horizontally and stacked on a phone. Quantities are in grams first, with home-kitchen measures in parentheses. Built in quick iterations against the local app, with tests and docs caught up at the end. Firestore is empty, so no migration.

## Scope

- **Steps own their Ingredients.** `Recipe` becomes `{ course, servings, steps: { ingredients: Ingredient[], text: string }[] }`. A step may have no Ingredients. The flat list Confirm needs is built from the steps, and an Ingredient used in two steps shows on both.
- **Ingredient is `{ text, grams: number | null, pieces: number | null, measure: string }`.**
  - `grams` is the main quantity, estimated for countable things and spoon amounts too. It is null only for "etter smak".
  - `pieces` is for things bought by the piece (egg, løk, paprika). It shows as "(6 stk)".
  - `measure` is free text for other home measures ("2 dl", "1 ss", "en klype", "2 fedd"), only when it helps. "500 g kjøttdeig" has none.
- **The AI makes the new shape in one call.** If Ingredients land on the wrong steps or go missing, a throwaway `draft` field goes first in the schema. Two calls only if that fails too.
- **Cooking view**, read-only with large type (about 1.25rem on wide screens):
  - Wide: a table filling most of the screen width, with quantity (right-aligned "200 g", then "(2 dl)" in smaller grey) | Ingredient | instruction spanning the step's rows.
  - Below about 40rem: each step is a block, its Ingredients on one line each ("200 g (2 dl) helmelk") and the instruction under them, with a step number and a thin divider.
  - The screen stays awake while a Recipe is open (Wake Lock).
  - Tapping a step greys it out, on this device only, until the Recipe is left.
  - Header: day, dish, servings, ↻. The AI instruction box stays visible.
- **Edit mode** behind an "Endre" toggle: each step as a block of Ingredient rows (g | stk | mål | Ingrediens | Fjern), "Legg til ingrediens" and the instruction as a textarea. A "+ steg" button above the first step and under every step inserts an empty step there. Steps can be removed but not reordered.
- **Confirm** lines add up grams, plus stk in parentheses when there are any: "egg 360 g (6 stk)". `measure` doesn't go to Groceries.

## Out of scope

- A scaling-% column, and rescaling amounts when servings change (roadmap idea).
- Timers from times in the steps (roadmap idea).
- Active or total time in the header (roadmap idea).
- Reordering steps.

## Steps

- [ ] **New Recipe and Ingredient shape**, in `weeks.ts`, `firestore.rules`, the stub and `weekIngredients`. Leave the screen working, roughly.
- [ ] **AI makes the new shape.** Prompt and schema in `makeRecipe`, remake included. Try 3–4 dishes on the dev server and add the `draft` field if needed.
- [ ] **Commit: Recipes as steps with their Ingredients.** *(manual)* (security rules)
- [ ] **Cooking view, wide table.**
- [ ] **Cooking view, stacked below 40rem.**
- [ ] **Wake Lock and tapping a step done.**
- [ ] **Commit: Recipe cooking view.** *(auto)*
- [ ] **Edit mode behind "Endre"**, with inserting and removing steps.
- [ ] **Confirm amounts** as grams plus stk.
- [ ] **Commit: Recipe edit mode and Confirm amounts.** *(auto)*
- [ ] **Tests.** Unit tests for the flat list and amounts, e2e for the cooking view, edit mode and Confirm.
- [ ] **Glossary (Recipe, Ingredient, a new Step), vision and README.**
- [ ] **Commit: Recipe cooking view tests and docs.** *(manual)* (user-visible)
- [ ] **Try cooking a real dinner from the tablet.** *(user)*
- [ ] **Move plan to `plans/done/`.** `git mv plans/active/21-recipe-cooking-view.md plans/done/21-recipe-cooking-view.md`, and remove it from **Now** in `ROADMAP.md`.
- [ ] **Commit: complete Recipe cooking view milestone.** *(auto)*

## Done when

- A Recipe on a horizontal tablet reads as a table of steps, each with its Ingredients in grams beside its instruction, and stays on screen while cooking.
- On a phone the same Recipe reads as stacked step blocks.
- A Recipe can be edited by hand, including inserting a step in the middle.
- Confirm shows grams, and stk where there are pieces.

## Notes

- 2026-10-26: Decisions from the grilling session. Modernist Cuisine's % column was left out as noise for a family dinner. Grams come first because they add up on the shopping list. Stk is the only home unit worth carrying to Groceries, so it gets its own number field, and everything else is free text. A single AI call comes first because thinking already drafts and Recipes are the costliest calls. Hand edits move behind "Endre", because inputs in the table are easy to hit with wet fingers.
