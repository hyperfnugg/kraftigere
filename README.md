# kraftigere

**Kraft** is our family's coordination tool: the one place for what we need to buy, plan and do. It starts with a shared shopping list and grows with what the family actually uses. Where it's heading is in [`ROADMAP.md`](ROADMAP.md).

## Principles

- **One place for the family.** Shared by default, synced across phones within seconds.
- **Built to change.** The roadmap shifts as ideas come up. Small steps, easy to undo or rework.
- **Low friction.** Installed on the home screen, one-tap Google sign-in, works offline.
- **Little backend to run.** Static frontend plus managed services. Cloud Functions only where a feature truly needs a server, as Oda does.
- **AI where it saves effort.** For planning and suggestions, never required for the basics.

## What it does today

- One shared shopping List, for signed-in Family Members only.
- Add an Entry, check it off, uncheck it, remove it.
- Changes appear on other phones within a few seconds.
- Installs to the home screen and works offline; changes sync when back online.
- Dinner for this week and next: Gemini names a dish for each day from the Family's Guidelines and Day Notes, and writes the Recipes when the Family asks. The Family adjusts the days, edits Recipes by hand or by instructing Gemini, and cooks from them: a Modernist Cuisine-style table of Steps on a tablet, stacked on a phone.
- Iverksett sends a week's Ingredients to the shopping List, one Entry per Ware with the dishes that need it, leaving out what's at home. Gemini matches Ingredients, and the Family's corrections are remembered.
- Odabestilling fills the Family's Basket on oda.com from the shopping List, through the Oda Link, and Avbryt takes out only the packs it added. The Family orders on oda.com and marks it Bestilt.

## Stack

- **Frontend:** React + TypeScript, built with Vite, hosted as a static SPA on Firebase Hosting at `https://kraftigere.web.app/` (see `docs/adr/0002-firebase-hosting.md`). No router (single screen), no state manager (Firestore is the state).
- **Styling:** inline styles where possible. No CSS framework, no animations, no transitions, no icon library — nothing that isn't load-bearing.
- **Auth:** Firebase Auth with Google provider (Google SSO).
- **State:** Firestore, access gated by security rules on the signed-in user.
- **Functions:** Cloud Functions (2nd gen, `europe-west1`) in `functions/` hold the Oda Link and talk to Oda's MCP server (ADR 0005). Callables require App Check and an allowlisted sign-in. CI deploys them with Hosting and the rules from `main`; a new function is deployed by hand once first (ADR 0002). A budget-triggered kill switch removes billing (ADR 0005).
- **LLM:** Gemini via Firebase AI Logic (Gemini Developer API backend), called directly from the browser with App Check protecting the key.

## Local development

- `npm run dev` runs the app against the Auth, Firestore and Functions emulators with a seeded Family (sign in as alice@example.com). Gemini answers with fixed stubs. The Oda functions talk to the real oda.com and share the Family's Basket with production, through their own Oda client; the link is kept in the gitignored `.oda-link.json`.
- **Real Gemini locally:** create an App Check debug token (Firebase console → App Check → Apps → Manage debug tokens) and put it in `.env.development.local` as `VITE_APPCHECK_DEBUG_TOKEN=…`. `npm run dev` then calls the real Gemini, on the real project's quota, while Auth and Firestore stay on the emulators. Only dev mode reads that file, so the token never reaches a build. e2e tests always use the stubs.
- `npm run test:e2e`, `npm run test:rules` and `npm run test:unit` run the tests. e2e and rules run their own emulators (`firebase.test.json`, `.env.e2e`) on other ports than `npm run dev`, so the dev server can keep running beside them.

## Sharing

Access is limited to a hand-maintained allowlist of family Google accounts — no invite flow, no admin UI.

- A single Firestore doc at `/config/family` holds a `members` array of allowed email addresses.
- Firestore security rules gate every read and write on the list by checking `request.auth.token.email in get(/databases/$(database)/documents/config/family).data.members`.
- Adding or removing a family member is a one-field edit in the Firebase console.
- Anyone signed in with a non-allowlisted Google account sees a "not authorized" screen; they cannot read or write the list.
- The Oda functions check the same list before every call. The Oda Link (`/config/odaLink`) is closed to every client; only the functions read it.