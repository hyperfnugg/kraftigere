---
status: accepted
---

# Wares may share an Oda Product

A Ware is what the Family means to buy, and an Oda Product is what Oda sells, so "melk" and "melk, hel" can rightly be the same carton. Until now an Oda Product could belong to at most one Ware. That rule goes: any number of Wares may point to the same Oda Product. Each keeps its own copy of the product's name, pack text and Pack Size, and in the choosing each Entry keeps its own line and Pack Count.

The only reason written down for the rule was that it "helps find duplicates", for a merge that doesn't exist. It worked against that: by blocking the pick, it made it rare for two Wares to reach one product, which is the very signal a merge would look for. Meanwhile it gave a dead end when picking and quietly worse suggestions, since a Ware's suggestion skipped the products other Wares had. It wasn't really enforced either. The check was client-only and against saved Wares, so unsaved picks, the step after filling and a second device all got past it.

Duplicate Wares are dealt with by the ideas in `ROADMAP.md`, in several ways rather than by matching on the product alone.

## Considered Options

- **Keeping the rule.** Rejected for the reasons above. Enforcing it properly would also take rules or a function checking every Ware, to protect something nothing depends on.
- **Forcing a merge whenever two Wares reach the same product.** Rejected: "melk" and "melk, hel" are different intents that Oda happens to meet with one product today. An Ingredient's wording says how strict the need is, and a merge would lose that. Offering a merge remains an idea in `ROADMAP.md`.

## Consequences

Accepted, since they're annoying but cheap:

- **Noise at Iverksett.** Duplicate Wares are no longer discouraged by their product, so one thing can show up as two Wares there.
- **A trip back to the shelf** when two Entries turn out to be the same thing, as Shop doesn't sort Entries by their Oda Product.
- **Rounding up twice.** Each Entry works out its own Pack Count, so two Entries can buy two packs where one would do. The Family Member can change the counts while choosing, and the Order Summary then shows one line per Oda Product, with its packs added up and the Entries it's for below it, so this can be seen before ordering.

Also:

- No data migration and no rules change: the rules never looked at this. A Basket line gets an optional `shared` for an Entry whose packs another Entry's line holds, which only the Oda functions write and clients can't, so ADR 0003's rules have nothing to check.
- An Off Sale product leaves only the Wares being filled. Other Wares with it find out when they're next filled.
