# Oda Products on Wares

**Status:** ready-for-agent · enhancement

Twenty-fourth milestone and the second Oda one, on the `oda` branch ([ADR 0005](../../docs/adr/0005-oda-route.md)). From an open Entry on Home, a Family Member searches Oda and picks the Oda Product for the Entry's Ware, or pastes a link to one, and the Ware remembers it. It runs against the real oda.com from `npm run dev`. This plan doesn't fill the Basket. That is the Oda Order plan, next in `ROADMAP.md`.

## Scope

- A callable `odaSearch` in the function: one `product_search` for a query, returning up to 20 products with id, name, pack text, price and availability. Same caller check and token refresh as `odaBasket`.
- An optional `oda` map on the Ware, `{ id, name, packText }`, written by the client through a new rules update branch that changes only `oda`.
- In the open Entry on Home, below Notat: the Oda Product as "<name> · <pack text>", linking to `https://oda.com/no/products/<id>/` in a new tab, with "Fjern Oda-vare". Changing it is removing it and choosing again. With no Oda Product: "Velg Oda-vare", which opens the search in its place. When the Family isn't linked, or the link is broken, the search shows "Koble til Oda".
- Search: a combobox (Downshift's `useCombobox`, the app's first UI dependency) starting with the Ware's name. It searches as you type after a 400 ms pause and 2 letters, a pasted link at once. ↑/↓ move, Enter picks, Esc closes the list and then the search, and leaving it closes it. Results show only for a finished search: 5 rows (name, pack text, price, "ikke tilgjengelig" when unavailable), then "Flere..." for the rest of the 20 without another call. Unavailable products can be picked. The Note and search fields select their text on focus.
- Pasting a URL like `https://oda.com/no/products/430-tine-tine-lettmelk-1-fett/`: search with the words from its slug, and pick the result whose id is exactly the URL's id. If none matches, show the results with "Fant ikke produktet fra lenken".
- An Oda Product belongs to at most one Ware: a result already on another Ware is greyed out with "brukt av «melk»" and can't be picked, and a pasted URL for one says the same. Checked in the client against the loaded Wares only.

## Out of scope

- Filling or emptying the Basket, pack counts, Substitutes: later Oda plans.
- A screen of all Wares, or choosing Oda Products for Wares not on the List.
- Showing Oda Products on Shop.
- Enforcing one Ware per Oda Product in the rules, and merging duplicate Wares.
- Storing price or URL on the Ware. The link is built from the id, since `oda.com/no/products/<id>/` redirects to the product page (checked 2026-10-28).

## Steps

- [x] **Search in the function.** `odaSearch({ query })` calls `product_search` and maps each product to `{ id, name, packText, price, available }` (`packText` from `description`, `available` from `availability.isAvailable`), up to 20. A parsing helper in `functions/src/oda.ts` with unit tests. Not linked, or refresh failed, returns `{ linked: false }` like `odaBasket`.
- [x] **Oda Product on the Ware.** Rules: an update branch where only `oda` changes, and `oda` is either absent or a map of exactly `id` (int), `name` and `packText` (strings, 1–200). `useWares` reads `oda`. No migration (ADR 0003): no existing Ware has one. Rules tests: setting, replacing and removing `oda`, and rejecting other keys or bad shapes alongside it.
- [x] **Commit: Oda search and the Ware's Oda Product.** *(manual)* (security rules; review first)
- [x] **Oda line and search on Home.** The Oda line in the open Entry, the search combobox, picking, "brukt av «…»", "Fjern Oda-vare", "Koble til Oda" when not linked, and pasted URLs matched by exact id.
- [x] **Try it on the dev server**, iterating on feedback: search "melk" from an Entry, pick, open the product on oda.com, "Flere...", paste a URL, try a product already on another Ware, remove it. Skipped in AFK mode. *(user)*
- [x] **Tests.** The fake Oda answers `product_search` with a fixed list. One e2e spec: pick from search, see the Oda line, "Flere...", a pasted URL picks its product, "brukt av" blocks, "Fjern Oda-vare". No test reaches oda.com.
- [x] **Commit: pick Oda Products for Wares on Home.** *(manual)* (user-visible; review first)
- [ ] **Move plan to `plans/done/`.** `git mv plans/active/24-oda-products-on-wares.md plans/done/24-oda-products-on-wares.md`, and remove it from **Now** in `ROADMAP.md`.
- [ ] **Commit: complete Oda Products on Wares milestone.** *(auto)*

## Done when

- In `npm run dev`, a Family Member opens an Entry on Home, searches Oda (or pastes a product link), picks a product, and sees it on the Entry with a link that opens it on oda.com.
- A product already on another Ware can't be picked, and a Ware's Oda Product can be replaced or removed.
- Rules tests cover the `oda` field, and the e2e spec passes against the fake Oda.

## Notes

- 2026-10-28: Planned after a grilling session. Pasted URLs go through `product_search`, not Oda's unofficial `/api/v1/products/<id>/`, to stay on the MCP route (ADR 0005). A paste only picks on an exact id match.
- 2026-10-28: `product_search` takes `queries` and `size`, and answers `{ result: [{ query, hasMore, products }] }` with prices as strings ("31.90"), checked against oda.com on the dev server.
