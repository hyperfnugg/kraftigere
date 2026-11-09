// The kill switch: the kill switch budget publishes to a Pub/Sub topic, and the function removes
// the project's billing account once that budget is overspent. See docs/adr/0005-oda-route.md.

// Budgets notify several times a day, under the limit too, so only a message from the kill
// switch budget, with cost above its amount, removes billing. Anything malformed leaves it.
export function overBudget(attributes: Record<string, string>, data: unknown, budgetId: string | undefined) {
  if (!budgetId || attributes.budgetId !== budgetId) return false
  const { costAmount, budgetAmount } = (data ?? {}) as { costAmount?: unknown; budgetAmount?: unknown }
  return typeof costAmount === 'number' && typeof budgetAmount === 'number' && costAmount > budgetAmount
}

// Unlinks the project from its billing account, which stops everything that costs money.
// Relinking is done by hand.
export async function removeBilling(project: string, accessToken: string, fetchImpl: typeof fetch = fetch) {
  const res = await fetchImpl(`https://cloudbilling.googleapis.com/v1/projects/${project}/billingInfo`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ billingAccountName: '' }),
  })
  if (!res.ok) throw new Error(`Removing billing failed: ${res.status} ${await res.text()}`)
}
