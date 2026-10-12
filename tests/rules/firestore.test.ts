import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, getDocs, collection, setDoc } from 'firebase/firestore'
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
    await setDoc(doc(ctx.firestore(), 'entries/e1'), { text: 'milk', checked: false })
  })
})

afterAll(() => env.cleanup())

const member = () => env.authenticatedContext('alice', { email: MEMBER }).firestore()
const outsider = () => env.authenticatedContext('eve', { email: OUTSIDER }).firestore()
const anon = () => env.unauthenticatedContext().firestore()

describe('/entries', () => {
  test('a Family Member can read and write', async () => {
    const db = member()
    await assertSucceeds(getDocs(collection(db, 'entries')))
    await assertSucceeds(setDoc(doc(db, 'entries/e2'), { text: 'eggs', checked: false }))
    await assertSucceeds(deleteDoc(doc(db, 'entries/e1')))
  })

  test('a signed-in non-member cannot read or write', async () => {
    const db = outsider()
    await assertFails(getDocs(collection(db, 'entries')))
    await assertFails(setDoc(doc(db, 'entries/e2'), { text: 'eggs', checked: false }))
  })

  test('a signed-out user cannot read or write', async () => {
    const db = anon()
    await assertFails(getDocs(collection(db, 'entries')))
    await assertFails(setDoc(doc(db, 'entries/e2'), { text: 'eggs', checked: false }))
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
