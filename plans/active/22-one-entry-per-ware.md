# One Entry per Ware

**Status:** ready-for-agent · enhancement

Twenty-second milestone. Groceries gets one Entry per Ware, whether it was added by hand or by Iverksett, so the same pack of eggs isn't two lines: "melk · mye · 👨‍🍳 700 g", with 👨‍🍳 standing for a plain chef's hat icon. A Ware becomes anything the Family buys, and a Staple is a Ware they've added by hand. The dishes behind an Entry are one tap away, for the shopper now and the AI filling an Oda basket later. A Recipe's intent is kept: its "melk, hel" is a Ware of its own, not the Family's "melk". Production Firestore is empty, so no migration.

## Scope

- **Wares replace Staples in Firestore.** One `wares` collection: a Ware is anything the Family buys, named the way they say it ("melk", "løk, gul"), groceries or not, possibly bought once. It carries what Staples did: `addCount`, `lastAddedAt`, `usuallyAtHome`. `staples` goes away. **Staple** stays a domain term: a Ware that has been hand-added (`addCount` ≥ 1). Autocomplete suggests Staples only.
- **Entry**: a Ware, an optional Note, and optional dishes. **Menu Entry** goes away as a term. Every Entry can have a Note.
- **Dishes on an Entry**: one per Recipe Iverksett added it from, with the week, the Recipe's id, the dish name, and that Recipe's grams and stk added together. No days, no Ingredient wordings.
- **At most one Entry per Ware on the List.** Adding a Ware, by hand or from Iverksett, adds to its waiting Entry. A checked Entry for the Ware is removed and a fresh one added. Hand-adding a Ware that's waiting adds nothing and opens that Entry's Note.
- **The List line**: `egg · store · 👨‍🍳 360 g (6 stk)`, the amount added up over all dishes, grams plus stk as at Iverksett. The chef's hat and amount are a button ("Fra middag") opening a popup listing the dish names, each opening that Recipe in Middag. The hat is a small inline SVG in the text's colour, since Unicode has only a colour emoji; it sits in the line like the ⌂ and ↻ glyphs.
- **Iverksett** matches Ingredients to Wares only, the one that is the same thing to buy: what doesn't change the purchase is dropped ("salt, fin" is "salt"), but the Recipe's intent is kept ("melk, hel" stays its own Ware even when the Family has "melk"). Ware names are singular, the thing first ("løk, gul", "kylling, bryst"), as are Ingredient names. Duplicates get cleaned up over time. Its lines keep their days. A Ware with an Entry waiting isn't shown: its dishes are added to that Entry without a chance to correct the match. Unticking a line marks any Ware usually at home. Iverksett doesn't count toward `addCount`.

## Out of scope

- Bringing Entries up to date after a Recipe changes (roadmap: Confirming again).
- Correcting the match of a line hidden because its Ware is waiting.
- Merging duplicate Wares. An Oda article will belong to exactly one Ware, which can help later.
- Units other than grams and stk on the List.
- Oda.

## Steps

- [x] **Glossary and vision.** In `CONTEXT.md`: Ware as anything the Family buys, Staple as a hand-added Ware, Entry with Note and dishes, Menu Entry removed. In `docs/vision/groceries-and-meals.md`: the model picture, "Three different things" and Confirm say one Entry per Ware, strictness stays in the Recipe, and an Oda article belongs to one Ware.
- [x] **Commit: glossary and vision for one Entry per Ware.** *(auto)*
- [x] **Wares replace Staples in data, rules and code.** `/wares/{id}` with `name`, `addCount`, `lastAddedAt`, `usuallyAtHome`. `/matches` point to a Ware. An Entry is `text`, `ware`, `checked`, optional `note`, optional `dishes` (`week`, `recipe`, `course`, `grams`, `pieces`). `staples`, and Entries' `staple`, `week`, `days` and `amount`, go. Rules and rules tests, the seed, hand-adding and autocomplete on Wares, and Iverksett matching to Wares only (prompt, stub, the screen's rematch) and writing dishes. The List shows the summed amount inline until the chef's hat step. README's Iverksett line.
- [x] **One Entry per Ware.** Hand-adding and Iverksett add to a waiting Entry, replace a checked one, and a hand-added waiting Ware opens its Note. Iverksett hides lines whose Ware is waiting and adds their dishes. The Note opens on every Entry.
- [x] **The chef's hat and the dishes popup** on Hjem and Handle, each dish opening its Recipe in Middag.
- [x] **Try it on the dev server**, iterating on feedback. Skipped in AFK mode. *(user)*
- [x] **Tests.** Unit tests for adding up dishes. e2e: a hand-added "egg" and Iverksett's egg are one Entry with its dishes popup linking the dish; a checked Entry is replaced; a waiting Ware is hidden at Iverksett; hand-adding a waiting Ware opens its Note.
- [x] **Commit: one Entry per Ware.** *(manual)* (security rules and user-visible; review first)
- [ ] **Shop a real week from it.** *(user)*
- [ ] **Move plan to `plans/done/`.** `git mv plans/active/22-one-entry-per-ware.md plans/done/22-one-entry-per-ware.md`, and remove it from **Now** in `ROADMAP.md`.
- [ ] **Commit: complete one Entry per Ware milestone.** *(auto)*

## Done when

- A Ware is on the List at most once, with its Note and the dishes it's needed for.
- The chef's hat shows the dishes, and each opens its Recipe.
- Iverksett skips what's already on the List and adds its dishes there.
- Staples exist only as hand-added Wares, and autocomplete still suggests them.

## Notes

- 2026-10-27: Decided in a grilling session. Wares rather than Staples are the shared entity, because Staples carry familiarity (preferred Substitutes, search hints) and can be from any shop, while Ingredients come from the grocery store and have other needs. Days and wordings stay off the List: the dish names lead to the Recipes, which keep the details. Several weeks on one Entry made an inline days display unreadable, hence the popup. Hidden lines at Iverksett get no correction for now.
- 2026-10-27: Tried on the dev server with the real AI. Ware and Ingredient names became singular and thing-first, with qualifiers that don't change the purchase dropped. The grilled "most general Ware" rule was reversed: a Recipe's "melk, hel" keeps its own Ware, to preserve the Recipe's intent. "melk" and "melk, hel" merge only once the Staple "melk" points to an Oda article that is whole milk. The plate icon became a chef's hat.
