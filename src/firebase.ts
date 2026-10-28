import { initializeApp } from 'firebase/app'
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions'
import { useEffect, useState, useSyncExternalStore } from 'react'

export const firebaseConfig = {
  apiKey: 'AIzaSyAEAvJBBvR8i7DGtpcGhlc0YmcIC1_kuys',
  authDomain: 'kraftigere.web.app',
  projectId: 'kraftigere',
  storageBucket: 'kraftigere.firebasestorage.app',
  messagingSenderId: '934401063813',
  appId: '1:934401063813:web:d54a68e4205017e9a2e2ec',
}

// Everything except the production build runs against the local emulators (`npm run dev`,
// `vite build --mode e2e`); `demo-` projects never reach real Firebase.
export const useEmulators = import.meta.env.MODE !== 'production'

export const app = initializeApp(
  useEmulators ? { apiKey: 'demo', authDomain: 'localhost', projectId: 'demo-kraftigere', appId: 'demo-app' } : firebaseConfig,
)

export const auth = getAuth(app)
// Persistent cache: the List shows offline and offline changes sync on reconnect.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})
export const functions = getFunctions(app, 'europe-west1')

if (useEmulators) {
  // The e2e tests run their own emulators, on the hosts in .env.e2e.
  const env = import.meta.env
  const [firestoreHost, firestorePort] = (env.VITE_FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':')
  connectAuthEmulator(auth, `http://${env.VITE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099'}`, { disableWarnings: true })
  connectFirestoreEmulator(db, firestoreHost, Number(firestorePort))
  const [functionsHost, functionsPort] = (env.VITE_FUNCTIONS_EMULATOR_HOST ?? '127.0.0.1:5001').split(':')
  connectFunctionsEmulator(functions, functionsHost, Number(functionsPort))
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

function subscribeOnline(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

export function useOnline() {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine)
}
