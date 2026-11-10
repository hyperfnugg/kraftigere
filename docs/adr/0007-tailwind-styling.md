---
status: accepted
---

# Tailwind for styling, without Preflight

Until now the app was styled with inline `style={{}}` objects only: 187 of them across three components, with button styles copied between files, five greys for one job, and no way to write `:hover`, `:focus-visible`, `@media` or a dark mode. Ahead of a redesign, styling moves to Tailwind v4, with its theme in an `@theme` block in `src/index.css` as the one place colours, sizes and spacing are defined.

The theme turns Tailwind's own colour palette off and defines a small set of colours named for their job (`text`, `muted`, `border`, `danger`, `accent`, `success`, `surface`), so only those can be used and dark mode can later be one swap of their values. The default type and spacing scales stay, since the app's sizes already sat on them. Patterns repeated across files, such as buttons, become small React components in `src/ui.tsx` rather than `@apply` classes. Inline `style={{}}` remains only for values computed at runtime.

Preflight, Tailwind's reset, is deliberately left out. It strips the browser's look from buttons, headings and lists, and the move to Tailwind was meant to keep the app looking the same. Turning it on belongs to the redesign, which will restyle those elements anyway.

## Considered Options

- **CSS Modules with a tokens stylesheet.** Plain CSS with nothing to install, and class names stay out of the JSX. Rejected in favour of Tailwind's ready-made scale and utilities, which are quicker to write and to change during a redesign.
- **Inline styles with a shared `theme.ts`.** The smallest change, but still no pseudo-classes, media queries or dark mode.
- **A CSS-in-JS library** such as vanilla-extract or styled-components. More dependency and concepts than a POC needs.

## Consequences

- Tailwind is the first CSS framework in the project, so CLAUDE.md's "no CSS framework" rule is replaced by the Tailwind rules. No animations, no transitions and no icon library still hold.
- Without Preflight, native elements keep browser defaults, and a utility that fights one (a margin on an `h2`, say) must say so explicitly.
- No `clsx`, Prettier class-sorting or Tailwind lint plugin: conditional classes are template strings until that gets messy.
