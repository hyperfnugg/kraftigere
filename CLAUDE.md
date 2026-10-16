# Project conventions

## Plans

Multi-step work lives in `plans/active/<NN>-<kebab-name>.md`, where `<NN>` is the next two-digit number across `plans/active/` and `plans/done/` (e.g. `05-foo.md`). Each plan has scope, out-of-scope, steps, ownership, and a done-when. Start new plans by copying `plans/TEMPLATE.md`.

- **Read the plan at the start of a session** and do not preload plans you aren't working on.
- **Steps are checkboxes** (`- [ ]` / `- [x]`). Tick each step off as it lands. Steps must use `- [ ]` bullet form, not numbered lists (GitHub only renders checkboxes on bullets).
- **Plans are living documents.** Add, remove, rewrite, or resplit steps as understanding changes — the plan reflects current reality, not original intent. Don't preserve obsolete steps just because they were written down.
- **Commits are per-step or per-coherent-chunk**, not one commit per plan. A plan will typically span several commits.
- **When the plan is complete**, `git mv plans/active/<name>.md plans/done/<name>.md` in its own commit (or bundled with the final step if small).
- One plan per milestone. Don't accumulate tiny TODOs here — those belong in conversation or a commit.
- Ideas live in `ROADMAP.md`, one line each. An idea becomes a plan when work on it starts.
- Don't duplicate plan content in `README.md` or this file.

## Commits

- Frequent, fine-grained commits. Roughly 1–2 prompts or one coherent chunk per commit. Never bundle many changes into one large commit.
- **Commit points are explicit in plans.** Each plan interleaves commit steps with work steps as checkboxes.
- Each commit step is tagged `*(auto)*` or `*(manual)*`:
  - `*(auto)*` — commit without asking once the preceding work steps land.
  - `*(manual)*` — pause and wait for an explicit "commit" before committing.
- Default to `*(auto)*` for low-risk routine changes; use `*(manual)*` for anything touching CI, auth, security rules, or user-visible behavior that wants review first.
- Step ownership (`*(user)*`, `*(auto)*`, `*(manual)*`) goes as an inline tag at the end of each step.

## Style

- Inline styles in components. No CSS framework, no animations, no transitions, no icon library.
- React + TypeScript + Vite frontend; Firebase (Auth, Firestore, AI Logic / Gemini) backend. Full stack in `README.md`.
- Keep new code minimal — this is a POC. Don't add abstractions for hypothetical future needs.

## Agent skills

### Issue tracker

Issues, specs and tickets are plan files in `plans/` — no external tracker. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five roles, recorded as a `**Status:**` line in each plan. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context (`CONTEXT.md` + `docs/adr/` at root). See `docs/agents/domain.md`.
