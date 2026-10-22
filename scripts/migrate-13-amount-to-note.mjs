// One-off migration for plan 13: renames Entries' `amount` to `note`. Entries without an
// `amount` are skipped, so it can be run again. See docs/adr/0003-data-shape-changes.md.
//
// Emulator:   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/migrate-13-amount-to-note.mjs demo-kraftigere
// Production: gcloud auth application-default login
//             node scripts/migrate-13-amount-to-note.mjs kraftigere
import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

const projectId = process.argv[2]
if (!projectId) throw new Error('usage: node scripts/migrate-13-amount-to-note.mjs <project-id>')

const db = getFirestore(initializeApp({ projectId }))

const entries = await db.collection('entries').where('amount', '!=', null).get()
const batch = db.batch()
for (const entry of entries.docs) {
  // Amounts were at most 50 characters, within a Note's 200.
  batch.update(entry.ref, { note: entry.get('amount'), amount: FieldValue.delete() })
  console.log(`${entry.id}: ${entry.get('amount')}`)
}
await batch.commit()
console.log(`Done: ${entries.size} Entries.`)
