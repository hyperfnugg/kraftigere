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

export type Entry = {
  id: string
  text: string
  staple: string
  checked: boolean
  createdAt: Timestamp | null
}

// How a Staple's name is written: trimmed, inner whitespace collapsed.
export function stapleName(text: string) {
  return text.trim().replace(/\s+/g, ' ')
}

// A Staple's id is its normalized name, so "Melk" and "melk " are the same Staple.
// Ids can't contain "/" or be "." or "..", or look like __reserved__.
export function stapleId(name: string) {
  const id = stapleName(name).toLowerCase().replaceAll('/', '∕')
  return /^\.\.?$|^__.*__$/.test(id) ? `~${id}` : id
}

export type Staple = {
  id: string
  name: string
  addCount: number
}

// All the Family's Staples. The persistent cache makes them available at once and keeps
// them fresh, so autocomplete needs no lookups.
export function useStaples() {
  const [staples, setStaples] = useState<Staple[]>([])

  useEffect(
    () =>
      onSnapshot(collection(db, 'staples'), (snap) => {
        setStaples(
          snap.docs.map((d) => ({ id: d.id, name: d.get('name'), addCount: d.get('addCount') })),
        )
      }),
    [],
  )

  return staples
}

// Up to 5 Staples for what's typed: names starting with it first, then names containing
// it, each ordered by how often they're added.
export function suggest(staples: Staple[], text: string) {
  const t = stapleId(text)
  if (!t) return []
  const byCount = (a: Staple, b: Staple) => b.addCount - a.addCount
  const starting = staples.filter((s) => s.id.startsWith(t)).sort(byCount)
  const containing = staples.filter((s) => !s.id.startsWith(t) && s.id.includes(t)).sort(byCount)
  return [...starting, ...containing].slice(0, 5)
}

// Adds an Entry for the Staple with this name, creating the Staple or counting the add.
export function addEntry(name: string) {
  const staple = stapleId(name)
  const batch = writeBatch(db)
  batch.set(doc(collection(db, 'entries')), {
    text: name,
    staple,
    checked: false,
    createdAt: serverTimestamp(),
  })
  batch.set(
    doc(db, 'staples', staple),
    { name, addCount: increment(1), lastAddedAt: serverTimestamp() },
    { merge: true },
  )
  return batch.commit()
}

// Checking off records when, so Checked Entries can be removed after shopping.
export function toggleEntry(id: string, checked: boolean) {
  return updateDoc(
    doc(db, 'entries', id),
    checked ? { checked, checkedAt: serverTimestamp() } : { checked, checkedAt: deleteField() },
  )
}

export function removeEntry(id: string) {
  return deleteDoc(doc(db, 'entries', id))
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
          ...(d.data() as Omit<Entry, 'id'>),
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
