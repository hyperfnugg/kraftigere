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

describe('config/guidelines', () => {
  const guidelines = (db: Firestore) => doc(db, 'config/guidelines')

  test('a Family Member can read and write the text, stamped now', async () => {
    await assertSucceeds(setDoc(guidelines(member()), { text: 'Fredag er taco.', updatedAt: serverTimestamp() }))
    await assertSucceeds(setDoc(guidelines(member()), { text: '', updatedAt: serverTimestamp() }))
    await assertSucceeds(getDoc(guidelines(member())))
  })

  test('a non-member cannot read or write', async () => {
    await assertFails(getDoc(guidelines(outsider())))
    await assertFails(setDoc(guidelines(outsider()), { text: 'x', updatedAt: serverTimestamp() }))
  })

  test('a long text, a client time or an extra field is refused', async () => {
    await assertFails(setDoc(guidelines(member()), { text: 'x'.repeat(5001), updatedAt: serverTimestamp() }))
    await assertFails(setDoc(guidelines(member()), { text: 'x', updatedAt: clientTime }))
    await assertFails(setDoc(guidelines(member()), { text: 'x' }))
    await assertFails(setDoc(guidelines(member()), { text: 'x', updatedAt: serverTimestamp(), by: 'alice' }))
  })
})

const emptyMenu = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] }
const allDays = (value: unknown) => Object.fromEntries(Object.keys(emptyMenu).map((d) => [d, value]))
// What setMadeMenu writes the first time: every day stamped.
const madeMenu = (menu: object = { ...emptyMenu, tue: ['Taco'] }) => ({
  menu,
  menuAt: serverTimestamp(),
  mealsAt: allDays(serverTimestamp()),
})

describe('/weeks', () => {
  const week = (db: Firestore, id = '2026-W44') => doc(db, `weeks/${id}`)

  test('a Family Member can write Week Notes, stamped now', async () => {
    await assertSucceeds(setDoc(week(member()), { notes: 'Gjester mandag.', notesAt: serverTimestamp() }, { merge: true }))
    await assertSucceeds(setDoc(week(member()), { notes: '', notesAt: serverTimestamp() }, { merge: true }))
    await assertSucceeds(getDoc(week(member())))
  })

  test('a non-member cannot read or write', async () => {
    await assertFails(getDoc(week(outsider())))
    await assertFails(setDoc(week(outsider()), { notes: 'x', notesAt: serverTimestamp() }))
  })

  test('a week id that is not an ISO week is refused', async () => {
    await assertFails(setDoc(week(member(), '2026-44'), { notes: 'x', notesAt: serverTimestamp() }))
    await assertFails(setDoc(week(member(), 'next'), { notes: 'x', notesAt: serverTimestamp() }))
  })

  test('Week Notes that are too long, unstamped or stamped by the client are refused', async () => {
    await assertFails(setDoc(week(member()), { notes: 'x'.repeat(5001), notesAt: serverTimestamp() }))
    await assertFails(setDoc(week(member()), { notes: 'x' }))
    await assertFails(setDoc(week(member()), { notes: 'x', notesAt: clientTime }))
    await assertFails(setDoc(week(member()), { notes: 'x', notesAt: serverTimestamp(), guests: 2 }))
  })

  test('a made Menu has all seven days and every changed day stamped', async () => {
    await assertSucceeds(setDoc(week(member()), madeMenu()))
    await assertFails(setDoc(week(member(), '2026-W45'), { ...madeMenu(), mealsAt: {} }))
    await assertFails(setDoc(week(member(), '2026-W45'), madeMenu({ tue: ['Taco'] })))
    await assertFails(setDoc(week(member(), '2026-W45'), madeMenu({ ...emptyMenu, xmas: [] })))
    await assertFails(setDoc(week(member(), '2026-W45'), { ...madeMenu(), menuAt: clientTime }))
    await assertFails(setDoc(week(member(), '2026-W45'), madeMenu({ ...emptyMenu, tue: 'Taco' })))
    await assertFails(setDoc(week(member(), '2026-W45'), madeMenu({ ...emptyMenu, tue: ['a', 'b', 'c', 'd', 'e'] })))
  })

  test('editing a Meal stamps that day, and other days stay as they were', async () => {
    await assertSucceeds(setDoc(week(member()), madeMenu()))
    const w = week(member())
    await assertSucceeds(updateDoc(w, { 'menu.tue': ['Taco', 'Is'], 'mealsAt.tue': serverTimestamp() }))
    await assertFails(updateDoc(w, { 'menu.wed': ['Suppe'] }))
    await assertFails(updateDoc(w, { 'menu.wed': ['Suppe'], 'mealsAt.wed': clientTime }))
    await assertFails(updateDoc(w, { 'mealsAt.thu': clientTime }))
    await assertSucceeds(updateDoc(w, { accepted: true }))
    await assertFails(updateDoc(w, { accepted: 'yes' }))
  })

  test('remaking the Menu stamps only the days that changed', async () => {
    await assertSucceeds(setDoc(week(member()), madeMenu()))
    const remade = { menu: { ...emptyMenu, tue: ['Taco'], wed: ['Suppe'] }, menuAt: serverTimestamp() }
    await assertSucceeds(setDoc(week(member()), { ...remade, mealsAt: { wed: serverTimestamp() } }, { merge: true }))
    await assertFails(setDoc(week(member()), { ...remade, menu: { ...remade.menu, fri: ['Pizza'] } }, { merge: true }))
  })

  test('accepting needs a Menu', async () => {
    await assertFails(setDoc(week(member()), { accepted: true }))
  })
})

describe('/weeks/{week}/recipes', () => {
  const recipe = (db: Firestore, id = 'tue-0') => doc(db, `weeks/2026-W44/recipes/${id}`)
  const made = (fields: object = {}) => ({
    course: 'Taco',
    servings: 4,
    ingredients: [{ text: 'kjøttdeig', amount: 400, unit: 'g' }],
    steps: 'Stek kjøttet.',
    madeAt: serverTimestamp(),
    ...fields,
  })

  test('a Family Member can write a made Recipe and edit it by hand', async () => {
    await assertSucceeds(setDoc(recipe(member()), made()))
    await assertSucceeds(updateDoc(recipe(member()), { servings: 6 }))
    await assertSucceeds(updateDoc(recipe(member()), { ingredients: [], steps: '' }))
    await assertSucceeds(setDoc(recipe(member()), made()))
    await assertSucceeds(getDoc(recipe(member())))
    await assertSucceeds(deleteDoc(recipe(member())))
  })

  test('a non-member cannot read or write', async () => {
    await assertFails(getDoc(recipe(outsider())))
    await assertFails(setDoc(recipe(outsider()), made()))
  })

  test('a Recipe id must name a day and a course', async () => {
    await assertFails(setDoc(recipe(member(), 'tue'), made()))
    await assertFails(setDoc(recipe(member(), 'xmas-0'), made()))
    await assertFails(setDoc(recipe(member(), 'tue-4'), made()))
  })

  test('a Recipe in the wrong shape is refused', async () => {
    await assertFails(setDoc(recipe(member()), made({ course: '' })))
    await assertFails(setDoc(recipe(member()), made({ servings: 0 })))
    await assertFails(setDoc(recipe(member()), made({ servings: 2.5 })))
    await assertFails(setDoc(recipe(member()), made({ ingredients: 'kjøttdeig' })))
    await assertFails(setDoc(recipe(member()), made({ ingredients: Array(61).fill({ text: 'x', amount: 1, unit: 'g' }) })))
    await assertFails(setDoc(recipe(member()), made({ steps: 'x'.repeat(10001) })))
    await assertFails(setDoc(recipe(member()), made({ rating: 5 })))
    await assertFails(setDoc(recipe(member()), made({ madeAt: clientTime })))
  })

  test('a hand edit cannot move madeAt to a client time', async () => {
    await assertSucceeds(setDoc(recipe(member()), made()))
    await assertFails(updateDoc(recipe(member()), { madeAt: clientTime }))
  })
})
