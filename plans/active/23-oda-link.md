# Oda Link

**Status:** ready-for-agent · enhancement

Twenty-third milestone and the first Oda one, on the long-lived `oda` branch ([ADR 0005](../../docs/adr/0005-oda-route.md)). The Family links its Oda account, and Shop shows how much is in the Basket. Everything runs locally: the Cloud Function runs in the Functions emulator inside `npm run dev` and talks to the real oda.com, so dev reads the Family's real Basket. Nothing deploys and nothing is paid for until the "Oda in production" plan in `ROADMAP.md`. Plan 23 doesn't change Wares or fill the Basket. Those are the next plans.

## Scope

- A `functions/` folder (TypeScript, region `europe-west1`, a low max instance count) that the Functions emulator runs in `npm run dev`.
- Linking: a Family Member taps "Koble til Oda", signs in and approves on oda.com, and lands back on Shop. The function registers itself with Oda, runs authorization code with PKCE and keeps the tokens out of every client's reach.
- Reading the Basket, with token refresh, so Shop shows "Oda: 4 varer i handlekurven".
- In dev, the Oda client registration and tokens survive a restart of `npm run dev`.

## Out of scope

- App Check on the function, Blaze, deploying and the production Oda client: the "Oda in production" plan.
- Oda Products on Wares, searching, and filling or emptying the Basket.
- Unlinking. A broken link (refresh fails) shows "Koble til Oda" again.
- Several Families. Kraft has one Family (`config/family`), so it has one Oda Link.

## Prerequisites (user)

- The Family's Oda login. The user signs in on oda.com. Claude never handles the password.

## Steps

- [ ] **Functions in `npm run dev`.** Scaffold `functions/` with its own `package.json` and `tsconfig.json` (Node 22, `firebase-functions`, `firebase-admin`). Add `functions` to `firebase.json` and its emulator port, and to the `emulators:exec` in `npm run dev`, with a TypeScript watch build so edits reload. Give `firebase.test.json` its own functions port, separate from dev's. Extend `tsc -b` and lint to cover `functions/`. A placeholder callable proves the app reaches it: `connectFunctionsEmulator` in `src/firebase.ts`, next to the others.
- [ ] **Commit: functions run in the emulator.** *(auto)*
- [ ] **Oda client in the function.** A small MCP client with plain `fetch`, as the plan 18 prototype did: dynamic registration, authorize URL with PKCE `S256`, `resource=https://oda.com/mcp` and scope `mcp`, code exchange, refresh (refresh tokens rotate, so every refresh saves the new pair), and `tools/call` over Streamable HTTP. The Oda base URL comes from configuration so tests can point it at a fake. Unit tests with a fake `fetch`.
- [ ] **Linking.** A callable `odaLinkStart`: checks that the caller is signed in and on `config/family`'s members, registers the client once if there isn't one, stores the PKCE verifier and a `state`, and returns the authorize URL. An HTTP function `odaCallback` (the redirect URI, `http://127.0.0.1:<port>/demo-kraftigere/europe-west1/odaCallback` in dev) checks the `state`, exchanges the code, stores the tokens and redirects to Shop. Client registration, pending sign-in and tokens live in `config/odaLink`, written only by the Admin SDK. The rules deny it to every client, explicitly, with a rules test.
- [ ] **Commit: Oda Link in the function.** *(manual)* (auth and security rules; review first)
- [ ] **Reading the Basket.** A callable `odaBasket` (same caller check) calls `get_cart`, refreshing the access token when it has expired, and returns the number of items and the cart link. If refresh fails or there is no link, it says so and the client shows "Koble til Oda".
- [ ] **Shop line.** On Shop: "Koble til Oda" when not linked, "Oda: 4 varer i handlekurven" when linked, read when Shop opens. Tapping "Koble til Oda" goes to oda.com in the same tab.
- [ ] **Keeping the link across dev restarts.** Under the emulator only, the function mirrors `config/odaLink` to a gitignored file at the repo root whenever it writes it, and `scripts/seed.mjs` restores it after seeding. Then restarting `npm run dev` keeps the link and doesn't register a new client on oda.com.
- [ ] **Try it on the dev server**, iterating on feedback: link, see the count change after adding something on oda.com, restart `npm run dev` and still be linked, wait out the hour-long access token and see it refresh. Skipped in AFK mode. *(user)*
- [ ] **Tests.** A fake Oda (OAuth endpoints that approve at once, and an `/mcp` that answers `get_cart`) started by Playwright on its own port, with the test emulators' function pointed at it. One e2e spec: "Koble til Oda" → back on Shop → "Oda: N varer i handlekurven". No test reaches oda.com.
- [ ] **Commit: Basket count on Shop.** *(manual)* (user-visible; review first)
- [ ] **Draft PR `oda` → `main`**, so `pr-check` runs CI on every push. Pushes after a rebase onto `main` use `--force-with-lease`.
- [ ] **Move plan to `plans/done/`.** `git mv plans/active/23-oda-link.md plans/done/23-oda-link.md`, and remove it from **Now** in `ROADMAP.md`.
- [ ] **Commit: complete Oda Link milestone.** *(auto)*

## Done when

- In `npm run dev`, a Family Member links the Family's Oda account from Shop and sees the Basket's item count, and the link survives a restart of `npm run dev`.
- Tokens are in `config/odaLink` only, and a rules test shows no client can read or write it.
- The e2e spec passes against a fake Oda, and no test reaches oda.com.

## Notes

- 2026-10-28: Planned after a grilling session. Work happens on the `oda` branch, rebased onto `main` for a linear history, and merged only in the "Oda in production" plan. Local dev reads (and in later plans fills) the Family's real Basket; if that becomes a problem, the user makes a separate Oda account for testing. Terms are in `CONTEXT.md`'s Oda section; the Oda Order flow and its warnings are in `docs/vision/groceries-and-meals.md`.
