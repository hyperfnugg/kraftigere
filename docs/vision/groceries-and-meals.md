# Groceries and meals

Where Groceries, meal planning and Oda are heading, and how they connect. This is the target, not a plan: work on any part becomes a plan in `plans/active/`. Terms follow `CONTEXT.md`.

## The model in one picture

```
Home ──types "melk"──▶ Ware "melk" (a Staple)
                         │
                         ▼
                  Entry "melk · mye"

Week ─▶ Menu ─▶ Meal ─▶ Recipe "Sufflé" ─▶ Step ─▶ Ingredient "melk, hel 500 g" ──matched──▶ Ware "melk, hel"
                                                         │
                                                      Confirm
                                                         ▼
                                     Entry "melk, hel · 👨‍🍳 500 g" ──👨‍🍳──▶ Sufflé
```

Three different things are easy to confuse here:

- **Ware**: anything the Family buys, named how they say it, the thing first ("melk", "melk, hel"). Later an Oda Product belongs to exactly one Ware.
- **Staple**: a Ware the Family has added by hand. It carries what comes from knowing it well: how often it's added, whether it's usually at home.
- **Ingredient**: what a Recipe needs ("melk, hel 500 g"). Its wording says how strict the need is.

A Ware is on the List once: "egg" added by hand and the week's eggs are one Entry, "egg · store · 👨‍🍳 360 g (6 stk)", and the chef's hat (👨‍🍳 here) lists the dishes behind it. The Recipe's intent is kept: the soufflé's "melk, hel" is its own Ware, so it sits next to the fridge's "melk" as a separate line.

## Groceries

Today's List becomes the Groceries List. Examples: "melk", "bleier", "epler", "sukker".

- **Adding.** Typing shows autocomplete over the Family's Staples, ranked by both text match and how often each Staple is added, with recent adds weighted more. Picking a Staple adds an Entry for it. Text that matches no Staple creates a new Ware, which is then a Staple. A Ware is on the List at most once: adding one that's waiting opens its Entry's Note instead, and adding one that's Checked replaces that Entry with a new one.
- **Fast autocomplete.** The lookup must feel instant, so the app keeps the Staples and their frequencies locally and refreshes them lazily.
- **Note.** Every Entry has an optional free-text Note, usually empty ("I'm out of eggs, buy lots", "the lactose-free one").
- **Checking off.** A Checked Entry stays on the List, greyed out, so the shopper can see what's done. "Remove checked" removes all of them at once. Fifteen minutes after the most recent check-off on Groceries, all Checked Entries are removed automatically. Unchecking doesn't restart the timer. Something found at home is just checked off.
- **History.** History lives on Wares, so removing Entries loses nothing.

### Later

- **Aliases and merging.** "melk" and "mjølk" become one Ware, with frequencies combined. An Oda Product belongs to exactly one Ware, which helps find duplicates.
- **More on Wares.** Oda reference, price, nutrition.
- **Store-walk order in Shop.** This needs each Ware's place in a particular store, which is a design of its own.

## Tabs and Home

The app has tabs for usage scenarios, each built for what you're doing at that moment:

| Tab | Scenario | Contains |
|---|---|---|
| **Home** | "Quick, before I forget" | Quick-add to every List currently in play. Groceries editing, newest first: Notes and removing, never checking off |
| **Meals** | "What's for dinner" | Planning and cooking: Guidelines, Day Notes, Menu, Recipes, Confirm |
| **Shop** | "I'm in the store" | Groceries: unchecked first, big text, check-off |
| **Oda** | "Fill the Basket" | The Oda Order: choosing, then "Bestilt" or "Avbryt". Behind ⋮ with Meals |
| **Lists** | Other Lists | IKEA, kids' clothes and the like, when Several Lists arrives |
| **Trip** | "We're going away" | Speculative: planning and packing from Templates |

Lists "in play" on Home: Groceries always, to-dos, and an upcoming trip's List until the trip starts. This makes it extremely simple to jot down "sunglasses" while in the middle of something else.

## Meal planning

One week at a time. A Family Member goes through these stages, and the AI does the writing:

- **Guidelines** (standing, written once, edited rarely). Example:
  > Meals should avoid ultra processed ingredients and take at most 20 minutes to cook. Friday is always tacos.
  > Who eats (assume all are present unless stated otherwise):
  > Peter: dislikes scallops. Mary: intolerant to lactose and mercury. Paul: born 2019, favourite meal pizza.

  The people named are whoever eats. They're free text, not Family Members.
- **Day Notes** (one day of this week only), next to each day. Examples:
  > Monday: Mary's parents visit, 3 courses, 1.5 hours prep.
  > Wednesday: Peter is away.
- **Menu.** The AI names a Meal, dinner, one dish for each day, as soon as the week is this week or next, so it's just there. The Family Member taps a day to change its Note or dish, or asks the AI for a new dish for it (↻).
- **Recipes.** When the days look right, "Lag oppskrifter" has the AI write every Recipe at once. That happens once: afterwards the days are no longer edited from the Menu, and a Recipe is remade from its own screen. A Recipe is Steps, as in Modernist Cuisine: each Step's Ingredients beside its short instructions. Amounts are in grams, with a kitchen measure ("2 dl", "2 stk") where it helps. The Family Member cooks from a horizontal tablet, where the Recipe is a table that keeps the screen awake, or from a phone, where the Steps stack. They edit it by hand behind "Rediger", or instruct the AI ("steam the strawberries, don't boil them").
- **Confirm.** Ingredients go to Groceries (below).

### Outdated

When the Guidelines change after a Menu exists, the Menu becomes **Outdated**. A Recipe becomes Outdated when the Guidelines, its day's Day Note or its own Meal change. Each shows when it became so. A changed Day Note only makes the day's Recipes Outdated, never the Meal: the Family Member decides whether the dinner itself should change. Nothing Outdated is remade until a Family Member asks, because remaking would overwrite their edits. Tapping "Utdatert" on the Menu, or ↻ on a Recipe's screen, asks "Lag på nytt? Endringer du har gjort forsvinner." and then remakes. A dish whose name changes is different, not Outdated: it loses its Recipe, and gets a new one from "Lag oppskrift". Later improvement: remaking that keeps hand edits.

### Confirm

- Each Ingredient is matched to the **Ware** that is the same thing to buy. What doesn't change the purchase is dropped ("salt, fin" is "salt"), but the Recipe's intent is kept ("melk, hel" stays "melk, hel" even when the Family has "melk"). The AI proposes matches, the Family Member corrects them, and the Family's matches are remembered for later weeks. Duplicate Wares are cleaned up as they show up.
- The Confirm screen shows one line per Ware with its summed grams, stk where there are pieces, and days: "egg 360 g (6 stk) · fre". An unticked line is at home, and its Ware is remembered as usually at home. A Ware already waiting on the List isn't shown.
- Each Ware's Entry gets the dishes that need it, with their grams and stk, and shows the sum: "egg · store · 👨‍🍳 360 g (6 stk)". The chef's hat lists the dishes, each opening its Recipe. In the store, the shopper picks packs from what's on the shelf.
- A week is Confirmed once. Afterwards its Menu and Recipes can still be edited by hand, but without the AI, and the edits don't change Groceries.

### Later

#### Confirming again

- Only the week's dishes on Entries change. Notes, and Entries the Family added by hand, are kept.
- Unchecked Entries are brought up to date without asking: dishes removed if no longer needed, amounts updated, new ones added.
- Checked Entries (bought, or ordered from Oda) stay as they are. If re-Confirm would change or remove any of them, a confirmation lists them first: "Already bought: venison, no longer needed."

## Ordering from Oda (parked)

- **Kraft only fills the Basket.** The Family Member places the order in Oda. The Odabestilling tab opens on the choosing: the unchecked Entries, "Nye varer" first, then "Tidligere kjøpte varer" ticked, each with its Note and Oda Product. Entries without one get one chosen right there, which is where most Wares first get their Oda Product. Wares never from Oda are at the bottom, folded away as "Utenfor Oda (15)". "Fyll handlekurven" puts the ticked Entries In Basket, unless some has no Oda Product ("Alle varer må ha et Oda-produkt", with those Entries marked). The tab then says the next step is the Family Member's own, ordering in the Basket on oda.com, and offers "Bestilt", which checks the In Basket Entries off, or "Avbryt", which takes the packs Kraft put in back out of the Basket and leaves them unchecked. A reload, or another device, picks the Oda Order up where it was.
- **Groceries is locked while an Oda Order lasts.** Home says "Odabestilling pågår" and changes nothing, Shop checks nothing off, and Iverksett on Middag waits.
- **Avbryt asks first.** "Ta ut varene Kraft la i handlekurven?" with "Avbryt odabestillingen" and "Tilbake". It takes out exactly the packs Kraft added, so what was in the Basket before, or was added on oda.com, stays. "Tilbake" never touches the Basket.
- **"Ikke tilgjengelig".** Filling the Basket shows what isn't available, as Oda doesn't say until then, and those packs come straight back out. An optional step lists those Wares on one screen, each with a search, and "Hopp over" skips it. A Substitute is for this Oda Order only: next time the Ware tries its own Oda Product again. What gets nothing in its place is Left Out: listed under the In Basket lines, unchecked after "Bestilt", for buying in a store.
- **"Ikke lenger tilgjengelig".** An Oda Product that's Off Sale leaves its Ware at filling. What's picked in the step becomes the Ware's new Oda Product. If nothing is, the Ware waits in "Nye varer" with a suggestion next time.
- **Pack counts appear only here.** "3 × Tine helmelk 1 l". The AI reads the Pack Size of the Ware's Oda Product once, and Kraft works out from it enough packs for the Entry's dishes. An Entry with no amounts starts at one pack. A Note doesn't count: the Family Member reads it and changes the count while choosing.
- **Prerequisites.** Staples, Wares and Confirm must exist first.
- **Technical route: Oda's MCP server**, with a Cloud Function as the client. The Ware remembers its Oda product id with the name and pack text. See [ADR 0005](../adr/0005-oda-route.md).

## Order of work

- **Groceries.** Staples, autocomplete, Notes, "Remove checked" and the 15-minute removal, on today's List. Changing the Entry shape follows ADR 0003: an existing Entry becomes an Entry for a Staple created from its text. Wares can wait.
- **Home and Shop tabs.**
- **Several Lists.**
- **Meal planner.** This is where Wares, matching and Confirm arrive.
- **Oda.**
