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
- [x] **Theme and components.** Removed `success-*` and `surface-*` from the `@theme`; turned on Preflight, with fields' borders, link underlines, black checkboxes, pointer cursors and one focus ring drawn back in the base layer. In `src/ui.tsx`: `Button` (square, black border, `small`, `inverted`), `MainAction`, `GlyphButton` (bare, 44px), `Notice`, `ErrorLine`, `StatusLine`, and the `Pot` glyph moved from `App.tsx`.
- [x] **Specimen page.** `design.html` with `src/design.tsx`, served by `npm run dev`; the production build takes only `index.html`, so it stays out.
- [x] **Commit: theme, components and specimen page** *(auto)*
- [x] **Tab Bar and More.** Square cells, the Current Tab inverted, inactive Tabs black; More square with no shadow; Offline moved above the Tab Bar.
- [x] **Rows.** At least 44px, `line` hairlines between them, wrapping Names and Details (fixes a long word widening Hjem), the Grip bare in a 44px square, Dragging an outline.
- [x] **Hjem.** The New Chip `subtle` instead of green; the chip row measured as content-box now that Preflight makes everything border-box.
- [x] **Middag and Iverksett.** Week Switcher with bare glyphs; ⏳ replaced by Busy text ("Lager …"); the next of Lag oppskrifter and Iverksett is the Main Action; Iverksett loses its title; square step numbers.
- [x] **Odabestilling.** Flat Sections instead of the tinted panel; one Status Line under Nye varer instead of one per Row; Main Actions for Koble til Oda, Fyll handlekurven, Legg i handlekurven and Bestilt; the Stepper as Glyph Buttons; the Order Summary loses its title.
- [x] **Messages everywhere.** Failures move from `accent` to `danger` Error Lines; notices stay `accent`.
- [x] **Commit: screens to the design guide** *(auto)*
- [x] **Try it on the dev server**, iterating on feedback. Skipped: the user was AFK through the merge. Instead each screen was screenshotted at 390px on the e2e stack (none scrolls sideways), which caught clipped chips and a doubled focus ring on fields. *(user)*
- [x] **Tests.** One test looked for the Order Summary's title; it now waits for the next-step line. `npx tsc -b`, `npm run lint`, `npm run test:unit` (107), `npm run test:rules` and `npm run test:e2e` (78) pass.
- [x] **Commit: tests for the design guide** *(auto)* — went with the screens' commit.
- [x] **Move plan to `plans/done/`.** `git mv plans/active/XX-design-guide.md plans/done/38-design-guide.md`.
- [x] **Commit: complete design guide milestone.** *(auto)*
- [x] **Number the plan** when it merges into `main`: `git mv` it to the next number across `plans/active/` and `plans/done/` there, and update links to it. Skip if already numbered.

## Done when

- `DESIGN.md` names every recurring part of the UI, its states, and the rules.
- The `@theme` has only the colours `DESIGN.md` lists.
- `/design.html` on the dev server shows every part and state.
- Every screen follows `DESIGN.md`, and nothing on a phone-width screen scrolls sideways.
- Typecheck, lint, unit, rules and e2e tests pass.

## Notes

- 2026-11-11: Decided in a grilling session. Monochrome with colour only for attention (`accent` notices, `danger` errors); the green New Chip goes grey. Square, flat, 1px black borders; the Main Action and the Current Tab inverted. Preflight on so buttons look the same on every browser. No screen titles. One Status Line per Section, never per Row. No success messages. The user was AFK from here and asked for auto commits through to `main`.
