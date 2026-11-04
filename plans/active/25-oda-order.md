# Oda Order on Shop

**Status:** ready-for-agent · enhancement

Twenty-fifth milestone and the third Oda one, on the `oda` branch ([ADR 0005](../../docs/adr/0005-oda-route.md)). On the Odabestilling tab a Family Member chooses which Entries to order from Oda, gives each one an Oda Product where it lacks one, and fills the Basket with one pack per Entry. They place the order in Oda, then tap "Bestilt" to check the Entries off, or "Avbryt" to empty the Basket. Groceries is locked while the Oda Order lasts. It runs against the real oda.com from `npm run dev`. Terms are in `CONTEXT.md`'s Oda section, and the flow in `docs/vision/groceries-and-meals.md`.

## Scope

- **Never from Oda.** An optional `neverOda: true` on the Ware. In the Oda search, a last row "Aldri fra Oda" sets it. On Home the Oda line then reads "Aldri fra Oda ×", and × clears it.
- **The Odabestilling tab.** The tab bar is ⌂, Handle and ⋮, with Middag and Odabestilling behind ⋮; while one of those is open, ⋮ carries its name. Back from linking Oda, the app opens on Odabestilling, which says "Koble til Oda" without a working Oda Link.
- **Choosing, on Odabestilling.** The tab opens on the choosing, under the Basket's count linking to oda.com, whatever the Basket already holds, kept only on this device:
  - The unchecked Entries in two lists, each alphabetical: "Nye varer" on top, whose Wares have no Oda Product yet, then "Tidligere kjøpte varer". Each Entry has a tickbox, the Ware's name, its Note (read-only), and its Oda Product as on Home (with ×).
  - A Ware without an Oda Product gets one suggested as the choosing opens: a callable `odaSuggest({ queries })` searches every such Ware's name at once (`product_search`, 10 names per call), and the first hit no other Ware has is suggested, preferring an available one. It reads like a saved Oda Product, linking to it on oda.com, and its × opens the search in its place, starting with the Ware's name. With no hit: "Velg Oda-produkt". Only Tidligere kjøpte varer start ticked; a suggestion is taken by ticking its Entry, and picking one in the search ticks it.
  - Wares never from Oda at the bottom, in a section folded by default: "Utenfor Oda (15)". × on "Aldri fra Oda" moves the Entry up, unticked.
  - "Fyll handlekurven", enabled with at least one ticked. If any ticked Entry has no Oda Product: "Alle varer må ha et Oda-produkt", and those Entries are marked. Leaving the tab leaves without filling. Suggested and picked Oda Products are saved on their Wares at "Fyll handlekurven", and only for ticked Entries. "Aldri fra Oda" is saved at once.
- **Filling.** A callable `odaFill({ entryIds })` reads the Entries and their Wares itself, and in a transaction refuses if any Entry is already In Basket. It writes `basket: { productId, quantity }` on each Entry, then adds one pack per Entry in one `manipulate_cart` call, and removes the `basket`s again if Oda doesn't take them. Claiming first, since a retried transaction would otherwise call `manipulate_cart` twice. An Oda Order lasts as long as any Entry has `basket`.
- **During the Oda Order.** Odabestilling: "Neste steg er ditt: bestill i handlekurven på oda.com", linking to the Basket in a new tab, with "Bestilt" and "Avbryt", and only the In Basket Entries listed, read-only, each with its Oda Product linking to oda.com (no ×). Home: "Odabestilling pågår", and nothing can be added or changed. Shop: the same words, and nothing can be checked off. Middag: Iverksett waits, with the same words. Every device shows this, and anyone may tap "Bestilt" or "Avbryt". A choosing open on another device closes when the Basket is filled.
- **Bestilt.** A callable `odaOrdered()` checks off the In Basket Entries (server time) and removes their `basket`. Oda's order history is not checked.
- **Avbryt.** Asks "Ta ut varene Kraft la i handlekurven?" with "Avbryt odabestillingen" and "Tilbake". Then a callable `odaCancel()` takes out exactly what the In Basket Entries added, with one `manipulate_cart` of negative quantities (they stop at zero), and removes every `basket`, leaving the Entries unchecked. The rest of the Basket stays.
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
- [x] **Check `manipulate_cart` and `clear_cart` on oda.com.** Their argument names and answers are only in the plan 18 research ("a list of operations, each on one `productId` … `quantity` is a delta"). Read their schemas from `tools/list` with a fresh dev link, and note them here.
- [x] **Oda Order in the function.** `odaFill`, `odaOrdered` and `odaCancel`, each with the Family Member check. Unit tests for the `manipulate_cart` operations that fill and cancel.
- [x] **Rules.** `basket` on Entries and `neverOda` on Wares as in Scope. Rules tests.
- [x] **Commit: Oda Order in the function and rules.** *(manual)* (security rules; review first)
- [x] **Never from Oda on Home.** "Aldri fra Oda" as the search's last row, and "Aldri fra Oda ×" on the Oda line.
- [x] **Choosing on Shop.** "Start odabestilling", the Basket warning, the choosing view with its folded "varer utenfor Oda", "Fyll handlekurven" and its check.
- [x] **During the Oda Order.** The next-step Shop with "Bestilt" and "Avbryt" and the Avbryt warning; Home and Iverksett locked.
- [x] **Try it on the dev server**, iterating on feedback: choose Entries, give one an Oda Product in the choosing, set one "Aldri fra Oda", fill against a Basket that already holds something, see the Basket on oda.com, check that Home and Shop are locked on a second browser, then "Bestilt"; and once more with "Avbryt" after adding something on oda.com. Skipped in AFK mode. *(user)*
- [x] **Tests.** `openTab` in `helpers.ts` opens Middag through ⋮, and `oda.spec.ts` finds the Basket on Odabestilling. The fake Oda keeps a Basket that `manipulate_cart` changes, starting with the 4 items `oda.spec.ts` expects. e2e specs: choosing and filling on Odabestilling (starting with 4 items already in the Basket, and "Alle varer må ha et Oda-produkt"), Home and Shop locked, "Bestilt" checking off, "Avbryt" with its question, taking out only Kraft's packs, and "Aldri fra Oda". No test reaches oda.com.
- [x] **Commit: Oda Order on Shop.** *(manual)* (user-visible; review first)
- [ ] **Move plan to `plans/done/`.** `git mv plans/active/25-oda-order.md plans/done/25-oda-order.md`, and remove it from **Now** in `ROADMAP.md`.
- [ ] **Commit: complete Oda Order milestone.** *(auto)*

## Done when

- In `npm run dev`, a Family Member chooses Entries on Odabestilling, gives the missing ones Oda Products there, fills the real Basket with one pack each, and ends the Oda Order with "Bestilt" (Entries checked off) or "Avbryt" (Basket empty, Entries unchecked).
- While the Oda Order lasts, Home, Shop and Iverksett change nothing on any device, and the rules refuse changes to In Basket Entries.
- A Ware set "Aldri fra Oda" never shows among the Entries to choose, only in the folded section.
- Rules tests and the e2e specs pass against the fake Oda.

## Notes

- 2026-10-29: Planned after a grilling session. The Oda Order has no document of its own: an Entry's `basket` says it is In Basket, and the Oda Order lasts while any Entry has one. That also gives Avbryt what Kraft added, to compare with the Basket. The choosing isn't stored, so it locks no one out, and leaving it leaves nothing behind.
- 2026-10-29: `manipulate_cart` takes `{ operations: [{ productId, quantity }] }` (also `recipeId`, `productListId`, `orderNumber`, `fromRecipePortions`), with `quantity` a delta, and answers with the cart. `clear_cart` takes nothing and answers with the empty cart. Both answer like `get_cart`: `groups`, each with `items` of `{ product: { id, name, … }, quantity, totalGrossAmount }`, some groups also with `id`, `title` and `groupType` for a recipe or list. Read from `tools/list` on oda.com.
- 2026-10-30: The UI calls an Oda Product "Oda-produkt" everywhere, as Oda mostly says produkt: "Velg Oda-produkt", "Fjern Oda-produkt", "Alle varer må ha et Oda-produkt". It was "Oda-vare" on Home and "odaprodukt" in the check.
- 2026-10-30: Avbryt takes out exactly the packs the Oda Order added, not the whole Basket, so nothing else in it is lost. That leaves nothing to warn about: the start warning and `foreign` are gone, and Avbryt only asks. ADR 0005 amended.
- 2026-11-01: `product_search` refuses more than 10 `queries` ("List should have at most 10 items"), checked on oda.com.
- 2026-11-01: Choosing was too many taps, so Wares without an Oda Product get one suggested, and suggestions are saved only when the Basket is filled.
- 2026-11-02: The choosing splits into "Nye varer" (no Oda Product saved) on top, then "Tidligere kjøpte varer", then the folded "Utenfor Oda", so the suggestions to check are together.
- 2026-11-02: Nye varer start unticked after all, so a bad suggestion ("olje, mat" → sardiner) isn't saved or ordered without a look.
- 2026-11-02: During the Oda Order Shop lists only the In Basket Entries, not the whole List with them marked.
- 2026-11-02: "Start odabestilling" became its own tab, Odabestilling, opening straight on the choosing, with no "Tilbake". With four tabs the bar got crowded, so Middag and Odabestilling sit behind ⋮.
