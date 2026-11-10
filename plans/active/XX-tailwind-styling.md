# Tailwind styling

**Status:** ready-for-agent · enhancement

Move the app's styling from inline `style={{}}` objects to Tailwind v4, as groundwork for a redesign in a separate thread. The app should look the same afterwards, except that near-duplicate colours merge into one named colour each. Decisions and rejected options are in [ADR 0007](../../docs/adr/0007-tailwind-styling.md). Not covered: any visual redesign, dark mode, Preflight, the style guide in `ROADMAP.md`, and splitting the large component files.

## Scope

Tailwind v4 via `@tailwindcss/vite`, a theme in `src/index.css` with a named colour set and Tailwind's default type and spacing scales, a `<Button>` in `src/ui.tsx` for the buttons copied across files, and every inline style in `Confirm.tsx`, `Meals.tsx` and `App.tsx` converted to classes.

## Out of scope

- Visual changes beyond merging near-duplicate colours, and rounding the four 1.375rem font sizes to `text-xl`.
- Preflight and dark mode. The redesign turns them on.
- Splitting `App.tsx` or `Meals.tsx` into smaller files.
- `clsx`, Prettier, or Tailwind lint plugins.
- `useWide` in `Meals.tsx`, which picks what renders, stays in JS. The modal width it also sets can become a breakpoint class.

## Steps

- [x] **Write the ADR, this plan, and the new Style rule in CLAUDE.md.**
- [x] **Commit: Tailwind styling plan, ADR and Style rule** *(auto)*
- [x] **Set up Tailwind.** `tailwindcss` and `@tailwindcss/vite` in `vite.config.ts`, and `src/index.css` with the `theme` and `utilities` layers only (no `preflight`), imported in `main.tsx`. The `@theme` turns Tailwind's palette off and names: `black`, `white`, `muted` (#555/#666/#444), `faint` (#888/#999), `line` (#ddd/#ccc/#e4e4e4 borders), `subtle` (#eee/#e4e4e4 backgrounds), `danger` (#b00020/#a00), `accent` with `-dark`, `-light`, `-pale` (#8a5a00 family), `success` with `-light`, `-pale`, and `surface` with `surface-line`. Font sizes drop Tailwind's line-heights so text keeps the browser's. `system-ui` is set on `body`.
- [x] **Add `src/ui.tsx`** with `<Button>` (and its `small` variant), matching the current `buttonStyle` / `smallButtonStyle`.
- [x] **Commit: Tailwind and its theme** *(manual)* — new dependency and build plugin.
- [x] **Convert `Confirm.tsx`.**
- [x] **Commit: Confirm on Tailwind** *(manual)*
- [x] **Convert `Meals.tsx`.** `TextButton` in `src/ui.tsx` is a button that reads as text, for the links in Meals and App. The Recipe screen widens at `sm:`, which is the 40rem of `useWide`.
- [x] **Commit: Meals on Tailwind** *(manual)*
- [ ] **Convert `App.tsx`.**
- [ ] **Commit: App on Tailwind** *(manual)*
- [ ] **Try it on the dev server**, comparing each screen with `main`, iterating on feedback. Skipped in AFK mode. *(user)*
- [ ] **Tests**: `npx tsc -b`, `npm run lint`, `npm run test:unit` and `npm run test:e2e` pass. No test checks styles, so no new tests are expected.
- [ ] **Commit: fixes from the dev server and tests** *(manual)* — skip if nothing changed.
- [ ] **Move plan to `plans/done/`.** `git mv plans/active/XX-tailwind-styling.md plans/done/XX-tailwind-styling.md`.
- [ ] **Commit: complete Tailwind styling milestone.** *(auto)*
- [ ] **Number the plan** when it merges into `main`: `git mv` it to the next number across `plans/active/` and `plans/done/` there, and update links to it. Skip if already numbered.

## Done when

- `grep "style={{" src` finds only values computed at runtime.
- No hex colour appears in `src/*.tsx`. Colours come from the theme.
- `buttonStyle` and `smallButtonStyle` exist nowhere. Buttons use `<Button>`.
- The app looks the same as `main`, apart from merged colours and the rounded font size.
- Type check, lint, unit and e2e tests pass.

## Notes

- 2026-11-10: Grilled. Tailwind was chosen over CSS Modules, Preflight is off to keep the look, and the redesign thread owns dark mode and the style guide.
