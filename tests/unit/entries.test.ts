import { describe, expect, test } from 'vitest'
import { type Entry, type Ware, suggest, typedName } from '../../src/entries'

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
