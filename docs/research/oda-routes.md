# Oda routes: survey

Researched 2026-10-28, for plan 18 (`plans/active/18-oda-exploration.md`), step "Survey".

The question: how can Kraft fill an Oda basket from Groceries without ever placing the order? The Family Member places the order. Kraft also needs to store an Oda article reference (and probably pack size) on a Ware.

Nothing here involved signing in, adding to a basket, or ordering. Probes were anonymous `curl` calls to public endpoints. "Inference" marks my reading, not what a source says.

## Summary

**Viable, to prototype:**

- **Oda's MCP server (`https://oda.com/mcp`).** Official, OAuth 2.1 with dynamic client registration. The endpoint sends no CORS headers, so a browser can't call it. Kraft would need a server (a Cloud Function, which needs the Blaze plan) or a native app as the MCP client. The tool list is behind sign-in. Most promising if its tools include search, add to cart, read and clear cart.
- **Browser extension.** Uses the Family Member's own oda.com session and the same JSON endpoints oda.com uses. Works on desktop Chrome/Firefox, and on iOS only as a Safari extension inside an iOS app. Not on Chrome for Android. Uses an undocumented API.
- **Native app.** Can call oda.com without CORS limits, either as an MCP client (OAuth, PKCE, public client) or with the user's session. Biggest build and distribution cost.

**Partly useful, not a basket route:**

- **Kassalapp API.** Covers Oda products with daily prices, pack size and the oda.com URL (which holds Oda's product id). It has no Oda basket. Fine for search and price, not for filling the basket. Hobby key is free but not for commercial use. CORS is open, but a key on the device is shared by everyone who can read it.

**Dead:**

- **Calling oda.com directly from the Kraft PWA.** Oda's own JSON API and the MCP endpoint send no `Access-Control-Allow-Origin`, and the session cookie can't be sent cross-site. A plain web page on Kraft's origin can't read or fill the basket. This kills "MCP from the browser" and "unofficial API from the browser". It does not kill the MCP route as such.

**Settled by the signed-in prototype** (see "Prototype: Oda's MCP server"):

- The MCP server has search, add, remove, read and clear cart, and no checkout tool.
- Registration accepts any client with a `127.0.0.1` redirect, no allowlist.
- Access tokens last an hour; refresh tokens rotate.
- The MCP product id is the id in `oda.com/no/products/<id>-...`, so one stored id works for every route.

**Still open:**

- Whether registration accepts an HTTPS redirect such as a Cloud Function URL, or a native app scheme.
- Refresh token lifetime, and any rate limit.
- Whether an extension's background `fetch` to `oda.com/api/v1/cart/...` carries the user's session cookie and passes the CSRF check. Only matters if the MCP route falls through.

## Prototype: Oda's MCP server

Tried 2026-10-28 with `scratch/oda-mcp.mjs` (not committed), a Node MCP client with no dependencies. The user signed in on oda.com in the browser. The Family's cart was empty before and after; nothing was ordered.

- **Registration.** `POST https://oda.com/o/register/` with `redirect_uris: ["http://127.0.0.1:8765/callback"]` and `token_endpoint_auth_method: "none"` returned a `client_id`, a `registration_access_token` and a `registration_client_uri` (RFC 7592 client management). No Oda account or approval was needed. Whether HTTPS redirects (a Cloud Function URL) or a native app scheme are accepted: not tried yet.
- **Sign-in.** Authorization code with PKCE `S256`, `resource=https://oda.com/mcp`, scope `mcp`. The user signs in and approves on oda.com; the code comes back to the local redirect.
- **Tokens.** Access token lasts 3600 s. A refresh token comes with it. Refreshing returns a new access token and a new refresh token (rotation), but the old refresh token still worked once more right after. Refresh token lifetime: not found.
- **Server.** `Oda MCP Server` 1.2.0, protocol `2025-06-18`, Streamable HTTP with an `Mcp-Session-Id`. Its instructions say: "Checkout and payment happen in the shop, not through MCP." The cart's `url` (`https://oda.com/no/cart/`) is where the Family Member reviews and pays.
- **Tools.** 26. For filling a basket:
  - `product_search`: up to 10 queries per call, `page` and `size` (max 20). Each product has `id`, `name`, `description` (pack text, "1% fett, 1 l"), `price`, `unitPrice`, `unitName`, `brand`, `brandId`, `url`, `availability` (`isAvailable`, `code`).
  - `get_cart`: lines grouped by source, totals with fees and surcharge, delivery address, delivery slot, `url`.
  - `manipulate_cart`: a list of operations, each on one `productId`, `recipeId`, `productListId` or `orderNumber`. `quantity` is a delta, never a target; negative removes and stops at zero.
  - `clear_cart`: empties the whole cart.
  - Others: `recipe_search`, `get_category`, `get_brand`, `likely_to_buy`, `unique_for_you`, `similar_and_related_products`, shopping and dinner lists (`get_product_lists`, `get_dinner_lists`, `get_product_list`, `create_product_list`, `manipulate_product_list`, `delete_product_list`), `get_liked_recipes`, `get_purchased_recipes`, `get_orders`, `get_order`, `order_tracking`, `get_delivery_addresses`, `get_delivery_slots`, `select_delivery_slot`, `feedback`.
  - No checkout, payment or place-order tool. `select_delivery_slot` changes the cart's slot but doesn't order.
- **Round trip.** `product_search` for "lettmelk" gave product `430` (Tine Lettmelk 1% fett, 1 l). `manipulate_cart` +1 added it, `get_cart` showed it, `manipulate_cart` -1 removed it. The prototype didn't call `clear_cart`, since it would also wipe whatever the Family already had in the cart.
- **Product id.** The MCP `id` is the number in the oda.com product URL (`430` in `https://oda.com/no/products/430-tine-tine-lettmelk-1-fett/`) and the `id` in Oda's own `GET /api/v1/products/430/`. So one stored id works for MCP, the unofficial API and Kassalapp's `url`.
- **Rate limits.** None hit or advertised.

### What this means

The MCP server covers everything the basket needs: search with pack size, add by product id, read the cart, remove. Kraft never has to check out, and can't. The extension and native app aren't needed for capability. The one open question is where the MCP client lives: the PWA can't call `oda.com/mcp` (no CORS), so a Cloud Function needs its HTTPS callback accepted by registration.

## What a Ware would store

Every route that reaches the basket keys products by Oda's numeric product id (`product_id` in the unofficial cart API, `id` in product JSON, the number in `https://oda.com/no/products/132-...`). Sources below. Inference: store the Oda product id on the Ware, plus the `name_extra` text ("0,1% fett, 1 l") or a parsed pack size for the AI's pack count. The URL is enough to recover the id.

## 1. Oda's MCP server

### What the endpoints say

Probed anonymously on 2026-10-28:

- `POST https://oda.com/mcp` without a token returns `401` with `WWW-Authenticate: Bearer resource_metadata="https://oda.com/.well-known/oauth-protected-resource/mcp"`. `GET` returns `405`. `OPTIONS` returns `405` with `allow: POST, DELETE`, and no CORS headers.
- [`/.well-known/oauth-protected-resource/mcp`](https://oda.com/.well-known/oauth-protected-resource/mcp):
  `{"resource":"https://oda.com/mcp","authorization_servers":["https://oda.com/o"],"scopes_supported":["mcp"],"bearer_methods_supported":["header"]}`
- [`/.well-known/oauth-authorization-server`](https://oda.com/.well-known/oauth-authorization-server): issuer `https://oda.com/o`, `authorization_code` and `refresh_token` grants, PKCE `S256`, a `registration_endpoint` (`https://oda.com/o/register/`), `token_endpoint_auth_methods_supported` includes `none` (public clients), `client_id_metadata_document_supported: false`.
- `/.well-known/oauth-protected-resource` (no path) and `/.well-known/openid-configuration` return `404`.

This matches the [MCP authorization spec](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization): the MCP client is the OAuth client, uses PKCE, discovers the server through protected resource metadata, may register itself with dynamic client registration (RFC 7591), and sends `Authorization: Bearer <token>` on every request. Redirect URIs must be `localhost` or HTTPS.

### Points

- **Auth model.** OAuth 2.1 authorization code with PKCE, scope `mcp`. The Family Member signs in on oda.com and approves. Dynamic registration is offered, so no Oda developer account seems needed. Whether registration accepts any redirect URI: not found (needs a real registration; not done).
- **Where secrets live.** Access and refresh tokens belong to whoever is the MCP client. Inference: on a Cloud Function, tokens live server-side (e.g. Firestore, locked by rules, or Secret Manager). In a native app, on the device.
- **Product search, read by id, basket.** The tool list needs a token, so: not found. Oda publishes no docs page for the MCP server that I could find.
  - Hint, not proof: Glama lists a server by `kolonialno` (Oda's GitHub org) with tools `search_products`, `get_product`, `get_related_products`, `get_cart`, `add_to_cart`, `remove_from_cart`, `clear_cart`, `get_orders`, `get_order`, and no checkout tool ([Glama listing](https://glama.ai/mcp/servers/kolonialno/oda-mcp)). That was a local `uvx` server with email and password, not `oda.com/mcp`. Its repo, `https://github.com/kolonialno/oda-mcp`, returns 404 today. I could not verify its source or whether the hosted server shares its tools.
- **Terms of use.** Oda's terms ([Betingelser](https://oda.com/no/legal/betingelser/), updated 20 October 2026) don't mention the MCP server, APIs, or automation. They say you are responsible for all activity on your account, and must not share your username or password. Inference: OAuth avoids sharing the password, so the MCP route sits best with the terms.
- **Cost and rate limits.** Not found.
- **Browser (CORS).** No. `/mcp` and `/o/token/` send no `Access-Control-Allow-Origin`, for any origin I tried (a `web.app` origin, `claude.ai`, `chatgpt.com`, `oda.com`). Only the metadata document allows `*`. So Kraft needs a server or a native app as the MCP client.
- **A server for Kraft.** Deploying Cloud Functions needs the Blaze plan ([Firebase docs](https://firebase.google.com/docs/functions/get-started): "to deploy functions, your project must be on the Blaze pricing plan"). This is the ADR 0004 revisit the plan mentions.

### Verdict

Viable. The most official route. Prototype first: register a client, have the user sign in, list tools, then search, add one item, read the cart, clear it.

## 2. Kassalapp API (kassal.app/api)

### Points

- **Auth model.** API key from [kassal.app/profil/api](https://kassal.app/profil/api), sent as `Authorization: Bearer <key>` ([FAQ](https://kassal.app/api/faq); [OpenAPI spec](https://kassal.app/docs/api.json), `securitySchemes.http`, scheme `bearer`). Rate limits are per account, not per key ([FAQ](https://kassal.app/api/faq)). No guidance on keeping keys out of browsers: not found.
- **Oda coverage.** The FAQ lists Oda among chains with daily price updates ([FAQ](https://kassal.app/api/faq)). The docs' example product is an Oda product: `store.code: "ODA_NO"`, `url: "https://oda.com/no/products/12592-pepsi-max-pepsi-max-4-x-15l/"`, `weight: 6`, `weight_unit: "l"`, `current_price: 74.9` ([docs](https://kassal.app/api/docs)). The `store` search filter exists, with examples `SPAR_NO, MENY_NO, KIWI` ([OpenAPI spec](https://kassal.app/docs/api.json)).
- **Oda's product id.** Kassalapp's `id` is its own. Oda's id is not a field. Inference: it is the number in the `url` path (`12592`). This matches Oda's own product URL format (`front_url` in Oda's product JSON, below).
- **Search by name.** `GET /api/v1/products?search=...&store=ODA_NO`. Results give `id`, `name`, `brand`, `vendor`, `ean`, `url`, `current_price`, `current_unit_price`, `weight`, `weight_unit`, `store`. Availability (in stock): not found.
- **Read by id.** `GET /api/v1/products/id/{id}` (Kassalapp id), or `GET /api/v1/products/find-by-url/single?url=` with an oda.com URL ([OpenAPI spec](https://kassal.app/docs/api.json)).
- **Basket.** None for Oda. The spec has `/shopping-lists`, which are Kassalapp's own lists for the signed-in Kassalapp user ([OpenAPI spec](https://kassal.app/docs/api.json)).
- **Freshness.** Prices are fetched once a day from about 09:00 ([FAQ](https://kassal.app/api/faq)). Inference: price and stock may be a day old.
- **Terms.** Hobby: free, 60 requests/minute, no commercial use. Bedrift: 750 NOK/month, no rate limit ([kassal.app/api](https://kassal.app/api)). "Tjener du penger på det, er det kommersielt." Caching and storing data is allowed; publishing raw dumps is not ([FAQ](https://kassal.app/api/faq)). Inference: Kraft is a free family app, so Hobby fits.
- **Browser (CORS).** Yes. Probed 2026-10-28: preflight to `/api/v1/products` returns `access-control-allow-origin: *`, `access-control-allow-headers: authorization`. Inference: a key in the PWA is readable by anyone who can open the app. With Hobby's per-account limit that's a low-stakes leak, but it's still the Family's key. Storing the key per device ("keys on the device", as the vision says) limits who sees it.

### Verdict

Not a basket route. Useful as a search and price source if the basket route's own search turns out weak. Does not need hands-on prototyping unless the chosen route lacks search.

## 3. Browser extension

### Points

- **Auth model.** None of its own. The extension rides the Family Member's oda.com session cookie. Kraft never sees the password.
- **How it reaches oda.com.** Extension service workers and extension pages "can talk to remote servers outside of its origin, as long as the extension requests host permissions". Content scripts don't get this: "Cross-origin requests are always treated as such in content scripts" ([Chrome: network requests](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)).
- **How Kraft talks to it.** With `externally_connectable.matches` set to Kraft's origin, the Kraft page can call `chrome.runtime.sendMessage` to the extension. Without it, "no web pages can connect" ([Chrome: externally_connectable](https://developer.chrome.com/docs/extensions/reference/manifest/externally-connectable)).
- **Search, read by id, basket.** Through Oda's unofficial JSON API (next section). Anonymous probes on 2026-10-28 show product search and product read need no login: `GET https://oda.com/api/v1/search/mixed/?q=melk&type=product` and `GET https://oda.com/api/v1/products/132/` both return JSON. Product JSON has `id`, `full_name`, `name_extra` ("0,1% fett, 1 l"), `gross_price`, `gross_unit_price`, `unit_price_quantity_abbreviation`, `availability.is_available`, `front_url`.
- **Cookies.** Oda's `csrftoken` cookie is `SameSite=lax` (probed). The session cookie's attributes need a sign-in: not checked. Whether an extension's background fetch carries the cookie: open question for the prototype.
- **Platforms.** Safari web extensions run on macOS, iOS and visionOS, and ship inside an app ([Apple: Safari web extensions](https://developer.apple.com/documentation/safariservices/safari-web-extensions)). Chrome for Android doesn't run extensions: not verified against a Google source. Inference: phone use on iOS means building and shipping an iOS app anyway.
- **Terms.** Oda's terms don't mention automation or extensions ([Betingelser](https://oda.com/no/legal/betingelser/)). Content on the site "ikke kan lastes ned, kopieres eller brukes på noen annen måte" without Oda's written consent (same page, "Immaterielle rettigheter"). Inference: grey area. Acting in the user's own session for their own basket is close to normal use, but the API is undocumented and can change without notice.
- **Cost.** Chrome Web Store has a one-time developer fee; an unpacked extension for one family needs none. Not verified.
- **Rate limits.** Oda's [robots.txt](https://oda.com/robots.txt) asks scrapers for a `bot` User-Agent and backoff on 429/5xx, and disallows `/*/cart/...` page paths for crawlers. No API rate limit found.

### Verdict

Viable on desktop. Weak on phones. Fragile, since it depends on an undocumented API.

## 4. Native app on Firestore

### Points

- **Auth model.** Two options. (a) MCP client: OAuth with PKCE as a public client (`token_endpoint_auth_methods_supported` includes `none`, see route 1), tokens on the device. Needs dynamic registration to accept a `localhost` or app redirect: open question. (b) Oda session in an in-app web view, then the unofficial API. Inference: (b) has the same fragility as the extension.
- **CORS.** Not an issue. CORS is a browser rule; native HTTP clients don't apply it. Inference, standard behaviour.
- **Firestore.** Firebase has native SDKs for iOS and Android ([Firestore quickstart](https://firebase.google.com/docs/firestore/quickstart)). Inference: the app reads Groceries and Wares from the same Firestore data as the PWA.
- **Search, read by id, basket.** Same as route 1 or the unofficial API, depending on (a) or (b).
- **Cost.** Apple Developer Program and Google Play developer accounts cost money; not verified here. Plus building and maintaining a second client.
- **Terms.** As routes 1 and 3.

### Verdict

Viable, but the most work. Mainly interesting as the MCP client if Oda's registration won't accept a Cloud Function, or as the iOS container a Safari extension needs anyway.

## Unofficial Oda API

**Unofficial. Undocumented by Oda.** Source: community project [gbbirkisson/mcp-oda](https://github.com/gbbirkisson/mcp-oda), its notes in [`ODA_API.md`](https://github.com/gbbirkisson/mcp-oda/blob/main/ODA_API.md). It logs in with email and password (`auth login --user <email> --pass-stdin`), which Oda's terms discourage (don't share your password). Forks exist, e.g. [agfagerbakk/mcp-oda](https://github.com/agfagerbakk/mcp-oda) and [HRB869/mcp-oda](https://github.com/HRB869/mcp-oda) (hosted, behind a secret URL path).

What `ODA_API.md` says:

- Cart: `GET https://oda.com/api/v1/cart/`. Add: `POST https://oda.com/api/v1/cart/items/` with `{"items": [{"product_id": 132, "quantity": 1}]}`. `quantity` is a delta; negative removes. Clear: `POST https://oda.com/api/v1/cart/clear/` with `{}`.
- Mutations need session cookies and an `X-CSRFToken` header from the `csrftoken` cookie.
- Search via page hydration data at `https://oda.com/no/search/products/?q=...`, or `GET /api/v1/search/mixed/`.
- Also: orders, saved product lists, delivery slots. No checkout endpoint is documented.

Checked anonymously on 2026-10-28: `GET /api/v1/products/132/`, `GET /api/v1/search/mixed/?q=melk&type=product` and `GET /api/v1/cart/` (empty, anonymous) all return JSON. None send `Access-Control-Allow-Origin`. `OPTIONS /api/v1/cart/items/` returns `200` with no CORS headers.

## Sources

- Oda: [`/.well-known/oauth-protected-resource/mcp`](https://oda.com/.well-known/oauth-protected-resource/mcp), [`/.well-known/oauth-authorization-server`](https://oda.com/.well-known/oauth-authorization-server), [Betingelser](https://oda.com/no/legal/betingelser/), [robots.txt](https://oda.com/robots.txt), and anonymous probes of `https://oda.com/mcp`, `https://oda.com/o/token/`, `https://oda.com/api/v1/...`.
- [MCP authorization spec, 2025-06-18](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization).
- Kassalapp: [kassal.app/api](https://kassal.app/api), [docs](https://kassal.app/api/docs), [FAQ](https://kassal.app/api/faq), [OpenAPI spec](https://kassal.app/docs/api.json), and a CORS probe.
- Chrome: [network requests](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests), [externally_connectable](https://developer.chrome.com/docs/extensions/reference/manifest/externally-connectable).
- Apple: [Safari web extensions](https://developer.apple.com/documentation/safariservices/safari-web-extensions).
- Firebase: [Cloud Functions get started](https://firebase.google.com/docs/functions/get-started), [Firestore quickstart](https://firebase.google.com/docs/firestore/quickstart).
- Community (unofficial): [gbbirkisson/mcp-oda](https://github.com/gbbirkisson/mcp-oda), [Glama: kolonialno/oda-mcp](https://glama.ai/mcp/servers/kolonialno/oda-mcp).
