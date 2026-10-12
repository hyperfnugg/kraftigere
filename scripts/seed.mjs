// Seeds the Firestore emulator with a test Family. "Bearer owner" bypasses security rules.
import { pathToFileURL } from 'node:url'

export const PROJECT = 'demo-kraftigere'
export const MEMBERS = ['alice@example.com', 'bob@example.com']
export const OUTSIDER = 'eve@example.com'

const documents = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`
const headers = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }

// Clears all Firestore data and Auth accounts in the emulators.
export async function reset() {
  for (const url of [
    `http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`,
    `http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/accounts`,
  ]) {
    const res = await fetch(url, { method: 'DELETE' })
    if (!res.ok) throw new Error(`reset failed: ${url} ${res.status}`)
  }
}

export async function seed() {
  const res = await fetch(`${documents}/config/family`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      fields: { members: { arrayValue: { values: MEMBERS.map((m) => ({ stringValue: m })) } } },
    }),
  })
  if (!res.ok) throw new Error(`seed failed: ${res.status} ${await res.text()}`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await seed()
  console.log(`Seeded Family: ${MEMBERS.join(', ')} (outsider: ${OUTSIDER})`)
}
