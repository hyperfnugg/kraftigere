import { type User } from 'firebase/auth'
import {
  type Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { app } from './firebase'

const db = getFirestore(app)

export type Item = {
  id: string
  text: string
  checked: boolean
  createdAt: Timestamp | null
}

export function addItem(text: string) {
  return addDoc(collection(db, 'items'), {
    text,
    checked: false,
    createdAt: serverTimestamp(),
  })
}

export function toggleItem(id: string, checked: boolean) {
  return updateDoc(doc(db, 'items', id), { checked })
}

export function removeItem(id: string) {
  return deleteDoc(doc(db, 'items', id))
}

export function useItems() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'items'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, (snap) => {
      setItems(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Item, 'id'>),
        })),
      )
      setLoading(false)
    })
  }, [])

  return { items, loading }
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
