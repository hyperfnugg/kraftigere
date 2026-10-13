import { expect, test } from '@playwright/test'

test('the manifest makes the app installable', async ({ page, request }) => {
  await page.goto('./')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(href).toBeTruthy()
  const manifest = await (await request.get(new URL(href!, page.url()).href)).json()

  expect(manifest.name).toBeTruthy()
  expect(manifest.display).toBe('standalone')
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ sizes: '192x192' }),
      expect.objectContaining({ sizes: '512x512' }),
      expect.objectContaining({ purpose: 'maskable' }),
    ]),
  )
  for (const icon of manifest.icons) {
    expect((await request.get(new URL(icon.src, new URL(href!, page.url())).href)).ok()).toBe(true)
  }
})

test('the service worker opens the app offline', async ({ page, context }) => {
  await page.goto('./')
  await page.evaluate(() => navigator.serviceWorker.ready)
  // The first load isn't controlled until the worker claims it; a reload makes sure.
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
})
