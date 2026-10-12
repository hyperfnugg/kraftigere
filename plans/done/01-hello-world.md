# Hello World

First milestone. Proves the toolchain and deploy pipeline end-to-end. No Firebase yet — that's the next milestone.

## Scope

A React + TypeScript + Vite static SPA that renders literal "Hello, world", deployed automatically to GitHub Pages on every push to `main`.

## Out of scope

- Firebase Auth, Firestore, AI Logic.
- Family allowlist and security rules.
- Shopping list UI and logic.
- Custom domain.

## Prerequisites (user)

- GitHub repo exists, and its full name (`owner/repo`) is known.
- Deploy target is the default `https://<owner>.github.io/<repo>/` subpath.

## Steps

- [x] **Verify GitHub remote.** Confirm `origin` points at the GitHub repo; fix or set if the upstream is gone. *(user)* — `origin` → `https://github.com/hyperfnugg/webapp_poc.git`, remote exists and is empty.
- [x] **Push existing commits.** `git push -u origin main` to populate the empty remote. *(manual)*
- [x] **Scaffold project in repo root.** `npm create vite@latest . -- --template react-ts`, then `npm install`. Merge any scaffold-generated `.gitignore` entries into the existing `.gitignore`.
- [x] **Commit: scaffold Vite React-TS project.** *(auto)*
- [x] **Configure Vite base path.** Set `base: '/webapp_poc/'` in `vite.config.ts` so assets resolve under the Pages subpath.
- [x] **Replace `App.tsx` with "Hello, world".** Strip the Vite template. Inline styles. No logo, no counter, nothing else.
- [x] **Delete template cruft.** `App.css`, `index.css`, `src/assets/`, `public/icons.svg`. Also updated `index.html` title and dropped the `index.css` import from `main.tsx`. Kept `public/favicon.svg` since it's trivially load-bearing for browser tab identity.
- [x] **Commit: minimal Hello World app.** *(auto)*
- [x] **Add GitHub Actions deploy workflow** at `.github/workflows/deploy.yml`. On push to `main`: checkout, setup Node, `npm ci`, `npm run build`, publish `dist/` via `actions/upload-pages-artifact` + `actions/deploy-pages`.
- [x] **Commit: GitHub Pages deploy workflow.** *(manual)* — CI change, review before committing.
- [x] **Enable Pages in repo settings.** Source = "GitHub Actions". One-time UI step. *(user)*
- [x] **Push to trigger first deploy.** Verify `https://hyperfnugg.github.io/webapp_poc/` renders "Hello, world". *(user)* — confirmed: HTTP 200, "Hello, world" in the live HTML.
- [x] **Move plan to `plans/done/`.** `git mv plans/active/hello-world.md plans/done/hello-world.md`.
- [x] **Commit: complete hello-world milestone.** *(auto)*

## Done when

- Pushing to `main` triggers a successful Actions run.
- The Pages URL renders "Hello, world" with no console errors.
- `README.md` stack section still reflects reality (no drift).