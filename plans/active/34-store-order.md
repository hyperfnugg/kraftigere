# Store order on Handle

**Status:** ready-for-agent · enhancement

Handle lists the Entries in the order the Family walks the store, so shopping is one pass. The order belongs to the Ware, not the Entry, so it holds as Entries come and go. A Family Member sets it by dragging a ↕ handle at the right of each row. A first version was tried in the rapid-feedback session behind plan 33 and rolled back to be done properly; its drag UI (listening on `window`, holding the dropped order until Firestore has it) carries over.

## Scope

- **Store Order.** Each Ware has a number, `order`, on the same scale as epoch millis. A new Ware gets the time it's created, so new Wares start in the order they're first added, after everything already placed. Iverksett gives the Wares it creates consecutive numbers in the order it lists them. A Ware from before this plan gets one on its next hand add; until then its Entry's `createdAt` stands in.
- **Sorting.** Handle sorts Entries by their Ware's Store Order, the Entry's id breaking ties. Avkrysset uses the same order.
- **Dragging.** Each unchecked row has a ↕ square at the right. Dragging it moves the row live; dropping writes the dragged Ware's new order, midway between its new neighbours. Only when neighbours are tied or too close does a drop also write the neighbours, spreading them apart. No handles while an Oda Order lasts. The dropped order shows at once and stays until Firestore has it, so the old order doesn't flash back.
- **Rules.** A Ware may be created with `order`, and `order` may be updated on its own. Both must be numbers.

## Out of scope

- Several stores with their own orders.
- Reordering on Hjem, which stays alphabetical.
- Keyboard reordering.
- Backfilling `order` on existing Wares in one go: a hand add or a drag gives them one, and the `createdAt` fallback covers them until then.

## Steps

- [x] **Order logic.** In `src/entries.ts`: `order` on `Ware`, read in `useWares`. Pure `storeOrder(entry, wares)`, `inStoreOrder(entries, order)` (ties by id) and `reorder(others, to)`, which returns the writes a drop needs: the moved order midway, or when neighbours are under 2 apart, 1 after the one before, pushing on only those in the way. `setOrders` writes them in one batch.
- [x] **Unit tests** for `storeOrder`, `inStoreOrder` and `reorder`: midpoint, first and last place, ties from one Iverksett batch, legacy Wares without `order`.
- [x] **Commit: Store Order logic.** *(auto)*
- [x] **Order on creation.** `addEntry` is passed the Wares and sets `order` to the time when its Ware is new or has none yet. That's where the new Entry would sort anyway, so it also backfills Wares from before Store Order. Iverksett (`confirmWeek` in `src/matching.ts`) gives the Wares it creates consecutive orders, in line order.
- [x] **Rules** in `firestore.rules`: `order` allowed as a number on create, on a hand add only when the Ware has none, and as a lone update.
- [x] **Rules tests** in `tests/rules/firestore.test.ts`: create with a number or not, a hand add setting a missing order but never changing one, a lone update, and refusing a non-number, a removal, or `order` alongside another field.
- [x] **Commit: Store Order on Wares and in the rules.** *(manual)* — security rules change.
- [ ] **Drag on Handle.** `Shop` in `src/App.tsx` sorts by Store Order and adds the ↕ handle, with the drag carried over from the session (git blob `65a3133` holds that version of `src/App.tsx`).
- [ ] **Try it on the dev server**, iterating on feedback, on a phone too. Skipped in AFK mode. *(user)*
- [ ] **e2e** in a new `tests/e2e/handle.spec.ts`: dragging moves a row and the order holds after a reload, a re-added Ware returns to its place, a new Ware comes last, and no handles show while an Oda Order lasts.
- [ ] **Glossary.** Add Store Order to `CONTEXT.md`.
- [ ] **Commit: drag to Store Order on Handle.** *(auto)*
- [ ] **Move plan to `plans/done/`.** `git mv plans/active/34-store-order.md plans/done/34-store-order.md`.
- [ ] **Commit: complete Store Order milestone.** *(auto)*

## Done when

- Dragging a row on Handle moves its Ware, and the order holds after a reload and on another device.
- Removing a Ware's Entry and adding it again puts it back in the same place.
- A drop writes only the dragged Ware, unless its neighbours are tied.
- `npx tsc -b`, `npm run lint`, `npm run test:unit`, `npm run test:rules` and the full e2e suite pass.

## Notes

- 2026-11-10: Rolled back from the rapid-feedback session. That version had no `order` until a Ware was first dragged, and Iverksett's one-batch Entries shared a `createdAt`. That froze them all on the same number, so drops couldn't move anything. The fix renumbered every listed Ware on each drop (about 46 writes), and a Ware off the List kept a stale number. Two drag lessons carry over. Reordering moves the dragged `<li>` in the DOM, which drops pointer capture, so the drag listens on `window`. And the dropped order has to be held locally until the write lands, or the old order flickers back.
- 2026-11-10: A hand add decides whether the Ware has a Store Order from the Wares it has cached. If that cache is stale and the Ware was created and dragged on another device, the add's batch is refused: the rules never let an add change an existing order. This is rare (both devices offline). Accepted for the POC.
