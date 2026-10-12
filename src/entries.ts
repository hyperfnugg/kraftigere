import { type User } from 'firebase/auth'
import {
  type Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
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

export function useAuthorized(user: User | null) {
  const [result, setResult] = useState<{ user: User; authorized: boolean } | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    getDoc(doc(db, 'config/family')).then(
      () => {
        if (!cancelled) setResult({ user, authorized: true })
      },
      () => {
        if (!cancelled) setResult({ user, authorized: false })
      },
    )
    return () => {
      cancelled = true
    }
  }, [user])

  const authorized = user && result?.user === user ? result.authorized : null
  return { authorized, loading: !!user && authorized === null }
}
