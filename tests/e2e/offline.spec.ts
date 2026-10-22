import { expect, test } from '@playwright/test'
import { MEMBERS, addEntry, completeGooglePopup, entry, reset, seed, signIn } from './helpers'

test.beforeEach(async () => {
  await reset()
  await seed()
})

test('the offline line shows while offline', async ({ page, context }) => {
  await signIn(page, MEMBERS[0])
  const line = page.getByText('Frakoblet: endringer lagres når nettet er tilbake')
  await expect(line).toHaveCount(0)

  await context.setOffline(true)
  await expect(line).toBeVisible()
  await context.setOffline(false)
  await expect(line).toHaveCount(0)
})

test('an Entry added offline syncs after reconnecting', async ({ browser }) => {
  const aliceContext = await browser.newContext()
  const alice = await aliceContext.newPage()
  const bob = await (await browser.newContext()).newPage()
  await signIn(alice, MEMBERS[0])
  await signIn(bob, MEMBERS[1])

  await aliceContext.setOffline(true)
  await addEntry(alice, 'coffee')
  // Give a would-be sync time to happen, then check it didn't.
  await bob.waitForTimeout(1_000)
  await expect(entry(bob, 'coffee')).toHaveCount(0)

  await aliceContext.setOffline(false)
  await expect(entry(bob, 'coffee')).toBeVisible()
})

test("Firestore unreachable shows Can't connect, not Not authorized", async ({ page, context }) => {
  // Block the Firestore emulator in Chrome itself: Playwright's page.route/context.route
  // interception breaks the Auth emulator's sign-in popup.
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.setBlockedURLs', { urls: ['*127.0.0.1:8080*'] })

  await completeGooglePopup(page, MEMBERS[0])
  await expect(page.getByText('Får ikke kontakt')).toBeVisible()
  await expect(page.getByText('Ingen tilgang')).toHaveCount(0)
})
