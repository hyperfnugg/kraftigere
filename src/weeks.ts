import {
  type Timestamp,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
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
export const MAX_COURSES = 4

// Each day's Meal as a list of courses. An empty list is no Meal.
export type Menu = Record<Day, string[]>

export type Ingredient = { text: string; amount: number | null; unit: string }

export type Recipe = {
  course: string
  servings: number
  ingredients: Ingredient[]
  steps: string
}

export type StoredRecipe = Recipe & { id: string; madeAt: Timestamp | null }

export type Week = {
  notes?: string
  notesAt?: Timestamp
  menu?: Menu
  // When the AI last made the Menu, and when each day's Meal last changed.
  menuAt?: Timestamp
  mealsAt?: Partial<Record<Day, Timestamp>>
  accepted?: boolean
}

export type Guidelines = { text: string; updatedAt?: Timestamp }

export const recipeId = (day: Day, course: number) => `${day}-${course}`

// ISO weeks: Monday to Sunday, and week 1 holds the year's first Thursday.
// Week ids look like 2026-W44. Counted in UTC days so daylight saving can't shift them.
export function isoWeekId(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const week = Math.ceil(((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86_400_000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

// The week's Monday, as a local date.
export function weekMonday(id: string) {
  const [year, week] = id.split('-W').map(Number)
  const jan4 = new Date(year, 0, 4)
  return new Date(year, 0, 4 - ((jan4.getDay() + 6) % 7) + (week - 1) * 7)
}

export function addWeeks(id: string, n: number) {
  const monday = weekMonday(id)
  return isoWeekId(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7 * n))
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']

// "Uke 44 · 26. okt–1. nov"
export function weekLabel(id: string) {
  const monday = weekMonday(id)
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6)
  const day = (d: Date) => `${d.getDate()}. ${MONTHS[d.getMonth()]}`
  return `Uke ${Number(id.split('-W')[1])} · ${day(monday)}–${day(sunday)}`
}

// "fre. 23. okt 14:05"
export function timeLabel(t: Timestamp) {
  const d = t.toDate()
  const weekday = ['søn.', 'man.', 'tir.', 'ons.', 'tor.', 'fre.', 'lør.'][d.getDay()]
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return `${weekday} ${d.getDate()}. ${MONTHS[d.getMonth()]} ${time}`
}

// The latest of the given times, ignoring missing ones.
function latest(...times: (Timestamp | undefined | null)[]) {
  return times.reduce<Timestamp | undefined>(
    (a, t) => (t && (!a || t.toMillis() > a.toMillis()) ? t : a),
    undefined,
  )
}

// When what the Menu was made from last changed, if after it was made.
export function menuOutdatedSince(week: Week, guidelines: Guidelines) {
  const changed = latest(guidelines.updatedAt, week.notesAt)
  return week.menuAt && changed && changed.toMillis() > week.menuAt.toMillis() ? changed : undefined
}

// When what the Recipe was made from (Guidelines, Week Notes, its own Meal) last changed,
// if after it was made.
export function recipeOutdatedSince(recipe: StoredRecipe, day: Day, week: Week, guidelines: Guidelines) {
  const changed = latest(guidelines.updatedAt, week.notesAt, week.mealsAt?.[day])
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

export function useWeek(id: string) {
  const [result, setResult] = useState<{ id: string; week: Week } | null>(null)
  useEffect(
    () =>
      onSnapshot(doc(db, 'weeks', id), (snap) =>
        setResult({ id, week: (snap.data(estimate) as Week | undefined) ?? {} }),
      ),
    [id],
  )
  return result?.id === id ? result.week : null
}

export function useRecipes(weekId: string) {
  const [result, setResult] = useState<{ weekId: string; recipes: Record<string, StoredRecipe> } | null>(null)
  useEffect(
    () =>
      onSnapshot(collection(db, 'weeks', weekId, 'recipes'), (snap) =>
        setResult({
          weekId,
          recipes: Object.fromEntries(
            snap.docs.map((d) => [d.id, { id: d.id, ...(d.data(estimate) as Omit<StoredRecipe, 'id'>) }]),
          ),
        }),
      ),
    [weekId],
  )
  return result?.weekId === weekId ? result.recipes : {}
}

export function setGuidelines(text: string) {
  return setDoc(doc(db, 'config/guidelines'), { text: text.trim(), updatedAt: serverTimestamp() })
}

export function setNotes(weekId: string, notes: string) {
  return setDoc(doc(db, 'weeks', weekId), { notes: notes.trim(), notesAt: serverTimestamp() }, { merge: true })
}

// A Menu the AI made. Days whose Meal changed are stamped, so their Recipes become Outdated.
export function setMadeMenu(weekId: string, menu: Menu, before?: Menu) {
  const mealsAt = Object.fromEntries(
    DAYS.filter((d) => JSON.stringify(menu[d]) !== JSON.stringify(before?.[d])).map((d) => [d, serverTimestamp()]),
  )
  return setDoc(doc(db, 'weeks', weekId), { menu, menuAt: serverTimestamp(), mealsAt }, { merge: true })
}

// A Meal edited by hand. Recipes for courses that no longer exist are removed.
export function setMeal(weekId: string, day: Day, courses: string[], recipes: Record<string, StoredRecipe>) {
  for (let i = courses.length; i < MAX_COURSES; i++) {
    if (recipes[recipeId(day, i)]) deleteDoc(doc(db, 'weeks', weekId, 'recipes', recipeId(day, i)))
  }
  return updateDoc(doc(db, 'weeks', weekId), { [`menu.${day}`]: courses, [`mealsAt.${day}`]: serverTimestamp() })
}

export function acceptMenu(weekId: string) {
  return updateDoc(doc(db, 'weeks', weekId), { accepted: true })
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
