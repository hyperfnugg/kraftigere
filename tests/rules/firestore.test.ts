import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, test } from 'vitest'

const MEMBER = 'alice@example.com'
const OUTSIDER = 'eve@example.com'

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-kraftigere-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  })
})

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'config/family'), { members: [MEMBER] })
    await setDoc(doc(ctx.firestore(), 'staples/milk'), { name: 'milk', addCount: 1, lastAddedAt: Timestamp.now() })
    await setDoc(doc(ctx.firestore(), 'entries/e1'), { text: 'milk', staple: 'milk', checked: false, createdAt: Timestamp.now() })
  })
})

afterAll(() => env.cleanup())

// A time chosen by the client. Fixed in the past: on the local emulator, Timestamp.now()
// can coincide with request.time and be accepted.
const clientTime = Timestamp.fromMillis(0)

const member = () => env.authenticatedContext('alice', { email: MEMBER }).firestore()
const outsider = () => env.authenticatedContext('eve', { email: OUTSIDER }).firestore()
const anon = () => env.unauthenticatedContext().firestore()

// What the app's addEntry writes: the Entry, and its Staple created or counted in the same batch.
const newEntry = (fields: object = {}) => ({
  text: 'eggs',
  staple: 'eggs',
  checked: false,
  createdAt: serverTimestamp(),
  ...fields,
})
const countedStaple = (name = 'eggs') => ({ name, addCount: increment(1), lastAddedAt: serverTimestamp() })

let n = 0
// A fresh Entry id each time, so every Entry write is a create rather than an update.
function add(db: Firestore, entry: object = newEntry(), staple: object | null = countedStaple(), stapleId = 'eggs') {
  const batch = writeBatch(db)
  batch.set(doc(db, `entries/new${n++}`), entry)
  if (staple) batch.set(doc(db, `staples/${stapleId}`), staple, { merge: true })
  return batch.commit()
}

describe('/entries', () => {
  test('a Family Member can read and write', async () => {
    const db = member()
    await assertSucceeds(getDocs(collection(db, 'entries')))
    await assertSucceeds(add(db))
    await assertSucceeds(deleteDoc(doc(db, 'entries/e1')))
  })

  test('a signed-in non-member cannot read or write', async () => {
    const db = outsider()
    await assertFails(getDocs(collection(db, 'entries')))
    await assertFails(add(db))
  })

  test('a signed-out user cannot read or write', async () => {
    const db = anon()
    await assertFails(getDocs(collection(db, 'entries')))
    await assertFails(add(db))
  })
})

describe('/entries shape', () => {
  const create = (entry: object, staple: object | null = countedStaple()) => add(member(), entry, staple)

  test('a new Entry for a new Staple is accepted', async () => {
    await assertSucceeds(create(newEntry()))
  })

  test('a new Entry for an existing Staple is accepted', async () => {
    await assertSucceeds(add(member(), newEntry({ text: 'milk', staple: 'milk' }), countedStaple('milk'), 'milk'))
  })

  test('a new Entry with an extra or missing field is refused', async () => {
    await assertFails(create(newEntry({ quantity: 2 })))
    await assertFails(create({ text: 'eggs', checked: false, createdAt: serverTimestamp() }))
    await assertFails(create({ staple: 'eggs', checked: false, createdAt: serverTimestamp() }))
  })

  test('a new Entry without its Staple, or with other text than the Staple name, is refused', async () => {
    await assertFails(create(newEntry(), null))
    await assertFails(create(newEntry({ text: 'Eggs' })))
    await assertFails(create(newEntry({ staple: 'nope' })))
  })

  test('a new Entry that is already Checked or has a client-chosen time is refused', async () => {
    await assertFails(create(newEntry({ checked: true })))
    await assertFails(create(newEntry({ createdAt: clientTime })))
  })

  test('checking off records the server time, unchecking removes it', async () => {
    const e1 = doc(member(), 'entries/e1')
    await assertSucceeds(updateDoc(e1, { checked: true, checkedAt: serverTimestamp() }))
    await assertSucceeds(updateDoc(e1, { checked: false, checkedAt: deleteField() }))
  })

  test('checking off without the server time, or unchecking without removing it, is refused', async () => {
    const e1 = doc(member(), 'entries/e1')
    await assertFails(updateDoc(e1, { checked: true }))
    await assertFails(updateDoc(e1, { checked: true, checkedAt: clientTime }))
    await assertSucceeds(updateDoc(e1, { checked: true, checkedAt: serverTimestamp() }))
    await assertFails(updateDoc(e1, { checked: false }))
    await assertFails(updateDoc(e1, { checked: 'yes', checkedAt: serverTimestamp() }))
  })

  test('an update may not change anything else', async () => {
    const e1 = doc(member(), 'entries/e1')
    await assertFails(updateDoc(e1, { text: 'oat milk' }))
    await assertFails(updateDoc(e1, { quantity: 2 }))
    await assertFails(updateDoc(e1, { staple: 'eggs' }))
  })
})

describe('/entries note', () => {
  test('a new Entry may have a Note of 1 to 200 characters', async () => {
    await assertSucceeds(add(member(), newEntry({ note: 'lots' })))
    await assertSucceeds(add(member(), newEntry({ note: 'x'.repeat(200) })))
    await assertFails(add(member(), newEntry({ note: '' })))
    await assertFails(add(member(), newEntry({ note: 'x'.repeat(201) })))
    await assertFails(add(member(), newEntry({ note: 12 })))
    await assertFails(add(member(), newEntry({ amount: 'lots' })))
  })

  test('an update may set, change or remove the Note', async () => {
    const e1 = doc(member(), 'entries/e1')
    await assertSucceeds(updateDoc(e1, { note: '12' }))
    await assertSucceeds(updateDoc(e1, { note: 'the lactose-free one' }))
    await assertSucceeds(updateDoc(e1, { note: deleteField() }))
    await assertFails(updateDoc(e1, { note: '' }))
    await assertFails(updateDoc(e1, { note: 'x'.repeat(201) }))
    await assertFails(updateDoc(e1, { amount: 'lots' }))
  })

  test('the Note of a Checked Entry can change without touching its check-off', async () => {
    const e1 = doc(member(), 'entries/e1')
    await assertSucceeds(updateDoc(e1, { checked: true, checkedAt: serverTimestamp() }))
    await assertSucceeds(updateDoc(e1, { note: '2' }))
    await assertFails(updateDoc(e1, { note: '3', checkedAt: clientTime }))
    await assertFails(updateDoc(e1, { checkedAt: clientTime }))
  })
})

describe('/staples', () => {
  const staple = (id = 'eggs') => doc(member(), `staples/${id}`)

  test('a Family Member can read, a non-member cannot', async () => {
    await assertSucceeds(getDocs(collection(member(), 'staples')))
    await assertFails(getDocs(collection(outsider(), 'staples')))
    await assertFails(getDocs(collection(anon(), 'staples')))
  })

  test('a new Staple has a name, an add count of 1 and server time', async () => {
    await assertSucceeds(setDoc(staple(), countedStaple()))
    await assertSucceeds(setDoc(staple('long'), countedStaple('x'.repeat(100))))
  })

  test('a new Staple with a bad name, count, time or extra field is refused', async () => {
    await assertFails(setDoc(staple(), countedStaple('')))
    await assertFails(setDoc(staple(), countedStaple('x'.repeat(101))))
    await assertFails(setDoc(staple(), { name: 'eggs', addCount: 2, lastAddedAt: serverTimestamp() }))
    await assertFails(setDoc(staple(), { name: 'eggs', addCount: 1, lastAddedAt: clientTime }))
    await assertFails(setDoc(staple(), { ...countedStaple(), ware: 'x' }))
    await assertFails(setDoc(staple(), { name: 'eggs', addCount: 1 }))
  })

  test('an add counts once and may respell the name', async () => {
    await assertSucceeds(setDoc(staple('milk'), countedStaple('milk'), { merge: true }))
    await assertSucceeds(setDoc(staple('milk'), countedStaple('Milk'), { merge: true }))
  })

  test('an update that counts more than once, sets the time or adds a field is refused', async () => {
    const milk = staple('milk')
    await assertFails(updateDoc(milk, { addCount: increment(2), lastAddedAt: serverTimestamp() }))
    await assertFails(updateDoc(milk, { addCount: 5, lastAddedAt: serverTimestamp() }))
    await assertFails(updateDoc(milk, { addCount: increment(1), lastAddedAt: clientTime }))
    await assertFails(updateDoc(milk, { name: 'oat milk' }))
    await assertFails(updateDoc(milk, { addCount: increment(1), lastAddedAt: serverTimestamp(), ware: 'x' }))
  })

  test('a Staple cannot be deleted', async () => {
    await assertFails(deleteDoc(staple('milk')))
  })
})

describe('config/family', () => {
  test('a Family Member can read but not write', async () => {
    const db = member()
    await assertSucceeds(getDoc(doc(db, 'config/family')))
    await assertFails(setDoc(doc(db, 'config/family'), { members: [MEMBER, OUTSIDER] }))
  })

  test('a non-member cannot read', async () => {
    await assertFails(getDoc(doc(outsider(), 'config/family')))
  })
})
