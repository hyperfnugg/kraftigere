import { describe, expect, test } from 'vitest'
import { measureText, piecesOf } from '../../src/amounts'

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
