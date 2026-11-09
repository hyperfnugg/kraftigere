import { describe, expect, test } from 'vitest'
import { overBudget, removeBilling } from '../../functions/src/killSwitch'

const BUDGET = 'b-123'
const from = (budgetId: string) => ({ budgetId, billingAccountId: '01-ABC', schemaVersion: '1.0' })

describe('overBudget', () => {
  test('is true for the kill switch budget with cost above its amount', () => {
    expect(overBudget(from(BUDGET), { costAmount: 200.01, budgetAmount: 200 }, BUDGET)).toBe(true)
  })

  test('is false at or under the amount, as budgets notify below the limit too', () => {
    expect(overBudget(from(BUDGET), { costAmount: 200, budgetAmount: 200 }, BUDGET)).toBe(false)
    expect(overBudget(from(BUDGET), { costAmount: 3.5, budgetAmount: 200 }, BUDGET)).toBe(false)
  })

  test('is false for another budget, such as the soft one', () => {
    expect(overBudget(from('soft'), { costAmount: 500, budgetAmount: 20 }, BUDGET)).toBe(false)
  })

  test('is false with no budget id set, as in the emulator', () => {
    expect(overBudget(from(''), { costAmount: 500, budgetAmount: 20 }, undefined)).toBe(false)
    expect(overBudget({}, { costAmount: 500, budgetAmount: 20 }, undefined)).toBe(false)
  })

  test('is false for a malformed message', () => {
    expect(overBudget(from(BUDGET), null, BUDGET)).toBe(false)
    expect(overBudget(from(BUDGET), { costAmount: '500', budgetAmount: 20 }, BUDGET)).toBe(false)
    expect(overBudget(from(BUDGET), { costAmount: 500 }, BUDGET)).toBe(false)
  })
})

describe('removeBilling', () => {
  test("empties the project's billing account", async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      return new Response('{}')
    }) as typeof fetch
    await removeBilling('kraftigere', 'tok', fake)
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://cloudbilling.googleapis.com/v1/projects/kraftigere/billingInfo')
    expect(calls[0].init.method).toBe('PUT')
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe('Bearer tok')
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ billingAccountName: '' })
  })

  test('throws when the Billing API refuses', async () => {
    const fake = (async () => new Response('denied', { status: 403 })) as typeof fetch
    await expect(removeBilling('kraftigere', 'tok', fake)).rejects.toThrow('403 denied')
  })
})
