# Worklog: launch performance

Not a plan. Notes from looking into how fast Kraft launches, to throw away or reshape into a plan.

## Why

On Android the installed app takes about a second to launch, and 3–4 seconds right after a deploy. A hard reload in Chrome downloaded megabytes.

## How to measure

`npm run perf` (`playwright.perf.config.ts`, `tests/perf/launch.spec.ts`). Not part of `npm run test:e2e` or CI. It uses Lighthouse's mobile profile: slow 4G (150 ms round trip, 1.6 Mbit/s down, 750 kbit/s up) and CPU slowed 4x, with 3 runs per case and the median reported.

- **Local:** a production-style build against the emulators, signed in, timed until the List shows. It has no App Check or reCAPTCHA, since those are off with emulators.
- **Live:** `kraftigere.web.app`, signed out (real Google sign-in can't be automated), timed until the sign-in button shows. It includes App Check and reCAPTCHA.
- **Cached:** the service worker serves the app, like the installed app.
- **Hard reload:** skips the HTTP cache and the service worker. Sign-in and Firestore's offline cache are kept.
- The KB figures are compressed downloads by the page. The service worker's own fetches aren't counted.

## Baseline, 2026-10-19

| Case | Time | Downloaded |
|---|---|---|
| Local, cached | 929 ms | 1 KB |
| Local, hard reload | 2482 ms | 257 KB |
| Live signed out, cached | 552 ms | 28 KB |
| Live signed out, hard reload | 6471 ms | 1016 KB |

Splitting the local cases (one-off runs):

| Case | Network throttled only | CPU throttled only |
|---|---|---|
| Local, cached | 846 ms | 322 ms |
| Local, hard reload | 2436 ms | 238 ms |

## After plan 11 steps 1–2, 2026-10-20

App Check and Gemini load on the first fun fact; the List shows from the cache while access is checked.

| Case | Baseline | After |
|---|---|---|
| Local, cached | 929 ms | 427 ms |
| Local, hard reload | 2482 ms | 1914 ms |
| Live signed out, cached | 552 ms | after deploy |
| Live signed out, hard reload | 6471 ms / 1016 KB | after deploy |

## Findings

- **Cached launch is network-bound, even though the code is on the phone.** Most of the ~0.9 s is round trips: the access check (`getDoc` on `config/family`) waits for the server before anything renders, and Firestore's connection takes several round trips to set up. Parsing and running our code costs about 0.3 s on a 4x-slower CPU.
- **Hard reload is download-bound.** It's our 257 KB bundle locally. The live site adds about 450 KB of reCAPTCHA (script, CSS, a Roboto font, a frame) for App Check, at launch, although only the Gemini fun fact needs App Check.
- **The live hard reload's 1 MB is mostly reCAPTCHA.** Its 346 KB `recaptcha__en.js` downloads twice: once for the page, once more inside reCAPTCHA's hidden `www.google.com` frame. Normally the second copy comes from the HTTP cache (a cached first visit is about 670 KB); a hard reload disables the cache. In total reCAPTCHA is about 760 KB of the 1012 KB, against 217 KB for our app.
- **Live, signed-out cached launch is fast (0.55 s).** No Firestore, and reCAPTCHA doesn't block the sign-in button.
- **Our bundle is a single 883 KB file (264 KB gzip, 217 KB brotli), and unused code is already removed.** Vite's build drops what isn't imported, and Firebase's modular SDK is built for that. A one-off build split by package:

  | Part | Minified | Gzip |
  |---|---|---|
  | Firestore | 515 KB | 151 KB |
  | Main file: React and React DOM, Firebase's shared core, our code | 225 KB | 71 KB |
  | Firebase Auth | 70 KB | 21 KB |
  | Firebase AI (Gemini) | 59 KB | 18 KB |
  | App Check | 14 KB | 5 KB |

  Firestore's size comes from real-time listeners, the offline cache, multi-tab support and its network protocol; Firestore Lite would drop the first two, so it's not an option. Only AI and App Check (23 KB gzip) are easy to load on demand, and doing so also keeps reCAPTCHA off launch. Preact instead of React would save about 40 KB gzip. Not worth it while cached launch is limited by Firestore's round trips rather than parsing.

## Hypotheses, not yet tested

- **After a deploy, the app starts twice.** With `registerType: 'autoUpdate'`, the old service worker serves the old app, finds a new `sw.js`, downloads the whole precache (about 880 KB) and then reloads the page. That would explain the 3–4 s. To test: deploy a change and time the first launch, or simulate it with two local builds.
- **Showing the cached List first** (checking access in the background instead of blocking on the server) would bring cached launch close to the 0.3 s CPU cost.
- **Loading App Check and Gemini only when the fun fact is used** would take reCAPTCHA off launch. This only works if App Check isn't enforced for Firestore or Auth (check in the Firebase console under App Check → APIs).
- Signed-in live launch also loads Firebase Auth's hidden frame. Not measured.

## Ideas if this becomes a plan

- Render from the Firestore cache first; treat access as known until the server says otherwise.
- Lazy-load `firebase/ai` and App Check.
- Make the update quieter: activate the new version on the next launch instead of reloading mid-launch (`registerType: 'prompt'` without a prompt, or skip the reload).
- Add a timing budget to CI only if it turns out to drift.
