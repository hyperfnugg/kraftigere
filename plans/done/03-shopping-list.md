# Shopping List

Third milestone. The actual shopping list: allowlist-gated, Firestore-backed, real-time synced across devices. Delivers the POC's stated purpose.

## Scope

- Family allowlist doc at `/config/family`, enforced by Firestore security rules.
- Not-authorized screen for signed-in users outside the allowlist.
- Items collection at `/items`; add, check/uncheck, remove.
- Real-time sync — changes visible on other devices within seconds via Firestore subscription.

## Out of scope

- Multiple lists, categories, quantities.
- Edit history, soft-delete, undo.
- LLM-assisted item parsing (next milestone).
- App Check (still deferred; add before LLM milestone).

## Prerequisites (user)

- Firestore enabled (Native mode) in the Firebase project. Region: **`europe-west1`** (Belgium; single-region, cheaper) or `eur3` (multi-region EU). Avoid `nam5` — noticeable latency from Norway.
- `/config/family` doc created manually in the console with field `members: [<email>, ...]` (array of strings).
- Family member Google accounts known and added to the `members` array.

## CI / deploy impact

No workflow changes needed. Firestore SDK is a runtime dep bundled by Vite (expect ~100 KB additional bundle on top of Auth). Existing API key Website restrictions (`hyperfnugg.github.io/*`, `localhost:5173/*`) already cover Firestore — its calls send the page origin as Referer, with no auth-handler equivalent.

## Steps

- [x] **Enable Firestore and seed allowlist.** Firebase console → Firestore → create database in `europe-west1`; then add `/config/family` doc with `members` string array. *(user)*
- [x] **Write `firestore.rules`** in repo root with shape:
  ```
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      function isFamily() {
        return request.auth != null &&
               request.auth.token.email in
                 get(/databases/$(database)/documents/config/family).data.members;
      }
      match /config/family  { allow read: if isFamily(); allow write: if false; }
      match /items/{itemId} { allow read, write: if isFamily(); }
    }
  }
  ```
  `get()` in rules costs one doc read per evaluation — negligible at family scale.
- [ ] **Commit: Firestore security rules.** *(manual)* — security rules, review before committing.
- [x] **Deploy rules.** Paste `firestore.rules` into Firebase console → Firestore → Rules, publish. *(user)*
- [x] **Create `src/items.ts`** — single module parallel to `src/firebase.ts`. Imports `auth` from `firebase.ts` and initializes `db` via `getFirestore(app)` (export `app` from `firebase.ts` if not already). Exports:
  - `addItem(text)` — `addDoc` with `{ text, checked: false, createdAt: serverTimestamp() }`.
  - `toggleItem(id, checked)` — `updateDoc`.
  - `removeItem(id)` — `deleteDoc`.
  - `useItems()` — hook wrapping `onSnapshot` on `/items` ordered by `createdAt` **ascending** (oldest first; matches a handwritten list). Returns `{ items, loading }`; `loading` stays `true` until first snapshot fires.
  - `useAuthorized()` — hook that, once `user` is set, calls `getDoc(doc(db, 'config/family'))`. Returns `{ authorized, loading }` where success → `true`, permission-denied → `false`. Single targeted check.
- [x] **Gate App.tsx on authorization** after sign-in:
  - `user` set, `authorized.loading` → render nothing.
  - `authorized === false` → not-authorized screen: "Not authorized — ask a family member to add your Google account" + sign-out button.
  - `authorized === true` → list UI.
- [x] **List UI.** One input at top for adding an item; below it a list of items with a checkbox and a remove button each. Inline styles. Checked items stay visible but dimmed (so you can un-check if you mis-tapped).
- [x] **Commit: shopping list CRUD with real-time sync and not-authorized screen.** *(auto)*
- [x] **Deploy and verify.** Push, then test with two family accounts on two devices: adds appear on the other within a few seconds; non-allowlisted account gets the not-authorized screen. *(user)* — verified: real-time sync across devices, not-authorized screen for non-allowlisted accounts.
- [x] **Move plan to `plans/done/`.** `git mv plans/active/shopping-list.md plans/done/shopping-list.md`.
- [x] **Commit: complete shopping-list milestone.** *(auto)*

## Done when

- A family member on one device adds an item; it appears on another family member's device within a few seconds without a refresh.
- A signed-in Google account not in the allowlist sees the not-authorized screen and cannot read `/items`.
- Firestore rules deny unauthenticated reads and unallowlisted reads (verified in the Rules Playground or by live test).