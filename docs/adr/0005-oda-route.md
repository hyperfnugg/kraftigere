---
status: accepted
---

# Oda through its MCP server, with a Cloud Function as the client; Wares hold an Oda product id

Kraft fills the Family's Oda basket through Oda's official MCP server (`https://oda.com/mcp`). The Kraft PWA can't call it, since Oda sends no CORS headers, so a Cloud Function is the MCP client. One Family Member links the Family's Oda account once: the function registers itself with Oda (dynamic client registration accepts its HTTPS callback), the Family Member signs in on oda.com, and the function keeps the tokens. After that any Family Member can fill the basket from Groceries. The Family Member opens the cart link and places the order in Oda. Kraft can't order: the MCP server has no checkout tool. Findings are in `docs/research/oda-routes.md`.

A Ware chosen for Oda holds Oda's numeric product id, the number in `https://oda.com/no/products/<id>-...`, which is also the MCP `productId` and the id in Oda's own API. Next to it the Ware keeps the product's name and pack text as Oda gave them when it was chosen ("Tine Lettmelk 1% fett", "1% fett, 1 l"), so the AI can count packs without a lookup. The MCP server has no tool to read a product by id, and the cart shows availability after adding, which is when Kraft falls back to Substitutes.

**Security, revisiting ADR 0004.** Filling the basket doesn't spend money. Only the Family Member's own checkout in Oda does, after seeing the cart. What the tokens do allow is filling or emptying the cart, changing the delivery slot, editing saved lists, and reading order history and the delivery address. So:

- Tokens live only in the function's reach: a Firestore document the rules deny to every client, read and written by the Admin SDK. They never reach a device.
- The function is callable only by signed-in Family Members on the allowlist, with App Check enforced on it. App Check already loads lazily for Gemini, so this adds nothing at launch.
- The function exposes a few narrow operations (search, add to cart, read cart, remove what it added), not the MCP server. It removes from the cart only when an Oda Order is Cancelled, and only the packs the Oda Order added. It never empties the cart, and never touches delivery slots, lists or orders.
- Firestore and Auth stay unenforced for App Check, as ADR 0004 says. Ordering doesn't change that, since Kraft can't order.

## Considered Options

- **Calling oda.com from the PWA.** Not possible: no CORS on `/mcp` or Oda's JSON API, and the session cookie isn't sent cross-site.
- **A browser extension in the Family Member's oda.com session.** Rejected: desktop only (iOS needs a Safari extension inside an app; Android Chrome has none) and it depends on Oda's undocumented API.
- **A native app as the MCP client.** Rejected: a second client to build and ship, and Oda refuses custom-scheme redirects, so it would also need HTTPS app links.
- **Kassalapp.** Not a basket route: it has Oda's products but no Oda basket. Not needed for search either, since `product_search` gives price, pack text and availability.
- **Oda's unofficial API with email and password**, as community MCP servers do. Rejected: Oda's terms say not to share the password, and the API can change without notice.

## Consequences

- The Firebase project moves to the Blaze plan to deploy functions. That also makes Firestore and Auth quota abuse by scripts (ADR 0004) cost money rather than stop the app. Spending is limited in three layers:
  - **Soft cap, $20 a month.** A project budget with alert emails at 50%, 90% and 100%. A Family Member then looks into it.
  - **Spend caps** on the Gemini API and Cloud Functions, $10 a month each. Google pauses the service when its cap is passed, and deletes nothing. Firestore and Auth can't have spend caps.
  - **Kill switch, $200 a month.** A second budget publishes to Pub/Sub, and a small function removes the project's billing account when it's passed. Every paid service stops, and Google warns that resources might be irretrievably deleted. At that level, losing the data is accepted, as it already is for a compromised account (ADR 0004). Restoring service means relinking billing by hand.
  - None of these are instant: budgets lag real costs, by up to a day.
- The Oda function has a low maximum instance count, so a flood of calls queues rather than scales.
- The Ware's shape gets an optional Oda product id, name and pack text. Rules and a migration follow ADR 0003, though no existing Ware needs one.
- If the Oda link stops working (tokens revoked, refresh token expired), a Family Member links again. Refresh tokens rotate; their lifetime is unknown.
- Kraft depends on Oda keeping the MCP server and its tools. The server version is in its answers (1.2.0 today).

## Amendments

- 2026-10-28: Cancelling an Oda Order empties the whole Basket, not only what Kraft added, so the function may call `clear_cart`. Two warnings guard it: one at "Start odabestilling" if the Basket isn't empty, and one at "Avbryt" if the Basket holds anything the Oda Order didn't put there. Before this, the function only added and never removed. See the vision's Oda section.
- 2026-10-30: Reversed: cancelling takes out exactly the packs the Oda Order added, with negative `manipulate_cart` quantities, which stop at zero. The rest of the Basket stays, so the function doesn't call `clear_cart`, and neither warning is needed. Avbryt asks before it acts.
- 2026-11-04: The AI doesn't count packs. It reads a product's Pack Size from its name and pack text, the Ware keeps that next to them as optional grams and pieces per pack, and the app works out the Pack Count. So the AI is asked once per product, and "enough for the dishes" doesn't depend on the model's arithmetic.
- 2026-11-05: There's no fallback to stored Substitutes. Filling reads availability from `manipulate_cart`'s answer, which is the full cart, takes unavailable packs back out, and lets the Family Member choose a Substitute for that Oda Order only. An Oda Product that's `not_for_sale` leaves its Ware. Search leaves such a product out and the MCP server can't read one by id, so filling is the first Kraft hears of it. Oda's public product JSON does show it, but isn't used: the same undocumented-API risk this ADR avoids, for something rare that filling catches anyway.
- 2026-11-06: No spend cap on Cloud Functions; the Gemini API keeps its own. A Functions cap also covers the kill switch, which is a function in the same project: a flood could pause it while Firestore, which has no cap, keeps costing money. Functions costs are held back by the maximum instance count, which applies per function, and caught by the soft budget and the kill switch. Linking billing also moves all Gemini use to pay-as-you-go, so the meal planner starts costing money, under its cap. The project was found on Spark with billing off, so all of this happens in plan 29.
- 2026-11-06: Filling puts in one pack of each Oda Product, and the function then raises counts to what the dishes need once the Order Summary opens. When a Family Member changes a count there it also lowers them, only ever by packs Kraft put in. Besides Cancelled, that's the only time it removes packs, apart from taking unavailable ones back out while filling. See plan 30.
- 2026-11-09: The kill switch was tested for real (plan 29). Billing is on a Kraft-only account in NOK, so the budgets are 200 NOK (soft) and 2,000 NOK (kill switch). An over-limit message removed billing within a second. For about an hour unlinked, the budgets stayed, and `killSwitch` showed state `UNKNOWN` until billing was relinked, then `ACTIVE` again. Relinking by hand restored everything. Firestore was identical before and after, though it held only four documents, and App Check on AI Logic stayed Enforced. Google's warning that resources might be irretrievably deleted didn't come true in an hour. Longer gaps are untested, and the earlier acceptance of losing the data stands. firebase-tools doesn't grant a custom trigger service account `roles/run.invoker` on its own Cloud Run service, so `kill-switch` has it on the `killswitch` service only, granted by hand. Redeploys keep it: firebase-tools 15.34.1 sets invoker bindings only when it creates a function, and on update only for HTTPS functions with an explicit invoker. New Gemini billing accounts default to Prepay, so the prepaid balance in AI Studio is a hard limit too.
