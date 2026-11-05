# Substitutes

**Status:** ready-for-agent · enhancement

Twenty-seventh milestone and the fifth Oda one, on the `oda` branch ([ADR 0005](../../docs/adr/0005-oda-route.md)). An unavailable Oda Product goes in the Basket like any other today, and Oda then refuses to go on to payment until it's removed. Now Kraft notices at filling, takes those packs back out, and offers a Substitute for this Oda Order only. It runs against the real oda.com and real Gemini from `npm run dev`. Terms are in `CONTEXT.md`'s Oda section.

## Scope

- **Finding out at filling.** `odaFill` reads availability from `manipulate_cart`'s answer, which is the full cart. A product of ours with `isAvailable: false`, or missing from the cart, is unavailable, and its code `not_for_sale` makes it Off Sale. An answer with no `groups` says nothing, so nothing counts as unavailable.
- **Taking them out.** Straight after, the unavailable packs come out, only what Kraft added, so the Family's own packs of that product stay. If that removal fails, the Entries stay In Basket as they are, and Oda's own message tells the Family Member.
- **In `basket`.** Every line also holds the product's `name` and `packText`, so the In Basket line reads from `basket`, not the Ware. An unavailable Entry has `basket` with `quantity: 0` and `gone: true` if Off Sale, so the existing lock and "an Oda Order lasts while any Entry has `basket`" still work. `left: true` makes it Left Out. Rules don't change, as they don't look inside `basket`.
- **Off Sale.** The Ware's `oda` is deleted at filling, with its Pack Size. Next time the Ware is in "Nye varer" with a suggestion.
- **The step.** While any Entry is unavailable and not yet Left Out, the Odabestilling tab shows the step instead of the "Neste steg" view, on any device and after a reload. Each Ware has a line: "ikke tilgjengelig" or "ikke lenger tilgjengelig", and "Velg erstatning" opening the search, starting from the Ware's name. Once a product is picked, the line shows it with × and `− 2 +`, with the Pack Count and Pack Size wait working as in the choosing. Picks aren't saved until a button is pressed, so a reload loses them.
- **The search in the step.** No "Aldri fra Oda" row. Unavailable results show but can't be picked, by tap or by pasted link. Any other Ware's product can be picked for a temporary line. On an Off Sale line it stays "brukt av «…»", since it becomes the Ware's own.
- **Finishing.** "Legg i handlekurven" sends what's picked, and every other unavailable Entry becomes Left Out. "Hopp over" sends nothing, with the same result. `odaSubstitute({ entries: [{ id, quantity, product: { id, name, packText } }] })` claims the Entries in a transaction first, which refuses an Entry that's no longer waiting for one, and releases them if Oda doesn't take the packs, as `odaFill` does.
- **Remembering.** A temporary pick is never saved on the Ware, and its Pack Size is read each time. An Off Sale line's pick is saved on the Ware with its Pack Size, first, as the choosing does.
- **The list.** Under the In Basket lines, "Ikke tilgjengelig" lists the Left Out Entries by name and Note, read-only.
- **Ending.** `odaOrdered` checks off only Entries with packs, and clears `basket` from all. `odaCancel` takes out what has packs, Substitutes included, and clears `basket` from all, back to the choosing.

## Out of scope

- A checkbox or other way to make a Substitute permanent. × in the choosing changes a Ware's Oda Product.
- Stored Substitutes, or the AI choosing or suggesting products.
- Suggesting a Substitute in the step, or `similar_and_related_products`.
- Finding Off Sale products before filling, through Oda's public product JSON. See ADR 0005's amendment.
- Checking again, after filling, whether a Substitute is still available.
- Availability changing after the step, such as between filling and ordering. Oda's own message covers it.

## Steps

- [x] **Glossary and vision.** `CONTEXT.md`: Substitute as an Oda Product for one Oda Order, Off Sale, Left Out, and Substitutes gone from Staple. The vision's Oda section and picture.
- [x] **Amend ADR 0005, and note the findings.** The amendment, and what the test on the real Basket found in `docs/research/oda-routes.md`.
- [x] **Roadmap.** The AI chooser gone, and this plan in **Now**.
- [x] **Commit: Plan Substitutes, with the glossary, vision and ADR to match.** *(auto)*
- [ ] **Reading the cart.** A pure function in `functions/src/oda.ts` that gives what's unavailable and Off Sale among our lines, with unit tests from the real answer in Notes, and a checker for `odaSubstitute`'s input with unit tests.
- [ ] **Filling and finishing.** `odaFill` takes out unavailable packs, marks the Entries and removes an Off Sale Oda Product. `odaSubstitute`. `odaOrdered` and `odaCancel` handling Entries without packs. `basket` holds name and pack text. `src/oda.ts` and the `Entry` type to match, and the fake Oda answering with availability, with an unavailable and an Off Sale product to add.
- [ ] **Commit: Find unavailable products when filling, and let a Substitute replace them.** *(auto)*
- [ ] **The step and the list in the app.** The step's lines and buttons, the search rules, the In Basket line reading from `basket`, and the "Ikke tilgjengelig" list.
- [ ] **Try it on the dev server**, iterating on feedback, with real Gemini. Claude seeds a Ware with Off Sale product 61999, and looks for a real product that's unavailable for now, or a temporary stand-in if none turns up. Fill, pick a Substitute for one and skip another, see the Basket on oda.com hold only available products, and "Bestilt" leave the Left Out Entry unchecked. Reload during the step. Then a next Oda Order: the temporary Ware tries its own product again, and the Off Sale one is in "Nye varer". Skipped in AFK mode. *(user)*
- [ ] **Tests.** e2e against the fake Oda and the Gemini stub: nothing unavailable means no step; packs out and the step shown; the Family's own packs staying; a Substitute reaching the Basket with its count and In Basket line, and the Ware unchanged; another Ware's product allowed; "Hopp over" giving the read-only list; "Bestilt" and "Avbryt" with Left Out Entries and Substitutes; everything unavailable; a reload returning to the step; an Off Sale pick saved on the Ware; skipping one leaving the Ware in "Nye varer". Rules tests still pass unchanged. No test reaches oda.com or Gemini.
- [ ] **Commit: Substitutes in the Oda Order.** *(manual)* (user-visible; review first)
- [ ] **Move plan to `plans/done/`.** `git mv plans/active/27-substitutes.md plans/done/27-substitutes.md`, and remove it from **Now** in `ROADMAP.md`.
- [ ] **Commit: complete Substitutes milestone.** *(auto)*

## Done when

- In `npm run dev`, filling with an unavailable Oda Product leaves it out of the real Basket, with the Family's own packs untouched, and offers the step.
- A Substitute reaches the Basket with its Pack Count, and the Ware's Oda Product is unchanged afterwards.
- An Off Sale Oda Product leaves its Ware, and what's picked in its place is saved.
- A Left Out Entry shows read-only during the Oda Order, and stays unchecked after "Bestilt".
- "Avbryt" takes out exactly the packs Kraft added, Substitutes included.
- Unit, rules and e2e tests pass, with no test reaching oda.com or Gemini.

## Notes

- 2026-11-04: The real answer from adding Off Sale product 61999, on an empty cart: `{ groups: [{ items: [{ product: { id: 61999, name: "Brokkoli Norge", description: "Norge, 400 g", availability: { isAvailable: false, description: "Ikke lenger tilgjengelig", code: "not_for_sale" } }, quantity: 1 }] }], productQuantityCount: 1, validationMessages: ["Brokkoli er dessverre utsolgt eller utilgjengelig av andre grunner. Du må fjerne dette produktet fra handlekurven før du kan gå videre til betaling."] }`. Any other unavailable code counts as temporary; none has been seen yet.
- 2026-11-05: Decided in a grilling session. Stored Substitutes and an AI product chooser were dropped as premature, and "falls back only as far as its dishes' Ingredients allow" went with them. A popup with a checkbox to overwrite the Ware's product became a step after filling, with several Wares on one screen and no way to make a Substitute permanent. An Off Sale line's pick is the one exception, since the old product is gone for good. Checking availability by searching for the saved name was dropped, since search leaves Off Sale products out and it would have called them available.
