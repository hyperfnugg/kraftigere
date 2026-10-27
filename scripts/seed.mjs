// Seeds the Firestore emulator with a test Family. "Bearer owner" bypasses security rules.
import { pathToFileURL } from 'node:url'

export const PROJECT = 'demo-kraftigere'
export const MEMBERS = ['alice@example.com', 'bob@example.com']
export const OUTSIDER = 'eve@example.com'

// The emulators of `npm run dev`, or the tests' own (firebase.test.json): emulators:exec and
// playwright.config.ts set these.
export const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099'

const documents = `http://${FIRESTORE_HOST}/v1/projects/${PROJECT}/databases/(default)/documents`
const headers = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }

// Since firebase-tools 15.34 the Firestore emulator sometimes answers 409 ("Transaction
// lock timeout") while the last test's writes settle, so a conflict is retried.
async function request(url, init) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, init)
    if (res.status !== 409 || attempt === 5) return res
    await new Promise((resolve) => setTimeout(resolve, 200 * attempt))
  }
}

// Clears all Firestore data and Auth accounts in the emulators. A write from the last test
// can still land after the clear, so Firestore is cleared until it stays empty.
export async function reset() {
  for (const url of [
    `http://${FIRESTORE_HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`,
    `http://${AUTH_HOST}/emulator/v1/projects/${PROJECT}/accounts`,
  ]) {
    const res = await request(url, { method: 'DELETE' })
    if (!res.ok) throw new Error(`reset failed: ${url} ${res.status}`)
  }
  for (let attempt = 1; !(await firestoreEmpty()); attempt++) {
    if (attempt === 10) throw new Error('reset failed: Firestore not empty')
    await new Promise((resolve) => setTimeout(resolve, 200))
    await request(`http://${FIRESTORE_HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, {
      method: 'DELETE',
    })
  }
}

async function firestoreEmpty() {
  const res = await request(`${documents}:listCollectionIds`, { method: 'POST', headers, body: '{}' })
  if (!res.ok) throw new Error(`reset check failed: ${res.status}`)
  return ((await res.json()).collectionIds ?? []).length === 0
}

// Creates Google accounts in the Auth emulator so its sign-in popup lists them.
// The emulator accepts an unsigned JSON ID token.
async function seedAccounts() {
  for (const email of [...MEMBERS, OUTSIDER]) {
    const idToken = JSON.stringify({ sub: email, email, email_verified: true, name: email.split('@')[0] })
    const res = await fetch(`http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=demo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestUri: 'http://localhost',
        postBody: `id_token=${encodeURIComponent(idToken)}&providerId=google.com`,
        returnSecureToken: true,
      }),
    })
    if (!res.ok) throw new Error(`account seed failed: ${email} ${res.status} ${await res.text()}`)
  }
}

export async function seed() {
  await seedAccounts()
  await setMembers(MEMBERS)
}

// Replaces the Family's members, as the Admin would in the console.
export async function setMembers(members) {
  const res = await request(`${documents}/config/family`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      fields: { members: { arrayValue: { values: members.map((m) => ({ stringValue: m })) } } },
    }),
  })
  if (!res.ok) throw new Error(`seed failed: ${res.status} ${await res.text()}`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await seed()
  console.log(`Seeded Family: ${MEMBERS.join(', ')} (outsider: ${OUTSIDER})`)
}
