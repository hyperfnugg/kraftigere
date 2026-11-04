# Pack Counts

**Status:** ready-for-agent · enhancement

Twenty-sixth milestone and the fourth Oda one, on the `oda` branch ([ADR 0005](../../docs/adr/0005-oda-route.md)). An Oda Order fills the Basket with one pack per Entry today, so a week's dishes can come up short. Now each Entry gets enough packs for its dishes: the AI reads a product's Pack Size once, the app works out the Pack Count, and the Family Member can change any count while choosing. It runs against the real oda.com and real Gemini from `npm run dev`. Terms are in `CONTEXT.md`'s Oda section.

## Scope

- **Pack Count.** A pure function in `src/amounts.ts` rounds up the larger of (dish grams ÷ pack grams) and (dish pieces ÷ pack pieces), and limits the result to 1–20. A side with nothing to compare is left out, and with neither side the count is 1. So an Entry that's bare, has only a Note, or has dishes with only "etter smak" starts at 1, with no AI. A Note never changes the count.
- **Pack Size.** The AI reads a product's name and pack text, and answers with grams per pack, plus pieces per pack if it's sold by the piece ("1 l" is about 1030 g). It's asked only for Entries with dish amounts whose Oda Product has no known size, ticked or not, in one request once the suggestions are in. The call lives in `src/ai.ts`, and `warmUp` also runs when Odabestilling opens. An answer that's missing, or whose grams aren't a positive number or whose pieces aren't a positive whole number, counts as failed.
- **Remembering it.** Optional `packGrams` and `packPieces` on the Ware's `oda`, saved at "Fyll handlekurven" for ticked Entries only, like picks. Existing Wares need no migration: they get a size the next time they're counted. × and picking the product again has the AI read it afresh. The Pack Count itself is never remembered.
- **In the choosing.** Every Entry with an Oda Product shows `− 2 +`, ticked or not, from 1 to 20. Changing a count ticks the Entry, and the change lasts only while the choosing stays open.
  - While its size is being read, a line shows `…` with `−` and `+` disabled. "Fyll handlekurven" is disabled while any ticked Entry is waiting, with "Regner ut antall pakker …" beside it.
  - Changing the Oda Product discards a hand-set count and works it out again. Dishes arriving from another device work it out again too, but a hand-set count stays.
  - When the AI fails, the line starts at 1, marked "Fikk ikke regnet ut antall pakker", and the Basket can still be filled. The mark clears when the count is changed. Reopening the tab tries again.
- **During the Oda Order.** Each In Basket line reads `2 × Tine Lettmelk …`, from `basket.quantity`, without buttons.
- **Filling.** `odaFill` takes `{ entries: [{ id, quantity }] }` and refuses a quantity that isn't a whole number from 1 to 20. It still reads the Entries and Wares itself. `odaCancel` doesn't change, as it already takes out `basket.quantity`.
- **Rules.** `isOdaProduct` allows optional `packGrams`, a positive number, and `packPieces`, a positive whole number.

## Out of scope

- Notes changing the Pack Count: the Family Member reads the Note and changes the count.
- Remembering Pack Counts on Wares.
- Showing or editing the Pack Size, or the AI explaining a count.
- One pack shared by several Wares. An Oda Product belongs to at most one Ware.
- "Ikke tilgjengelig" and Substitutes. The Substitutes plan.

## Steps

- [x] **Glossary and vision.** `CONTEXT.md`: Pack Count and Pack Size. The vision's pack counts line, and the sentence about two Wares sharing a pack gone.
- [x] **Amend ADR 0005.** The Ware also keeps the Pack Size, and the AI reads that rather than counting packs.
- [x] **Commit: Pack Counts planned, with the glossary, vision and ADR to match.** *(auto)*
- [x] **Rules.** `packGrams` and `packPieces` in `isOdaProduct`, and the `OdaProduct` type. Rules tests.
- [x] **Commit: Let a Ware's Oda Product hold its Pack Size.** *(manual)* (security rules; review first)
- [x] **Pack Count function.** In `src/amounts.ts`, with unit tests for the cases in Notes.
- [x] **Commit: Work out a Pack Count from dishes and a Pack Size.** *(auto)*
- [x] **Filling with counts.** `odaFill` takes quantities, checked by `fillEntries` with unit tests, and `src/oda.ts` to match.
- [x] **Pack Size from the AI.** The call in `src/ai.ts`, its answer checked by `packSizeOf` with unit tests, a stub for `npm run dev` without a debug token and for e2e, and `warmUp` on Odabestilling.
- [x] **Counts in the choosing.** `− 2 +`, the wait, the failure mark, saving the Pack Size at "Fyll handlekurven", and `2 ×` during the Oda Order.
- [x] **Try it on the dev server**, iterating on feedback, with real Gemini: fill from a week's Entries, and look at whether the sizes and counts are right for awkward pack text (a multipack, something by the piece, something in litres, "ca." weights). Change a count, change a product, and see an Entry with only a Note stay at 1. Then "Avbryt", and check that only Kraft's packs leave the Basket. Skipped in AFK mode. *(user)*
- [x] **Tests.** e2e against the fake Oda and the Gemini stub: a dish's amounts giving more than one pack and that count reaching the Basket, a bare Entry at 1, `−` and `+`, the Pack Size saved and not asked for again, `2 ×` during the Oda Order, and "Avbryt" taking out the whole count. Unit test what a bad AI answer gives. No test reaches oda.com or Gemini.
- [x] **Commit: Pack Counts in the Oda Order.** *(manual)* (user-visible; review first)
- [x] **Move plan to `plans/done/`.** `git mv plans/active/26-pack-counts.md plans/done/26-pack-counts.md`, and remove it from **Now** in `ROADMAP.md`.
- [x] **Commit: complete Pack Counts milestone.** *(auto)*

## Done when

- In `npm run dev`, an Entry whose dishes need more than a pack fills the real Basket with enough packs, and an Entry without amounts with one.
- A Family Member can change any count before filling, and the Basket gets that count.
- A Ware counted once fills again without asking the AI for its Pack Size.
- With Gemini failing, the Basket can still be filled, and the uncounted lines are marked.
- "Avbryt" takes out exactly the packs the Oda Order added.
- Rules tests, unit tests and the e2e specs pass, with no test reaching oda.com or Gemini.

## Notes

- 2026-11-04: Planned after a grilling session. The AI first was to answer with the Pack Count itself. Instead it reads the Pack Size and the app does the arithmetic, so "always enough" holds whatever the model does, and it can be unit tested.
- 2026-11-04: Pieces are compared as well as grams, since a Recipe's grams are AI estimates while its pieces are what it asks for. Cases to test (Entry, pack, count): epler 900 g (6 stk), 180 g and 1 stk, 6. Egg 360 g (6 stk), 720 g and 12 stk, 1. Melk, hel 500 g, 1030 g, 1. Pasta 1050 g, 1000 g, 2. Salt "etter smak", no size, 1.
- 2026-11-04: Changing a count ticks the Entry, like picking an Oda Product does: wanting two of something means wanting it.
- 2026-11-04: The Tests step found a bug from the Oda Order: back from linking, the app opens on Odabestilling, Wares could load before Entries, and the suggestions then ran once on nothing. They now wait for both.
- 2026-11-04: Notes left out: "mye" or "to kartonger" would have the AI answer in packs after all, for little gain, and the Note is right there next to the count.
