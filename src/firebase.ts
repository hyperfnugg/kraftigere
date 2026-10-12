import { initializeApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { useEffect, useState } from 'react'

const firebaseConfig = {
  apiKey: 'AIzaSyAEAvJBBvR8i7DGtpcGhlc0YmcIC1_kuys',
  authDomain: 'kraftigere.firebaseapp.com',
  projectId: 'kraftigere',
  storageBucket: 'kraftigere.firebasestorage.app',
  messagingSenderId: '934401063813',
  appId: '1:934401063813:web:d54a68e4205017e9a2e2ec',
}

// Dev runs against the local emulators (`npm run dev`); `demo-` projects never reach real Firebase.
const dev = import.meta.env.DEV

export const app = initializeApp(
  dev ? { apiKey: 'demo', projectId: 'demo-kraftigere' } : firebaseConfig,
)

if (!dev) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider('6LdWdOosAAAAAD-CgahJPqpZb3pi8A06Bv5-rkh-'),
    isTokenAutoRefreshEnabled: true,
  })
}

export const auth = getAuth(app)
export const db = getFirestore(app)

if (dev) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}

const provider = new GoogleAuthProvider()

export function signInWithGoogle() {
  return signInWithPopup(auth, provider)
}

export function signOut() {
  return firebaseSignOut(auth)
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
  }, [])

  return { user, loading }
}
