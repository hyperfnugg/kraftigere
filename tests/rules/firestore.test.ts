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
    // On the emulator emulators:exec started, found by FIRESTORE_EMULATOR_HOST.
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
})

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'config/family'), { members: [MEMBER] })
    await setDoc(doc(ctx.firestore(), 'wares/milk'), { name: 'milk', addCount: 1, lastAddedAt: Timestamp.now() })
    await setDoc(doc(ctx.firestore(), 'entries/e1'), { text: 'milk', ware: 'milk', checked: false, createdAt: Timestamp.now() })
  })
})

afterAll(() => env.cleanup())

// A time chosen by the client. Fixed in the past: on the local emulator, Timestamp.now()
// can coincide with request.time and be accepted.
const clientTime = Timestamp.fromMillis(0)

const member = () => env.authenticatedContext('alice', { email: MEMBER }).firestore()
const outsider = () => env.authenticatedContext('eve', { email: OUTSIDER }).firestore()
const anon = () => env.unauthenticatedContext().firestore()

// What the app's addEntry writes: the Entry, and its Ware created or counted in the same batch.
const newEntry = (fields: object = {}) => ({
  text: 'eggs',
  ware: 'eggs',
  checked: false,
  createdAt: serverTimestamp(),
  ...fields,
})
const countedWare = (name = 'eggs') => ({ name, addCount: increment(1), lastAddedAt: serverTimestamp() })

let n = 0
// A fresh Entry id each time, so every Entry write is a create rather than an update.
function add(db: Firestore, entry: object = newEntry(), ware: object | null = countedWare(), wareId = 'eggs') {
  const batch = writeBatch(db)
  batch.set(doc(db, `entries/new${n++}`), entry)
  if (ware) batch.set(doc(db, `wares/${wareId}`), ware, { merge: true })
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
  const create = (entry: object, ware: object | null = countedWare()) => add(member(), entry, ware)

  test('a new Entry for a new Ware is accepted', async () => {
    await assertSucceeds(create(newEntry()))
  })

  test('a new Entry for an existing Ware is accepted', async () => {
    await assertSucceeds(add(member(), newEntry({ text: 'milk', ware: 'milk' }), countedWare('milk'), 'milk'))
  })

  test('a new Entry with an extra or missing field is refused', async () => {
    await assertFails(create(newEntry({ quantity: 2 })))
    await assertFails(create({ text: 'eggs', checked: false, createdAt: serverTimestamp() }))
    await assertFails(create({ ware: 'eggs', checked: false, createdAt: serverTimestamp() }))
    await assertFails(create(newEntry({ staple: 'eggs' })))
  })

  test('a new Entry without its Ware, or with other text than the Ware name, is refused', async () => {
    await assertFails(create(newEntry(), null))
    await assertFails(create(newEntry({ text: 'Eggs' })))
    await assertFails(create(newEntry({ ware: 'nope' })))
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
    await assertFails(updateDoc(e1, { ware: 'eggs' }))
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

describe('/wares', () => {
  const ware = (id = 'eggs') => doc(member(), `wares/${id}`)

  test('a Family Member can read, a non-member cannot', async () => {
    await assertSucceeds(getDocs(collection(member(), 'wares')))
    await assertFails(getDocs(collection(outsider(), 'wares')))
    await assertFails(getDocs(collection(anon(), 'wares')))
  })

  test('a hand-added Ware has a name, an add count of 1 and server time', async () => {
    await assertSucceeds(setDoc(ware(), countedWare()))
    await assertSucceeds(setDoc(ware('long'), countedWare('x'.repeat(100))))
  })

  test('a new Ware with a bad name, count, time or extra field is refused', async () => {
    await assertFails(setDoc(ware(), countedWare('')))
    await assertFails(setDoc(ware(), countedWare('x'.repeat(101))))
    await assertFails(setDoc(ware(), { name: 'eggs', addCount: 2, lastAddedAt: serverTimestamp() }))
    await assertFails(setDoc(ware(), { name: 'eggs', addCount: 1, lastAddedAt: clientTime }))
    await assertFails(setDoc(ware(), { ...countedWare(), price: 10 }))
    await assertFails(setDoc(ware(), { name: 'eggs', addCount: 1 }))
    await assertFails(setDoc(ware(), { name: 'eggs' }))
  })

  test('an add counts once and may respell the name', async () => {
    await assertSucceeds(setDoc(ware('milk'), countedWare('milk'), { merge: true }))
    await assertSucceeds(setDoc(ware('milk'), countedWare('Milk'), { merge: true }))
  })

  test('an update that counts more than once, sets the time or adds a field is refused', async () => {
    const milk = ware('milk')
    await assertFails(updateDoc(milk, { addCount: increment(2), lastAddedAt: serverTimestamp() }))
    await assertFails(updateDoc(milk, { addCount: 5, lastAddedAt: serverTimestamp() }))
    await assertFails(updateDoc(milk, { addCount: increment(1), lastAddedAt: clientTime }))
    await assertFails(updateDoc(milk, { name: 'oat milk' }))
    await assertFails(updateDoc(milk, { addCount: increment(1), lastAddedAt: serverTimestamp(), price: 10 }))
  })

  test('a Ware cannot be deleted', async () => {
    await assertFails(deleteDoc(ware('milk')))
  })

  test('Iverksett can create a Ware without counting an add, and remember it as usually at home', async () => {
    await assertSucceeds(setDoc(ware('salt'), { name: 'salt', addCount: 0 }))
    await assertSucceeds(setDoc(ware('oil'), { name: 'oil', addCount: 0, usuallyAtHome: true }))
    await assertFails(setDoc(ware('pepper'), { name: 'pepper', addCount: 0, lastAddedAt: serverTimestamp() }))
    await assertFails(setDoc(ware('pepper'), { name: 'pepper', addCount: 0, usuallyAtHome: 'yes' }))
    // A Ware made by Iverksett counts its first hand add like any other.
    await assertSucceeds(setDoc(ware('salt'), countedWare('salt'), { merge: true }))
  })

  test('usuallyAtHome can change on its own, but not with anything else', async () => {
    await assertSucceeds(updateDoc(ware('milk'), { usuallyAtHome: true }))
    await assertSucceeds(updateDoc(ware('milk'), { usuallyAtHome: false }))
    await assertFails(updateDoc(ware('milk'), { usuallyAtHome: 'no' }))
    await assertFails(updateDoc(ware('milk'), { usuallyAtHome: true, name: 'Milk' }))
  })

  test('Staples are gone', async () => {
    await assertFails(getDocs(collection(member(), 'staples')))
    await assertFails(setDoc(doc(member(), 'staples/eggs'), countedWare()))
  })
})

describe('/matches', () => {
  test('a Family Member can read and write a remembered match, a non-member cannot', async () => {
    await assertSucceeds(setDoc(doc(member(), 'matches/helmelk'), { wording: 'helmelk', ware: 'milk' }))
    await assertSucceeds(setDoc(doc(member(), 'matches/helmelk'), { wording: 'Helmelk', ware: 'helmelk' }))
    await assertSucceeds(getDocs(collection(member(), 'matches')))
    await assertFails(getDocs(collection(outsider(), 'matches')))
    await assertFails(setDoc(doc(outsider(), 'matches/helmelk'), { wording: 'helmelk', ware: 'milk' }))
  })

  test('a match in the wrong shape is refused', async () => {
    await assertFails(setDoc(doc(member(), 'matches/x'), { wording: 'x' }))
    await assertFails(setDoc(doc(member(), 'matches/x'), { wording: 'x', staple: 'x' }))
    await assertFails(setDoc(doc(member(), 'matches/x'), { wording: 'x', ware: 'x', staple: 'x' }))
    await assertFails(setDoc(doc(member(), 'matches/x'), { wording: '', ware: 'x' }))
    await assertFails(setDoc(doc(member(), 'matches/x'), { wording: 'x', ware: '' }))
  })

  test('a match cannot be deleted', async () => {
    await assertFails(deleteDoc(doc(member(), 'matches/helmelk')))
  })
})

describe('/entries made by Iverksett', () => {
  const dish = { week: '2026-W44', recipe: 'mon-0', course: 'Taco', grams: 200, pieces: 2 }
  const iverksatt = (fields: object = {}) => ({
    text: 'løk',
    ware: 'løk',
    dishes: [dish],
    checked: false,
    createdAt: serverTimestamp(),
    ...fields,
  })
  const create = (entry: object) => setDoc(doc(member(), `entries/menu${n++}`), entry)

  test('an Entry with dishes is made without counting its Ware', async () => {
    await assertSucceeds(create(iverksatt()))
    await assertSucceeds(create(iverksatt({ dishes: Array(50).fill(dish) })))
  })

  test('an Entry with dishes in the wrong shape is refused', async () => {
    await assertFails(create(iverksatt({ ware: '' })))
    await assertFails(create(iverksatt({ dishes: [] })))
    await assertFails(create(iverksatt({ dishes: Array(51).fill(dish) })))
    await assertFails(create(iverksatt({ dishes: dish })))
    await assertFails(create(iverksatt({ days: ['mon'] })))
    await assertFails(create(iverksatt({ checked: true })))
    await assertFails(create(iverksatt({ createdAt: clientTime })))
  })

  test('dishes can be added to a waiting Entry, which can also get a Note', async () => {
    const e = doc(member(), 'entries/menu-x')
    await assertSucceeds(setDoc(e, iverksatt()))
    await assertSucceeds(updateDoc(e, { dishes: [dish, { ...dish, recipe: 'fri-0' }] }))
    await assertSucceeds(updateDoc(e, { note: 'de store' }))
    await assertSucceeds(updateDoc(doc(member(), 'entries/e1'), { dishes: [dish] }))
    await assertFails(updateDoc(e, { dishes: [] }))
    await assertFails(updateDoc(e, { dishes: 'Taco' }))
    await assertSucceeds(updateDoc(e, { checked: true, checkedAt: serverTimestamp() }))
    await assertSucceeds(deleteDoc(e))
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

  // What the app's setDayNote writes.
  const dayNote = (day: string, note: string, at: unknown = serverTimestamp()) => ({
    dayNotes: { [day]: note },
    dayNotesAt: { [day]: at },
  })

  test('a Family Member can write Day Notes, each stamped now', async () => {
    await assertSucceeds(setDoc(week(member()), dayNote('mon', 'Gjester.'), { merge: true }))
    await assertSucceeds(setDoc(week(member()), dayNote('wed', 'Peter er borte.'), { merge: true }))
    await assertSucceeds(setDoc(week(member()), dayNote('mon', ''), { merge: true }))
    await assertSucceeds(getDoc(week(member())))
    await assertSucceeds(getDocs(collection(member(), 'weeks')))
  })

  test('a non-member cannot read or write', async () => {
    await assertFails(getDoc(week(outsider())))
    await assertFails(getDocs(collection(outsider(), 'weeks')))
    await assertFails(setDoc(week(outsider()), dayNote('mon', 'x')))
  })

  test('a week id that is not an ISO week is refused', async () => {
    await assertFails(setDoc(week(member(), '2026-44'), dayNote('mon', 'x')))
    await assertFails(setDoc(week(member(), 'next'), dayNote('mon', 'x')))
  })

  test('Day Notes that are too long, unstamped, stamped by the client or not on a day are refused', async () => {
    await assertFails(setDoc(week(member()), dayNote('mon', 'x'.repeat(5001))))
    await assertFails(setDoc(week(member()), { dayNotes: { mon: 'x' } }))
    await assertFails(setDoc(week(member()), { dayNotes: { mon: 'x' }, dayNotesAt: {} }))
    await assertFails(setDoc(week(member()), dayNote('mon', 'x', clientTime)))
    await assertFails(setDoc(week(member()), dayNote('xmas', 'x')))
    await assertFails(setDoc(week(member()), { ...dayNote('mon', 'x'), guests: 2 }))
  })

  test('changing one Day Note leaves the other days as they were', async () => {
    await assertSucceeds(setDoc(week(member()), dayNote('mon', 'Gjester.')))
    await assertFails(updateDoc(week(member()), { 'dayNotes.mon': 'Ingen gjester.' }))
    await assertFails(updateDoc(week(member()), { 'dayNotes.mon': 'Ingen gjester.', 'dayNotesAt.tue': serverTimestamp() }))
    await assertFails(updateDoc(week(member()), { 'dayNotesAt.mon': clientTime }))
  })

  test('Week Notes and accepted, left over on old weeks, can stay but not change', async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), 'weeks/2026-W44'), { notes: 'Gjester.', notesAt: Timestamp.now(), ...madeMenu(), accepted: true }),
    )
    await assertSucceeds(setDoc(week(member()), dayNote('mon', 'Gjester.'), { merge: true }))
    await assertSucceeds(updateDoc(week(member()), { 'menu.tue': ['Suppe'], 'mealsAt.tue': serverTimestamp() }))
    await assertFails(updateDoc(week(member()), { notes: 'x', notesAt: serverTimestamp() }))
    await assertFails(updateDoc(week(member()), { accepted: false }))
    await assertFails(setDoc(week(member(), '2026-W45'), { notes: 'x', notesAt: serverTimestamp() }))
    await assertFails(setDoc(week(member(), '2026-W45'), { ...madeMenu(), accepted: true }))
  })

  test('Confirm stamps the week once, only a week with a Menu, and fixes its Menu and Day Notes', async () => {
    await assertFails(setDoc(week(member()), { confirmedAt: serverTimestamp() }))
    await assertSucceeds(setDoc(week(member()), madeMenu()))
    await assertFails(updateDoc(week(member()), { confirmedAt: clientTime }))
    await assertSucceeds(updateDoc(week(member()), { confirmedAt: serverTimestamp() }))
    await assertFails(updateDoc(week(member()), { confirmedAt: serverTimestamp() }))
    await assertFails(updateDoc(week(member()), { confirmedAt: deleteField() }))
    // The Ingredients are bought, so the Menu and Day Notes stay as they are.
    await assertFails(updateDoc(week(member()), { 'menu.tue': ['Suppe'], 'mealsAt.tue': serverTimestamp() }))
    await assertFails(setDoc(week(member()), { dayNotes: { mon: 'x' }, dayNotesAt: { mon: serverTimestamp() } }, { merge: true }))
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
  })

  test('remaking the Menu stamps only the days that changed', async () => {
    await assertSucceeds(setDoc(week(member()), madeMenu()))
    const remade = { menu: { ...emptyMenu, tue: ['Taco'], wed: ['Suppe'] }, menuAt: serverTimestamp() }
    await assertSucceeds(setDoc(week(member()), { ...remade, mealsAt: { wed: serverTimestamp() } }, { merge: true }))
    await assertFails(setDoc(week(member()), { ...remade, menu: { ...remade.menu, fri: ['Pizza'] } }, { merge: true }))
  })

  test("a changed Meal and its changed courses' Recipes go in one batch", async () => {
    await assertSucceeds(setDoc(week(member()), madeMenu()))
    const db = member()
    const batch = writeBatch(db)
    batch.delete(doc(db, 'weeks/2026-W44/recipes/tue-0'))
    batch.update(week(db), { 'menu.tue': ['Suppe'], 'mealsAt.tue': serverTimestamp() })
    await assertSucceeds(batch.commit())
  })
})

describe('/weeks/{week}/recipes', () => {
  const recipe = (db: Firestore, id = 'tue-0') => doc(db, `weeks/2026-W44/recipes/${id}`)
  const made = (fields: object = {}) => ({
    course: 'Taco',
    servings: 4,
    steps: [{ ingredients: [{ text: 'kjøttdeig', grams: 400, measure: '' }], instructions: ['Stek kjøttet.'] }],
    madeAt: serverTimestamp(),
    ...fields,
  })

  test('a Family Member can write a made Recipe and edit it by hand', async () => {
    await assertSucceeds(setDoc(recipe(member()), made()))
    await assertSucceeds(updateDoc(recipe(member()), { servings: 6 }))
    await assertSucceeds(updateDoc(recipe(member()), { steps: [] }))
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
    await assertFails(setDoc(recipe(member()), made({ steps: 'Stek kjøttet.' })))
    await assertFails(setDoc(recipe(member()), made({ steps: Array(31).fill({ ingredients: [], instructions: ['x'] }) })))
    await assertFails(setDoc(recipe(member()), made({ ingredients: [] })))
    await assertFails(setDoc(recipe(member()), made({ rating: 5 })))
    await assertFails(setDoc(recipe(member()), made({ madeAt: clientTime })))
  })

  test('a hand edit cannot move madeAt to a client time', async () => {
    await assertSucceeds(setDoc(recipe(member()), made()))
    await assertFails(updateDoc(recipe(member()), { madeAt: clientTime }))
  })
})
