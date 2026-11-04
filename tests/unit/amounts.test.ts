import { describe, expect, test } from 'vitest'
import { formatAmount, measureText, packCount, piecesOf, sumKnown } from '../../src/amounts'

describe('piecesOf', () => {
  test.each([
    ['2 stk', 2],
    ['2 stk.', 2],
    ['2 STK', 2],
    ['2stk', 2],
    ['1 stykk', 1],
    ['3 stykker', 3],
    ['2', 2],
    [' 2 ', 2],
    ['1,5', 1.5],
    ['1.5 stk', 1.5],
    ['1/2', 0.5],
    ['½ stk', 0.5],
    ['¾', 0.75],
  ])('%j is %d pieces', (measure, pieces) => expect(piecesOf(measure)).toBe(pieces))

  test.each(['', '2 dl', '1 ss', '2 fedd', 'en klype', 'etter smak', '0', '0 stk', '2 stk løk', 'stk'])(
    '%j is no pieces',
    (measure) => expect(piecesOf(measure)).toBeNull(),
  )
})

test('measureText shows pieces as stk and anything else as written', () => {
  expect(measureText('2')).toBe('2 stk')
  expect(measureText('1.5 stykker')).toBe('1,5 stk')
  expect(measureText(' 2 dl ')).toBe('2 dl')
  expect(measureText('')).toBe('')
})

test('sumKnown adds what is known, and is null when nothing is', () => {
  expect(sumKnown([200, null, 150])).toBe(350)
  expect(sumKnown([null, null])).toBeNull()
  expect(sumKnown([])).toBeNull()
})

describe('formatAmount', () => {
  const dish = (grams: number | null, pieces: number | null) => ({ grams, pieces })

  test('adds up grams, with stk in parentheses when there are pieces', () => {
    expect(formatAmount([dish(200, 2), dish(160, 4)])).toBe('360 g (6 stk)')
    expect(formatAmount([dish(400, null), dish(100, null)])).toBe('500 g')
    expect(formatAmount([dish(null, 2), dish(null, 1)])).toBe('3 stk')
    expect(formatAmount([dish(2.5, null), dish(null, 0.5)])).toBe('2,5 g (0,5 stk)')
  })

  test('leaves out what is to taste, and is empty when nothing is known', () => {
    expect(formatAmount([dish(200, 2), dish(null, null)])).toBe('200 g (2 stk)')
    expect(formatAmount([dish(null, null)])).toBe('')
    expect(formatAmount([])).toBe('')
  })
})

describe('packCount', () => {
  const dish = (grams: number | null, pieces: number | null = null) => ({ grams, pieces })

  test('rounds up to enough packs for the grams', () => {
    expect(packCount([dish(500)], { packGrams: 1030 })).toBe(1)
    expect(packCount([dish(1000)], { packGrams: 1000 })).toBe(1)
    expect(packCount([dish(1050)], { packGrams: 1000 })).toBe(2)
  })

  test('adds up the dishes, leaving out what is to taste', () => {
    expect(packCount([dish(600), dish(600), dish(null)], { packGrams: 1000 })).toBe(2)
  })

  test('goes by whichever of grams and pieces needs more', () => {
    expect(packCount([dish(900, 6)], { packGrams: 180, packPieces: 1 })).toBe(6)
    expect(packCount([dish(360, 6)], { packGrams: 720, packPieces: 12 })).toBe(1)
    expect(packCount([dish(2000, 2)], { packGrams: 500, packPieces: 1 })).toBe(4)
  })

  test('leaves out a side with nothing to compare', () => {
    expect(packCount([dish(null, 3)], { packGrams: 500, packPieces: 2 })).toBe(2)
    expect(packCount([dish(1500, 3)], { packGrams: 500 })).toBe(3)
    expect(packCount([dish(null, 3)], { packGrams: 500 })).toBe(1)
  })

  test('is one pack with no amounts or no Pack Size', () => {
    expect(packCount([], { packGrams: 1000 })).toBe(1)
    expect(packCount([dish(null)], { packGrams: 1000 })).toBe(1)
    expect(packCount([dish(5000, 6)], {})).toBe(1)
  })

  test('stays within 1 to 20', () => {
    expect(packCount([dish(1)], { packGrams: 1000 })).toBe(1)
    expect(packCount([dish(100000)], { packGrams: 100 })).toBe(20)
  })

  test('does not add a pack for a rounding error in the decimals', () => {
    expect(packCount([dish(0.1), dish(0.2)], { packGrams: 0.3 })).toBe(1)
  })
})
