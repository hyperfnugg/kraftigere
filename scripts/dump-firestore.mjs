// Copies every Firestore document, subcollections included, to a JSON file, keyed by path. Made
// for plan 29's kill switch test, to compare Firestore after billing was removed. Not a backup.
//
// The copy holds family data and the Oda Link's tokens, so it is written outside the repo,
// readable only by you, and deleted when no longer needed.
//
// Emulator:   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/dump-firestore.mjs demo-kraftigere ~/kraft-dump.json
// Production: gcloud auth application-default login
//             node scripts/dump-firestore.mjs kraftigere ~/kraft-dump.json
import { writeFile } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeApp } from 'firebase-admin/app'
import { DocumentReference, GeoPoint, Timestamp, getFirestore } from 'firebase-admin/firestore'

const [projectId, out] = process.argv.slice(2)
if (!projectId || !out) throw new Error('usage: node scripts/dump-firestore.mjs <project-id> <file>')
const file = resolve(out)
const inRepo = !relative(fileURLToPath(new URL('..', import.meta.url)), file).startsWith('..')
if (inRepo) throw new Error(`${file} is inside the repo; write the copy somewhere else`)

const db = getFirestore(initializeApp({ projectId }))

// Firestore's own types, written so a later copy compares equal when nothing changed.
function plain(value) {
  if (value instanceof Timestamp) return { timestamp: value.toDate().toISOString() }
  if (value instanceof DocumentReference) return { reference: value.path }
  if (value instanceof GeoPoint) return { geoPoint: [value.latitude, value.longitude] }
  if (Array.isArray(value)) return value.map(plain)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, plain(value[k])]))
  }
  return value
}

const documents = {}
// listDocuments includes documents that only hold subcollections.
async function dump(collections) {
  for (const collection of collections) {
    for (const ref of await collection.listDocuments()) {
      const snap = await ref.get()
      if (snap.exists) documents[ref.path] = plain(snap.data())
      await dump(await ref.listCollections())
    }
  }
}
await dump(await db.listCollections())

const sorted = Object.fromEntries(Object.keys(documents).sort().map((k) => [k, documents[k]]))
await writeFile(file, JSON.stringify(sorted, null, 2) + '\n', { mode: 0o600, flag: 'wx' })
console.log(`Done: ${Object.keys(sorted).length} documents in ${file}.`)
