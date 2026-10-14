---
status: accepted
---

# Unattended dependency updates: auto-merge on passing checks, cooldown except for security fixes

Every Dependabot PR (npm and GitHub Actions, majors included) is merged and deployed with no human review, as soon as the required `check` passes: build, lint, Firestore rules tests, and Playwright e2e tests against the emulators. The app only affects one family, so stability doesn't matter much, but security does: known vulnerabilities must be patched without anyone at the keyboard. Ordinary updates wait out a 7-day cooldown, because most malicious npm releases are pulled within days. Security updates skip the cooldown, because fast patching matters more for known vulnerabilities. Actions are pinned to commit SHAs, because tags can be moved to point at different code.

## Considered Options

- **Review each update, or auto-merge only minor and patch.** Rejected: it needs a human, and security fixes that require a major version would wait.
- **Renovate.** Rejected in favour of Dependabot, which has no third-party app with write access to the repo.
- **Native GitHub auto-merge.** Rejected: merges made with `GITHUB_TOKEN` don't trigger `deploy.yml`, so merged fixes wouldn't go live. Instead `pr-check.yml` merges the PR and starts the deploy itself (`workflow_dispatch` is exempt from that rule). A personal access token would also work, but it's a long-lived credential to rotate.

## Consequences

- Runtime breakage the e2e cases don't cover will reach the family. This is accepted. Things that run only in production, such as App Check, real Google sign-in and Gemini, aren't exercised by the emulator-based tests.
- A PR that fails the check stays open until a human (or, later, Claude in CI) fixes it. That includes security fixes that need a breaking major.
- No update tooling can protect against a true zero-day (no fix exists yet). Dependabot alert emails are the backstop.
- Merged updates deploy to Firebase Hosting and Firestore rules through the keyless deploy identity (ADR 0002). It only accepts runs on `main`, so a PR that changes a workflow can't deploy until it is merged.
