# Oda exploration

**Status:** ready-for-agent · enhancement

Eighteenth milestone. Decide how Kraft fills an Oda basket from Groceries, by trying the candidate routes hands-on. The choice can shape the architecture (a server, keys on the device, a browser extension, a native app), so it's made with a working understanding of each route, not from docs alone. This plan builds nothing that ships. Filling the basket is a roadmap idea that becomes a plan once this ADR lands. See `docs/vision/groceries-and-meals.md#ordering-from-oda-parked`.

## Scope

- Try each candidate route with a throwaway prototype: search for a product, read a Ware's likely Oda reference, add to the basket.
  - Oda's MCP server (https://oda.com/mcp).
  - https://kassal.app/api, with keys stored on the device.
  - A browser extension.
  - A native app on Firestore.
- About two sessions per route. Drop a route as soon as it's clearly dead.
- An ADR picking the route.

## Out of scope

- Building the basket feature.
- Changing Wares or Staples in the app (plan 17's shape stands until the follow-up plan).
- Placing an order, ever.

## Prerequisites (user)

- The Family's Oda login. The user signs in wherever a login is needed. Claude never handles the password.

## Steps

- [x] **Survey.** Use the `research` skill to collect what each route offers: auth, product search, basket API, terms of use, cost, and whether it can be called from a browser. Write the findings to `docs/research/oda-routes.md`. Mark routes that are clearly dead.
- [x] **Commit: Oda route survey.** *(auto)*
- [ ] **Prototype the remaining routes,** one step each, rewritten after the survey. Each prototype lives outside `src/`, under `scratch/` (gitignored), and is deleted afterwards. Record what worked and what didn't in the research file. Never place an order: stop at a filled basket and empty it again. *(user signs in)*
- [ ] **Commit: prototype findings.** *(auto)*
- [ ] **ADR.** `docs/adr/0005-oda-route.md`: the chosen route and why, the options rejected, what a Ware needs to hold for Oda (an Oda reference? pack size?), and the security revisit from ADR 0004, since ordering spends money: App Check, a server, where keys live, who can fill the basket.
- [ ] **Commit: ADR for the Oda route.** *(manual)* (architecture and security decision; review first)
- [ ] **Roadmap.** Turn the Oda idea in `ROADMAP.md` into one line pointing at the ADR. Update the vision's Oda section ("Technical route: open").
- [ ] **Move plan to `plans/done/`.** `git mv plans/active/18-oda-exploration.md plans/done/18-oda-exploration.md`, and remove it from **Now** in `ROADMAP.md`.
- [ ] **Commit: complete oda-exploration milestone.** *(auto)*

## Done when

- An accepted ADR names the route for filling an Oda basket, says what Wares need for it, and settles the ADR 0004 revisit for ordering.
- No order was placed, and no prototype code is left in the repo.

## Notes

- 2026-10-23: Comes after Iverksett (plan 17), so Wares exist. If Ware's shape needs changing for Oda, a migration script handles it (ADR 0003). The Family has an Oda login.
- 2026-10-28: Survey done (`docs/research/oda-routes.md`). Oda's MCP server is official (OAuth 2.1, PKCE, dynamic client registration) but sends no CORS headers, so the PWA can't call it or oda.com directly: the MCP client must be a server (Cloud Function, Blaze plan) or a native app. A browser extension works on desktop only. Kassalapp has Oda products and ids but no basket. The tool list, redirect URIs for registration and token lifetimes need the signed-in prototype.
