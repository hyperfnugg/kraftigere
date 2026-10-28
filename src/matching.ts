import { collection, doc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore'
import { type Dish, type Entry, type Ware, wareId } from './entries'
import { piecesOf, sumKnown } from './amounts'
import { db } from './firebase'
import { DAYS, type Day, type StoredRecipe } from './weeks'

// A remembered match: the Ware, by id, an Ingredient wording went to last.
export type MatchDoc = { wording: string; ware: string }

// One wording of an Ingredient, as it appears in the week's Recipes.
export type Wording = { key: string; text: string }

// One line of the Iverksett screen: everything the week's Ingredients matched to one Ware,
// with the wordings that went to it, the Recipe and amount of each, and the days they serve.
export type Line = {
  key: string
  name: string
  wordings: Wording[]
  amounts: { recipe: string; course: string; grams: number | null; pieces: number | null }[]
  days: Day[]
}

// The Family's Wares, remembered matches and Entries, read once for Iverksett.
export async function readFamilyMatches() {
  const [wares, matches, entries] = await Promise.all(
    ['wares', 'matches', 'entries'].map((c) => getDocs(collection(db, c))),
  )
  return {
    wares: wares.docs.map((d) => ({ id: d.id, ...d.data() }) as Ware),
    matches: Object.fromEntries(matches.docs.map((d) => [d.id, d.data() as MatchDoc])),
    entries: entries.docs.map((d) => ({ id: d.id, ...d.data() }) as Entry),
  }
}

// The Entry waiting on the List for a line's Ware, if any. Its line isn't shown at
// Iverksett: the dishes are just added to it.
export function waitingEntry(line: Line, entries: Entry[]) {
  return entries.find((e) => e.ware === line.key && !e.checked)
}

// The week's Ingredients, from every step of every Recipe, with the Recipe and day each
// serves. Wordings are keyed like Wares, so "Løk" and "løk " are one wording.
export function weekIngredients(recipes: Record<string, StoredRecipe>) {
  return Object.values(recipes).flatMap((r) =>
    r.steps.flatMap((s) =>
      s.ingredients.map((ing) => ({
        ...ing,
        recipe: r.id,
        course: r.course,
        day: r.id.split('-')[0] as Day,
        key: wareId(ing.text),
      })),
    ),
  )
}

// A remembered match, by the name of its Ware.
export function rememberedMatch(m: MatchDoc, wares: Ware[]) {
  return wares.find((w) => w.id === m.ware)?.name ?? m.ware
}

// The lines for the week's Ingredients, given the Ware name each wording matches.
export function makeLines(
  ingredients: ReturnType<typeof weekIngredients>,
  matches: Record<string, string>,
  wares: Ware[],
) {
  const lines = new Map<string, Line>()
  for (const ing of ingredients) {
    const match = matches[ing.key]
    if (!match) continue
    const key = wareId(match)
    const name = wares.find((w) => w.id === key)?.name ?? match
    const line = lines.get(key) ?? { key, name, wordings: [], amounts: [], days: [] }
    if (!line.wordings.some((w) => w.key === ing.key)) line.wordings.push({ key: ing.key, text: ing.text })
    line.amounts.push({ recipe: ing.recipe, course: ing.course, grams: ing.grams, pieces: piecesOf(ing.measure) })
    if (!line.days.includes(ing.day)) line.days.push(ing.day)
    lines.set(key, line)
  }
  return [...lines.values()]
    .map((l) => ({ ...l, days: DAYS.filter((d) => l.days.includes(d)) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'nb'))
}

// Whether a line starts ticked: everything but a Ware the Family usually has at home.
export function startsTicked(line: Line, wares: Ware[]) {
  return !wares.find((w) => w.id === line.key)?.usuallyAtHome
}

// A line's dishes: one per Recipe in day order, with what that Recipe needs added up.
export function dishesOf(line: Line, week: string): Dish[] {
  // Recipe ids are like tue-0: the day, then the course.
  const order = (id: string) => DAYS.indexOf(id.split('-')[0] as Day) * 10 + Number(id.split('-')[1])
  const recipes = [...new Set(line.amounts.map((a) => a.recipe))].sort((a, b) => order(a) - order(b))
  return recipes.map((recipe) => {
    const amounts = line.amounts.filter((a) => a.recipe === recipe)
    return {
      week,
      recipe,
      course: amounts[0].course,
      grams: sumKnown(amounts.map((a) => a.grams)),
      pieces: sumKnown(amounts.map((a) => a.pieces)),
    }
  })
}

// Iverksetts the week in one batch: the dishes added to each waiting Entry, an Entry for
// each other ticked line replacing a Checked one, new Wares, remembered matches that
// changed, usuallyAtHome where it changed, and confirmedAt.
export function confirmWeek(
  weekId: string,
  lines: (Line & { ticked: boolean })[],
  family: Awaited<ReturnType<typeof readFamilyMatches>>,
) {
  const batch = writeBatch(db)
  for (const line of lines) {
    for (const w of line.wordings) {
      if (family.matches[w.key]?.ware !== line.key) batch.set(doc(db, 'matches', w.key), { wording: w.text, ware: line.key })
    }
    const waiting = waitingEntry(line, family.entries)
    if (waiting) {
      batch.update(doc(db, 'entries', waiting.id), {
        dishes: [...(waiting.dishes ?? []), ...dishesOf(line, weekId)].slice(-50),
      })
      continue
    }
    const ware = family.wares.find((w) => w.id === line.key)
    const atHome = !line.ticked
    if (!ware) batch.set(doc(db, 'wares', line.key), { name: line.name, addCount: 0, usuallyAtHome: atHome })
    else if (!!ware.usuallyAtHome !== atHome) batch.update(doc(db, 'wares', line.key), { usuallyAtHome: atHome })
    if (line.ticked) {
      for (const e of family.entries) if (e.ware === line.key) batch.delete(doc(db, 'entries', e.id))
      batch.set(doc(collection(db, 'entries')), {
        text: line.name,
        ware: line.key,
        dishes: dishesOf(line, weekId),
        checked: false,
        createdAt: serverTimestamp(),
      })
    }
  }
  batch.update(doc(db, 'weeks', weekId), { confirmedAt: serverTimestamp() })
  return batch.commit()
}
