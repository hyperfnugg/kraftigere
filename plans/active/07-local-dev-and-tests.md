# Local dev and tests

**Status:** ready-for-agent · enhancement

Seventh milestone. Give the agent a development loop it can verify: a local stack on Firebase emulators that it can drive in a browser, plus automated rules and end-to-end tests that also gate Dependabot's auto-merge. Today `npm run dev` hits the production project, sign-in can't be automated, and nothing tests runtime behaviour. Unit tests are not part of this.

## Scope

- `npm run dev` runs Vite against the Auth and Firestore emulators (project `demo-kraftigere`), seeded with a test Family. In dev, App Check is skipped and the fun fact is stubbed.
- Firestore rules tests and Playwright e2e tests, run locally and in the required CI `check`.
- Playwright MCP for interactive browser use by the agent.
- `git push` working inside the agent's sandbox.

## Out of scope

- Unit and component tests (add when real logic appears).
- Local runs against production (`dev:prod`).
- Real Gemini locally (App Check debug token). Revisit with the real LLM features.
- Any change to the production build's behaviour.

## Prerequisites (user)

- Java 21+ installed (Java 25 is present).

## Steps

- [x] **Let git use gh credentials.** Run `! gh auth setup-git` (adds a github.com credential helper to `~/.gitconfig`). *(user)*
- [x] **Emulator config and dev wiring.**
  - Add `firebase-tools` as a dev dependency. Install new packages with `npm install --before=<today − 7 days>` to respect the ADR 0001 cooldown.
  - `firebase.json`: `firestore.rules` path, Auth emulator on 9099, Firestore emulator on 8080, UI off.
  - `src/firebase.ts`: when `import.meta.env.DEV`, use project `demo-kraftigere`, call `connectAuthEmulator` and `connectFirestoreEmulator`, and skip `initializeAppCheck`. Firestore is initialised in `src/entries.ts`, so either move `db` into `firebase.ts` or connect it there. The production path must stay unchanged.
  - `src/ai.ts`: when `import.meta.env.DEV`, `generate` returns a fixed fake fact.
  - `scripts/seed.mjs`: writes `config/family` with two fake Family Members, using the Firestore emulator REST API with `Authorization: Bearer owner` to bypass rules.
  - `npm run dev`: `firebase emulators:exec --project demo-kraftigere --only auth,firestore "node scripts/seed.mjs && vite"`.
  - Verify: `npm run dev` starts, and signing in through the emulator's fake Google popup as a seeded Family Member shows the List.
- [x] **Commit: run local dev against Firebase emulators.** *(auto)*
- [x] **Rules tests.** Vitest + `@firebase/rules-unit-testing`, in `tests/rules/`. `npm run test:rules` runs them under `firebase emulators:exec --only firestore`. Cases:
  - A Family Member can read and write `/entries`.
  - A signed-in non-member can't read or write `/entries`.
  - A signed-out user can't read or write `/entries`.
  - A Family Member can read but not write `config/family`.
  - A non-member can't read `config/family`.
- [x] **Commit: Firestore rules tests.** *(auto)*
- [x] **E2E tests.** Playwright (Chromium only), in `tests/e2e/`. `playwright.config.ts` uses `webServer: npm run dev`. `npm run test:e2e`. Sign-in goes through the emulator's fake Google popup. Cases:
  - A Family Member signs in and sees the List.
  - A non-member sees the not-authorized screen.
  - Add, check off, uncheck and remove an Entry.
  - An Entry added in one browser context appears in a second one.
  - The fun-fact button appears only on the bottom-most unchecked Entry and shows the stubbed fact.
  - Reset emulator data between tests (Firestore emulator `DELETE …/documents`, then re-seed).
- [x] **Commit: Playwright e2e tests against emulators.** *(auto)*
- [x] **Playwright MCP.** Add `@playwright/mcp` as a dev dependency, plus a checked-in `.mcp.json` that runs its local binary headless (check the bin name in the installed package). Verify by opening `localhost:5173` and signing in through the emulator.
- [x] **Commit: Playwright MCP for agent browser access.** *(auto)*
- [x] **CI gate.** In `pr-check.yml`'s `check` job, after lint:
  - `actions/setup-java` (Temurin 21), pinned to a SHA.
  - Cache `~/.cache/firebase/emulators` and the Playwright browser cache (key on the Playwright version).
  - `npx playwright install --with-deps chromium`.
  - `npm run test:rules`, then `npm run test:e2e`.
  - Upload the Playwright report as an artifact on failure.
- [x] **Update ADR 0001.** The gate is now build + lint + rules tests + e2e. Runtime breakage that the e2e cases don't cover can still reach the Family.
- [x] **Commit: run rules and e2e tests in the PR check; update ADR 0001.** *(manual)* (CI gate and ADR; review before committing)
- [ ] **Verify in CI.** Push, then open a throwaway PR (or wait for a Dependabot PR) and confirm that `check` runs both suites and passes. Record its run time in Notes.
- [ ] **Move plan to `plans/done/`.** `git mv plans/active/07-local-dev-and-tests.md plans/done/07-local-dev-and-tests.md`.
- [ ] **Commit: complete local-dev-and-tests milestone.** *(auto)*

## Done when

- `npm run dev` runs the app on emulators with seeded data. The production build is unchanged.
- `npm run test:rules` and `npm run test:e2e` pass locally.
- The required CI `check` runs both suites, so a dependency update that breaks them doesn't merge.
- The agent can open and sign in to `localhost:5173` through Playwright MCP.
- The agent can `git push` without bypassing its sandbox.

## Notes

- 2026-10-12: Decided in a grilling session: emulators over production or a dev project (throwaway data, automatable fake Google sign-in, real rules enforced); a stubbed fun fact in dev (Gemini has no emulator, and App Check would block localhost); no `dev:prod`. Because the dev build stubs Gemini, the e2e tests need no network interception.
- 2026-10-12: E2E flakiness found and fixed. (1) The emulator popup drops clicks made before its script is ready, so the helper retries "Add new account" until the form shows. (2) The first popup sign-in after the emulators start sometimes never reaches the page, so a `globalSetup` warm-up does one throwaway sign-in. (3) Playwright's `webServer` left the Java emulator running after a run; `gracefulShutdown: SIGINT` fixes that. After these, 60/60 passed across 4 cold starts.
- 2026-10-12: `@playwright/mcp` 0.0.83 pins a pre-release `playwright` (1.64 alpha) with its own Chromium build, separate from `@playwright/test`'s. After Dependabot bumps it, run `node node_modules/@playwright/mcp/node_modules/playwright/cli.js install chromium` if the MCP can't find a browser. Smoke-tested over stdio: it lists 25 tools and loads the dev server. Claude Code only loads `.mcp.json` servers after a restart, with an approval prompt.
