# Roadmap

Where Kraft is heading. It changes often. Ideas are one line each, cheap to add and delete, in no particular order. When work on an idea starts, it becomes a plan in `plans/active/` and moves to **Now**. Terms follow `CONTEXT.md`.

## Now

- [Dependency maintenance](plans/active/05-dependency-maintenance.md)
- [Shared Oda Products](plans/active/28-shared-oda-products.md)
- [Pack Counts on the Order Summary](plans/active/30-pack-counts-on-the-summary.md)
- [Oda in production](plans/active/29-oda-in-production.md)

## Ideas

- Style guide: one short page on how the app looks. Icons are plain black text glyphs on a transparent background (⌂ for Hjem, ↻ for a new dish), sized up a little, not emoji or boxed buttons.
- Rescaling a Recipe's amounts when its servings change.
- Timers from the times in a Recipe's steps.
- Active and total time on a Recipe.
- Confirming again: bringing Menu Entries up to date after a week's Recipes change. See [Groceries and meals](docs/vision/groceries-and-meals.md#confirming-again).
- Several Lists: create, name and switch between Lists of a List Kind.
- Categorized shopping Lists, such as kids' clothes and IKEA.
- Templates, such as packing for a trip.
- Personal Lists.
- To-do Lists.
- List Kinds that share behaviour (a hierarchy of kinds).
- Calendar integration.
- Firestore backups, now that Blaze makes them possible (ADR 0004).

### Duplicate Wares

- Renaming and merging Wares on Home: a new name, with autocomplete over all Wares, moves the Ware, and a name already in use merges the two, with their Entries, counts and matches.
- Aliases: a Ware's other names, kept in `matches`, listed on the Ware and removable, used when typing on Home and given to the AI at Iverksett.
- Autocomplete over all Wares when changing a line's Ware at Iverksett.
- "Ny vare" on Iverksett lines that would create a Ware, with the AI's closest existing Ware one tap away.
- Offering a merge in the choosing when a Ware gets an Oda Product another Ware has: "Slå sammen" or "Behold begge".
- Tidying Wares: the AI proposes likely duplicates among all Wares and their Oda Products, each answered yes or no, with a no remembered.
- Shop sorted by name, so "salt" and "salt, natriumklorid" sit together before leaving the shelf.
