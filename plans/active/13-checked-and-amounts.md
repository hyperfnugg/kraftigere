# Removing Checked Entries, and amounts

**Status:** ready-for-agent · enhancement

Thirteenth milestone. Checked Entries on Groceries go away once shopping is over: by hand with "Remove checked", or automatically 15 minutes after the most recent check-off. Hand-added Entries can carry an optional free-text amount ("lots", "12"). Not part of it: tabs (plan 14), Menu Entries, pack counts. See `docs/vision/groceries-and-meals.md#groceries`.

## Scope

- Entries remember when they were checked off.
- A "Remove checked" button, and automatic removal 15 minutes after the most recent check-off.
- An optional free-text amount on Entries.

## Out of scope

- A shopping-trip concept.
- Removal while no app is open. It happens the next time any Family Member opens the app, which looks the same to the shopper.
- Amounts on Staples or pack counts.

## Steps

- [x] **Checked timestamp.** Checking off sets `checkedAt` to the server time, and unchecking removes it. Rules: an update may change only `checked` and `checkedAt`. `checked == true` requires `checkedAt == request.time`, and `checked == false` requires no `checkedAt`. Rules tests for each case.
- [x] **Commit: Entries remember when they were checked off.** *(manual)* (security rules)
- [ ] **Remove checked.** A "Remove checked" button, shown when any Entry is Checked, removes them all in one batch. The app also does this by itself when the newest `checkedAt` is more than 15 minutes old. It checks on open and on a timer while open. Checked Entries without `checkedAt` (checked before this plan) count as old.
  - e2e: Remove checked removes only Checked Entries. With the clock moved 16 minutes past a check-off, they're gone. At 14 minutes they're still there.
- [ ] **Commit: remove Checked Entries by hand and after 15 minutes.** *(auto)*
- [ ] **Amount.** An Entry may have `amount` (string, 1–50 characters). Tapping an Entry's text opens an inline field for it, and an empty field removes it. The List shows it after the name: "egg · lots". Rules: `amount` is optional on create and the only other field updates may change. Rules tests.
- [ ] **Commit: free-text amounts on Entries.** *(manual)* (security rules)
- [ ] **Deploy and check.** Push. On `https://kraftigere.web.app/`: check off, Remove checked, set an amount, and wait out the 15 minutes once. *(user)*
- [ ] **Move plan to `plans/done/`.** `git mv plans/active/13-checked-and-amounts.md plans/done/13-checked-and-amounts.md`, and remove it from **Now** in `ROADMAP.md`.
- [ ] **Commit: complete checked-and-amounts milestone.** *(auto)*

## Done when

- Checked Entries disappear 15 minutes after the most recent check-off, and at once with "Remove checked".
- An Entry can show a free-text amount.

## Notes

- 2026-10-22: Decided in the grilling session: 15 minutes, counted from the most recent check-off on the List, and unchecking doesn't restart it. Unchecking the newest Checked Entry makes the next newest count, which can bring removal forward. Accepted.
- 2026-10-22: An installed app still on the old code checks off without `checkedAt`, which the rules now refuse, so the check-off reverts until the app updates on its next online launch. Accepted per ADR 0003.
