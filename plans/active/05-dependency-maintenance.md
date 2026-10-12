# Dependency maintenance

**Status:** ready-for-agent · enhancement

Fifth milestone. Keep npm packages and GitHub Actions up to date with no human involvement, so that fixes for known vulnerabilities are live within minutes of a PR passing. Stability doesn't matter much (the only users are family), but security does. Ordinary updates wait out a cooldown to reduce supply-chain risk. Security updates skip it. No update tooling can protect against a true zero-day (no fix exists yet); for that case the plan relies on alert emails.

## Scope

- Dependabot version updates and security updates for `npm` and `github-actions`.
- A PR check (`npm ci && npm run build && npm run lint`), made required on `main` by a ruleset.
- Dependabot PRs that pass the check merge and deploy automatically, majors included.
- GitHub Actions pinned to commit SHAs.

## Out of scope

- Node version in CI (`24`, an LTS line). Dependabot's npm updater doesn't bump it.
- Supply-chain protection on the local dev machine (`npm install` scripts, local cooldowns).
- Tests beyond build + lint. Runtime breakage can reach the family, and that's accepted.
- Native GitHub auto-merge and personal access tokens (see Notes).

## Steps

- [ ] **Enable Dependabot alerts and security updates** via `gh api` (`PUT repos/hyperfnugg/webapp_poc/vulnerability-alerts`, then `PUT …/automated-security-fixes`). Confirm with `gh api repos/hyperfnugg/webapp_poc --jq .security_and_analysis`. *(manual)* (repo security settings; run only after the user approves)
- [ ] **Fix existing lint errors.** `npm run lint` fails on `main` with 2 `react-hooks/set-state-in-effect` errors (`App.tsx` clears the fun fact in an effect; `useAuthorized` in `items.ts` resets state in an effect). CI never ran lint, so nobody noticed. The required check would fail every PR until these are fixed. Behaviour must not change.
- [ ] **Commit: fix set-state-in-effect lint errors.** *(auto)*
- [ ] **Add `.github/dependabot.yml`.**
  - `npm`: weekly, `cooldown.default-days: 7`. Group `minor` + `patch` into one PR. Majors stay ungrouped, one PR each.
  - `@types/node`: ignore `version-update:semver-major`, so its major version stays matched to the Node version CI runs (24).
  - `github-actions`: weekly, `cooldown.default-days: 7`, all updates in one group.
  - Security updates are not grouped and ignore the cooldown, so each fix arrives as its own PR right away.
- [ ] **Pin Actions to SHAs** in `deploy.yml`: `uses: actions/checkout@<sha> # v4.x.y`, and the same for `setup-node`, `upload-pages-artifact` and `deploy-pages`. Look up each tag's SHA with `gh api`.
- [ ] **Add `.github/workflows/pr-check.yml`.**
  - Trigger: `pull_request` to `main`.
  - Job `check`: checkout, setup-node 24 with npm cache, `npm ci`, `npm run build`, `npm run lint`. Actions pinned to SHAs.
  - Job `merge`: `needs: check`, runs only if `github.event.pull_request.user.login == 'dependabot[bot]'`. Permissions: `contents: write`, `pull-requests: write`, `actions: write`. Runs `gh pr merge --squash --delete-branch "$PR_URL"`, then `gh workflow run deploy.yml`.
- [ ] **Commit: Dependabot config, PR check with auto-merge and deploy, SHA-pinned actions.** *(manual)* (CI workflows; review before committing)
- [ ] **Create ruleset on `main`** via `gh api repos/hyperfnugg/webapp_poc/rulesets`. It requires the `check` status check, and the repository admin role is on the bypass list so direct pushes to `main` still work. Confirm that a direct push still succeeds. *(manual)* (branch rules; run only after the user approves)
- [ ] **Verify end to end.** Push. Wait for Dependabot to open its first PRs (enabling the config triggers a run). Watch at least one pass, merge and deploy with `gh run list` / `gh pr list --state merged`. If nothing is outdated, trigger a check with a throwaway PR that downgrades a patch version.
- [ ] **Decide on Claude fixing failed PRs** after about 4 weeks of running. If failing Dependabot PRs are common, add steps for `claude-code-action`: it runs on a failed check for Dependabot PRs only, uses an `ANTHROPIC_API_KEY` stored as a Dependabot secret, and pushes fixes to the PR branch. If they're rare, delete this step. *(user)*
- [ ] **Move plan to `plans/done/`.** `git mv plans/active/05-dependency-maintenance.md plans/done/05-dependency-maintenance.md`.
- [ ] **Commit: complete dependency-maintenance milestone.** *(auto)*

## Done when

- Dependabot alerts and security updates are enabled.
- A Dependabot PR that passes build + lint merges and deploys without anyone touching it.
- A Dependabot PR that fails the check stays open, and GitHub notifies the user.
- Every `uses:` in `.github/workflows/` points at a commit SHA.
- Direct pushes to `main` by the user still work.

## Notes

- 2026-10-12: Decision recorded in [ADR 0001](../../docs/adr/0001-unattended-dependency-updates.md).
- 2026-10-12: The merge happens inside `pr-check.yml` rather than through native auto-merge. Merges made with `GITHUB_TOKEN` don't start new workflow runs, so a natively auto-merged PR would never trigger `deploy.yml`. `workflow_dispatch` is the exception to that rule, which is why the merge job starts the deploy itself.
- 2026-10-12: The cooldown is there for supply-chain attacks: most malicious npm releases are pulled within days. Security updates skip it because fast patching matters more for known vulnerabilities.
- 2026-10-12: Moved ahead of item-to-entry at the user's request (that plan is now 06).
- 2026-10-12: Manual dependency update before starting (`50708cd`): minor and patch only, with the cooldown applied via `npm update --before`. `typescript` 7 is blocked because `typescript-eslint` requires `<6.1`. `npm audit` still reports 4 highs from `@grpc/grpc-js` 1.9 inside `@firebase/firestore`. Firebase 13 ships the same version, it's used only by Firestore's Node build (not in the browser bundle), and the advisories concern gRPC server and cert-auth handling. Accepted; no override.
