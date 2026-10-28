// The Oda Link and the Basket, through the Oda functions. See docs/adr/0005-oda-route.md.
import { httpsCallable } from 'firebase/functions'
import { useEffect, useState } from 'react'
import { functions } from './firebase'

export type Basket = { linked: false } | { linked: true; items: number; url: string }

const odaBasket = httpsCallable<void, Basket>(functions, 'odaBasket')
const odaLinkStart = httpsCallable<void, { url: string }>(functions, 'odaLinkStart')

// The Basket, read once when Shop opens. 'error' when Oda or the function doesn't answer.
export function useBasket() {
  const [basket, setBasket] = useState<Basket | 'error' | null>(null)
  useEffect(() => {
    let current = true
    odaBasket().then(
      (res) => current && setBasket(res.data),
      () => current && setBasket('error'),
    )
    return () => {
      current = false
    }
  }, [])
  return basket
}

// Goes to oda.com in this tab to sign in and approve. Oda sends the Family Member back to
// /?oda=linked, or /?oda=error.
export async function linkOda() {
  const res = await odaLinkStart()
  location.assign(res.data.url)
}

// The outcome of linking, read from the URL Oda came back to when the app loads, and then
// cleared from it.
export const linkResult = new URLSearchParams(location.search).get('oda')
if (linkResult) history.replaceState(null, '', location.pathname)
