import {
  type Timestamp,
  type WriteBatch,
  collection,
  doc,
  getDoc,
  getDocFromCache,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from './firebase'

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export type Day = (typeof DAYS)[number]
export const DAY_NAMES: Record<Day, string> = {
  mon: 'Mandag',
  tue: 'Tirsdag',
  wed: 'Onsdag',
  thu: 'Torsdag',
  fri: 'Fredag',
  sat: 'Lørdag',
  sun: 'Søndag',
}
export const DAY_SHORT: Record<Day, string> = {
  mon: 'man',
  tue: 'tir',
  wed: 'ons',
  thu: 'tor',
  fri: 'fre',
  sat: 'lør',
  sun: 'søn',
}
// One dish per day for now. A Meal stays a list of courses (the rules allow 4), so more
// can come back, and older weeks may still have several.
export const MAX_COURSES = 1

// Each day's Meal as a list of courses. An empty list is no Meal.
export type Menu = Record<Day, string[]>

// What a step needs, in grams, plus a count for what's bought by the piece and a free-text
// kitchen measure ("2 dl", "en klype", "etter smak"). Grams and pieces add up at Confirm.
export type Ingredient = { text: string; grams: number | null; pieces: number | null; measure: string }

// One step of a Recipe: the Ingredients it uses and what to do with them.
export type Step = { ingredients: Ingredient[]; text: string }

export type Recipe = {
  course: string
  servings: number
  steps: Step[]
}

// The rules allow 30 steps. A step's Ingredients are capped here and in the AI.
export const MAX_STEPS = 30
export const MAX_STEP_INGREDIENTS = 20

export type StoredRecipe = Recipe & { id: string; madeAt: Timestamp | null }

export type Week = {
  // Day Notes, and when each last changed.
  dayNotes?: Partial<Record<Day, string>>
  dayNotesAt?: Partial<Record<Day, Timestamp>>
  menu?: Menu
  // When the AI last made the Menu, and when each day's Meal last changed.
  menuAt?: Timestamp
  mealsAt?: Partial<Record<Day, Timestamp>>
  // When the week was Confirmed. It happens once.
  confirmedAt?: Timestamp
}

export type Guidelines = { text: string; updatedAt?: Timestamp }

export const recipeId = (day: Day, course: number) => `${day}-${course}`

// The latest of the given times, ignoring missing ones.
function latest(...times: (Timestamp | undefined | null)[]) {
  return times.reduce<Timestamp | undefined>(
    (a, t) => (t && (!a || t.toMillis() > a.toMillis()) ? t : a),
    undefined,
  )
}

// When the Guidelines last changed, if after the Menu was made.
export function menuOutdatedSince(week: Week, guidelines: Guidelines) {
  const changed = guidelines.updatedAt
  return week.menuAt && changed && changed.toMillis() > week.menuAt.toMillis() ? changed : undefined
}

// When what the Recipe was made from (Guidelines, its day's Note and Meal) last changed,
// if after it was made.
export function recipeOutdatedSince(recipe: StoredRecipe, day: Day, week: Week, guidelines: Guidelines) {
  const changed = latest(guidelines.updatedAt, week.dayNotesAt?.[day], week.mealsAt?.[day])
  return recipe.madeAt && changed && changed.toMillis() > recipe.madeAt.toMillis() ? changed : undefined
}

// Pending server times are estimated, so a change made offline counts at once.
const estimate = { serverTimestamps: 'estimate' } as const

export function useGuidelines() {
  const [guidelines, setGuidelines] = useState<Guidelines>({ text: '' })
  useEffect(
    () =>
      onSnapshot(doc(db, 'config/guidelines'), (snap) =>
        setGuidelines((snap.data(estimate) as Guidelines | undefined) ?? { text: '' }),
      ),
    [],
  )
  return guidelines
}

// The week, and whether it's been heard from the server: until then a missing Menu may
// just not be in the cache.
export function useWeek(id: string) {
  const [result, setResult] = useState<{ id: string; week: Week; synced: boolean } | null>(null)
  useEffect(
    () =>
      onSnapshot(doc(db, 'weeks', id), { includeMetadataChanges: true }, (snap) =>
        setResult((r) => ({
          id,
          week: (snap.data(estimate) as Week | undefined) ?? {},
          synced: (r?.id === id && r.synced) || !snap.metadata.fromCache,
        })),
      ),
    [id],
  )
  return result?.id === id ? result : null
}

// The ids of the weeks that have a Menu, in order.
export function useMenuWeeks() {
  const [ids, setIds] = useState<string[]>([])
  useEffect(
    () =>
      onSnapshot(collection(db, 'weeks'), (snap) =>
        setIds(snap.docs.filter((d) => d.data().menu).map((d) => d.id).sort()),
      ),
    [],
  )
  return ids
}

// The week's Recipes, and whether they've been heard from the server: until then a Recipe
// missing may just not be in the cache.
export function useRecipes(weekId: string) {
  type Result = { weekId: string; recipes: Record<string, StoredRecipe>; synced: boolean }
  const [result, setResult] = useState<Result | null>(null)
  useEffect(
    () =>
      onSnapshot(collection(db, 'weeks', weekId, 'recipes'), { includeMetadataChanges: true }, (snap) =>
        setResult((r) => ({
          weekId,
          recipes: Object.fromEntries(
            snap.docs.map((d) => [d.id, { id: d.id, ...(d.data(estimate) as Omit<StoredRecipe, 'id'>) }]),
          ),
          synced: (r?.weekId === weekId && r.synced) || !snap.metadata.fromCache,
        })),
      ),
    [weekId],
  )
  return result?.weekId === weekId ? result : ({ weekId, recipes: {}, synced: false } satisfies Result)
}

// The latest Guidelines and week, including edits saved a moment ago (as you leave a field
// to tap a button), for sending to the AI.
export async function readLatest(weekId: string) {
  const read = (path: string) => getDocFromCache(doc(db, path)).catch(() => getDoc(doc(db, path)))
  const [guidelines, week] = await Promise.all([read('config/guidelines'), read(`weeks/${weekId}`)])
  return {
    guidelines: (guidelines.data(estimate) as Guidelines | undefined) ?? { text: '' },
    week: (week.data(estimate) as Week | undefined) ?? {},
  }
}

export function setGuidelines(text: string) {
  return setDoc(doc(db, 'config/guidelines'), { text: text.trim(), updatedAt: serverTimestamp() })
}

// A Day Note, stamped so the day's Recipes become Outdated.
export function setDayNote(weekId: string, day: Day, note: string) {
  return setDoc(
    doc(db, 'weeks', weekId),
    { dayNotes: { [day]: note.trim() }, dayNotesAt: { [day]: serverTimestamp() } },
    { merge: true },
  )
}

// Removes the Recipes of courses that changed or are gone, so new ones get made.
function removeChangedRecipes(
  batch: WriteBatch,
  weekId: string,
  day: Day,
  courses: string[],
  before: string[] | undefined,
  recipes: Record<string, StoredRecipe>,
) {
  for (let i = 0; i < Math.max(courses.length, before?.length ?? 0); i++) {
    const id = recipeId(day, i)
    if (recipes[id] && courses[i] !== before?.[i]) batch.delete(doc(db, 'weeks', weekId, 'recipes', id))
  }
}

// A Menu the AI made. Days whose Meal changed are stamped, and their changed courses lose
// their Recipes.
export function setMadeMenu(weekId: string, menu: Menu, before: Menu | undefined, recipes: Record<string, StoredRecipe>) {
  const batch = writeBatch(db)
  const changed = DAYS.filter((d) => JSON.stringify(menu[d]) !== JSON.stringify(before?.[d]))
  for (const d of changed) removeChangedRecipes(batch, weekId, d, menu[d], before?.[d], recipes)
  const mealsAt = Object.fromEntries(changed.map((d) => [d, serverTimestamp()]))
  // An empty map would replace mealsAt rather than merge into it.
  const stamps = changed.length > 0 ? { mealsAt } : {}
  batch.set(doc(db, 'weeks', weekId), { menu, menuAt: serverTimestamp(), ...stamps }, { merge: true })
  return batch.commit()
}

// A Meal edited by hand. Changed courses lose their Recipes.
export function setMeal(
  weekId: string,
  day: Day,
  courses: string[],
  before: string[],
  recipes: Record<string, StoredRecipe>,
) {
  const batch = writeBatch(db)
  removeChangedRecipes(batch, weekId, day, courses, before, recipes)
  batch.update(doc(db, 'weeks', weekId), { [`menu.${day}`]: courses, [`mealsAt.${day}`]: serverTimestamp() })
  return batch.commit()
}

// A Recipe the AI made.
export function setMadeRecipe(weekId: string, id: string, recipe: Recipe) {
  return setDoc(doc(db, 'weeks', weekId, 'recipes', id), { ...recipe, madeAt: serverTimestamp() })
}

// A Recipe edited by hand: only the fields that changed, so two people editing different
// fields both keep their edit.
export function updateRecipe(weekId: string, id: string, fields: Partial<Recipe>) {
  return updateDoc(doc(db, 'weeks', weekId, 'recipes', id), fields)
}
