# Iverksett

**Status:** ready-for-agent · enhancement

Seventeenth milestone, and the second half of the AI-assisted meal planner. Iverksett (Confirm) sends a week's Ingredients to Groceries as Menu Entries. Each Ingredient is matched to a Ware or a Staple, and the Family's matches are remembered. Iverksett happens once per week. After it, the Menu and Recipes can still be edited by hand, but without the AI, and the edits don't change Groceries. Builds on plan 16. See `docs/vision/groceries-and-meals.md#confirm`.

## Scope

- **Wares** arrive, created only at Iverksett: the AI proposes a Ware name when an Ingredient needs something specific, and the Family Member accepts or changes it.
- **Matching**: each Ingredient is matched to a Ware (needs exactly this) or a Staple (whatever the Family usually buys will do). A remembered match is keyed on the Ingredient's normalized wording ("helmelk", "pasta, hvilken som helst"). Remembered wordings skip the AI. The AI proposes the rest, given the Family's Staples and Wares. Any correction overwrites the remembered match.
- **The Iverksett screen**: one line per Ware or Staple, with its summed amount, its days and a tick. Unticked means "har hjemme" and doesn't go to Groceries. A Staple's "usually at home" choice is remembered on the Staple, so salt and oil start unticked.
- **Menu Entries**: one per ticked line, shown like "helmelk 3 dl · fre". Amounts with the same unit are added up in code. Mixed units are shown side by side ("smør 200 g + 2 ss · ons, fre"), with no conversion. Menu Entries are marked as such, never merge with hand-added Entries, don't count toward a Staple's `addCount`, have no Note, and can be Removed like any Entry on Hjem and Handle.
- **After Iverksett**: the week shows it was iverksatt, hides "Utdatert", 🔄 and the instruction boxes, and keeps hand editing.

## Out of scope

- Confirming again. It's a roadmap idea until there's a clear need.
- A screen for managing Wares.
- A Staple's preferred Ware and Substitutes, Oda references, prices (Oda work).
- Unit conversion and pack counts.
- Aliases and merging of Staples.

## Steps

- [x] **Glossary and vision.** In `CONTEXT.md`, Confirm happens once per week, and add **Menu Entry**. In `docs/vision/groceries-and-meals.md`, move "Confirming again" under a **Later** heading (its anchor in `ROADMAP.md` still works), and say a week can be hand-edited after Confirm without the AI.
- [x] **Commit: glossary and vision for Iverksett.** *(auto)*
- [ ] **Data and rules.** `/wares/{id}` with `name`, id from the normalized name like Staples. `/matches/{normalizedWording}` points to a Ware or a Staple. Staples gain an optional `usuallyAtHome`. A Menu Entry is an Entry with `week`, `days`, and an `amounts` list (or a rendered amount text, decided while building) and a `ware` or `staple`. It has no Note and is created without counting its Staple. The week records `confirmedAt`. Rules for each, following ADR 0003, with tests in `tests/rules/firestore.test.ts`.
- [ ] **Commit: Wares, matches and Menu Entries in data and rules.** *(manual)* (security rules; review before committing)
- [ ] **Matching with AI.** A typed AI call with a response schema: given unmatched Ingredient wordings and the Family's Staples and Wares, propose a Staple, an existing Ware, or a new Ware name for each. Remembered matches are looked up first. Emulator stub returns fixed matches.
- [ ] **Iverksett screen.** "Iverksett" on a week with Recipes opens the screen described in Scope. Each line's match can be changed (choose a Staple or Ware, or type a new Ware name), and its tick toggled. Iverksett writes the Menu Entries, remembered matches, `usuallyAtHome` choices and `confirmedAt` in one batch.
  - e2e: iverksett a stubbed week. Two Recipes using "løk" give one Menu Entry with summed amount and both days. Unticking salt keeps it off Groceries, and salt starts unticked next week. A corrected match is used next week without the AI.
- [ ] **Commit: Iverksett sends Ingredients to Groceries.** *(manual)* (user-visible; review first)
- [ ] **After Iverksett.** Show that the week was iverksatt, hide Utdatert, 🔄 and the instruction boxes, keep hand editing, and show Menu Entries on Hjem and Handle with their days.
  - e2e: after Iverksett, editing a Recipe doesn't change Groceries, and no instruction box shows. A Menu Entry can be Removed on Hjem and checked off on Handle.
- [ ] **Commit: week after Iverksett.** *(manual)* (user-visible; review first)
- [ ] **Deploy and shop a real week.** Push. Iverksett a planned week and shop from it. *(user)*
- [ ] **Move plan to `plans/done/`.** `git mv plans/active/17-iverksett.md plans/done/17-iverksett.md`, and remove it from **Now** in `ROADMAP.md`.
- [ ] **Commit: complete iverksett milestone.** *(auto)*

## Done when

- Iverksett on a planned week puts one Menu Entry per needed Ware or Staple on Groceries, with summed amounts and days, leaving out what's at home.
- The next week reuses the Family's matches and "usually at home" choices.
- After Iverksett the week stays editable by hand, and Groceries doesn't change.

## Notes

- 2026-10-23: Decisions from the planning session: Iverksett is once per week, because confirming again is complicated and needs a clear need first. Wares come only from Iverksett. Matches are keyed on normalized wording. Same-unit amounts are summed in code, with no conversion. Menu Entries don't count toward `addCount`. If plan 18 shows that Ware needs a different shape for Oda, a migration script (ADR 0003) handles it.
- 2026-10-24: Plan 19 made the Menu and Recipes appear on their own, and a course whose name changes gets a new Recipe at once. Decide whether that should still happen after Iverksett, when the old Recipe's Ingredients are already in Groceries.
