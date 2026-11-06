# Shared Oda Products

**Status:** ready-for-agent · enhancement

Twenty-eighth milestone and the sixth Oda one, on the `oda` branch, to land before `oda` merges ([ADR 0005](../../docs/adr/0005-oda-route.md)). An Oda Product may belong to at most one Ware today, but a Ware is what the Family means to buy and an Oda Product is what Oda sells, so "melk" and "melk, hel" can rightly be the same carton. The rule gives a dead end when picking and quietly worse suggestions, and it isn't enforced anyway. Now several Wares may share an Oda Product, and duplicate Wares are dealt with by the ideas in `ROADMAP.md` instead. Terms are in `CONTEXT.md`'s Oda section.

## Scope

- **Picking.** A product another Ware has can be picked in every search, by tap or by pasted link. Its result says "også på «Melk»" instead of "brukt av «Melk»". An unavailable result still can't be picked in the step after filling.
- **Suggestions.** A Ware's suggestion in the choosing no longer skips products other Wares have: it's the first available hit, as if no other Ware existed.
- **The choosing.** Within "Nye varer" and within "Tidligere kjøpte varer", Entries with the same Oda Product, saved or picked, sit together, otherwise alphabetically. Each keeps its own line and Pack Count.
- **The same product twice in the Basket.** `manipulate_cart` can get one `productId` in two operations, when filling, when adding Substitutes and when cancelling. It's tried on real Oda, and if it doesn't add them up, `addOperations` and `removeOperations` combine them first.

## Out of scope

- Merging Wares, aliases, and offering a merge. See `ROADMAP.md`.
- One Pack Count across Entries with the same Oda Product. Each Entry rounds up on its own, so two Entries can buy two packs, and the Family Member can change the counts.
- Sorting Shop or the In Basket lines.
- Sharing a Pack Size between Wares. Each Ware keeps its own copy, read by the AI as today.
- Removing an Off Sale product from Wares outside the Oda Order. They find out when they're next filled.
- Enforcing anything in the rules, which don't look at this today.

## Prerequisites (user)

- Substitutes ([plan 27](27-substitutes.md)) is committed, since both change `OdaSearch` and the choosing.

## Steps

- [x] **Glossary and vision.** `CONTEXT.md`: Ware and Oda Product say several Wares may share one, and Substitute loses "It may be another Ware's Oda Product". The vision's two "belongs to exactly one Ware" sentences go, including "which helps find duplicates".
- [x] **ADR 0006: Wares may share an Oda Product.** Why the rule goes, and the alternatives: keeping it, and forcing a merge whenever two Wares reach the same product. Accepted costs: noise at Iverksett, a trip back to the shelf when two Entries are the same thing, and rounding up twice.
- [x] **Commit: Let Wares share an Oda Product, in the glossary, vision and an ADR.** *(auto)*
- [x] **Try the same product twice on real Oda.** One `manipulate_cart` with the same product in two additions, then two removals, on a product the Family's cart doesn't hold, and taken out again. What it did goes in `docs/research/oda-routes.md`. If it doesn't add them up, combine the lines in `addOperations` and `removeOperations`, with unit tests, and make the fake Oda behave the same way.
- [x] **Commit: What Oda does with the same product twice.** *(auto)*
- [ ] **Picking, suggestions and the choosing in the app.** `usedBy` becomes a label only, and its `replacing === 'substitute'` exception and the "Brukt av" message go. The `taken` set goes from the suggestions. The choosing's sections keep the same product together.
- [ ] **Try it on the dev server**, iterating on feedback, with real Gemini. Pick "melk"'s product for "melk, hel", by search and by pasted link. See a suggestion land on a product another Ware has. See both Entries sit together in the choosing, and whether a row moving when its product is picked feels wrong. Fill, and see the real Basket hold both Pack Counts added up. Then "Avbryt", and see exactly those packs come out. Skipped in AFK mode. *(user)*
- [ ] **Tests.** `tests/e2e/oda-products.spec.ts`'s "brukt av" part becomes picking another Ware's product, by tap and by pasted link, with the label. e2e against the fake Oda and the Gemini stub: a suggestion that another Ware has; two Entries with one product sitting together; filling adding up their packs; "Avbryt" taking out exactly those. Unit, rules and e2e pass, with no test reaching oda.com or Gemini. The fake Oda adds up repeated products by its own design, so the real behaviour rests on the trial above.
- [ ] **Commit: Wares share Oda Products.** *(manual)* (user-visible; review first)
- [ ] **Move plan to `plans/done/`.** `git mv plans/active/28-shared-oda-products.md plans/done/28-shared-oda-products.md`, and remove it from **Now** in `ROADMAP.md`.
- [ ] **Commit: complete Shared Oda Products milestone.** *(auto)*

## Done when

- In `npm run dev`, two Wares can hold the same Oda Product, by search and by pasted link, with "også på «…»" shown.
- A suggestion can be a product another Ware has.
- Entries with the same Oda Product sit together in the choosing.
- The real Basket gets both Pack Counts when filling, and "Avbryt" takes out exactly those.
- What Oda does with a repeated product is written down in `docs/research/oda-routes.md`.
- Unit, rules and e2e tests pass, with no test reaching oda.com or Gemini.

## Notes

- 2026-11-05: Decided in discussion. The only reason written down for the rule was "helps find duplicates", for a merge that doesn't exist, while blocking means two Wares rarely reach one product, which is the signal merging would look for. The check is client-only against saved Wares, so unsaved picks, the step after filling and two devices already get past it. Dropping it needs no data migration.
- 2026-11-06: The Family accepts the three costs, since they're annoying but cheap, and will combat duplicate Wares in several ways rather than by matching alone. Giving the Ware names to the AI making Recipes was dropped: matching already has them, and it could blur an Ingredient's wording.
- 2026-11-06: Real Oda adds up repeated products, in additions and removals, so `addOperations` and `removeOperations` stay as they are. See `docs/research/oda-routes.md`.
