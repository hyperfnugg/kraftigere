import { collection, doc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore'
import type { Match } from './ai'
import { type Staple, stapleId } from './entries'
import { formatNumber, piecesOf } from './amounts'
import { db } from './firebase'
import { DAYS, type Day, type StoredRecipe } from './weeks'

export type Ware = { id: string; name: string }

// A remembered match: the Ware or Staple, by id, an Ingredient wording went to last.
export type MatchDoc = { wording: string; staple?: string; ware?: string }

// One wording of an Ingredient, as it appears in the week's Recipes.
export type Wording = { key: string; text: string }

// One line of the Confirm screen: everything the week's Ingredients matched to one Ware or
// Staple, with the wordings that went to it, their amounts and the days they serve.
export type Line = {
  key: string
  match: Match
  name: string
  wordings: Wording[]
  amounts: { grams: number | null; pieces: number | null }[]
  days: Day[]
}

const lineKey = (m: Match) => `${m.kind}:${stapleId(m.name)}`

// The Family's Staples, Wares and remembered matches, read once for Confirm.
export async function readFamilyMatches() {
  const [staples, wares, matches] = await Promise.all(
    ['staples', 'wares', 'matches'].map((c) => getDocs(collection(db, c))),
  )
  return {
    staples: staples.docs.map((d) => ({ id: d.id, ...d.data() }) as Staple),
    wares: wares.docs.map((d) => ({ id: d.id, name: d.get('name') }) as Ware),
    matches: Object.fromEntries(matches.docs.map((d) => [d.id, d.data() as MatchDoc])),
  }
}

// The week's Ingredients, from every step of every Recipe, with the day each serves.
// Wordings are keyed like Staples, so "Løk" and "løk " are one wording.
export function weekIngredients(recipes: Record<string, StoredRecipe>) {
  return Object.values(recipes).flatMap((r) =>
    r.steps.flatMap((s) =>
      s.ingredients.map((ing) => ({ ...ing, day: r.id.split('-')[0] as Day, key: stapleId(ing.text) })),
    ),
  )
}

// A remembered match as a Match, named after its Ware or Staple.
export function rememberedMatch(m: MatchDoc, staples: Staple[], wares: Ware[]): Match {
  if (m.ware) return { kind: 'ware', name: wares.find((w) => w.id === m.ware)?.name ?? m.ware }
  return { kind: 'staple', name: staples.find((s) => s.id === m.staple)?.name ?? m.staple ?? m.wording }
}

// The lines for the week's Ingredients, given what each wording matches, by name.
export function makeLines(
  ingredients: ReturnType<typeof weekIngredients>,
  matches: Record<string, Match>,
  staples: Staple[],
  wares: Ware[],
) {
  const lines = new Map<string, Line>()
  for (const ing of ingredients) {
    const match = matches[ing.key]
    if (!match) continue
    const key = lineKey(match)
    const id = stapleId(match.name)
    const existing = match.kind === 'ware' ? wares.find((w) => w.id === id) : staples.find((s) => s.id === id)
    const line = lines.get(key) ?? { key, match, name: existing?.name ?? match.name, wordings: [], amounts: [], days: [] }
    if (!line.wordings.some((w) => w.key === ing.key)) line.wordings.push({ key: ing.key, text: ing.text })
    line.amounts.push({ grams: ing.grams, pieces: piecesOf(ing.measure) })
    if (!line.days.includes(ing.day)) line.days.push(ing.day)
    lines.set(key, line)
  }
  return [...lines.values()]
    .map((l) => ({ ...l, days: DAYS.filter((d) => l.days.includes(d)) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'nb'))
}

// Whether a line starts ticked: everything but a Staple the Family usually has at home.
export function startsTicked(line: Line, staples: Staple[]) {
  return !(line.match.kind === 'staple' && staples.find((s) => s.id === stapleId(line.match.name))?.usuallyAtHome)
}

// Grams added up, with pieces in parentheses when there are any: "360 g (6 stk)".
// Amounts "etter smak" are left out.
export function formatAmount(amounts: Line['amounts']) {
  const sum = (ns: (number | null)[]) => {
    const known = ns.filter((n) => n !== null)
    return known.length > 0 ? known.reduce((a, n) => a + n, 0) : null
  }
  const grams = sum(amounts.map((a) => a.grams))
  const pieces = sum(amounts.map((a) => a.pieces))
  const g = grams === null ? '' : `${formatNumber(grams)} g`
  const p = pieces === null ? '' : `${formatNumber(pieces)} stk`
  return g && p ? `${g} (${p})` : g || p
}

// Confirms the week in one batch: a Menu Entry for each ticked line, new Wares and
// Staples, remembered matches that changed, usuallyAtHome where it changed, and confirmedAt.
export function confirmWeek(
  weekId: string,
  lines: (Line & { ticked: boolean })[],
  family: Awaited<ReturnType<typeof readFamilyMatches>>,
) {
  const batch = writeBatch(db)
  for (const line of lines) {
    const { kind } = line.match
    const id = stapleId(line.match.name)
    if (kind === 'ware') {
      if (!family.wares.some((w) => w.id === id)) batch.set(doc(db, 'wares', id), { name: line.name })
    } else {
      const staple = family.staples.find((s) => s.id === id)
      const atHome = !line.ticked
      if (!staple) batch.set(doc(db, 'staples', id), { name: line.name, addCount: 0, usuallyAtHome: atHome })
      else if (!!staple.usuallyAtHome !== atHome) batch.update(doc(db, 'staples', id), { usuallyAtHome: atHome })
    }
    for (const w of line.wordings) {
      const before = family.matches[w.key]
      if (before?.[kind] !== id) batch.set(doc(db, 'matches', w.key), { wording: w.text, [kind]: id })
    }
    if (line.ticked) {
      batch.set(doc(collection(db, 'entries')), {
        text: line.name,
        [kind]: id,
        week: weekId,
        days: line.days,
        amount: formatAmount(line.amounts),
        checked: false,
        createdAt: serverTimestamp(),
      })
    }
  }
  batch.update(doc(db, 'weeks', weekId), { confirmedAt: serverTimestamp() })
  return batch.commit()
}
