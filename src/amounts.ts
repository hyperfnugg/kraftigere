// Amounts in Recipes and on Groceries. Nothing from Firebase here, so it's unit tested.

// "1,5" for 1.5, to two decimals.
export const formatNumber = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',')

const FRACTIONS: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75 }

// The pieces a kitchen measure says: "2 stk", "2 stk.", "2 stykker", "1,5", "1/2", "½", or a
// bare "2", as a number with no unit is pieces. Anything else ("2 dl", "2 fedd") is none.
export function piecesOf(measure: string): number | null {
  const m = /^\s*(\d+(?:[.,]\d+)?|\d+\/\d+|[½¼¾])\s*(?:stk\.?|stykk|stykker)?\s*$/i.exec(measure)
  if (!m) return null
  const [a, b] = m[1].split('/')
  const n = FRACTIONS[m[1]] ?? (b ? Number(a) / Number(b) : Number(a.replace(',', '.')))
  return Number.isFinite(n) && n > 0 ? n : null
}

// A kitchen measure as shown: pieces as "2 stk" however they were written, anything else as
// it is.
export function measureText(measure: string) {
  const n = piecesOf(measure)
  return n === null ? measure.trim() : `${formatNumber(n)} stk`
}

// Grams or pieces added up, leaving out the unknown ones ("etter smak"). None known is null.
export function sumKnown(ns: (number | null)[]) {
  const known = ns.filter((n) => n !== null)
  return known.length > 0 ? known.reduce((a, n) => a + n, 0) : null
}

// Grams added up, with pieces in parentheses when there are any: "360 g (6 stk)".
export function formatAmount(amounts: { grams: number | null; pieces: number | null }[]) {
  const grams = sumKnown(amounts.map((a) => a.grams))
  const pieces = sumKnown(amounts.map((a) => a.pieces))
  const g = grams === null ? '' : `${formatNumber(grams)} g`
  const p = pieces === null ? '' : `${formatNumber(pieces)} stk`
  return g && p ? `${g} (${p})` : g || p
}
