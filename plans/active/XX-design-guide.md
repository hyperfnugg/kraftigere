# Design guide

**Status:** ready-for-agent · enhancement

A shared look and a shared vocabulary for the UI, so screens stay consistent and changes are easy to talk about. `DESIGN.md` names every recurring part of the screen (Row, Chip, Main Action), its states and transitions, and the rules for colour, type, space, surfaces and copy. Then the app is redesigned to match: functional first, friendly second, stylish third, in a monochrome, brutalist, early-web look with colour only for what needs attention. Not covered: dark mode, new features, or renaming the Norwegian labels.

## Scope

`DESIGN.md`; the theme in `src/index.css` cut to the colours it lists, with Preflight on; the components it names in `src/ui.tsx`; a dev-only specimen page, `design.html`, rendering each part and state; and Hjem, Handle, Middag, Odabestilling, More and the Dialogs restyled to match.

## Out of scope

- Dark mode, though the colours named by job keep it one swap away.
- New features, and wording beyond the Busy and Status texts.
- Splitting `App.tsx` or `Meals.tsx`.
- Screen titles: the Tab Bar alone says where you are.

## Steps

- [x] **Write `DESIGN.md`**, point the Style rule in `CLAUDE.md` at it, and move the style guide idea in `ROADMAP.md` to **Now**.
- [x] **Commit: design guide and plan** *(auto)*
- [ ] **Theme and components.** Remove `success-*` and `surface-*` from the `@theme`; turn on Preflight. In `src/ui.tsx`: `Button` (white, black border, square), `MainAction` (inverted), `GlyphButton` (bare, 44px hit area), `Notice`, `ErrorLine`, `StatusLine`. Restore what Preflight strips that the app relies on (list bullets aren't used; heading sizes and margins become explicit).
- [ ] **Specimen page.** `design.html` with `src/design.tsx`, a second Vite entry served by `npm run dev` and left out of the production build, rendering each term in `DESIGN.md` with its states.
- [ ] **Commit: theme, components and specimen page** *(auto)*
- [ ] **Tab Bar and More.** Square cells, the Current Tab inverted, inactive Tabs black; More square with no shadow.
- [ ] **Rows.** At least 44px, `line` hairlines between them, wrapping Names and Details (fixes a long word widening Hjem), the Grip a bare Glyph Button.
- [ ] **Commit: Tab Bar, More and Rows** *(auto)*
- [ ] **Hjem.** Add Field and Chips; the New Chip `subtle` instead of green.
- [ ] **Middag and Iverksett.** Week Switcher with bare glyphs; ⏳ replaced by Busy text; Main Actions.
- [ ] **Odabestilling.** Flat Sections instead of the tinted panel; one Status Line instead of one per Row; Fyll handlekurven a Main Action.
- [ ] **Messages everywhere.** Failures move from `accent` to `danger` Error Lines; notices stay `accent`.
- [ ] **Commit: screens to the design guide** *(auto)*
- [ ] **Try it on the dev server**, iterating on feedback. Skipped: the user is AFK through the merge. *(user)*
- [ ] **Tests.** Update tests that expect old texts or structure, then `npx tsc -b`, `npm run lint`, `npm run test:unit`, `npm run test:rules` and `npm run test:e2e`.
- [ ] **Commit: tests for the design guide** *(auto)*
- [ ] **Move plan to `plans/done/`.** `git mv plans/active/XX-design-guide.md plans/done/XX-design-guide.md`.
- [ ] **Commit: complete design guide milestone.** *(auto)*
- [ ] **Number the plan** when it merges into `main`: `git mv` it to the next number across `plans/active/` and `plans/done/` there, and update links to it. Skip if already numbered.

## Done when

- `DESIGN.md` names every recurring part of the UI, its states, and the rules.
- The `@theme` has only the colours `DESIGN.md` lists.
- `/design.html` on the dev server shows every part and state.
- Every screen follows `DESIGN.md`, and nothing on a phone-width screen scrolls sideways.
- Typecheck, lint, unit, rules and e2e tests pass.

## Notes

- 2026-11-11: Decided in a grilling session. Monochrome with colour only for attention (`accent` notices, `danger` errors); the green New Chip goes grey. Square, flat, 1px black borders; the Main Action and the Current Tab inverted. Preflight on so buttons look the same on every browser. No screen titles. One Status Line per Section, never per Row. No success messages. The user was AFK from here and asked for auto commits through to `main`.
