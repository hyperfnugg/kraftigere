# Gemini behind the allowlist

**Status:** ready-for-agent · enhancement

Right now the browser calls Gemini through Firebase AI Logic, and AI Logic checks only App Check. It can't see who is signed in. Anyone who opens the site passes App Check, so a stranger can spend on Gemini. This plan moves every Gemini call into a callable that runs `requireFamily` like the Oda callables, so only Family Members can use the AI, and then closes the AI Logic path. Family Members themselves are trusted: over-use by a Family Member is left to the budgets and the kill switch (ADR 0005). Nothing changes for the Family except that the AI keeps working only for them.

## Scope

- One thin callable, `generate`. It takes a prompt, a JSON schema and a token cap, keeps the model fixed on the server, and runs `requireFamily` with App Check enforced. Prompt-building stays in `src/ai.ts`.
- Gemini through Vertex AI, using `@google/genai`, from the functions' runtime service account, at Vertex's `global` location (the function itself runs in `europe-west1`). There's no API key.
- All four calls (`makeMenu`, `makeRecipe`, `makeMatches`, `readPackSizes`) go through it via `generateJson`.
- Firebase AI Logic turned off, and its Gemini key deleted.
- A dated note on ADR 0004.

## Out of scope

- Roles within the Family (RBAC). Every Family Member is equal, and nothing needs a Role yet.
- Rate limits for each Family Member. The budgets and kill switch cover over-use.
- Upgrading the model. It stays `gemini-3.5-flash-lite` for the move; the upgrade is its own change afterwards.
- Moving prompts to the server, or a callable per task.
- The roadmap's test that *every* callable refuses accounts not on the allowlist. This plan tests only `generate`.

## Steps

- [x] **The `generate` callable** in `functions/src/index.ts`. It runs `requireFamily` and enforces App Check, like the other callables. It calls Vertex AI (`vertexai: true`, project from `GCLOUD_PROJECT`, location `global`, since Vertex answers 404 for the model in `europe-west1`) with `responseMimeType: 'application/json'`, the given schema, `maxOutputTokens` and medium thinking. Function timeout is about 120 s. It logs the same timings and token counts `generateJson` logs today, and returns an error when the answer hits `MAX_TOKENS`. No streaming.
  - In the emulator, it answers `{ stub: true }` after `requireFamily` unless real AI is turned on for the emulator (`GEMINI_PROJECT=kraftigere` in `functions/.env.local`, which uses ADC from `gcloud auth application-default login`). The emulator's `.env.local` wins over its process env, so e2e sets `AI_STUBS` to force the stubs. The task-specific stubs stay in `src/ai.ts` and answer when the callable says `stub`. That way e2e still runs through `requireFamily`, and the generic callable doesn't need to know the tasks.
- [x] **Client.** `generateJson` in `src/ai.ts` calls `generate` (awaiting `startAppCheck` outside the emulators, as `src/oda.ts` does), sending the schema as plain JSON instead of `firebase/ai`'s `Schema` builder. Remove `firebase/ai`, `realAi` and the `VITE_APPCHECK_DEBUG_TOKEN` switch for AI. `warmUp` only starts App Check.
- [x] **Try it on the dev server**, iterating on feedback. Menu, Recipes, Confirm's matches and pack sizes still work, with stubs and with real AI on in the emulator. Skipped in AFK mode. *(user)*
- [x] **Tests.** `npx tsc -b`, `npm run lint`, `npm run test:unit`, and the e2e specs that use the AI (`menu`, `recipe`, `confirm`, `pack-counts`). A test that `generate` refuses a signed-in account not on the allowlist.
- [x] **Commit: Gemini through the `generate` callable.** *(manual)* — auth control; review first.
- [x] **Vertex AI access.** Enable the Vertex AI API (`aiplatform.googleapis.com`) and grant `roles/aiplatform.user` to the default compute service account that the callables run as. *(user)*
- [x] **Deploy `generate` once by hand** (`npx firebase deploy --only functions:generate`), since `firebase-deploy` can't create functions (ADR 0002). Then push to `main` so CI deploys the client. *(user)*
- [x] **Verify in production.** Menu and a Recipe work on `kraftigere.web.app`. A signed-in Google account that isn't on the allowlist is refused by `generate`. *(user)*
- [x] **Close AI Logic.** Turn off the Firebase AI Logic API (`firebasevertexai.googleapis.com`) and delete the Gemini API key it used. Delete the App Check debug token too; nothing uses it now. A direct AI Logic call with the public config is refused. An installed copy of the app on the old client loses AI until it updates; accepted. *(user)*
- [x] **ADR 0004 note.** A dated note: Gemini is now behind the allowlist on a server, App Check is no longer its only protection, and AI Logic is off. Update `README.md`'s stack if it names AI Logic.
- [x] **Commit: Gemini behind the allowlist in production.** *(auto)*
- [ ] **Move plan to `plans/done/`.** `git mv plans/active/31-gemini-behind-the-allowlist.md plans/done/31-gemini-behind-the-allowlist.md`.
- [ ] **Commit: complete Gemini behind the allowlist milestone.** *(auto)*

## Done when

- Every Gemini call goes through `generate`, and the client no longer imports `firebase/ai`.
- `generate` refuses a signed-in account that isn't on the allowlist, both in a test and in production.
- A direct Firebase AI Logic call is refused.
- ADR 0004 has the note.

## Notes

- 2026-11-09: `@google/genai` is pinned at `^2.32.0`, since 3.0.0 was three days old, inside the 7-day cooldown (ADR 0001). The schemas are plain JSON Schema sent as `responseJsonSchema`, every property required as `firebase/ai`'s builder made them, and nullable as `type: [t, 'null']`. The client's `callable` helper moved from `src/oda.ts` to `src/firebase.ts`, and App Check no longer has a second app for the emulators. Without streaming, `generate` logs the total time only, not the first part's.
- 2026-11-09: Decided in a grilling session. "Signed in" alone isn't enough, since any Google account can sign in. Blocking non-members at sign-in (`beforeSignIn`) would need Identity Platform. Vertex was chosen over the Gemini Developer API to avoid a secret, at the cost of AI Studio's prepaid hard cap; the kill switch is the hard limit instead. The free tier no longer matters.
