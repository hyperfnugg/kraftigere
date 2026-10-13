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
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'
import { useEffect, useState, useSyncExternalStore } from 'react'

const firebaseConfig = {
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

if (!useEmulators) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider('6LdWdOosAAAAAD-CgahJPqpZb3pi8A06Bv5-rkh-'),
    isTokenAutoRefreshEnabled: true,
  })
}

export const auth = getAuth(app)
// Persistent cache: the List shows offline and offline changes sync on reconnect.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})

if (useEmulators) {
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
