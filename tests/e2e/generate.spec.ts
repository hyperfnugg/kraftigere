import { expect, test } from '@playwright/test'
import { MEMBERS, OUTSIDER, PROJECT, reset, seed } from './helpers'

test.beforeEach(async () => {
  await reset()
  await seed()
})

// An ID token from the Auth emulator for a seeded account, which accepts an unsigned Google token.
async function idToken(email: string) {
  const res = await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=demo`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestUri: 'http://localhost',
        postBody: `id_token=${encodeURIComponent(JSON.stringify({ sub: email, email, email_verified: true }))}&providerId=google.com`,
        returnSecureToken: true,
      }),
    },
  )
  return (await res.json()).idToken as string
}

// Calls generate as the account, straight over the callable protocol, as a script would.
async function generate(email: string) {
  const res = await fetch(`http://${process.env.FUNCTIONS_HOST}/${PROJECT}/europe-west1/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await idToken(email)}` },
    body: JSON.stringify({ data: { prompt: 'Hei', schema: { type: 'object' }, maxTokens: 100 } }),
  })
  return { status: res.status, body: await res.json() }
}

test('generate answers a Family Member and refuses a signed-in account not on the allowlist', async () => {
  expect(await generate(MEMBERS[0])).toEqual({ status: 200, body: { result: { stub: true } } })
  const outsider = await generate(OUTSIDER)
  expect(outsider.status).toBe(403)
  expect(outsider.body.error.status).toBe('PERMISSION_DENIED')
})
