import { type User } from 'firebase/auth'
import {
  type Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromCache,
  getDocFromServer,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from './firebase'

export type Entry = {
  id: string
  text: string
  checked: boolean
  createdAt: Timestamp | null
}

export function addEntry(text: string) {
  return addDoc(collection(db, 'entries'), {
    text,
    checked: false,
    createdAt: serverTimestamp(),
  })
}

export function toggleEntry(id: string, checked: boolean) {
  return updateDoc(doc(db, 'entries', id), { checked })
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
