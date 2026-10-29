import { type User } from 'firebase/auth'
import {
  type Timestamp,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocFromCache,
  getDocFromServer,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from './firebase'

// One dish Iverksett added an Entry for: its Recipe, by week and id, and what it needs.
export type Dish = { week: string; recipe: string; course: string; grams: number | null; pieces: number | null }

export type Entry = {
  id: string
  // The Ware's name, and its id.
  text: string
  ware: string
  checked: boolean
  note?: string
  dishes?: Dish[]
  // Missing on Entries checked off before checkedAt existed.
  checkedAt?: Timestamp
  createdAt: Timestamp | null
}

// How a Ware's name is written: trimmed, inner whitespace collapsed.
export function wareName(text: string) {
  return text.trim().replace(/\s+/g, ' ')
}

// A Ware's id is its normalized name, so "Melk" and "melk " are the same Ware.
// Ids can't contain "/" or be "." or "..", or look like __reserved__.
export function wareId(name: string) {
  const id = wareName(name).toLowerCase().replaceAll('/', '∕')
  return /^\.\.?$|^__.*__$/.test(id) ? `~${id}` : id
}

// Anything the Family buys. One they've added by hand (addCount 1 or more) is a Staple.
export type Ware = {
  id: string
  name: string
  addCount: number
  usuallyAtHome?: boolean
  oda?: OdaProduct
}

// The Oda Product a Ware points to, with its name and pack text as Oda gave them when chosen.
export type OdaProduct = { id: number; name: string; packText: string }

export const isStaple = (w: Ware) => w.addCount > 0

// Sets, replaces or (with null) removes the Ware's Oda Product.
export function setOdaProduct(wareId: string, oda: OdaProduct | null) {
  return updateDoc(doc(db, 'wares', wareId), { oda: oda ?? deleteField() })
}

// All the Family's Wares. The persistent cache makes them available at once and keeps
// them fresh, so autocomplete needs no lookups.
export function useWares() {
  const [wares, setWares] = useState<Ware[]>([])

  useEffect(
    () =>
      onSnapshot(collection(db, 'wares'), (snap) => {
        setWares(
          snap.docs.map((d) => ({
            id: d.id,
            name: d.get('name'),
            addCount: d.get('addCount'),
            usuallyAtHome: d.get('usuallyAtHome'),
            oda: d.get('oda'),
          })),
        )
      }),
    [],
  )

  return wares
}

// Up to 5 Staples for what's typed: names starting with it first, then names containing
// it, each ordered by how often they're added. With nothing typed, the most added Staples
// that aren't already waiting on the List.
export function suggest(wares: Ware[], text: string, entries: Entry[]) {
  const staples = wares.filter(isStaple)
  const byCount = (a: Ware, b: Ware) => b.addCount - a.addCount
  const t = wareId(text)
  if (!t) {
    const waiting = new Set(entries.filter((e) => !e.checked).map((e) => e.ware))
    return staples.filter((s) => !waiting.has(s.id)).sort(byCount).slice(0, 5)
  }
  const starting = staples.filter((s) => s.id.startsWith(t)).sort(byCount)
  const containing = staples.filter((s) => !s.id.startsWith(t) && s.id.includes(t)).sort(byCount)
  return [...starting, ...containing].slice(0, 5)
}

// Adds an Entry for the Ware with this name, creating the Ware or counting the add. A Ware
// is on the List once: one that's waiting isn't added again, and its Entry is returned
// instead. A Checked Entry for it is replaced.
export function addEntry(name: string, entries: Entry[]) {
  const ware = wareId(name)
  const waiting = entries.find((e) => e.ware === ware && !e.checked)
  if (waiting) return waiting
  const batch = writeBatch(db)
  for (const e of entries) if (e.ware === ware) batch.delete(doc(db, 'entries', e.id))
  batch.set(doc(collection(db, 'entries')), {
    text: name,
    ware,
    checked: false,
    createdAt: serverTimestamp(),
  })
  batch.set(
    doc(db, 'wares', ware),
    { name, addCount: increment(1), lastAddedAt: serverTimestamp() },
    { merge: true },
  )
  batch.commit().catch(console.error)
  return null
}

// Checking off records when, so Checked Entries can be removed after shopping.
export function toggleEntry(id: string, checked: boolean) {
  return updateDoc(
    doc(db, 'entries', id),
    checked ? { checked, checkedAt: serverTimestamp() } : { checked, checkedAt: deleteField() },
  )
}

// An empty Note removes it.
export function setNote(id: string, note: string) {
  const n = note.trim()
  return updateDoc(doc(db, 'entries', id), { note: n || deleteField() })
}

export function removeEntry(id: string) {
  return deleteDoc(doc(db, 'entries', id))
}

export function removeEntries(entries: Entry[]) {
  const batch = writeBatch(db)
  for (const e of entries) batch.delete(doc(db, 'entries', e.id))
  return batch.commit()
}

const SHOPPING_OVER_MS = 15 * 60_000

// Removes all Checked Entries once 15 minutes have passed since the most recent check-off.
// Runs while the app is open, so with no app open it happens on the next open.
export function useRemoveCheckedAfterShopping(entries: Entry[]) {
  useEffect(() => {
    const checked = entries.filter((e) => e.checked)
    if (checked.length === 0) return
    const newest = Math.max(...checked.map((e) => e.checkedAt?.toMillis() ?? 0))
    const check = () => {
      if (Date.now() - newest > SHOPPING_OVER_MS) removeEntries(checked)
    }
    check()
    const timer = setInterval(check, 30_000)
    return () => clearInterval(timer)
  }, [entries])
}

export function useEntries() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'entries'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, (snap) => {
      setEntries(
        snap.docs.map((d) => ({
          id: d.id,
          // Estimate pending server times, so a check-off made offline has a time at once.
          ...(d.data({ serverTimestamps: 'estimate' }) as Omit<Entry, 'id'>),
        })),
      )
      setLoading(false)
    })
  }, [])

  return { entries, loading }
}

// 'unreachable' means the check failed for another reason than being denied, e.g. offline
// with nothing cached.
export type Access = 'authorized' | 'unauthorized' | 'unreachable'

export function useAccess(user: User | null) {
  const [result, setResult] = useState<{ user: User; access: Access } | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const family = doc(db, 'config/family')
    const set = (access: Access) => {
      if (!cancelled) setResult({ user, access })
    }
    getDocFromCache(family).then(
      () => {
        // Seen before on this device: show the List now and confirm in the background.
        // Only a denial overrides the cached answer; being offline doesn't.
        set('authorized')
        getDocFromServer(family).catch((e: { code?: string }) => {
          if (e.code === 'permission-denied') set('unauthorized')
        })
      },
      () =>
        getDoc(family).then(
          () => set('authorized'),
          (e: { code?: string }) => set(e.code === 'permission-denied' ? 'unauthorized' : 'unreachable'),
        ),
    )
    return () => {
      cancelled = true
    }
  }, [user])

  const access = user && result?.user === user ? result.access : null
  return { access, loading: !!user && access === null }
}
