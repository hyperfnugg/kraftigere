// The Oda Link and the Basket, through the Oda functions. See docs/adr/0005-oda-route.md.
import { httpsCallable } from 'firebase/functions'
import { useEffect, useState } from 'react'
import { type OdaProduct } from './entries'
import { functions } from './firebase'

export type Basket = { linked: false } | { linked: true; items: number; url: string }
type Linked = { linked: boolean }
type SubstituteEntry = { id: string; product: { id: number; name: string; packText: string } }

const odaBasket = httpsCallable<void, Basket>(functions, 'odaBasket')
const odaFill = httpsCallable<{ entries: string[] }, Linked & { unavailable?: string[] }>(functions, 'odaFill')
const odaSubstitute = httpsCallable<{ entries: SubstituteEntry[] }, Linked>(functions, 'odaSubstitute')
const odaOrdered = httpsCallable<void, void>(functions, 'odaOrdered')
const odaCancel = httpsCallable<void, Linked>(functions, 'odaCancel')
const odaLinkStart = httpsCallable<void, { url: string }>(functions, 'odaLinkStart')

// A product_search result: an Oda Product with today's price and availability.
export type OdaResult = OdaProduct & { price: number | null; available: boolean }
export type Search = { linked: false } | { linked: true; products: OdaResult[] }

const odaSearch = httpsCallable<{ query: string }, Search>(functions, 'odaSearch')

const odaSuggest = httpsCallable<{ queries: string[] }, { linked: false } | { linked: true; products: OdaResult[][] }>(
  functions,
  'odaSuggest',
)

// A few Oda Products for each of the Ware names, in one search, per name in the order given.
export async function suggestOda(queries: string[]) {
  return (await odaSuggest({ queries })).data
}

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

// Fills the Basket with one pack of each Oda Product, which starts the Oda Order. Says which Entries
// turned out unavailable.
export async function fillBasket(entries: string[]) {
  return (await odaFill({ entries })).data
}

// Ends the step after filling: these go in the Basket, and any other Entry waiting is Left Out.
export async function substituteBasket(entries: SubstituteEntry[]) {
  return (await odaSubstitute({ entries })).data.linked
}

// Ordered: checks off the In Basket Entries.
export async function orderedOda() {
  await odaOrdered()
}

// Cancelled: empties the Basket and leaves the In Basket Entries unchecked.
export async function cancelOda() {
  return (await odaCancel()).data.linked
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
