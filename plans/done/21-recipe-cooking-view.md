# Recipe cooking view

**Status:** ready-for-agent · enhancement

Twenty-first milestone: the Recipe screen becomes something to cook from, in the style of Modernist Cuisine. Each step is a row group with its Ingredients on the left and its instruction on the right, made mainly for a tablet held horizontally and stacked on a phone. Quantities are in grams first, with home-kitchen measures in parentheses. Built in quick iterations against the local app, with tests and docs caught up at the end. Firestore is empty, so no migration.

## Scope

- **Steps own their Ingredients.** `Recipe` becomes `{ course, servings, steps: { ingredients: Ingredient[], instructions: string[] }[] }`. A step is a group of Ingredients used together with short instructions for them, as in Modernist Cuisine. It may have no Ingredients. The flat list Confirm needs is built from the steps, and an Ingredient used in two steps shows on both.
- **Ingredient is `{ text, grams: number | null, measure: string }`.**
  - `grams` is the main quantity, estimated for countable things and spoon amounts too. It is null only for "etter smak".
  - `measure` is free text for the home measure ("2 dl", "1 ss", "en klype", "2 fedd", "2 stk"), only when it helps. "500 g kjøttdeig" has none.
  - A measure that's a count ("2 stk", "2 stykker", "½", or a bare "2") is pieces, found by a regex in `src/amounts.ts`. It shows as "(2 stk)". Things bought by the piece (egg, løk, paprika) get one.
- **The AI makes the new shape in one call.** If Ingredients land on the wrong steps or go missing, a throwaway `draft` field goes first in the schema. Two calls only if that fails too.
- **Cooking view**, read-only with large type (about 1.25rem on wide screens):
  - Wide: a table filling most of the screen width under INGREDIENS | MENGDE | FREMGANGSMÅTE, like the Modernist Cuisine pages. Each row has one Ingredient, its quantity ("200 g", then "(2 dl)" in smaller grey) and one instruction. Steps aren't numbered but separated by rules. Instructions are numbered in circles across the Recipe, and a step has as many rows as it has Ingredients or instructions, whichever is more.
  - Below about 40rem: each step is a block between rules, its Ingredients as name and quantity, and the numbered instructions under them.
  - The screen stays awake while a Recipe is open (Wake Lock).
  - Header: day, dish, servings, ↻. The AI instruction box stays visible.
- **Edit mode** behind a "Rediger" toggle ("Endre" is already the AI instruction box's button): each step as a block of Ingredient rows (g | mål | Ingrediens | Fjern), "Legg til ingrediens" and the instructions as a textarea, one per line. A "+ steg" button above the first step and under every step inserts an empty step there. Steps can be removed but not reordered.
- **Confirm** lines add up grams, plus stk in parentheses when there are any: "egg 360 g (6 stk)". `measure` doesn't go to Groceries.

## Out of scope

- A scaling-% column, and rescaling amounts when servings change (roadmap idea).
- Timers from times in the steps (roadmap idea).
- Active or total time in the header (roadmap idea).
- Reordering steps.

## Steps

- [x] **New Recipe and Ingredient shape**, in `weeks.ts`, `firestore.rules` (with rules tests), the stub and `weekIngredients`.
- [x] **AI makes the new shape.** Prompt and schema in `makeRecipe`, remake included.
- [x] **Confirm amounts** as grams plus stk.
- [x] **One home measure field**, with pieces read from it by a regex (unit tested, `npm run test:unit`), instead of a separate stk field that didn't work in the edit form.
- [x] **Edit form for steps**, as the Recipe screen for now: Ingredient rows, inserting and removing steps. The steps are saved whole, so each edit builds on the last one saved until a snapshot shows it. e2e for inserting a step mid-list.
- [x] **Commit: Recipes as steps with their Ingredients.** *(manual)* (security rules)
- [x] **Cooking view, wide table**, as the Recipe screen, with the edit form behind "Rediger".
- [x] **Cooking view, stacked below 40rem.**
- [x] **Wake Lock.**
- [x] **Tests** for the cooking view at both widths. The Wake Lock isn't tested: headless Chromium has no screen to keep on.
- [x] **Commit: Recipe cooking view.** *(manual)* (user-visible)
- [x] **Glossary (Recipe, Ingredient, a new Step), vision and README.**
- [x] **Commit: Recipe cooking view docs.** *(auto)*
- [x] **Try 3–4 dishes with the real AI on the dev server**, and add the `draft` field if Ingredients land on the wrong steps or go missing. In the feedback session. *(user)* Done 2026-10-27: the Steps looked right, so no `draft` field. Naming changes went into plan 22.
- [x] **Try cooking a real dinner from the tablet.** *(user)* Moved to plan 22.
- [x] **Move plan to `plans/done/`.** `git mv plans/active/21-recipe-cooking-view.md plans/done/21-recipe-cooking-view.md`, and remove it from **Now** in `ROADMAP.md`.
- [x] **Commit: complete Recipe cooking view milestone.** *(auto)*

## Done when

- A Recipe on a horizontal tablet reads as a table of steps, each with its Ingredients in grams beside its instruction, and stays on screen while cooking.
- On a phone the same Recipe reads as stacked step blocks.
- A Recipe can be edited by hand, including inserting a step in the middle.
- Confirm shows grams, and stk where there are pieces.

## Notes

- 2026-10-26: Decisions from the grilling session. Modernist Cuisine's % column was left out as noise for a family dinner. Grams come first because they add up on the shopping list. Stk is the only home unit worth carrying to Groceries, so it gets its own number field, and everything else is free text. A single AI call comes first because thinking already drafts and Recipes are the costliest calls. Hand edits move behind "Endre", because inputs in the table are easy to hit with wet fingers.
- 2026-10-26: The user asked for a proper implementation rather than rapid feedback, so trying the prompt with the real AI moved to a later feedback session. The toggle is "Rediger", since "Endre" already sends an instruction to the AI.
- 2026-10-27: From the Colonel's Fried Chicken page in Modernist Cuisine: instructions are short numbered sub-steps beside the Ingredient rows, and the groups aren't numbered. A step's single text became a list of instructions.
- 2026-10-27: The separate stk field didn't work in the edit form, so stk and the kitchen measure became one free-text field, and a regex reads pieces from it, a bare number included.
- 2026-10-27: Tapping a step to grey it out was removed as cruft.
- 2026-10-28: Closed. Its open real-world check moved to plan 22's "Deploy and live a real week", which covers plans 15–22 in one go.
