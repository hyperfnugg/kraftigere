# Pack Counts on the Order Summary

**Status:** needs-info · enhancement

Thirtieth milestone and the seventh Oda one, on the `oda` branch, to land before `oda` merges ([ADR 0005](../../docs/adr/0005-oda-route.md)). Now that Wares share Oda Products ([ADR 0006](../../docs/adr/0006-wares-share-oda-products.md)), a Pack Count per Entry is the wrong shape: "melk, hel" and "melk, hvilken som helst" can be one carton, but the choosing starts them at two packs with no way to say one. A Pack Count is about an Oda Product, and only the Order Summary shows Entries by Oda Product. So the choosing and the step after filling stop asking about counts, and the Family Member sets them once, on the Order Summary. Terms are in `CONTEXT.md`'s Oda section.

## Scope

- **The choosing.** No Pack Counts and no steppers. It's about which Entries, and which Oda Products.
- **The step after filling.** No Pack Count and no stepper. It's about what replaces what.
- **The Order Summary.** One stepper per Oda Product, starting at what its Entries' dishes need. Pressing it changes the real Basket at once, by the difference, and only ever by packs Kraft put there.
- **What a Pack Count is.** One for each Oda Product in an Oda Order, not one for each Entry. Its Entries' dishes are added up before rounding, when all of them have amounts. "Bestilt" and "Avbryt" go on working from what Kraft put in.

## Out of scope

- Showing or changing what the Family put in the Basket themselves. Kraft only counts its own packs, and a change on oda.com isn't read back.
- Sorting Shop by Oda Product.
- Remembering a Pack Count between Oda Orders.

## Prerequisites (user)

- Shared Oda Products ([plan 28](../done/28-shared-oda-products.md)) is committed: the Order Summary, its grouping, and the `shared` Basket line this builds on.
- The open questions under **Notes** are answered. Each has a recommendation, and the steps assume it.

## Steps

- [ ] **Answer the open questions.** *(user)*
- [ ] **Glossary, vision and ADR.** `CONTEXT.md`'s Pack Count belongs to an Oda Product in one Oda Order. The vision's "Pack counts appear only here" and its choosing paragraph follow. ADR 0005 gets an amendment: besides at Cancelled, the function removes packs when a Family Member lowers a count on the Order Summary, and only packs Kraft put in.
- [ ] **Commit: Pack Counts belong to the Order Summary, in the glossary, vision and ADR 0005.** *(auto)*
- [ ] **A function that sets a Pack Count.** `odaSetPacks` takes an Oda Product and a count, for a product the Oda Order has packs of, from 1 to the most allowed. In a transaction it works out the difference from what the Entries' lines hold, and moves the count to the first Entry with the others `shared`, then calls `manipulate_cart` with the difference. It's released if Oda doesn't take it, as in `odaFill`, since a retried transaction mustn't add twice. It takes a count rather than a difference, so two devices agree. Unit tests for working out the operation.
- [ ] **Commit: Setting a Pack Count in the Basket.** *(manual)* (touches the real Basket; review first)
- [ ] **The app.** The steppers leave the choosing and the step after filling, along with their hand counts and `usePackCounts`' hand part. Filling and adding Substitutes send what the dishes need, added up per Oda Product. The Order Summary gets a `PackStepper` per product, which waits for the function and shows "Oda svarer ikke" if it fails. Nothing moves in the list while it waits.
- [ ] **Try it on the dev server**, iterating on feedback, with real Gemini and real Oda. Fill with two Entries on one Oda Product, and see the count their dishes need together. Lower it to one, and see it in the real Basket. Raise it. Change it on two devices. Add a pack on oda.com, and see "Avbryt" leave that one. Skipped in AFK mode. *(user)*
- [ ] **Tests.** `tests/e2e/pack-counts.spec.ts` is rewritten around the Order Summary, and `substitutes.spec.ts` loses its steppers. e2e against the fake Oda and the Gemini stub: a count set from the Order Summary reaching the Basket, both ways; two devices; "Bestilt" and "Avbryt" after a change, with packs the Family added left alone; Oda failing while a count changes. Unit, rules and e2e pass, with no test reaching oda.com or Gemini.
- [ ] **Commit: Pack Counts on the Order Summary.** *(manual)* (user-visible; review first)
- [ ] **Move plan to `plans/done/`.** `git mv plans/active/30-pack-counts-on-the-summary.md plans/done/30-pack-counts-on-the-summary.md`, and remove it from **Now** in `ROADMAP.md`.
- [ ] **Commit: complete Pack Counts on the Order Summary milestone.** *(auto)*

## Done when

- In `npm run dev`, the choosing and the step after filling show no Pack Counts.
- The Order Summary has one stepper per Oda Product, and pressing it changes the real Basket by exactly that much.
- Two Entries on one Oda Product can be one pack.
- "Bestilt" checks off all the In Basket Entries, and "Avbryt" takes out exactly the packs Kraft holds at that moment, leaving what the Family added.
- Unit, rules and e2e tests pass, with no test reaching oda.com or Gemini.

## Notes

- 2026-11-06: Came out of trying plan 28. Steppers on each screen kept getting in each other's way, and the Family Member decided the counts belong in one place. The summary has to come after filling, since Oda only says what's unavailable then, which is why a stepper there has to change the real Basket.
- 2026-11-06: Open questions, with what the steps assume:
  - **When are Pack Sizes read?** Filling needs them to start at the right count. *Recommended: as today, in the choosing, without showing a count, with "Fyll handlekurven" waiting on "Regner ut antall pakker …".* The alternative is filling with one pack each and raising the counts on the Order Summary, which starts faster but changes the Basket twice, and is wrong if the app is closed in between.
  - **Can a count go to 0?** *Recommended: no, 1 is the lowest, as today.* Taking a product out is "Avbryt", or doing it on oda.com. Going to 0 would raise what becomes of its Entries: Left Out, or unticked and waiting?
  - **Do dishes add up before rounding?** *Recommended: yes when every Entry on the product has amounts, as 300 g and 400 g in packs of 1 kg is one pack, and otherwise each Entry adds its own, an Entry without amounts counting one.*
