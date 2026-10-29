# Oda Order on Shop

**Status:** ready-for-agent · enhancement

Twenty-fifth milestone and the third Oda one, on the `oda` branch ([ADR 0005](../../docs/adr/0005-oda-route.md)). From Shop a Family Member chooses which Entries to order from Oda, gives each one an Oda Product where it lacks one, and fills the Basket with one pack per Entry. They place the order in Oda, then tap "Bestilt" to check the Entries off, or "Avbryt" to empty the Basket. Groceries is locked while the Oda Order lasts. It runs against the real oda.com from `npm run dev`. Terms are in `CONTEXT.md`'s Oda section, and the flow in `docs/vision/groceries-and-meals.md`.

## Scope

- **Never from Oda.** An optional `neverOda: true` on the Ware. In the Oda search, a last row "Aldri fra Oda" sets it. On Home the Oda line then reads "Aldri fra Oda ×", and × clears it.
- **Choosing, on Shop.** "Start odabestilling" first reads the Basket fresh. If it isn't empty: "Handlekurven har 4 varer fra før. Tilbake lar den være som den er. Avbryt senere tømmer hele handlekurven." with "Start likevel" and "Tilbake". Then the choosing view, kept only on this device:
  - The unchecked Entries alphabetically, each with a tickbox, the Ware's name, its Note (read-only), and the Oda line as on Home (product with ×, or "Velg Oda-vare" opening the search in place). Entries whose Ware has an Oda Product start ticked, the rest unticked.
  - Wares never from Oda at the bottom, in a section folded by default: "15 varer utenfor Oda". × on "Aldri fra Oda" moves the Entry up, unticked.
  - "Fyll handlekurven", enabled with at least one ticked. If any ticked Entry has no Oda Product: "Alle varer må ha et odaprodukt", and those Entries are marked. "Tilbake" leaves without filling. Oda Products and "Aldri fra Oda" chosen here stay on their Wares.
- **Filling.** A callable `odaFill({ entryIds })` reads the Entries and their Wares itself, and in a transaction refuses if any Entry is already In Basket. It adds one pack per Entry in one `manipulate_cart` call, then writes `basket: { productId, quantity }` on each Entry. An Oda Order lasts as long as any Entry has `basket`.
- **During the Oda Order.** Shop: "Neste steg er ditt: bestill i handlekurven på oda.com", linking to the Basket in a new tab, with "Bestilt" and "Avbryt", and the List read-only (In Basket Entries marked "i handlekurven", no checkboxes, no "Fjern avkryssede"). Home: "Odabestilling pågår", and nothing can be added or changed. Middag: Iverksett waits, with the same words. Every device shows this, and anyone may tap "Bestilt" or "Avbryt". A choosing open on another device closes when the Basket is filled.
- **Bestilt.** A callable `odaOrdered()` checks off the In Basket Entries (server time) and removes their `basket`. Oda's order history is not checked.
- **Avbryt.** `odaBasket` also answers `foreign`: whether the Basket holds a product no In Basket Entry put there, or more packs of one than Kraft added. If so: "Handlekurven har varer som ikke kom fra Kraft. Tøm alt, eller Tilbake og fortsett odabestillingen." with "Tøm alt" and "Tilbake". Then a callable `odaCancel()` empties the Basket (`clear_cart`) and removes every `basket`, leaving the Entries unchecked.
- **Rules.** No client writes `basket`, and no client updates or deletes an Entry that has it. A Ware's `neverOda` is set or cleared on its own, like `oda`. Locking everything else during an Oda Order is the client's job: rules can't ask whether any Entry is In Basket.

## Out of scope

- Pack counts: always one pack per Entry. The next Oda plan.
- "Ikke tilgjengelig" and Substitutes: an unavailable Oda Product goes in the Basket like any other. The Substitutes plan.
- Choosing Oda Products with the AI.
- Checking Oda's order history at "Bestilt".
- Rules that refuse new Entries during an Oda Order. A device with a stale view could add one; it just stays unchecked.

## Steps

- [x] **Glossary and vision.** `CONTEXT.md`: never from Oda on Oda Product, the Oda Order beginning at filling and locking Groceries, In Basket as what keeps an Oda Order going. The vision's Oda section: the choosing, the lock, and "ikke tilgjengelig" moving to Substitutes.
- [x] **Commit: Oda Order in the glossary and vision.** *(auto)*
- [ ] **Check `manipulate_cart` and `clear_cart` on oda.com.** Their argument names and answers are only in the plan 18 research ("a list of operations, each on one `productId` … `quantity` is a delta"). Read their schemas from `tools/list` with a fresh dev link, and note them here.
- [ ] **Oda Order in the function.** `odaFill`, `odaOrdered`, `odaCancel`, and `foreign` on `odaBasket`, each with the Family Member check. Unit tests for the `manipulate_cart` operations and for `foreign` against a `get_cart` answer.
- [ ] **Rules.** `basket` on Entries and `neverOda` on Wares as in Scope. Rules tests.
- [ ] **Commit: Oda Order in the function and rules.** *(manual)* (security rules; review first)
- [ ] **Never from Oda on Home.** "Aldri fra Oda" as the search's last row, and "Aldri fra Oda ×" on the Oda line.
- [ ] **Choosing on Shop.** "Start odabestilling", the Basket warning, the choosing view with its folded "varer utenfor Oda", "Fyll handlekurven" and its check.
- [ ] **During the Oda Order.** The next-step Shop with "Bestilt" and "Avbryt" and the Avbryt warning; Home and Iverksett locked.
- [ ] **Try it on the dev server**, iterating on feedback: choose Entries, give one an Oda Product in the choosing, set one "Aldri fra Oda", fill against a Basket that already holds something, see the Basket on oda.com, check that Home and Shop are locked on a second browser, then "Bestilt"; and once more with "Avbryt" after adding something on oda.com. Skipped in AFK mode. *(user)*
- [ ] **Tests.** The fake Oda keeps a Basket that `manipulate_cart` and `clear_cart` change, starting with the 4 items `oda.spec.ts` expects. e2e specs: choosing and filling (with the start warning and "Alle varer må ha et odaprodukt"), Home and Shop locked, "Bestilt" checking off, "Avbryt" with and without the warning, and "Aldri fra Oda". No test reaches oda.com.
- [ ] **Commit: Oda Order on Shop.** *(manual)* (user-visible; review first)
- [ ] **Move plan to `plans/done/`.** `git mv plans/active/25-oda-order.md plans/done/25-oda-order.md`, and remove it from **Now** in `ROADMAP.md`.
- [ ] **Commit: complete Oda Order milestone.** *(auto)*

## Done when

- In `npm run dev`, a Family Member chooses Entries on Shop, gives the missing ones Oda Products there, fills the real Basket with one pack each, and ends the Oda Order with "Bestilt" (Entries checked off) or "Avbryt" (Basket empty, Entries unchecked).
- While the Oda Order lasts, Home, Shop and Iverksett change nothing on any device, and the rules refuse changes to In Basket Entries.
- A Ware set "Aldri fra Oda" never shows among the Entries to choose, only in the folded section.
- Rules tests and the e2e specs pass against the fake Oda.

## Notes

- 2026-10-29: Planned after a grilling session. The Oda Order has no document of its own: an Entry's `basket` says it is In Basket, and the Oda Order lasts while any Entry has one. That also gives Avbryt what Kraft added, to compare with the Basket. The choosing isn't stored, so it locks no one out, and leaving it leaves nothing behind.
