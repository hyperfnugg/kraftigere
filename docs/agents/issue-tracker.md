# Issue tracker: plans/

Issues, specs and tickets live in the repo's plan files, not an external tracker. Plan conventions (numbering, steps, commit tags, moving to done) are defined in `CLAUDE.md` under "Plans"; this file only maps skill vocabulary onto them.

## Mapping

- **Issue / spec** = one plan file, `plans/active/<NN>-<kebab-name>.md`, created from `plans/TEMPLATE.md`. Spec content goes in the intro, Scope, Out of scope, and Done when.
- **Tickets** = checkbox steps in the plan's `## Steps`, interleaved with commit steps per `CLAUDE.md`. Put acceptance criteria as sub-bullets under the step. Never create one file per ticket.
- **Blocking** = step order: the first unchecked step is the frontier. Add `(blocked by: <step title>)` only when the order is not a straight line.
- **Triage state** = a `**Status:** <label>` line directly under the plan title (labels from `triage-labels.md`). Category goes on the same line: `**Status:** ready-for-agent · enhancement`.
- **Comments** = append to a `## Notes` section at the bottom of the plan (triage notes, agent briefs, decisions), newest last, dated `YYYY-MM-DD`.
- **Close (done)** = `git mv plans/active/<name>.md plans/done/<name>.md`.
- **Close (wontfix)** = set `**Status:** wontfix`, add the reason under `## Notes`, then `git mv` to `plans/done/`. Rejected requests in `plans/done/` with `Status: wontfix` replace the `.out-of-scope/` knowledge base: search there for prior rejections.

## When a skill says "publish to the issue tracker"

Create a new plan file at the next number across `plans/active/` and `plans/done/`. For tickets from an existing plan, rewrite that plan's `## Steps` instead of creating files.

## When a skill says "fetch the relevant ticket"

Read the plan file. The user will refer to it by number (`05`) or name.

## Listing issues

`grep -H '^\*\*Status:\*\*' plans/active/*.md`. Plans without a Status line count as unlabeled.

## Wayfinding operations

- **Map** = the plan file; Notes / Decisions-so-far / Fog go under `## Notes`.
- **Child ticket** = a step; type as a tag, e.g. `*(research)*`.
- **Frontier** = first unchecked, unblocked step. **Claim** is implicit (solo repo). **Resolve** = tick the step and append the answer under `## Notes`.
