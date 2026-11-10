import { Timestamp } from 'firebase/firestore'
import { describe, expect, test } from 'vitest'
import { type Entry, type Ware, dropOrders, inStoreOrder, reorder, storeOrder, suggest, typedName } from '../../src/entries'

describe('typedName', () => {
  test('drops punctuation and spaces at the ends', () => {
    expect(typedName('  melk. ')).toBe('melk')
    expect(typedName('brød,')).toBe('brød')
    expect(typedName('- egg!?')).toBe('egg')
    expect(typedName('...')).toBe('')
  })

  test('keeps punctuation inside, and % or brackets at the ends', () => {
    expect(typedName('Coca-Cola')).toBe('Coca-Cola')
    expect(typedName('Lettmelk 0,5%')).toBe('Lettmelk 0,5%')
    expect(typedName('Egg (store)')).toBe('Egg (store)')
    expect(typedName('crème  fraîche')).toBe('crème fraîche')
  })
})

describe('suggest', () => {
  const ware = (name: string, addCount: number): Ware => ({ id: name.toLowerCase(), name, addCount })
  const wares = [ware('Melk', 5), ware('Mel', 2), ware('Smør', 9), ware('Hjemmelaget', 1), ware('Mango', 0)]
  const waiting = (name: string, checked = false): Entry => ({ id: name, text: name, ware: name.toLowerCase(), checked })

  test('with nothing typed, the most added Staples', () => {
    expect(suggest(wares, '', []).map((w) => w.name)).toEqual(['Smør', 'Melk', 'Mel', 'Hjemmelaget'])
  })

  test('names starting with the text first, then names containing it', () => {
    expect(suggest(wares, 'mel', []).map((w) => w.name)).toEqual(['Melk', 'Mel', 'Hjemmelaget'])
  })

  test('leaves out Staples waiting on the List, typed or not, but not checked ones', () => {
    const entries = [waiting('Melk'), waiting('Mel', true)]
    expect(suggest(wares, 'mel', entries).map((w) => w.name)).toEqual(['Mel', 'Hjemmelaget'])
    expect(suggest(wares, '', entries).map((w) => w.name)).toEqual(['Smør', 'Mel', 'Hjemmelaget'])
  })
})

describe('storeOrder', () => {
  const entry = (ware: string, createdAt: number | null): Entry => ({
    id: ware,
    text: ware,
    ware,
    checked: false,
    createdAt: createdAt === null ? null : Timestamp.fromMillis(createdAt),
  })
  const wares: Ware[] = [{ id: 'melk', name: 'melk', addCount: 1, order: 500 }, { id: 'brød', name: 'brød', addCount: 1 }]

  test("is the Ware's order", () => {
    expect(storeOrder(entry('melk', 9000), wares)).toBe(500)
  })

  test("is when the Entry was added for a Ware without one, or last if it isn't timed yet", () => {
    expect(storeOrder(entry('brød', 9000), wares)).toBe(9000)
    expect(storeOrder(entry('brød', null), wares)).toBe(Infinity)
  })

  test('sorts by it, ties broken by id', () => {
    const entries = [entry('c', 1), entry('a', 1), entry('b', 0)]
    expect(inStoreOrder(entries, (e) => e.createdAt!.toMillis()).map((e) => e.id)).toEqual(['b', 'a', 'c'])
  })
})

describe('reorder', () => {
  test('puts the moved Ware midway between its neighbours, writing only it', () => {
    expect(reorder([1000, 2000, 3000], 1)).toEqual([[1, 1500]])
  })

  test('first and last go 1000 beyond the end', () => {
    expect(reorder([1000, 2000], 0)).toEqual([[0, 0]])
    expect(reorder([1000, 2000], 2)).toEqual([[2, 3000]])
    expect(reorder([], 0)).toEqual([[0, 0]])
  })

  test('between tied neighbours, as from one Iverksett, pushes on only those in the way', () => {
    // From [5, 5, 5, 9]: the moved one lands after the first 5.
    expect(reorder([5, 5, 5, 9], 1)).toEqual([
      [1, 6],
      [2, 7],
      [3, 8],
    ])
  })

  test('between neighbours closer than 2, makes room', () => {
    expect(reorder([10, 11, 20], 1)).toEqual([
      [1, 11],
      [2, 12],
    ])
  })
})

describe('dropOrders', () => {
  const ware = (id: string, order?: number): Ware => ({ id, name: id, addCount: 1, order })
  const entry = (id: string): Entry => ({ id, text: id, ware: id, checked: false, createdAt: null })
  const wares = [ware('a', 5), ware('b', 5), ware('c', 100), ware('h', 6), ware('old')]
  const order = (e: Entry) => wares.find((w) => w.id === e.ware)!.order!

  test('between neighbours with room, writes only the moved Ware', () => {
    expect(dropOrders([entry('a'), entry('c')], entry('b'), 1, [ware('a', 10), ware('b', 50), ware('c', 30)], (e) => ({ a: 10, c: 30 })[e.ware]!)).toEqual([['b', 20]])
  })

  test('pushing on tied neighbours also pushes a Ware without an Entry, keeping its place', () => {
    // On the List: a (5), b (5). Off it: h (6). c lands between a and b.
    expect(dropOrders([entry('a'), entry('b')], entry('c'), 1, wares, order)).toEqual([
      ['c', 6],
      ['b', 7],
      ['h', 8],
    ])
  })

  test('to the top lands right before the top Entry, after Wares off the List above it', () => {
    expect(dropOrders([entry('h'), entry('c')], entry('b'), 0, [ware('a', 1), ware('h', 6), ware('c', 100), ware('b', 200)], (e) => ({ h: 6, c: 100 })[e.ware]!)).toEqual([['b', 3.5]])
  })

  test('to the bottom of a List of one', () => {
    expect(dropOrders([entry('a')], entry('c'), 1, [ware('a', 5), ware('c', 100)], () => 5)).toEqual([['c', 1005]])
  })
})
