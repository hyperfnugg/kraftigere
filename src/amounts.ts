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
