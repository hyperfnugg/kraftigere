---
status: accepted
---

# Host on Firebase Hosting at kraftigere.web.app, deployed keylessly from CI

The app is served by Firebase Hosting at `https://kraftigere.web.app/`, from the root path, instead of GitHub Pages at `hyperfnugg.github.io/webapp_poc/`. The main reason is sign-in in the installed app: Firebase Auth's sign-in handler runs on the `authDomain`, and with the app on `github.io` and the handler on `kraftigere.firebaseapp.com` they were on different sites, which iPhone standalone mode and third-party-cookie blocking break. On Firebase Hosting the handler is served from the app's own domain (`authDomain: 'kraftigere.web.app'`). Hosting also lets us set cache headers, so the service worker and app shell are never stale, and one `firebase deploy` ships both the app and the Firestore rules.

`deploy.yml` authenticates through Workload Identity Federation: GitHub's OIDC token is exchanged for the `firebase-deploy` service account, which can only deploy Hosting and Firestore rules and read the project. The provider only accepts tokens from `hyperfnugg/kraftigere` on `refs/heads/main`. No Google Cloud key is stored anywhere.

## Considered Options

- **Stay on GitHub Pages.** Rejected: cross-site sign-in, no control over headers, and the app lives under a subpath tied to the repo name.
- **A service account key as a repo secret.** Rejected: a long-lived credential that never expires, at odds with ADR 0001's supply-chain care.
- **A custom domain.** Not now. `kraftigere.web.app` is free and needs no DNS.

## Consequences

- An installed app and its offline Firestore cache belong to their domain. Moving domains again, including to a custom domain, means everyone reinstalls.
- The provider condition names the repo, so renaming the repo again means updating it.
- The service worker must never answer `/__/auth/*` with `index.html` (`navigateFallbackDenylist` in `vite.config.ts`), or same-domain sign-in breaks once the worker is installed.
- Users see "Kraft"; the repo, package, Firebase project and domain are "kraftigere".
