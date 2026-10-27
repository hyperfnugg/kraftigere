# Family coordination

The family's one place for what to buy, plan and do. It starts with shared Lists, shopping first. A Family's Lists are shared by all its Family Members.

## Language

The app speaks Norwegian (bokmål); code, docs and Firestore use the English terms. Each term's _UI_ line gives the word the Family sees.

### Lists

**List**:
A collection of Entries belonging to at most one Family, which can have many Lists, including several of the same List Kind (kids' clothes and IKEA are separate shopping Lists). Lists are never shared across Families.
_UI_: "liste" ("lista" when it means the Family's one List)
_Avoid_: Shopping list (one List Kind, not the general concept)

**List Kind**:
What a List is for, such as shopping or to-do. Every Entry on a List is of the List's kind, and the List Kind decides how the List behaves. Groceries is the only List Kind in use today, and the Family's one List is its Groceries List.
_Avoid_: List type, category

**Groceries**:
A List Kind that is a kind of shopping, for food and household goods bought again and again. A Groceries List has everything a shopping List has, plus behaviour of its own.
_UI_: "Dagligvarer"
_Avoid_: Food list

**Ware**:
Anything the Family buys, named the way they say it, such as "melk", "løk, gul" or "vinterjakke". It need not be groceries and may be bought only once. A Ware has a name unique within the Family and lasts beyond any one Entry. It is the Family's own idea of the thing, not a shop's product, though later an Oda article may belong to exactly one Ware.
_UI_: "Vare"
_Avoid_: Product, grocery, item, article

**Staple**:
A Ware the Family has added by hand, and so knows well. A Staple remembers how often it is added and whether it is usually at home, and later names its Substitutes. Autocomplete suggests Staples.
_UI_: "Basisvare"
_Avoid_: Favourite, regular, item

**Substitute**:
A Ware a Staple accepts when the Staple itself isn't available.
_Avoid_: Alternative, replacement

**Personal List**:
A List that belongs to one Family Member and is visible only to them. Every List is either the Family's or Personal, never shared by only some Family Members.
_Avoid_: Private list

**Template**:
A saved List to start new Lists from, such as packing for a cabin trip. Creating a List from a Template copies its Entries. Later changes to the Template don't affect Lists already made from it.
_Avoid_: Preset, blueprint

**Entry**:
One line on a List. On Groceries an Entry is for one Ware, and a Ware has at most one Entry waiting: adding it again, by hand or at Confirm, adds to that Entry, and a Checked Entry for it is replaced by a new one. An Entry may have a Note and the dishes Confirm added it for.
_UI_: not named; the add field asks "Hva trenger vi?" and its button says "Legg til"
_Avoid_: Item, product, task

**Note**:
Free text on an Entry saying anything more about it, such as "lots" or "the lactose-free one".
_UI_: "Notat"
_Avoid_: Amount, comment, description

**Checked**:
The state of an Entry that has been dealt with, whether bought, done, or otherwise. A Family Member *checks off* an Entry and can *uncheck* it. Checking off an Entry because it is already at home is still checking it off.
_UI_: "Avkrysset"; checking off is "krysse av"
_Avoid_: Done, bought, completed

**Remove**:
Permanently deleting an Entry from a List. This is the only way an Entry leaves a List. It is distinct from checking it off.
_UI_: "Fjern"; removing all Checked Entries is "Fjern avkryssede"
_Avoid_: Delete, clear, archive

### Meals

**Guidelines**:
The Family's standing guidance for planning meals, applying to every week, such as cooking time, dislikes and intolerances. The people it mentions are whoever eats, who need not be Family Members.
_UI_: "Føringer"
_Avoid_: Preferences, profile, rules

**Day Note**:
Guidance for planning one day of one particular week, such as guests or someone away, shown next to the day. It can be edited until the week's Recipes are made.
_UI_: "Notat"
_Avoid_: Note (that is on an Entry), Week Notes (the single note on a whole week it replaced)

**Menu**:
Which Meal is eaten on which day of one week. The AI makes it, dish names only, from the Guidelines and Day Notes as soon as the week is this week or next. A Family Member adjusts the days, then has the AI make every Recipe at once ("Lag oppskrifter"), after which the days are no longer edited from the Menu.
_UI_: "Meny"
_Avoid_: Meal plan, plan, week plan

**Meal**:
The dinner eaten on one day of a Menu: one dish for now, with its own Recipe, though older weeks may have several courses. A day can have no Meal.
_UI_: "middag"
_Avoid_: Dinner, dish

**Recipe**:
How to cook one course of a Meal, as Steps, for a number of servings.
_UI_: "Oppskrift"
_Avoid_: Dish

**Step**:
One part of a Recipe, as in Modernist Cuisine: the Ingredients used together, and short instructions for them. Instructions are numbered across the Recipe; Steps aren't numbered. A Step may have no Ingredients, and an Ingredient used in two Steps is in both.
_UI_: none (Steps are separated by rules; "+ steg" when editing)
_Avoid_: Stage, section

**Ingredient**:
One line of a Step saying what is needed and how much: grams first, and a kitchen measure ("2 dl", "en klype") where it helps. A measure that's a count ("2 stk", or just "2") is pieces. It is worded to say how strict the need is ("helmelk" versus "melk, hvilken som helst"). At Confirm each Ingredient is matched to the most general Ware the Family has that fits ("helmelk" to "melk"), and the strictness stays in the Recipe. The Family's matches are remembered.
_UI_: "Ingrediens"
_Avoid_: Grocery, item

**Confirm**:
The moment a Family Member is done with a week's Recipes, which sends their Ingredients to Groceries: each Ware's Entry gets the dishes that need it, with their grams and stk. A Ware already waiting on the List isn't shown at Confirm; its dishes are just added. It happens once per week. Afterwards the week can still be edited by hand, but without the AI, and the edits don't change Groceries.
_UI_: "Iverksett"
_Avoid_: Commit, submit, finalize

**Outdated**:
The state of a Menu whose Guidelines changed after it was made, or of a Recipe whose Guidelines, Day Note or own Meal changed after it was made. It stays as it is until a Family Member asks the AI to remake it, which loses their hand edits. A changed Day Note never changes the Meal itself.
_UI_: "Utdatert" on the Menu, "utdatert" next to a dish, and ↻ ("Lag oppskriften på nytt") on the Recipe
_Avoid_: Stale, dirty

### Tabs

**Home**:
The tab for "quick, before I forget": adding to Groceries and editing it, never checking off.
_UI_: ⌂, read out as "Hjem"
_Avoid_: Add, inbox

**Meals**:
The tab for what's for dinner: planning the Menus of this week and next, and cooking from their Recipes. Earlier weeks that have a Menu can be looked back at. A week runs Monday to Sunday and is the ISO week.
_UI_: "Middag", with weeks labelled like "Uke 44 · 26. okt–1. nov"
_Avoid_: Week (the tab's old name), planner, calendar

**Shop**:
The tab for "I'm in the store": Groceries with unchecked first and one tap to check off.
_UI_: "Handle"
_Avoid_: Store, buy

### People

**Family**:
The group of people who share Lists. It is always a family, never a team, group, or organisation.
_UI_: "Familie"
_Avoid_: Group, household, team, tenant

**Family Member**:
A person, identified by their Google account, who belongs to exactly one Family. Being a Family Member is the only way into the app.
_UI_: "Familiemedlem"
_Avoid_: User, member (without "Family")

**Admin**:
The single person who maintains Families and their Family Members. This is a system-wide role. No Family has its own head.
_UI_: "admin"
_Avoid_: Owner, head of family
