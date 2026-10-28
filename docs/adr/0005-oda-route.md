---
status: accepted
---

# Oda through its MCP server, with a Cloud Function as the client; Wares hold an Oda product id

Kraft fills the Family's Oda basket through Oda's official MCP server (`https://oda.com/mcp`). The Kraft PWA can't call it, since Oda sends no CORS headers, so a Cloud Function is the MCP client. One Family Member links the Family's Oda account once: the function registers itself with Oda (dynamic client registration accepts its HTTPS callback), the Family Member signs in on oda.com, and the function keeps the tokens. After that any Family Member can fill the basket from Groceries. The Family Member opens the cart link and places the order in Oda. Kraft can't order: the MCP server has no checkout tool. Findings are in `docs/research/oda-routes.md`.

A Ware chosen for Oda holds Oda's numeric product id, the number in `https://oda.com/no/products/<id>-...`, which is also the MCP `productId` and the id in Oda's own API. Next to it the Ware keeps the product's name and pack text as Oda gave them when it was chosen ("Tine Lettmelk 1% fett", "1% fett, 1 l"), so the AI can count packs without a lookup. The MCP server has no tool to read a product by id, and the cart shows availability after adding, which is when Kraft falls back to Substitutes.

**Security, revisiting ADR 0004.** Filling the basket doesn't spend money. Only the Family Member's own checkout in Oda does, after seeing the cart. What the tokens do allow is filling or emptying the cart, changing the delivery slot, editing saved lists, and reading order history and the delivery address. So:

- Tokens live only in the function's reach: a Firestore document the rules deny to every client, read and written by the Admin SDK. They never reach a device.
- The function is callable only by signed-in Family Members on the allowlist, with App Check enforced on it. App Check already loads lazily for Gemini, so this adds nothing at launch.
- The function exposes a few narrow operations (search, add to cart, read cart), not the MCP server. It never calls `clear_cart`, delivery slots, lists or orders. It only adds, so it never removes what the Family put in the cart themselves.
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
