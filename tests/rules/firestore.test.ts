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
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
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
    await setDoc(doc(ctx.firestore(), 'entries/e1'), { text: 'milk', checked: false, createdAt: Timestamp.now() })
  })
})

afterAll(() => env.cleanup())

const member = () => env.authenticatedContext('alice', { email: MEMBER }).firestore()
const outsider = () => env.authenticatedContext('eve', { email: OUTSIDER }).firestore()
const anon = () => env.unauthenticatedContext().firestore()

// What the app's addEntry writes.
const newEntry = (fields: object = {}) => ({ text: 'eggs', checked: false, createdAt: serverTimestamp(), ...fields })

describe('/entries', () => {
  test('a Family Member can read and write', async () => {
    const db = member()
    await assertSucceeds(getDocs(collection(db, 'entries')))
    await assertSucceeds(setDoc(doc(db, 'entries/e2'), newEntry()))
    await assertSucceeds(deleteDoc(doc(db, 'entries/e1')))
  })

  test('a signed-in non-member cannot read or write', async () => {
    const db = outsider()
    await assertFails(getDocs(collection(db, 'entries')))
    await assertFails(setDoc(doc(db, 'entries/e2'), newEntry()))
  })

  test('a signed-out user cannot read or write', async () => {
    const db = anon()
    await assertFails(getDocs(collection(db, 'entries')))
    await assertFails(setDoc(doc(db, 'entries/e2'), newEntry()))
  })})

describe('/entries shape', () => {
  let n = 0
  // A fresh id each time, so every write is a create rather than an update.
  const create = (data: object) => setDoc(doc(member(), `entries/new${n++}`), data)

  test('a new Entry with text, checked false and server time is accepted', async () => {
    await assertSucceeds(create(newEntry()))
    await assertSucceeds(create(newEntry({ text: 'x'.repeat(500) })))
  })

  test('a new Entry with an extra or missing field is refused', async () => {
    await assertFails(create(newEntry({ quantity: 2 })))
    await assertFails(create({ text: 'eggs', checked: false }))
  })

  test('a new Entry with empty, too long or non-string text is refused', async () => {
    await assertFails(create(newEntry({ text: '' })))
    await assertFails(create(newEntry({ text: 'x'.repeat(501) })))
    await assertFails(create(newEntry({ text: 42 })))
  })

  test('a new Entry that is already Checked or has a client-chosen time is refused', async () => {
    await assertFails(create(newEntry({ checked: true })))
    await assertFails(create(newEntry({ createdAt: Timestamp.now() })))
  })

  test('an update may only check off or uncheck', async () => {
    const e1 = doc(member(), 'entries/e1')
    await assertSucceeds(updateDoc(e1, { checked: true }))
    await assertSucceeds(updateDoc(e1, { checked: false }))
    await assertFails(updateDoc(e1, { checked: 'yes' }))
    await assertFails(updateDoc(e1, { text: 'oat milk' }))
    await assertFails(updateDoc(e1, { quantity: 2 }))
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
