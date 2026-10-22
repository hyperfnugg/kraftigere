import { expect, test } from '@playwright/test'
import { MEMBERS, openTab, reset, seed, signIn } from './helpers'
import { addWeeks, isoWeekId, weekLabel } from '../../src/dates'

test.beforeEach(async () => {
  await reset()
  await seed()
})

test('Uke opens on the current week, and › shows the next', async ({ page }) => {
  await signIn(page, MEMBERS[0])
  await openTab(page, 'Uke')
  const thisWeek = isoWeekId(new Date())
  await expect(page.getByRole('heading', { name: weekLabel(thisWeek) })).toBeVisible()
  await page.getByRole('button', { name: 'Neste uke' }).click()
  await expect(page.getByRole('heading', { name: weekLabel(addWeeks(thisWeek, 1)) })).toBeVisible()
  await page.getByRole('button', { name: 'Forrige uke' }).click()
  await page.getByRole('button', { name: 'Forrige uke' }).click()
  await expect(page.getByRole('heading', { name: weekLabel(addWeeks(thisWeek, -1)) })).toBeVisible()
})

test('Ukeplan and Føringer stay after a reload, and each week has its own Ukeplan', async ({ page }) => {
  await signIn(page, MEMBERS[0])
  await openTab(page, 'Uke')
  const notes = page.getByRole('textbox', { name: 'Ukeplan' })
  await notes.fill('Gjester mandag.')
  await notes.blur()
  await page.getByRole('button', { name: 'Føringer' }).click()
  const guidelines = page.getByRole('textbox', { name: 'Føringer' })
  await guidelines.fill('Fredag er taco.')
  await guidelines.blur()

  await page.getByRole('button', { name: 'Neste uke' }).click()
  await expect(notes).toHaveValue('')
  await notes.fill('Peter er borte.')
  await notes.blur()

  await page.reload()
  await openTab(page, 'Uke')
  await expect(notes).toHaveValue('Gjester mandag.')
  await page.getByRole('button', { name: 'Føringer' }).click()
  await expect(guidelines).toHaveValue('Fredag er taco.')
  await page.getByRole('button', { name: 'Neste uke' }).click()
  await expect(notes).toHaveValue('Peter er borte.')
})
