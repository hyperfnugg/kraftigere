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
Anything the Family buys, named the way they say it, such as "melk", "løk, gul" or "vinterjakke". It need not be groceries and may be bought only once. A Ware has a name unique within the Family and lasts beyond any one Entry. It is the Family's own idea of the thing, not a shop's product, so several Wares may share one Oda Product.
_UI_: "Vare"
_Avoid_: Product, grocery, item, article

**Staple**:
A Ware the Family has added by hand, and so knows well. A Staple remembers how often it is added and whether it is usually at home. Autocomplete suggests Staples.
_UI_: "Basisvare"
_Avoid_: Favourite, regular, item

**Store Order**:
Where a Ware sits in the store, so Handle lists Entries in the order the Family walks it. It belongs to the Ware, not the Entry, so a Ware added again goes back to its place. A new Ware comes last. A Family Member sets it by dragging on Handle.
_UI_: not named; the drag handle says "Flytt"
_Avoid_: Sort order, position, aisle

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

**Favourite**:
A copy of a Recipe the Family likes, kept apart from any week, to put on a day of a Menu again. It is made with ☆ on a Recipe and keeps that version, whatever happens to the week's Recipe afterwards. No two Favourites share a name: ☆ on a Recipe named like one offers to replace it. Picking it while typing a Meal's dish name puts its Recipe on that day as it is, without the AI. Favourites are offered most used first, a use being a Confirm of a Meal placed from it. A Recipe placed from a Favourite and edited by hand can be saved back over it.
_UI_: "Favoritt"; ☆ on the Recipe makes one, ★ marks a Recipe placed from one (on the Recipe, where it removes the Favourite, and next to the dish on the Menu), and "Lagre" saves a hand-edited Recipe back over its Favourite
_Avoid_: Saved recipe, cookbook, bookmark

**Step**:
One part of a Recipe, as in Modernist Cuisine: the Ingredients used together, and short instructions for them. Instructions are numbered across the Recipe; Steps aren't numbered. A Step may have no Ingredients, and an Ingredient used in two Steps is in both.
_UI_: none (Steps are separated by rules; "+ steg" when editing)
_Avoid_: Stage, section

**Ingredient**:
One line of a Step saying what is needed and how much: grams first, and a kitchen measure ("2 dl", "en klype") where it helps. A measure that's a count ("2 stk", or just "2") is pieces. It is named in the singular, the thing first, and worded to say how strict the need is ("melk, hel" versus "melk, hvilken som helst"). At Confirm each Ingredient is matched to the Ware that is the same thing to buy. What doesn't change the purchase is dropped ("salt, fin" is "salt"), but the Recipe's intent is kept: "melk, hel" is its own Ware even when the Family has "melk". The Family's matches are remembered.
_UI_: "Ingrediens"
_Avoid_: Grocery, item

**Confirm**:
The moment a Family Member is done with a week's Recipes, which sends their Ingredients to Groceries: each Ware's Entry gets the dishes that need it, with their grams and stk. A Ware already waiting on the List isn't shown at Confirm; its dishes are just added. It happens once per week. Afterwards the week can still be edited by hand, but without the AI, and the edits don't change Groceries.
_UI_: "Iverksett"
_Avoid_: Commit, submit, finalize

**Outdated**:
The state of a Menu whose Guidelines changed after it was made, or of a Recipe whose Guidelines, Day Note or own Meal changed after it was made. A Recipe placed from a Favourite is never Outdated by the Guidelines or a Day Note. It stays as it is until a Family Member asks the AI to remake it, which loses their hand edits. A changed Day Note never changes the Meal itself.
_UI_: "Utdatert" on the Menu, "utdatert" next to a dish, and ↻ ("Lag oppskriften på nytt") on the Recipe
_Avoid_: Stale, dirty

### Tabs

**Home**:
The tab for "quick, before I forget": adding to Groceries and editing it, never checking off.
_UI_: ⌂, read out as "Hjem"
_Avoid_: Add, inbox

**Meals**:
The tab for what's for dinner: planning the Menus of this week and next, and cooking from their Recipes. Earlier weeks that have a Menu can be looked back at. A week runs Monday to Sunday and is the ISO week.
_UI_: "Middag", behind ⋮ in the tab bar, with weeks labelled like "Uke 44 · 26. okt–1. nov"
_Avoid_: Week (the tab's old name), planner, calendar

**Shop**:
The tab for "I'm in the store": Groceries with unchecked first and one tap to check off.
_UI_: "Handle"
_Avoid_: Store, buy

### Oda

**Oda Product**:
Something Oda sells, such as "Tine Lettmelk 1% fett, 1 l". A Ware may point to one Oda Product, and several Wares may share one, since "melk" and "melk, hel" can rightly be the same carton. A Ware may instead be *never from Oda*, such as socks bought elsewhere, which keeps it out of every Oda Order.
_UI_: "Oda-produkt"; never from Oda is "Aldri fra Oda", and such Wares on the List are "varer utenfor Oda"
_Avoid_: Article, item, product (without "Oda")

**Basket**:
The Family's shopping cart on oda.com, which Kraft fills and the Family Member orders from in Oda.
_UI_: "handlekurv"
_Avoid_: Cart

**Pack Count**:
How many packs of one Oda Product an Oda Order holds in the Basket: at first enough for its Entries' dishes, and otherwise one, then whatever the Family Member sets on the Order Summary. A Note doesn't change it. It belongs to one Oda Order and isn't remembered.
_UI_: "− 3 +"
_Avoid_: Quantity, amount (that's what the dishes need)

**Pack Size**:
How much one pack of an Oda Product holds: its grams, and its pieces if it is sold by the piece. The AI reads it from what Oda says about the product, on the Order Summary when an Entry's dishes have amounts, and a Ware whose own Oda Product it is remembers it. A Substitute's is used once.
_UI_: none
_Avoid_: Unit, weight

**Oda Link**:
The Family's connection to its Oda account, set up once by one Family Member, which lets any Family Member fill the Basket. Each Family has its own.
_UI_: "Koble til Oda"
_Avoid_: Oda login, integration

**Oda Order**:
Filling the Basket with the Groceries Entries a Family Member chooses, and seeing it through, from when the Basket is filled until it is Ordered or Cancelled. A Family has at most one at a time, and while it lasts Groceries can't be changed. The order itself is placed in Oda, never by Kraft.
_UI_: "odabestilling"; its tab "Odabestilling", behind ⋮ with Middag, opens on the choosing, and "Fyll handlekurven" fills the Basket
_Avoid_: Checkout, basket run, sync

**In Basket**:
The state of an Entry that an Oda Order has put in the Basket, as its Ware's Oda Product or a Substitute, sharing that product's Pack Count with any other In Basket Entries on it. An Oda Order lasts as long as any Entry is In Basket or Left Out. The Entry is locked until the Oda Order is Ordered or Cancelled.
_UI_: "i handlekurven"
_Avoid_: Pending, reserved

**Substitute**:
An Oda Product put in the Basket for one Oda Order in place of a Ware's own, which isn't available. The Ware's own doesn't change, and nothing remembers the Substitute afterwards.
_UI_: "erstatning"
_Avoid_: Alternative, replacement

**Off Sale**:
An Oda Product Oda has stopped selling, as opposed to one that's unavailable for now. Kraft finds out when filling the Basket. The Ware then loses it, so what the Family Member chooses in its place becomes the Ware's new Oda Product rather than a Substitute.
_UI_: "ikke lenger tilgjengelig"
_Avoid_: Discontinued, deleted

**Left Out**:
The state of an Entry whose Oda Product wasn't available when the Oda Order filled the Basket, and which got nothing in its place. It stays unchecked, for buying in a store, and is locked like an In Basket Entry until the Oda Order ends.
_UI_: "ikke tilgjengelig"
_Avoid_: Skipped, missing

**Order Summary**:
What an Oda Order put in the Basket, once any Substitutes are chosen: each Oda Product with its Pack Count and the Entries it meets, then what was Left Out. Kraft works out the Pack Counts here, and changing one changes the Basket at once. From here the Family Member orders in Oda, then ends the Oda Order as Ordered or Cancelled.
_UI_: no title (screens have none); Odabestilling opens on it with "Neste steg er ditt: bestill i handlekurven på oda.com"
_Avoid_: Checkout, Basket view, step

**Ordered**:
The end of an Oda Order once a Family Member has placed the order in Oda, which checks off every In Basket Entry. Left Out Entries stay unchecked.
_UI_: "Bestilt"
_Avoid_: Confirm (that is Iverksett), done, checked out

**Cancelled**:
The end of an Oda Order that won't be ordered, which takes out of the Basket exactly the packs Kraft holds there at that moment, and leaves every Entry unchecked. Anything else in the Basket stays.
_UI_: "Avbryt"
_Avoid_: Abort, undo

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
