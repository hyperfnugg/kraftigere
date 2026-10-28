# Roadmap

Where Kraft is heading. It changes often. Ideas are one line each, cheap to add and delete, in no particular order. When work on an idea starts, it becomes a plan in `plans/active/` and moves to **Now**. Terms follow `CONTEXT.md`.

## Now

- [Dependency maintenance](plans/active/05-dependency-maintenance.md)
- [Oda Products on Wares](plans/active/24-oda-products-on-wares.md)

## Next

Filling the Basket from Groceries ([ADR 0005](docs/adr/0005-oda-route.md)), on the `oda` branch, in this order. It runs against the real oda.com from `npm run dev`; nothing deploys until the last one.

- Oda Order on Shop: "Start odabestilling", "Bestilt" and "Avbryt", one pack per Entry.
- Pack counts by AI from an Entry's amount, Note and dishes.
- Choosing Oda Products with the AI, back and forth ("no, this one: <url>").
- Substitutes when an Oda Product is unavailable, "ikke tilgjengelig" when none is found.
- Oda in production: Blaze with the three spending limits, the production Oda client, App Check on the function, deploy, and merge `oda` into `main`.

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
