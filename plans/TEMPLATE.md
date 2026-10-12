<!-- Copy to plans/active/<NN>-<kebab-name>.md to start a new plan (NN = next number across active/ and done/). -->

# <Title>

<One-paragraph intro: what this milestone is, why it matters, what it explicitly does not cover.>

## Scope

<What's being built. Keep concrete — a sentence or two.>

## Out of scope

- <Thing not included>
- <Thing not included>

## Prerequisites (user)

<Delete this section if there are none.>

- <Thing the user must have done or confirmed before Claude executes>

## Steps

<Interleave work steps and commit steps as checkboxes. Each step ends with an ownership/policy tag:
- *(user)* — user executes, Claude waits
- *(auto)* — Claude commits without asking once preceding work lands
- *(manual)* — Claude pauses for an explicit "commit" before committing
- untagged — Claude executes as work

Commit cadence: roughly one commit per coherent chunk (1–2 prompts). Default commit policy is *(auto)*; use *(manual)* for CI, auth, security rules, or anything that wants review.>

- [ ] **<Work step>** <details>
- [ ] **<Work step>** <details>
- [ ] **Commit: <summary of what landed>** *(auto)*
- [ ] **<User-owned step>** <details> *(user)*
- [ ] **<Work step with CI/security implications>** <details>
- [ ] **Commit: <summary>** *(manual)* — <why review is wanted>
- [ ] **Move plan to `plans/done/`.** `git mv plans/active/<name>.md plans/done/<name>.md`.
- [ ] **Commit: complete <name> milestone.** *(auto)*

## Done when

- <Concrete verifiable condition>
- <Concrete verifiable condition>