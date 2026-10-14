# kraftigere on Firebase Hosting

**Status:** ready-for-agent · enhancement

Ninth milestone. Move the app from GitHub Pages (`hyperfnugg.github.io/webapp_poc/`) to Firebase Hosting at `https://kraftigere.web.app/`, and name everything "kraftigere" to match the Firebase project: the repo, the package, the README and the installed app. Serving the app and Google sign-in from the same domain makes sign-in work in the installed app on iPhone. CI deploys hosting and Firestore rules with keyless Google Cloud credentials (Workload Identity Federation). This plan must land before plan 08's "Deploy and install" step, so the family installs the app only once, on its final domain.

## Scope

- Firebase Hosting serving `dist/` at the root path, with cache headers that keep the service worker and app shell fresh.
- `authDomain: 'kraftigere.web.app'`, so sign-in runs on the app's own domain.
- Name "kraftigere": GitHub repo `hyperfnugg/kraftigere`, `package.json` name, README title, manifest `name`/`short_name` and the `<title>`.
- `deploy.yml` deploys `hosting` and `firestore:rules` on push to `main`, authenticated through Workload Identity Federation (no stored keys).
- GitHub Pages switched off, and `github.io` removed from every allowlist.
- ADR 0002, README, ADR 0001 and plan 08 updated.

## Out of scope

- Renaming the local folder (`~/code/webapp_poc` stays).
- Custom domain.
- Preview channels for PRs.
- Switching to `signInWithRedirect`. Try it only if popup sign-in still fails on iPhone after the move (plan 08's install step finds out).
- A redirect or self-destroying service worker on the old Pages URL. The only people who have opened it clear site data by hand.

## Prerequisites (user)

- The plan 08 agent has stopped, and its work is either committed or stashed, so the working tree is clean.
- `npx firebase login` done locally, with an account that owns the `kraftigere` project.

## Steps

- [x] **Update plan 08.** Move its "Deploy and install" step after this plan (install from `https://kraftigere.web.app/`), change the expected app name to "kraftigere" in the remaining steps and the installability e2e test, drop "Moving hosting off GitHub Pages" from its out-of-scope list and the `/webapp_poc/` base wording, and add a dated note pointing here.
- [x] **Commit: plan 09 and plan 08 reordering.** *(auto)*
- [x] **Hosting config.** `firebase.json` gets a `hosting` block: `public: "dist"`, and headers giving `sw.js`, `index.html` and `manifest.webmanifest` `Cache-Control: no-cache`, and `assets/**` `public, max-age=31536000, immutable`. No SPA rewrite (no router). Add `.firebaserc` with default project `kraftigere`. Make sure `firebase emulators:exec` in the test scripts still works (they pass `--project demo-kraftigere`).
- [x] **Root path.** `vite.config.ts`: drop `base` (defaults to `/`). `playwright.config.ts`: `baseURL` becomes `http://localhost:5173/`. In the `VitePWA` workbox config, add `navigateFallbackDenylist: [/^\/__\//]` so the service worker never answers `/__/auth/*` with `index.html`. Without it, same-domain sign-in breaks once the worker is installed.
- [x] **Same-domain sign-in.** In the production config in `src/firebase.ts`, set `authDomain: 'kraftigere.web.app'`. The emulator config is unchanged.
- [x] **Name "kraftigere".** Manifest `name` and `short_name`, `<title>` in `index.html`, `package.json` `name` (and `package-lock.json` via `npm install`), README `#` title. Update any e2e test that checks the old name. Lint, build and all tests pass, and `dist/` contains no `demo-kraftigere`.
- [x] **Commit: serve from the root path on kraftigere.web.app, sign in on the same domain, rename to kraftigere.** *(manual)* (auth and user-visible name; review before committing)
- [x] **Allow the new domain.** *(user)* In the consoles:
  - Google Cloud → APIs & Services → Credentials → the browser API key: add `https://kraftigere.web.app/*` to the HTTP referrers (keep `kraftigere.firebaseapp.com`, see memory note on referrers).
  - The same page → the OAuth 2.0 web client: add `https://kraftigere.web.app/__/auth/handler` to the authorized redirect URIs.
  - reCAPTCHA admin → the App Check site key: add `kraftigere.web.app`.
  - Firebase Auth → Settings → Authorized domains: check that `kraftigere.web.app` is listed (it is by default).
- [x] **First deploy by hand.** *(user)* `npm run build && npx firebase deploy --only hosting --project kraftigere`. On `https://kraftigere.web.app/` on a desktop browser: Google sign-in works, the List loads, the fun fact (App Check + Gemini) loads, and DevTools shows the service worker active and the manifest name "kraftigere".
- [x] **Retire GitHub Pages.** *(manual)* (repo settings; run only after the user approves) `gh workflow disable deploy.yml`, then `gh api -X DELETE repos/hyperfnugg/webapp_poc/pages`. The user clears site data for `hyperfnugg.github.io` on any device that has opened it. Until the CI step lands, deploys are done by hand as above.
- [x] **Rename the repo.** *(manual)* (repo settings; run only after the user approves) `gh repo rename kraftigere`, then `git remote set-url origin https://github.com/hyperfnugg/kraftigere.git`. Check that the ruleset on `main` and the Dependabot settings carried over (`gh api repos/hyperfnugg/kraftigere/rulesets`, `gh api repos/hyperfnugg/kraftigere --jq .security_and_analysis`).
- [x] **Workload Identity Federation.** *(user)* Claude writes a wizard (`mattpocock-skills:wizard`) for these console steps, and the user runs it:
  - A workload identity pool and OIDC provider for `https://token.actions.githubusercontent.com`, with attribute condition `assertion.repository == 'hyperfnugg/kraftigere' && assertion.ref == 'refs/heads/main'`.
  - A service account with Firebase Hosting Admin, Firebase Rules Admin and Firebase Viewer (adjust if `firebase deploy` reports a missing permission), and `roles/iam.workloadIdentityUser` granted to the pool principal for this repo.
  - Repo variables (not secrets) `GCP_WIF_PROVIDER` and `GCP_SERVICE_ACCOUNT`.
- [x] **Deploy workflow on Firebase.** Rewrite `deploy.yml`: keep the `push` and `workflow_dispatch` triggers and the build job. Permissions `contents: read`, `id-token: write`. Steps: `google-github-actions/auth` pinned to a commit SHA (with the ADR 0001 cooldown) using the two variables, then `npx firebase deploy --only hosting,firestore:rules --project kraftigere --non-interactive`. Drop the Pages actions, the `pages` concurrency group (rename it to `deploy`) and the `github-pages` environment. Re-enable the workflow (`gh workflow enable deploy.yml`). The `gh workflow run deploy.yml` dispatch in `pr-check.yml` stays as it is.
- [x] **Commit: deploy hosting and Firestore rules from CI with Workload Identity Federation.** *(manual)* (CI and credentials; review before committing)
- [ ] **Verify the CI deploy.** *(user)* Push. The deploy run succeeds, the Firebase console shows a new Hosting release and a new Firestore rules release, and `https://kraftigere.web.app/` still signs in.
- [ ] **Remove `github.io` from allowlists.** *(user)* Remove `hyperfnugg.github.io` from the API key's HTTP referrers, the reCAPTCHA site's domains and Firebase Auth's authorized domains.
- [ ] **Docs.**
  - `docs/adr/0002-firebase-hosting.md`: host on Firebase Hosting at `kraftigere.web.app`. Why: same-domain sign-in for the installed app, root path, headers, one deploy for hosting and rules. Consequences: an installed app and its offline cache belong to their domain, so moving domains again (including to a custom domain) means reinstalling. CI uses Workload Identity Federation bound to `hyperfnugg/kraftigere` on `main`, so renaming the repo again means updating the provider condition. Considered: staying on GitHub Pages (cross-site sign-in), a service account key (long-lived secret).
  - README: the Stack line says Firebase Hosting, and mentions of GitHub Pages are gone.
  - ADR 0001: `deploy.yml` now deploys to Firebase. The `GITHUB_TOKEN` and `workflow_dispatch` reasoning still holds.
  - Update the memory note on API key referrers if the allowed-sites list changed what it says.
- [ ] **Commit: ADR 0002 and docs for Firebase Hosting.** *(auto)*
- [ ] **Move plan to `plans/done/`.** `git mv plans/active/09-kraftigere-on-firebase-hosting.md plans/done/09-kraftigere-on-firebase-hosting.md`.
- [ ] **Commit: complete kraftigere-on-firebase-hosting milestone.** *(auto)*

## Done when

- `https://kraftigere.web.app/` serves the app at the root path, Google sign-in works there, and the manifest names the app "kraftigere".
- A push to `main` deploys hosting and Firestore rules through Workload Identity Federation, with no stored Google Cloud key.
- The repo is `hyperfnugg/kraftigere`, GitHub Pages is off, and `hyperfnugg.github.io` is on no allowlist.
- ADR 0002 exists, and README, ADR 0001 and plan 08 no longer describe GitHub Pages hosting.

## Notes

- 2026-10-13: Decided in a grilling session. Do it now, before plan 08's install step, because an installed app and Firestore's offline cache belong to their domain, so moving later means reinstalling. Domain `kraftigere.web.app`, no custom domain. Workload Identity Federation over a service account key. CI deploys Firestore rules too, since nothing deployed them before. No preview channels. One plan for rename and move, ordered so nothing is done twice: Firebase Hosting comes up first while Pages still runs, then Pages is retired and the repo renamed, then the keyless CI is set up against the final repo name. Pages is retired by hand (only the user has opened it). The installed app is named "kraftigere" (replaces plan 08's "Kraft"). The local folder keeps its name.
