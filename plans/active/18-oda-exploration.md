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
- [x] **Prototype: Oda's MCP server.** `scratch/oda-mcp.mjs`, a Node script with no dependencies: register a client, sign in through the browser with PKCE and a `127.0.0.1` redirect, list the tools, then search, add one item, read the basket and empty it. Answers whether registration takes a local redirect, which tools exist, and how long tokens last. Tools that could order are refused by the script. *(user signs in)*
- [x] **Check registration accepts an HTTPS callback** (a Cloud Function URL) and a native app scheme: register a throwaway client for each, then delete it through its `registration_client_uri`. *(user approved)*
- [x] **Prototype the browser extension or native app only if the MCP server falls short** (it didn't; skipped) (no basket tools, or registration refuses every redirect Kraft could use). Kassalapp has no basket, so it gets no prototype. Record what worked and what didn't in the research file. Never place an order: stop at a filled basket and empty it again. *(user signs in)*
- [x] **Commit: prototype findings.** *(auto)*
- [x] **ADR.** `docs/adr/0005-oda-route.md`: the chosen route and why, the options rejected, what a Ware needs to hold for Oda (an Oda reference? pack size?), and the security revisit from ADR 0004, since ordering spends money: App Check, a server, where keys live, who can fill the basket.
- [x] **Commit: ADR for the Oda route.** *(manual)* (architecture and security decision; review first)
- [ ] **Roadmap.** Turn the Oda idea in `ROADMAP.md` into one line pointing at the ADR. Update the vision's Oda section ("Technical route: open").
- [ ] **Clean up the prototype.** Delete the `Kraft prototype` client on oda.com through its `registration_client_uri`, and delete `scratch/`.
- [ ] **Move plan to `plans/done/`.** `git mv plans/active/18-oda-exploration.md plans/done/18-oda-exploration.md`, and remove it from **Now** in `ROADMAP.md`.
- [ ] **Commit: complete oda-exploration milestone.** *(auto)*

## Done when

- An accepted ADR names the route for filling an Oda basket, says what Wares need for it, and settles the ADR 0004 revisit for ordering.
- No order was placed, and no prototype code is left in the repo.

## Notes

- 2026-10-23: Comes after Iverksett (plan 17), so Wares exist. If Ware's shape needs changing for Oda, a migration script handles it (ADR 0003). The Family has an Oda login.
- 2026-10-28: Survey done (`docs/research/oda-routes.md`). Oda's MCP server is official (OAuth 2.1, PKCE, dynamic client registration) but sends no CORS headers, so the PWA can't call it or oda.com directly: the MCP client must be a server (Cloud Function, Blaze plan) or a native app. A browser extension works on desktop only. Kassalapp has Oda products and ids but no basket. The tool list, redirect URIs for registration and token lifetimes need the signed-in prototype.
- 2026-10-28: MCP prototype done. 26 tools, including search, `manipulate_cart` (deltas by product id), `get_cart`, `clear_cart`; no checkout. Local-redirect registration works without approval; access tokens last an hour and refresh tokens rotate. MCP product id = the oda.com URL id. Prototype removed only what it added rather than `clear_cart`, since clearing would wipe a real cart.
- 2026-10-28: Registration accepts HTTPS redirects (Cloud Function, `web.app`), `localhost` and even plain `http`; refuses custom app schemes. Throwaway clients deleted. The MCP server doesn't fall short, so no extension or native prototype. The prototype's own client (`Kraft prototype`, 127.0.0.1) is kept until the ADR lands, then deleted.
