# Design

How Kraft looks and what its parts are called. `CONTEXT.md` names the domain (Ware, Entry, Menu); this file names the screen (Row, Chip, Main Action), so a change can be talked about in either. To see every part and state rendered, run `npm run dev` and open `/design.html`.

**Functional first, then friendly, then stylish.** The look is brutalist and early-web: system font, black on white, square boxes with 1px black borders, no shadows, no rounding, no motion. It is monochrome: colour appears only for something that needs attention.

## Language

UI terms are English in code and docs. A term's _UI_ line gives the Norwegian the Family sees, its _Look_ line how it's drawn, and `ui.tsx` the component, where there is one.

### Frame

**Tab Bar**:
The bar at the bottom of every screen, holding the Tabs. It is the only way to tell which screen you're on: screens have no titles.
_Look_: a row of equal square cells with 1px black borders, fixed to the bottom, above a `line` rule.

**Tab**:
One cell of the Tab Bar: ⌂ (Home), "Handle" (Shop), and ⋮ (More). On a tab inside More, the ⋮ cell shows that tab's name too, like "Middag ⋮".
_Look_: black text on white; the Current Tab is inverted.

**More**:
The popover from ⋮ in the Tab Bar, holding the Avatar and the tabs that don't fit: Middag and Odabestilling.
_UI_: "Mer" (its label)
_Look_: a square white box with a 1px black border, no shadow, its tabs as full-width Buttons.
_Avoid_: Menu (that's the week's dinners), overflow

**Avatar**:
The signed-in Family Member's initials in More, opening who's signed in and "Logg ut".
_Look_: the one round thing in the app, since it stands for a person; `subtle` fill, black initials.

**Dialog**:
A box over the screen for one task, such as picking which dinner an Ingredient came from. Closed by ✕ in its corner, Esc, or tapping outside.
_Look_: a square white box with a 1px black border on a dimmed screen, at most 24rem wide.
_Avoid_: modal, popup, sheet

**Section**:
A group of Rows or fields under a heading inside a screen, like "Nye varer" on Odabestilling.
_Look_: no box; a `text-lg` black heading over its content.
_Avoid_: card, panel

**Fold**:
A Section that opens in place when its heading is tapped (a `<details>`), like the checked Entries on Handle.
_Look_: a Section whose heading starts with the browser's ▸.

### Lists

**Row**:
One line of a list: an Entry, a Meal, an Oda line.
_Look_: at least 44px tall, separated from the next by a `line` hairline; long words wrap rather than widen the page.
_Avoid_: item, line (a Row on Iverksett is still a Row)

**Box**:
The checkbox at the start of a Row. Ticked when its Entry is Checked.
_Look_: the browser's checkbox, sized up to 1.25rem.

**Name**:
What a Row is about, such as the Ware's name: the first text in the Row.
_Look_: black, `text-base`.

**Detail**:
Everything secondary in a Row after its Name: the Source Mark, the Note, the amount. Parts are separated by " · ".
_Look_: `muted`, the same size as the Name, wrapping under it when long.

**Source Mark**:
The pot glyph in a Detail saying an Entry came from Middag; tapping it opens which dinners.
_Look_: a Glyph in `muted`.

**Grip**:
The ↕ at the end of a Row on Handle, dragged to change the Store Order.
_UI_: "Flytt" (its label)
_Look_: a bare Glyph Button.
_Avoid_: handle (Handle is a tab)

### Fields

**Add Field**:
The text field on Home for adding an Entry.
_UI_: "Hva trenger vi?" (its placeholder)
_Look_: full-width, a 1px black border, square, `text-base`.

**Chip**:
A pickable suggestion under a field, such as a Staple under the Add Field or a Favourite under a dish name.
_Look_: a small Button.
_Avoid_: tag, pill

**New Chip**:
The first Chip, "+" or "+ text", which adds what's typed as a new Ware instead of picking a suggestion.
_Look_: a Chip with a `subtle` fill, to set it apart without colour.

**Search Field**:
A field that searches as you type, such as for an Oda Product.
_UI_: "Søk, eller lim inn lenke fra oda.com"
_Look_: like the Add Field.

**Stepper**:
− n + for a number, such as a Pack Count.
_Look_: two Glyph Buttons around the number.

**Week Switcher**:
‹ week › at the top of Middag, moving between weeks.
_UI_: "Uke 46 · 9.–15. nov"; "Forrige uke" and "Neste uke" (the glyphs' labels)
_Look_: two Glyph Buttons around a `text-lg` bold label.

### Actions

**Button**:
A tappable box with a text label, for any action that isn't the Main Action.
_Look_: `<Button>`: white fill, 1px black border, square, black text; `small` for those in Rows and Chips.

**Main Action**:
The one action a screen or Dialog exists for, such as "Fyll handlekurven", "Iverksett" or "Logg inn med Google". At most one per screen or Dialog.
_Look_: `<MainAction>`: a Button inverted: black fill, white text.

**Glyph Button**:
An action shown as a single text glyph instead of words: ✕, ×, ↻, ☆, ‹, ›, −, +, ↕. Always has a Norwegian `aria-label`.
_Look_: `<GlyphButton>`: the bare glyph in black, no box, `text-xl`, with a hit area of at least 44×44px.
_Avoid_: icon, emoji

**Text Button**:
A button that reads as the text around it, such as a dish name that opens its Recipe.
_Look_: `<TextButton>`: no box, the surrounding font.

**Glyph**:
A plain Unicode character used as a picture, such as ⌂ or ↻. Never an emoji, never an icon font or image.

### Messages

**Status Line**:
One line saying what's happening now, while it happens, such as "Søker …" or "Finner Oda-produkter …". One per Section at most, never one per Row.
_Look_: `<StatusLine>`: `muted`, `text-base`, ending in " …".

**Notice**:
Something to notice that isn't broken: offline, Outdated, a partial result.
_Look_: `<Notice>`: `accent` text; as a block, `accent-pale` fill with an `accent-light` border.

**Error Line**:
Something that failed or blocks the next step, said in words of what to do.
_Look_: `<ErrorLine>`: `danger` text, directly under the control that failed.

## States

Each UI state has one look, wherever it appears. Domain states (Checked, Outdated, In Basket) keep their names from `CONTEXT.md` and borrow these looks.

**Current**:
The Tab you're on.
_Look_: inverted: black fill, white text.

**Disabled**:
Shown but not tappable right now.
_Look_: `faint` text and border, no fill change.

**Busy**:
A control waiting on the network after a tap. Its label says what it's doing, ending in " …" ("Fyller handlekurven …"), and it can't be tapped again.
_Look_: Disabled, with the Busy label. Never ⏳, a spinner or a progress bar.

**Highlighted**:
The Chip or Row the arrow keys are on.
_Look_: a 2px black outline.

**Dragging**:
The Row being moved by its Grip.
_Look_: a 2px black outline; the other Rows stay put until it's dropped.

**Offline**:
The app has no network; changes are saved when it's back.
_UI_: "Frakoblet: endringer lagres når nettet er tilbake"
_Look_: a Notice above the Tab Bar.

**Empty**:
A list or Section with nothing in it.
_Look_: one `muted` line saying what would be here, such as "Ingen varer".

### Transitions

Every action goes **Ready → Busy → Ready**. On success the change itself shows; there is no success message. On failure an Error Line appears under the control, and clears on the next try. Changes are instant: no animations, no transitions.

## Rules

### Colour

Only the colours in the `@theme` of `src/index.css` exist. Each has one job:

| Name | Job |
|---|---|
| `black` | Text, borders, Glyphs, the inverted fill |
| `white` | The page, and every box's fill |
| `muted` | Secondary text: Details, Status Lines, Empty |
| `faint` | Disabled text and borders |
| `line` | Hairlines between Rows and above the Tab Bar |
| `subtle` | A quiet fill: the New Chip, the Avatar |
| `accent` (`-dark`, `-light`, `-pale`) | Notices only |
| `danger` | Error Lines only, and a Row that blocks the Main Action |

No other colour is added for decoration, grouping or success. If something needs to stand out without needing attention, use weight, inversion or position instead.

### Type

`system-ui` throughout. Sizes come from the theme: `text-sm` only for a `small` Button, `text-base` for nearly everything, `text-lg` for Section headings and the Week Switcher, `text-xl` for Glyph Buttons. Bold is for Section headings, the Week Switcher, and Names that must stand out (a line that blocks the Main Action). No titles on screens.

### Space and layout

- Phone first. Content is at most 32rem wide and centred; Dialogs at most 24rem.
- The page has 1rem (`p-4`) at the sides, and room at the bottom for the Tab Bar.
- Spacing is `gap` on the parent, not margins on children: `gap-1` inside a Row's Detail, `gap-2` between Rows' contents and in Sections, `gap-4` between Sections.
- Anything tappable is at least 44×44px.
- Text never widens the page: long words wrap (`wrap-anywhere`).

### Surfaces

Square corners everywhere (except the Avatar). Borders are 1px `black`; hairlines between Rows are 1px `line`. No shadows, no gradients, no tinted panels: a Section is a heading, not a box.

### Copy

- Norwegian bokmål, in sentence case: "Fyll handlekurven", not "Fyll Handlekurven".
- Labels are verbs for actions ("Legg til", "Iverksett") and nouns for places ("Handle", "Middag").
- Busy and Status texts end in " …" with a space, and say what's happening: "Finner Oda-produkter …".
- Error Lines say what failed and what to do, without apologising.
- Domain words follow the _UI_ lines in `CONTEXT.md`.
