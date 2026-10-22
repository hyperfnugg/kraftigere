# Week planning

**Status:** ready-for-agent · enhancement

Sixteenth milestone, and the first half of the AI-assisted meal planner. A Week tab where a Family Member writes the Week Notes and has the AI propose a Menu and write the Recipes, all in Norwegian, editing each by hand or by instructing the AI. It's useful on its own: you can read the Recipes and shop by hand. Sending Ingredients to Groceries (Confirm, "Iverksett") is plan 17. See `docs/vision/groceries-and-meals.md#meal-planning`.

## Scope

- Tabs: 🏠 · Uke · Handle.
- **Føringer** (Guidelines): one free-text document for the Family, behind a link at the top of Uke.
- **Weeks**: one Firestore document per ISO week (id like `2026-W44`, Monday–Sunday). Uke opens on the current week, and ‹ › go to any week, past or future, with a label like "Uke 44 · 26. okt–1. nov".
- **Ukeplan** (Week Notes): free text on the week.
- **Meny**: dinner only, one Meal for each of the seven days. Any day can be no Meal. A Meal can have several courses. The AI proposes it, and each day is editable as plain text.
- **Oppskrifter**: "Godta meny" writes a Recipe for every course of every Meal, in parallel. A Recipe has servings ("4 porsjoner", worked out by the AI from Føringer and Ukeplan, editable), Ingredient rows (text, amount, unit, in grams unless stated otherwise) and steps as plain text. It can be edited as a form.
- **Instructing the AI**: one-off, with one instruction box on the Menu and one per Recipe. Each call sends the current content including hand edits, Føringer, Ukeplan and the instruction, and gets the whole thing back. No chat history.
- **Utdatert** (Outdated): a Menu becomes Outdated when Føringer or Ukeplan change after it was made. A Recipe becomes Outdated when Føringer, Ukeplan or its own Meal change. Each shows "Utdatert" with a timestamp. Tapping it asks "Lag på nytt? Endringer du har gjort forsvinner." and then remakes. Nothing is remade automatically.
- AI output is structured JSON (a response schema) and in Norwegian, using the newest Gemini Flash in Firebase AI Logic. On the emulator, stubs return fixed Menus and Recipes so e2e can drive the flow.
- The fun fact goes away.

## Out of scope

- Confirm / Iverksett, Wares, matching, Menu Entries (plan 17).
- Lunch, breakfast, or more than one Meal per day.
- Rescaling amounts when servings change. Instruct the AI instead.
- Chat history with the AI, and remaking that keeps hand edits.
- Browsing past weeks as a list (the arrows are enough).
- Locking or merging when two people edit at once. Last write wins per field.
- A cooking view (a roadmap idea).

## Steps

- [x] **Glossary and vision.** In `CONTEXT.md`, Outdated also covers a Recipe whose own Meal changed, and a Meal is dinner. In `docs/vision/groceries-and-meals.md`, update the Outdated section to match: tapping "Utdatert" remakes after a warning.
- [x] **Commit: glossary and vision for week planning.** *(auto)*
- [x] **Week data and rules.** `/config/guidelines` holds `text`. `/weeks/{isoWeek}` holds `notes`, the Menu (seven days, each with a list of courses), Recipes keyed by day and course, and the timestamps needed for Outdated (when Føringer, Ukeplan and each Meal last changed, and when each Menu and Recipe was made). Pick the exact shape while building. Built: `/weeks/{isoWeek}` holds `notes`/`notesAt`, `menu` (day → list of up to 4 courses), `menuAt`, `mealsAt` (day → time) and `accepted`. Recipes are a subcollection `/weeks/{isoWeek}/recipes/{day-course}` (like `tue-0`) with `course`, `servings`, `ingredients`, `steps` and `madeAt`, so rules check each Recipe and two people editing different Recipes don't collide. Rules can't loop, so the shape of each Ingredient row is not checked. Rules: Family Members only, with field types and size limits checked, following ADR 0003. Rules tests in `tests/rules/firestore.test.ts`.
- [x] **Commit: week data and rules.** *(manual)* (security rules; review before committing)
- [x] **Uke tab, Føringer and Ukeplan.** Tab bar 🏠 · Uke · Handle. Week navigation as in Scope. The Føringer link opens an editable text. Ukeplan is an editable text on the week. Both save as you leave the field, like Notes.
  - e2e: Uke opens on the current week, › shows next week, and text typed in Ukeplan and Føringer stays after a reload.
- [x] **Commit: Uke tab with Føringer and Ukeplan.** *(manual)* (user-visible; review first)
- [ ] **Menu with AI.** Rework `src/ai.ts` into typed calls with response schemas and Norwegian prompts. Remove the fun fact and its code from `App.tsx`. "Lag meny" proposes a Menu, each day can be edited as text, the instruction box remakes the Menu, and "Godta meny" accepts it. Emulator stub returns a fixed Menu.
  - Check which Gemini Flash models AI Logic offers when starting, and pick the newest.
  - e2e: make a Menu (stub), edit Tuesday, accept it.
- [ ] **Commit: AI proposes the Menu; fun fact removed.** *(manual)* (user-visible, and changes what Gemini is called with)
- [ ] **Recipes with AI.** "Godta meny" writes every course's Recipe in parallel and shows progress. A Recipe opens from its day. The form edits servings, Ingredient rows and steps. The instruction box remakes that Recipe. Emulator stub returns a fixed Recipe.
  - e2e: accepting the Menu gives a Recipe for each course, and editing an Ingredient's amount stays after a reload.
- [ ] **Commit: AI writes Recipes.** *(manual)* (user-visible; review first)
- [ ] **Outdated.** Mark and show "Utdatert" as in Scope, and tap to remake after the warning.
  - e2e: editing Ukeplan after accepting the Menu shows Utdatert on the Menu and Recipes. Editing Tuesday's Meal marks only Tuesday's Recipes. Tapping and confirming remakes and clears the label.
- [ ] **Commit: Outdated Menus and Recipes.** *(manual)* (user-visible; review first)
- [ ] **ADR 0004 revisit.** Add a dated note to `docs/adr/0004-app-check-only-for-gemini.md`: revisited before the Menu. Føringer and Weeks get the same accepted risk as the List, and Oda is revisited in plan 18.
- [ ] **Commit: ADR 0004 revisited for meal data.** *(auto)*
- [ ] **Deploy and plan a real week.** Push. Write Føringer, plan next week, cook at least one Recipe. Note what felt wrong. *(user)*
- [ ] **Move plan to `plans/done/`.** `git mv plans/active/16-week-planning.md plans/done/16-week-planning.md`, and remove it from **Now** in `ROADMAP.md`.
- [ ] **Commit: complete week-planning milestone.** *(auto)*

## Done when

- A Family Member can plan a real week on the phone: Føringer, Ukeplan, a Menu they edited, and a Recipe for every course, all in Norwegian.
- Changing Ukeplan, Føringer or a Meal marks what depends on it as Utdatert, and tapping the label remakes it.
- The fun fact is gone.

## Notes

- 2026-10-23: Decisions from the planning session: ISO weeks, opening on the current week, because a week stays worth revisiting after Iverksett. Dinner only. Recipes are structured forms. Instructions are one-off. AI output in Norwegian. Last write wins. ADR 0004's risk is accepted for meal data. Tapping "Utdatert" remakes, after a warning since hand edits are lost.
