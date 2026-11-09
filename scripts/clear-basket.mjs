// Frees every In Basket Entry by removing its `basket`, as Avbryt does, leaving it unchecked.
// The rules let only the Oda functions do that, so this is for when they are switched off or
// failing (plan 29, "If production breaks"). It doesn't touch the Basket on oda.com: empty
// that there by hand. Run it again and it finds nothing to do.
//
// Emulator:   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/clear-basket.mjs demo-kraftigere
// Production: gcloud auth application-default login
//             node scripts/clear-basket.mjs kraftigere
import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

const projectId = process.argv[2]
if (!projectId) throw new Error('usage: node scripts/clear-basket.mjs <project-id>')

const db = getFirestore(initializeApp({ projectId }))

const entries = await db.collection('entries').where('basket', '!=', null).get()
const batch = db.batch()
for (const entry of entries.docs) {
  batch.update(entry.ref, { basket: FieldValue.delete() })
  console.log(`${entry.id}: ${entry.get('basket').name ?? entry.get('basket').productId}`)
}
await batch.commit()
console.log(`Done: ${entries.size} Entries freed.`)
