// One-off migration for plan 12: gives every Entry without a Staple one, created or counted
// from its text. Entries that already have a Staple are skipped, so it can be run again.
// See docs/adr/0003-data-shape-changes.md.
//
// Emulator:   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/migrate-12-staples.mjs demo-kraftigere
// Production: gcloud auth application-default login
//             node scripts/migrate-12-staples.mjs kraftigere
import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

const projectId = process.argv[2]
if (!projectId) throw new Error('usage: node scripts/migrate-12-staples.mjs <project-id>')

const db = getFirestore(initializeApp({ projectId }))

// Same as stapleName and stapleId in src/entries.ts. Names are capped at 100 characters, as the rules require.
const stapleName = (text) => text.trim().replace(/\s+/g, ' ').slice(0, 100).trim()
function stapleId(name) {
  const id = stapleName(name).toLowerCase().replaceAll('/', '∕')
  return /^\.\.?$|^__.*__$/.test(id) ? `~${id}` : id
}

// Group Entries without a Staple by the Staple they belong to, oldest first, so the
// last spelling added becomes the Staple's name.
const entries = await db.collection('entries').orderBy('createdAt').get()
const groups = new Map()
for (const entry of entries.docs) {
  if (entry.get('staple')) continue
  const name = stapleName(entry.get('text'))
  if (!name) {
    console.warn(`skipped ${entry.id}: no text`)
    continue
  }
  const id = stapleId(name)
  const group = groups.get(id) ?? { name, entries: [], lastAddedAt: null }
  group.name = name
  group.entries.push(entry)
  group.lastAddedAt = entry.get('createdAt')
  groups.set(id, group)
}

// One batch per Staple, so a failure leaves each Staple and its Entries consistent.
for (const [id, group] of groups) {
  const ref = db.doc(`staples/${id}`)
  const existing = await ref.get()
  const batch = db.batch()
  if (existing.exists) {
    const later = existing.get('lastAddedAt').toMillis() > group.lastAddedAt.toMillis()
    batch.update(ref, {
      name: group.name,
      addCount: FieldValue.increment(group.entries.length),
      lastAddedAt: later ? existing.get('lastAddedAt') : group.lastAddedAt,
    })
  } else {
    batch.set(ref, { name: group.name, addCount: group.entries.length, lastAddedAt: group.lastAddedAt })
  }
  for (const entry of group.entries) batch.update(entry.ref, { staple: id, text: group.name })
  await batch.commit()
  console.log(`${id}: ${group.entries.length} Entries${existing.exists ? ' (existing Staple)' : ''}`)
}

console.log(`Done: ${groups.size} Staples, ${[...groups.values()].reduce((n, g) => n + g.entries.length, 0)} Entries.`)
