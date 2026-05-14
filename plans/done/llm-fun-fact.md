# LLM Fun Fact

Fourth milestone. Proof-of-concept for Firebase AI Logic (Gemini): add a "fun fact" button to the bottom-most unchecked item; clicking it generates a one- or two-sentence fact via Gemini and displays it inline. Validates the LLM wiring before the real use case (NLP item parsing, recipes) lands.

## Scope

- Add App Check (reCAPTCHA v3) to gate AI Logic and other Firebase API calls.
- Add Firebase AI Logic with the Gemini Developer API backend and `gemini-2.5-flash` model.
- New `src/ai.ts` module exporting a generic `generate(prompt)` so future features (recipes, NLP) reuse the same wiring.
- "Fun fact" button on the bottom-most unchecked item only. Clicking generates a fact, shows it inline below that item until next click.

## Out of scope

- Recipe generation and NLP item parsing — separate milestones once we know the shape.
- Persisting fun facts to Firestore (live ephemeral display only).
- Fun facts on multiple items at once or on checked items.
- Internationalization, prompt configurability, model selection UI.

## Prerequisites (user)

- **Firebase project upgraded to Blaze plan.** Required for both App Check and Firebase AI Logic. Set a budget alert (e.g. €5/month) in the GCP billing console — for family scale on the Gemini Developer API free tier, expected cost is €0.
- **App Check enabled** in Firebase console → App Check → register the web app with **reCAPTCHA v3** as the provider. Note the reCAPTCHA v3 **site key**.
- **Firebase AI Logic enabled** in Firebase console → Build → AI Logic → enable; pick **Gemini Developer API** backend (has free tier; Vertex AI backend is paid-only).

## CI / deploy impact

No workflow changes needed. App Check and AI Logic are runtime deps via Vite. The reCAPTCHA site key is public-by-design (it's embedded in the page) and goes alongside the Firebase config in `src/firebase.ts`.

## Steps

- [x] **Enable Blaze, App Check, AI Logic** as above. *(user)* — provide reCAPTCHA v3 site key. Site key: `6LdWdOosAAAAAD-CgahJPqpZb3pi8A06Bv5-rkh-`.
- [x] **Wire App Check in `src/firebase.ts`** via `initializeAppCheck(app, { provider: new ReCaptchaV3Provider(siteKey), isTokenAutoRefreshEnabled: true })`. Initialize *after* `initializeApp` and *before* any other Firebase service is used.
- [x] **Add `src/ai.ts`** — single module parallel to `firebase.ts` and `items.ts`. Imports `app` from `firebase.ts`. Initializes `getAI(app, { backend: new GoogleAIBackend() })` and a model via `getGenerativeModel(ai, { model: 'gemini-2.5-flash' })`. Exports `generate(prompt: string): Promise<string>` returning the response text. Keep generic — no fun-fact-specific logic in this module.
- [ ] **Commit: App Check + AI module.** *(manual)* — touches auth/security wiring and turns on billed services, review before committing.
- [x] **Fun-fact UI on bottom-most unchecked item.**
  - Compute `lastUnchecked = items.findLast(i => !i.checked)`.
  - Render a "Fun fact" button next to that item's remove button only.
  - Local state in `App` (or `List`): `{ itemId, text, loading } | null` for the current fact.
  - On click: set loading, call `generate('Share a fun fact about: ' + item.text + '. One or two sentences, casual tone.')`, set text on resolve.
  - Display text inline below the item, slightly dimmed.
  - Clicking the button again regenerates (overwrites).
  - Checking off the item clears the fact.
- [x] **Commit: fun-fact button.** *(auto)*
- [x] **Deploy and verify.** Push, then on the live URL: confirm App Check doesn't break sign-in or Firestore; confirm the button only appears on the bottom-most unchecked item; confirm a fun fact appears within a few seconds; confirm checking the item off clears the fact. *(user)* — verified end-to-end.
- [x] **Move plan to `plans/done/`.** `git mv plans/active/llm-fun-fact.md plans/done/llm-fun-fact.md`.
- [x] **Commit: complete llm-fun-fact milestone.** *(auto)*

## Done when

- The bottom-most unchecked item shows a working "Fun fact" button; no other items do.
- Clicking the button generates a contextually relevant fun fact in 1–2 sentences.
- App Check is active — calls from `localhost:5173` and `hyperfnugg.github.io` succeed; calls from elsewhere are rejected at the Firebase API edge (verified via the App Check metrics view).
- No regressions: sign-in, allowlist gating, list CRUD, and real-time sync still work.
- Billing dashboard shows no charges (free tier holds).
