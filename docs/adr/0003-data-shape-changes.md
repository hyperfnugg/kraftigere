---
status: accepted
---

# Data shape changes: rules define the shape, migrations are scripts run by hand, brief disruption is acceptable

Installed copies of the app keep an offline cache and update themselves only when opened online. A phone left alone for weeks can start old code and replay offline writes in an old shape after a new version has shipped. We accept a brief disruption while the data shape changes (an outdated app may refuse to save or show an error until it updates), but not corrupted or silently mixed data. Firestore security rules define the allowed shape of every document, with a rules test for each rule, so a write in the wrong shape is refused rather than stored. Data already stored is changed by one-off scripts in `scripts/` using the Firebase Admin SDK: tried against the emulator with seeded data first, then run by hand against production with the developer's own `gcloud auth application-default login` credentials.

There is no app version check yet. Outdated apps update themselves on their next online launch. The first change that can't tolerate that adds a minimum version (for example in `/config/app`) that the app checks before writing and the rules enforce.

## Considered Options

- **Expand and contract** (old and new shapes both valid while data moves, then the old one removed). Rejected for now: zero disruption isn't worth the extra steps for one family. Still available for a change that needs it.
- **Migrating in the app as it reads.** Rejected: old-shape handling would spread through the app and never leave.
- **A CI job that runs migrations on deploy.** Rejected: changes are rare and the data is tiny, so a reviewed script run by hand is safer.
- **A service account key for scripts.** Rejected for the same reason as in ADR 0002: a long-lived key.

## Consequences

- When the server refuses an offline write from an outdated app, the write is dropped and the app's local copy reverts. An Entry added offline by an outdated app can disappear. This is accepted.
- Every change to the data shape changes `firestore.rules` and its tests in the same PR.
- The Admin SDK skips the rules, so migration scripts must produce data the rules would accept.
