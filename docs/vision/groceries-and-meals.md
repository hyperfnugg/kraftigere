# Groceries and meals

Where Groceries, meal planning and Oda are heading, and how they connect. This is the target, not a plan: work on any part becomes a plan in `plans/active/`. Terms follow `CONTEXT.md`.

## The model in one picture

```
Home ──types "melk"──▶ Staple "melk" ──prefers──▶ Ware "Tine helmelk 1 l"
                         │                └─accepts──▶ Ware "Tine lettmelk 1 l"  (Substitute)
                         ▼
                  Entry "melk" (hand-added)

Week ─▶ Menu ─▶ Meal ─▶ Recipe ─▶ Ingredient "300 ml whole milk" ──matched──▶ Ware "Tine helmelk 1 l"
                                  Ingredient "5 dl milk, any"    ──matched──▶ Staple "melk"
                                         │
                                    Confirm
                                         ▼
                                  Entry "helmelk 3 dl · Fri" (Menu Entry)
```

Three different things are easy to confuse here:

- **Staple**: what the Family keeps buying, named how they say it ("melk"). It says what will do.
- **Ingredient**: what a Recipe needs ("300 ml whole milk"). Its wording says how strict the need is.
- **Ware**: the specific thing in the basket ("Tine helmelk 1 l").

Staples and Ingredients point to Wares. The soufflé's whole milk and the fridge's "melk" can point to the same Ware and still be different needs: one accepts lettmelk, the other doesn't. That's why they stay separate Entries.

## Groceries

Today's List becomes the Groceries List. Examples: "melk", "bleier", "epler", "sukker".

- **Adding.** Typing shows autocomplete over the Family's Staples, ranked by both text match and how often each Staple is added, with recent adds weighted more. Picking a Staple adds an Entry for it. Text that matches no Staple creates a new Staple with only a name. A Ware can be attached later.
- **Fast autocomplete.** The lookup must feel instant, so the app keeps the Staples and their frequencies locally and refreshes them lazily.
- **Note.** A hand-added Entry has an optional free-text Note, usually empty ("I'm out of eggs, buy lots", "the lactose-free one").
- **Checking off.** A Checked Entry stays on the List, greyed out, so the shopper can see what's done. "Remove checked" removes all of them at once. Fifteen minutes after the most recent check-off on Groceries, all Checked Entries are removed automatically. Unchecking doesn't restart the timer. Something found at home is just checked off.
- **History.** History lives on Staples, so removing Entries loses nothing.

### Later

- **Aliases and merging.** "melk" and "mjølk" become one Staple, with frequencies and Wares combined.
- **More on Wares.** Oda reference, price, nutrition.
- **Store-walk order in Shop.** This needs each Ware's place in a particular store, which is a design of its own.

## Tabs and Home

The app has tabs for usage scenarios, each built for what you're doing at that moment:

| Tab | Scenario | Contains |
|---|---|---|
| **Home** | "Quick, before I forget" | Quick-add to every List currently in play. Groceries editing, newest first: Notes and removing, never checking off |
| **Meals** | "What's for dinner" | Planning and cooking: Guidelines, Day Notes, Menu, Recipes, Confirm |
| **Shop** | "I'm in the store" | Groceries: unchecked first, big text, check-off |
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
- **Menu.** The AI makes a Meal, dinner, for each day as soon as the week is this week or next, so it's just there. The Family Member edits a day directly, asks the AI to suggest a new Meal for it, or instructs the AI about the whole Menu ("Mary's father doesn't like fish").
- **Recipes.** The AI writes a Recipe for each course of each Meal right after, and again whenever a course changes. Ingredient amounts are in grams unless stated otherwise. The Family Member reads a Recipe full screen while cooking, and edits it directly or instructs the AI ("steam the strawberries, don't boil them").
- **Confirm.** Ingredients go to Groceries (below).

### Outdated

When the Guidelines change after a Menu exists, the Menu becomes **Outdated**. A Recipe becomes Outdated when the Guidelines, its day's Day Note or its own Meal change. Each shows when it became so. A changed Day Note only makes the day's Recipes Outdated, never the Meal: the Family Member decides whether the dinner itself should change. Nothing Outdated is remade until a Family Member asks, because remaking would overwrite their edits. Tapping "Utdatert" on the Menu or 🔄 next to a Recipe's course asks "Lag på nytt? Endringer du har gjort forsvinner." and then remakes. A course whose name changes is different, not Outdated: it loses its Recipe and gets a new one at once. Later improvement: remaking that keeps hand edits.

### Confirm

- Each Ingredient is matched to a **Ware** (the Recipe needs exactly this) or a **Staple** (whatever the Family usually buys will do). The AI proposes matches, the Family Member corrects them, and the Family's matches are remembered for later weeks. Speciality items (a particular pasta) match a Ware of their own, and everyday ones (salt, oil, milk for pancakes) match Staples.
- All of a week's Ingredients matched to the same Ware or Staple become one **Menu Entry**, showing the summed amount and the days it serves: "helmelk 3 dl · Fri". In the store, the shopper picks packs from what's on the shelf.
- Menu Entries are marked as such and never merge with hand-added Entries, even for the same Staple.
- A week is Confirmed once. Afterwards its Menu and Recipes can still be edited by hand, but without the AI, and the edits don't change Groceries.

### Later

#### Confirming again

- Hand-added Entries are never touched.
- Unchecked Menu Entries are brought up to date without asking: removed if no longer needed, amounts updated, new ones added.
- Checked Menu Entries (bought, or ordered from Oda) stay as they are. If re-Confirm would change or remove any of them, a confirmation lists them first: "Already bought: venison, no longer needed."

## Ordering from Oda (parked)

- **Kraft only fills the basket.** The Family Member places the order. Ordered Entries become Checked.
- **Pack counts appear only here.** "3 × Tine helmelk 1 l". For Menu Entries the AI turns the summed amount into packs of the matched Ware. For hand-added Staples Kraft always asks the count, with a suggested amount.
- **Choosing Oda products.** Picking means back and forth ("did you mean this one?" "No, this one: <url>"). What's settled is remembered on the Ware as its Oda reference. When a Ware is out of stock, Staple Entries fall back to the Staple's Substitutes. Ingredient Entries fall back only as far as the Ingredient's wording allows.
- **Prerequisites.** Staples, Wares and Confirm must exist first.
- **Technical route: open.** Candidates: Oda's MCP server (https://oda.com/mcp), https://kassal.app/api with keys stored on the device, a browser extension, or a native app on Firestore. Picking one is research for when the work starts.

## Order of work

- **Groceries.** Staples, autocomplete, Notes, "Remove checked" and the 15-minute removal, on today's List. Changing the Entry shape follows ADR 0003: an existing Entry becomes an Entry for a Staple created from its text. Wares can wait.
- **Home and Shop tabs.**
- **Several Lists.**
- **Meal planner.** This is where Wares, matching and Confirm arrive.
- **Oda.**
