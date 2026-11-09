# Pack Counts on the Order Summary

**Status:** ready-for-human · enhancement

Thirtieth milestone and the seventh Oda one, on the `oda` branch, to land before `oda` merges ([ADR 0005](../../docs/adr/0005-oda-route.md)). Now that Wares share Oda Products ([ADR 0006](../../docs/adr/0006-wares-share-oda-products.md)), a Pack Count per Entry is the wrong shape: "melk, hel" and "melk, hvilken som helst" can be one carton, but the choosing starts them at two packs with no way to say one. A Pack Count is about an Oda Product, and only the Order Summary shows Entries by Oda Product, once any Substitutes are chosen and every product is known. So the choosing and the step after filling stop asking about counts, filling puts in one pack per product, and the Order Summary works out the counts and lets the Family Member change them. Terms are in `CONTEXT.md`'s Oda section.

## Scope

- **The choosing.** No Pack Counts, no steppers and no Pack Size reading. It's about which Entries, and which Oda Products.
- **The step after filling.** The same. It's about what replaces what.
- **Filling and adding Substitutes.** One pack per Oda Product, held by its first Entry, with the others `shared`.
- **The Order Summary.** It sets the starting counts of what it can work out at once, then reads any missing Pack Sizes and sets the rest, and shows one stepper per Oda Product. Pressing it changes the real Basket at once, by the difference, and only ever by packs Kraft put there.
- **What a Pack Count is.** One for each Oda Product in an Oda Order, not one for each Entry. Its Entries' dishes are added up before rounding, when all of them have amounts. "Bestilt" and "Avbryt" go on working from what Kraft put in.

## Out of scope

- Showing or changing what the Family put in the Basket themselves. Kraft only counts its own packs, and a change on oda.com isn't read back.
- Taking one Oda Product out of an Oda Order, or a count of 0. It's "Avbryt", or doing it on oda.com, after which "Bestilt" still checks its Entries off. An idea in `ROADMAP.md`.
- Reading Oda's answer when a count changes. A product that has become unavailable is left for Oda to flag before paying.
- Sorting Shop by Oda Product.
- Remembering a Pack Count between Oda Orders.

## Steps

- [x] **Glossary, vision and ADRs.**
  - `CONTEXT.md`: Pack Count becomes "How many packs of one Oda Product an Oda Order holds in the Basket: at first enough for its Entries' dishes, and otherwise one, then whatever the Family Member sets on the Order Summary." Pack Size, Cancelled, Order Summary and In Basket follow.
  - The vision's "Pack counts appear only here" and its choosing paragraph follow.
  - ADR 0005 gets an amendment: after filling, the function raises counts to what the dishes need, and when a Family Member changes a count on the Order Summary it also lowers them, only ever by packs Kraft put in. Besides Cancelled, that's the only time it removes packs, apart from taking unavailable ones back out while filling.
  - ADR 0006 gets an amendment: "each Entry keeps its own line and Pack Count" and "Rounding up twice" no longer hold.
- [x] **Commit: Pack Counts belong to the Order Summary, in the glossary, vision and ADRs.** *(auto)*
- [x] **Filling and Substitutes put in one pack.**
  - `odaFill` and `odaSubstitute` take no counts. In the transaction, the first Entry on each Oda Product gets one pack and the others `shared`. Oda is only sent lines with packs.
  - Each line is marked not yet counted, with an optional field that only the functions write. A line without it counts as counted. No rules change or migration.
  - `odaFill` removes `shared` when a product turns out unavailable. Today's `{ ...line, quantity: 0 }` would keep it, so the Entry would skip the step after filling and "Bestilt" would check it off.
  - Unit tests.
- [x] **A function that sets Pack Counts.** `odaSetPacks` takes a list of Oda Products and counts, for products the Oda Order has packs of, ignoring Left Out lines and lines waiting for a Substitute.
  - **Two uses.** The starting counts are one call, flagged as starting, which applies only to products still not yet counted, so a second device can't overwrite a count someone has set. A stepper press is the same call without the flag.
  - **The transaction.** It works out each difference from what the lines hold, moves the count to the first Entry with the others `shared`, since a Substitute can leave two lines holding one product, and clears the mark. No differences means no call to Oda. It then calls `manipulate_cart` once. It takes counts rather than differences, so two devices agree.
  - **Limits.** Counts start at 1. Only raising is refused above the most allowed (20), as merged lines can be above it and lowering must always work.
  - **If Oda doesn't take it.** A transaction takes back only this call's differences and restores the mark, and does nothing for a line that's gone. It never restores old values: that would lose another device's change, or put `basket` back on an Entry whose Oda Order has ended.
  - Unit tests for working out the operations.
- [x] **Commit: Setting Pack Counts in the Basket.** *(manual)* (touches the real Basket; review first)
- [x] **Starting counts in `amounts.ts`.** A pure function for one Oda Product's starting count from its Entries' dishes and a Pack Size. When every Entry has amounts they're added up before rounding, so 300 g and 400 g in packs of 1 kg is one pack. Otherwise each Entry adds its own, and one without amounts counts as one. Unit tests.
- [x] **The choosing and the step after filling lose their counts.** The steppers go, along with the hand counts, `usePackCounts`, the waiting on "Regner ut antall pakker …" and the Pack Size reading.
- [x] **The Order Summary counts.** While any product isn't yet counted, each device that opens it does the following once:
  - It uses the first saved Pack Size among the product's Entries, alphabetically, and otherwise asks the AI in one request, for products where an Entry has amounts.
  - A Pack Size that's read is saved at once on the Wares whose own Oda Product it is, even if the Oda Order is later Cancelled. A Substitute's is used once and not saved. What replaces an Off Sale product is already the Ware's own by then, so it's saved too.
  - It calls `odaSetPacks` with the starting counts of the products that need no reading, without waiting for the read, and again with those it read. A product whose Pack Size can't be read stays not yet counted, at one pack.
- [x] **The Order Summary while counting.** The Oda Products and their Entries show from the start, so the Family Member can begin looking them over.
  - "Regner ut antall pakker …" takes the place of "Neste steg er ditt", keeping its height, and "Bestilt" and "Avbryt" are disabled, so nothing moves when counting ends.
  - A product with a known count shows it, with its stepper working, from the start. One whose Pack Size is being read has an empty count, with − and + disabled.
  - If the read or Oda fails, everything opens up, so a Gemini outage never blocks an order.
- [x] **The Order Summary's steppers.**
  - A `PackStepper` per Oda Product shows the new count at once and goes back if Oda fails, saying "Oda svarer ikke", or "Koble til Oda på nytt" if the Oda Link is broken. These show on the stepper's own row.
  - "Bestilt", "Avbryt" and the steppers block each other on one device while one is working.
  - "Sjekk antall" shows on the row of a product that isn't yet counted, with an Entry that has amounts and no Pack Size, once the read is over. Nothing about the failure is stored. Reopening the Order Summary reads again. Using the stepper clears the warning, and from then on a later read never changes that count.
- [x] **The step after filling keeps its error and picks.** When `odaSubstitute` fails, the step remounts, so "Oda svarer ikke" never shows and the picks are lost. It stays mounted through the call, as the choosing does through filling.
- [x] **Try it on the dev server**, iterating on feedback, with real Gemini and real Oda. Skipped in AFK mode. *(user)*
  - Fill with two Entries on one Oda Product, and see the count their dishes need together, with nothing moving as it lands.
  - Lower it to one, and see it in the real Basket. Raise it. Change it on two devices.
  - Close the app right after filling, reopen it, and see the counts land.
  - Add a pack on oda.com, and see "Avbryt" leave that one.
- [x] **Tests.** `tests/e2e/pack-counts.spec.ts` is rewritten around the Order Summary, and `substitutes.spec.ts` loses its steppers. e2e against the fake Oda and the Gemini stub:
  - starting counts landing, including for a Substitute that meets a product already in the Basket, and after reopening;
  - a count set from the Order Summary reaching the Basket, both ways;
  - two devices counting at once, and a hand-set count that a second device's starting count leaves alone;
  - a failed read showing "Sjekk antall", then a retry working;
  - an unavailable product shared by two Entries, both reaching the step after filling;
  - "Bestilt" and "Avbryt" after a change, with packs the Family added left alone;
  - Oda failing while counts land, while a count changes, and while adding Substitutes, with the picks kept.

  Unit, rules and e2e pass, with no test reaching oda.com or Gemini.
- [x] **Commit: Pack Counts on the Order Summary.** *(manual)* (user-visible; review first)
- [x] **Move plan to `plans/done/`.** `git mv plans/active/30-pack-counts-on-the-summary.md plans/done/30-pack-counts-on-the-summary.md`, and remove it from **Now** in `ROADMAP.md`.
- [x] **Commit: complete Pack Counts on the Order Summary milestone.** *(auto)*

## Done when

- In `npm run dev`, the choosing and the step after filling show no Pack Counts and don't wait for any.
- The Order Summary shows its Oda Products at once, with nothing moving when the counts land.
- The Order Summary has one stepper per Oda Product, and pressing it changes the real Basket by exactly that much.
- Two Entries on one Oda Product can be one pack.
- Closing the app after filling loses nothing: the next device to open the Order Summary finishes the counting, and never overwrites a count someone has set.
- A failed Pack Size read leaves one pack and "Sjekk antall", and blocks nothing.
- "Bestilt" checks off all the In Basket Entries, and "Avbryt" takes out exactly the packs Kraft holds at that moment, leaving what the Family added.
- Unit, rules and e2e tests pass, with no test reaching oda.com or Gemini.

## Notes

- 2026-11-06: Came out of trying plan 28. Steppers on each screen kept getting in each other's way, and the Family Member decided the counts belong in one place. The summary has to come after filling, since Oda only says what's unavailable then, which is why a stepper there has to change the real Basket.
- 2026-11-06: Grilled. Pack Sizes are read on the Order Summary rather than in the choosing, since only then are all the products known. It saves AI requests and the waiting before filling, and counts a Substitute together with what it meets. The cost is that the Basket changes twice for a product needing more than one pack. Closing the app in between is safe, as any device that opens the Order Summary finishes the job. An empty Pack Size alone can't say a count has been applied, as a second device would overwrite a hand-set count, hence the mark on the line.
- 2026-11-06: If another device ends the Oda Order while a call to Oda is in flight, one stray pack can land in the Basket. Accepted as rare, and visible on oda.com. `odaSubstitute` doesn't need `odaSetPacks`' careful undo, as the step after filling offers no way to end the Oda Order.
- 2026-11-06: Trying it, "også på «…»" went, on Home and in the choosing. It's redundant now the Order Summary shows which Entries share an Oda Product.
- 2026-11-06: Trying it, swapping the buttons and the steppers for "Regner ut antall pakker …" and "…" was too much visual noise. Only "Neste steg er ditt" is still replaced by that text. Buttons are now disabled rather than removed, and products with a known count look finished from the start. So a slow read doesn't hold them up, they reach the Basket at once, in a call of their own, which can make the starting counts two calls to Oda rather than one.
