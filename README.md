# kraftigere

A tiny shared shopping list for my family. Open a URL on your phone, add items, check them off. Everyone sees the same list.

## Principles

- **Tiny first.** Smallest thing that works. No settings page, no admin UI.
- **Shared by default.** State syncs across devices in near-real-time.
- **Low-friction access.** Open a URL on any phone browser — no install, one-tap Google sign-in.
- **No backend to run.** Static frontend plus managed services only.
- **Expand only when needed.** Add features when real use reveals the need.

## Features

- One shared list, scoped to signed-in family members.
- Add item, check item off, remove item.
- Updates appear on other devices within a few seconds.
- Works on a phone browser.

## Stack

- **Frontend:** React + TypeScript, built with Vite, hosted as a static SPA on Firebase Hosting at `https://kraftigere.web.app/` (see `docs/adr/0002-firebase-hosting.md`). No router (single screen), no state manager (Firestore is the state).
- **Styling:** inline styles where possible. No CSS framework, no animations, no transitions, no icon library — nothing that isn't load-bearing.
- **Auth:** Firebase Auth with Google provider (Google SSO).
- **State:** Firestore, access gated by security rules on the signed-in user.
- **LLM:** Gemini via Firebase AI Logic (Gemini Developer API backend), called directly from the browser with App Check protecting the key.

## Sharing

Access is limited to a hand-maintained allowlist of family Google accounts — no invite flow, no admin UI.

- A single Firestore doc at `/config/family` holds a `members` array of allowed email addresses.
- Firestore security rules gate every read and write on the list by checking `request.auth.token.email in get(/databases/$(database)/documents/config/family).data.members`.
- Adding or removing a family member is a one-field edit in the Firebase console.
- Anyone signed in with a non-allowlisted Google account sees a "not authorized" screen; they cannot read or write the list.