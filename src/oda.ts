// The Oda Link and the Basket, through the Oda functions. See docs/adr/0005-oda-route.md.
import { httpsCallable } from 'firebase/functions'
import { useEffect, useState } from 'react'
import { type OdaProduct } from './entries'
import { functions } from './firebase'

export type Basket = { linked: false } | { linked: true; items: number; url: string }

const odaBasket = httpsCallable<void, Basket>(functions, 'odaBasket')
const odaLinkStart = httpsCallable<void, { url: string }>(functions, 'odaLinkStart')

// A product_search result: an Oda Product with today's price and availability.
export type OdaResult = OdaProduct & { price: number | null; available: boolean }
export type Search = { linked: false } | { linked: true; products: OdaResult[] }

const odaSearch = httpsCallable<{ query: string }, Search>(functions, 'odaSearch')

// Up to 20 Oda Products for the words, or { linked: false } when the Family has no working Oda Link.
export async function searchOda(query: string) {
  return (await odaSearch({ query })).data
}

// oda.com redirects /no/products/<id>/ to the product's own page.
export const odaProductUrl = (id: number) => `https://oda.com/no/products/${id}/`

// A pasted link to an Oda Product, such as https://oda.com/no/products/430-tine-tine-lettmelk-1-fett/:
// its id, and the words of its name from the link to search for it with.
export function parseOdaUrl(text: string) {
  const m = text.match(/oda\.com\/\w+\/products\/(\d+)(?:-([^/?#\s]*))?/)
  return m ? { id: Number(m[1]), words: (m[2] ?? '').replaceAll('-', ' ') } : null
}

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
