import { describe, expect, test } from 'vitest'
import { formatAmount, measureText, piecesOf, sumKnown } from '../../src/amounts'

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
