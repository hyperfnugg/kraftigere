import { randomBytes } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { logger, setGlobalOptions } from 'firebase-functions/v2'
import { HttpsError, onCall, onRequest, type CallableRequest } from 'firebase-functions/v2/https'
import {
  OdaAuthError,
  addOperations,
  fillEntries,
  odaClient,
  pkce,
  removeOperations,
  resultsPerQuery,
  searchResults,
  substituteEntries,
  summarizeCart,
  unavailableProducts,
  type BasketLine,
  type Registration,
  type Tokens,
} from './oda.js'

// Close to the Family, and capped so a bug or a flood can't run up a bill.
setGlobalOptions({ region: 'europe-west1', maxInstances: 2 })

initializeApp()
const db = getFirestore()

// Tests point this at a fake Oda.
const oda = odaClient(process.env.ODA_BASE_URL ?? 'https://oda.com')

// The Oda Link: the client Kraft registered with Oda, a sign-in under way, and the tokens.
// The rules deny it to every client; only these functions read and write it.
type OdaLink = {
  client?: Registration & { redirectUri: string }
  pending?: { state: string; verifier: string; returnTo: string; startedAt: number }
  tokens?: Tokens
  refreshingUntil?: number
}
const linkRef = db.doc('config/odaLink')

async function readLink() {
  return ((await linkRef.get()).data() ?? {}) as OdaLink
}

// In `npm run dev` only, the client and tokens are mirrored to a gitignored file that
// scripts/seed.mjs restores, so restarting the emulators keeps the link and doesn't register
// a new client on oda.com.
async function mirrorLink() {
  const file = process.env.ODA_LINK_FILE
  if (!file || process.env.FUNCTIONS_EMULATOR !== 'true') return
  const { client, tokens } = await readLink()
  await writeFile(file, JSON.stringify({ client, tokens }, null, 2) + '\n', { mode: 0o600 })
}

// A sign-in left this long is abandoned.
const PENDING_MS = 10 * 60 * 1000

// Only Family Members may use the Oda Link.
async function requireFamily(req: CallableRequest) {
  const email = req.auth?.token.email
  if (!email) throw new HttpsError('unauthenticated', 'Not signed in')
  const members = ((await db.doc('config/family').get()).data()?.members ?? []) as string[]
  if (!members.includes(email)) throw new HttpsError('permission-denied', 'Not a Family Member')
}

// Where oda.com sends the Family Member back after approving. Only the emulator is set up:
// production comes with the "Oda in production" plan.
function callbackUrl(req: CallableRequest) {
  if (process.env.FUNCTIONS_EMULATOR !== 'true') throw new HttpsError('failed-precondition', 'Oda is only set up in the emulator')
  return `http://${req.rawRequest.headers.host}/${process.env.GCLOUD_PROJECT}/europe-west1/odaCallback`
}

// Starts linking: returns the oda.com URL where a Family Member signs in and approves.
export const odaLinkStart = onCall(async (req) => {
  await requireFamily(req)
  const origin = req.rawRequest.headers.origin
  if (!origin || !/^https?:\/\/[^/]+$/.test(origin)) throw new HttpsError('invalid-argument', 'No origin to return to')
  const redirectUri = callbackUrl(req)

  const link = await readLink()
  // Registered once; again only if the callback moved, as when the emulator's port changes.
  const client = link.client?.redirectUri === redirectUri ? link.client : { ...(await oda.register(redirectUri)), redirectUri }
  const { verifier, challenge } = pkce()
  const state = randomBytes(16).toString('base64url')
  await linkRef.set(
    { client, pending: { state, verifier, returnTo: `${origin}/`, startedAt: Date.now() } } satisfies OdaLink,
    { merge: true },
  )
  await mirrorLink()
  return { url: oda.authorizeUrl(client.clientId, redirectUri, challenge, state) }
})

// The redirect URI: exchanges the code for tokens and sends the Family Member back to Shop.
export const odaCallback = onRequest(async (req, res) => {
  const { client, pending } = await readLink()
  if (!client || !pending || req.query.state !== pending.state || Date.now() - pending.startedAt > PENDING_MS) {
    res.status(400).send('Ugyldig eller utløpt Oda-innlogging. Prøv "Koble til Oda" igjen.')
    return
  }
  const code = req.query.code
  if (typeof code !== 'string') {
    // Declined on oda.com, or Oda answered with an error.
    await linkRef.update({ pending: FieldValue.delete() })
    res.redirect(`${pending.returnTo}?oda=error`)
    return
  }
  try {
    const tokens = await oda.exchangeCode(client.clientId, client.redirectUri, code, pending.verifier)
    await linkRef.update({ tokens, pending: FieldValue.delete() })
    await mirrorLink()
    res.redirect(`${pending.returnTo}?oda=linked`)
  } catch (e) {
    logger.error('Oda code exchange failed', e)
    await linkRef.update({ pending: FieldValue.delete() })
    res.redirect(`${pending.returnTo}?oda=error`)
  }
})

// Refresh a minute early, so the token doesn't expire on the way to Oda.
const EXPIRY_MARGIN_MS = 60 * 1000

// How long one call may hold the refresh before another may take it over.
const REFRESH_LEASE_MS = 10 * 1000

// Refresh tokens rotate, so every refresh saves the new pair. Calls that arrive together
// (Shop opening on two phones) mustn't spend the same refresh token twice, so one call takes
// a short lease on the refresh and the others wait for the pair it saves. The transaction
// only claims the lease: it can be retried, and a retried refresh would spend the token twice.
async function refreshOnce(clientId: string, refreshToken: string): Promise<Tokens> {
  for (;;) {
    const claim = await db.runTransaction(async (tx) => {
      const { tokens, refreshingUntil } = ((await tx.get(linkRef)).data() ?? {}) as OdaLink
      if (!tokens) throw new OdaAuthError('not linked')
      if (tokens.refreshToken !== refreshToken) return tokens
      if ((refreshingUntil ?? 0) > Date.now()) return 'wait'
      tx.update(linkRef, { refreshingUntil: Date.now() + REFRESH_LEASE_MS })
      return 'mine'
    })
    if (claim === 'wait') {
      await new Promise((resolve) => setTimeout(resolve, 250))
      continue
    }
    if (claim !== 'mine') return claim
    try {
      const fresh = await oda.refresh(clientId, refreshToken)
      await linkRef.update({ tokens: fresh, refreshingUntil: FieldValue.delete() })
      await mirrorLink()
      return fresh
    } catch (e) {
      await linkRef.update({ refreshingUntil: FieldValue.delete() })
      throw e
    }
  }
}

// Calls an Oda tool with a fresh access token. A token Oda refuses before it should expire
// gets one refresh and one retry.
async function callOda(name: string, args?: object) {
  const { client, tokens } = await readLink()
  if (!client || !tokens) throw new OdaAuthError('not linked')
  if (tokens.expiresAt - EXPIRY_MARGIN_MS > Date.now()) {
    try {
      return await oda.callTool(tokens.accessToken, name, args)
    } catch (e) {
      if (!(e instanceof OdaAuthError)) throw e
    }
  }
  return oda.callTool((await refreshOnce(client.clientId, tokens.refreshToken)).accessToken, name, args)
}

// The In Basket Entries. An Oda Order lasts as long as there are any.
const inBasket = () => db.collection('entries').where('basket', '!=', null)

// The Basket for Shop. Not linked, or a link Oda no longer accepts, both mean "Koble til Oda".
export const odaBasket = onCall(async (req) => {
  await requireFamily(req)
  try {
    const cart = await callOda('get_cart')
    if (process.env.FUNCTIONS_EMULATOR === 'true') logger.info('get_cart', JSON.stringify(cart).slice(0, 2000))
    return { linked: true, ...summarizeCart(cart) }
  } catch (e) {
    if (e instanceof OdaAuthError) return { linked: false }
    logger.error('Oda get_cart failed', e)
    throw new HttpsError('unavailable', 'Oda svarer ikke')
  }
})

// Oda Products for a Ware: one product_search, up to 20 results.
export const odaSearch = onCall(async (req: CallableRequest<{ query?: unknown }>) => {
  await requireFamily(req)
  const query = typeof req.data?.query === 'string' ? req.data.query.trim().slice(0, 200) : ''
  if (!query) throw new HttpsError('invalid-argument', 'No query')
  try {
    const answer = await callOda('product_search', { queries: [query], size: 20 })
    if (process.env.FUNCTIONS_EMULATOR === 'true') logger.info('product_search', JSON.stringify(answer).slice(0, 2000))
    return { linked: true, products: searchResults(answer) }
  } catch (e) {
    if (e instanceof OdaAuthError) return { linked: false }
    logger.error('Oda product_search failed', e)
    throw new HttpsError('unavailable', 'Oda svarer ikke')
  }
})

// product_search takes at most 10 queries (checked on oda.com 2026-11-01).
const QUERIES_PER_SEARCH = 10

// Suggestions for Wares without an Oda Product when the Oda Order's choosing opens: a few
// products per Ware name, in as few product_searches as Oda allows.
export const odaSuggest = onCall(async (req: CallableRequest<{ queries?: unknown }>) => {
  await requireFamily(req)
  const raw = req.data?.queries
  const queries = Array.isArray(raw) ? raw.filter((q): q is string => typeof q === 'string').map((q) => q.trim().slice(0, 200)) : []
  if (queries.length === 0 || queries.length > 100 || queries.some((q) => !q)) throw new HttpsError('invalid-argument', 'No queries')
  try {
    const batches = Array.from({ length: Math.ceil(queries.length / QUERIES_PER_SEARCH) }, (_, i) =>
      queries.slice(i * QUERIES_PER_SEARCH, (i + 1) * QUERIES_PER_SEARCH),
    )
    const answers = await Promise.all(batches.map((batch) => callOda('product_search', { queries: batch, size: 5 })))
    return { linked: true, products: batches.flatMap((batch, i) => resultsPerQuery(answers[i], batch)) }
  } catch (e) {
    if (e instanceof OdaAuthError) return { linked: false }
    logger.error('Oda product_search failed', e)
    throw new HttpsError('unavailable', 'Oda svarer ikke')
  }
})

// Fills the Basket with each Entry's Pack Count, which starts an Oda Order. The Entries are
// claimed In Basket first, in a transaction that refuses if an Oda Order is already under
// way, and released if Oda doesn't take them: a transaction can be retried, and a retried
// manipulate_cart would add twice. Oda takes unavailable products too, and only its answer says
// so, so those packs come straight back out, to wait for a Substitute.
export const odaFill = onCall(async (req: CallableRequest<{ entries?: unknown }>) => {
  await requireFamily(req)
  const chosen = fillEntries(req.data?.entries)
  if (!chosen) throw new HttpsError('invalid-argument', 'No Entries')
  const refs = chosen.map(({ id }) => db.collection('entries').doc(id))
  const { lines, wareRefs } = await db.runTransaction(async (tx) => {
    if (!(await tx.get(inBasket().limit(1))).empty) throw new HttpsError('failed-precondition', 'Odabestilling pågår')
    const entries = await tx.getAll(...refs)
    if (entries.some((e) => !e.exists || e.get('checked'))) throw new HttpsError('failed-precondition', 'An Entry is gone or checked off')
    const wares = await tx.getAll(...entries.map((e) => db.collection('wares').doc(e.get('ware'))))
    if (wares.some((w) => w.get('neverOda') || typeof w.get('oda.id') !== 'number')) {
      throw new HttpsError('failed-precondition', 'Alle varer må ha et Oda-produkt')
    }
    // Quantities are deltas, added to whatever the Basket holds.
    const lines: BasketLine[] = wares.map((w, i) => ({
      productId: w.get('oda.id'),
      quantity: chosen[i].quantity,
      name: w.get('oda.name'),
      packText: w.get('oda.packText'),
    }))
    entries.forEach((e, i) => tx.update(e.ref, { basket: lines[i] }))
    return { lines, wareRefs: wares.map((w) => w.ref) }
  })
  let cart: unknown
  try {
    cart = await callOda('manipulate_cart', { operations: addOperations(lines) })
  } catch (e) {
    const batch = db.batch()
    for (const ref of refs) batch.update(ref, { basket: FieldValue.delete() })
    await batch.commit()
    if (e instanceof OdaAuthError) return { linked: false }
    logger.error('Oda manipulate_cart failed', e)
    throw new HttpsError('unavailable', 'Oda svarer ikke')
  }
  const unavailable = unavailableProducts(cart, lines.map((l) => l.productId))
  if (unavailable.size === 0) return { linked: true }
  // If they can't come out they stay In Basket, and Oda says what to remove before paying.
  try {
    await callOda('manipulate_cart', { operations: removeOperations(lines.filter((l) => unavailable.has(l.productId))) })
    const batch = db.batch()
    lines.forEach((line, i) => {
      const found = unavailable.get(line.productId)
      if (!found) return
      batch.update(refs[i], { basket: { ...line, quantity: 0, ...(found.gone && { gone: true }) } })
      // An Off Sale product is gone for good, and its Pack Size with it.
      if (found.gone) batch.update(wareRefs[i], { oda: FieldValue.delete() })
    })
    await batch.commit()
    return { linked: true, unavailable: refs.filter((_, i) => unavailable.has(lines[i].productId)).map((ref) => ref.id) }
  } catch (e) {
    logger.error('Taking unavailable products out failed', e)
  }
  return { linked: true }
})

// Ends the step after filling: the Substitutes go in the Basket, and every other Entry waiting for
// one is Left Out. Claimed first and released if Oda doesn't take them, as in odaFill.
export const odaSubstitute = onCall(async (req: CallableRequest<{ entries?: unknown }>) => {
  await requireFamily(req)
  const picks = substituteEntries(req.data?.entries)
  if (!picks) throw new HttpsError('invalid-argument', 'No Entries')
  const { waiting, lines } = await db.runTransaction(async (tx) => {
    const waiting = (await tx.get(inBasket())).docs.filter((d) => {
      const line = d.get('basket') as BasketLine
      return line.quantity === 0 && !line.left
    })
    if (picks.some((p) => !waiting.some((d) => d.id === p.id))) throw new HttpsError('failed-precondition', 'An Entry is no longer waiting')
    const lines: BasketLine[] = []
    for (const d of waiting) {
      const pick = picks.find((p) => p.id === d.id)
      if (pick) {
        const { id: productId, name, packText } = pick.product
        const line = { productId, quantity: pick.quantity, name, packText }
        lines.push(line)
        tx.update(d.ref, { basket: line })
      } else tx.update(d.ref, { basket: { ...d.get('basket'), left: true } })
    }
    return { waiting, lines }
  })
  if (lines.length === 0) return { linked: true }
  try {
    await callOda('manipulate_cart', { operations: addOperations(lines) })
    return { linked: true }
  } catch (e) {
    const batch = db.batch()
    for (const d of waiting) batch.update(d.ref, { basket: d.get('basket') })
    await batch.commit()
    if (e instanceof OdaAuthError) return { linked: false }
    logger.error('Oda manipulate_cart failed', e)
    throw new HttpsError('unavailable', 'Oda svarer ikke')
  }
})

// Ordered: the Family Member placed the order in Oda, so the In Basket Entries are checked off.
// Oda's order history isn't checked. Left Out Entries stay unchecked, for buying in a store.
export const odaOrdered = onCall(async (req) => {
  await requireFamily(req)
  const batch = db.batch()
  for (const d of (await inBasket().get()).docs) {
    if ((d.get('basket') as BasketLine).quantity > 0) {
      batch.update(d.ref, { checked: true, checkedAt: FieldValue.serverTimestamp(), basket: FieldValue.delete() })
    } else batch.update(d.ref, { basket: FieldValue.delete() })
  }
  await batch.commit()
})

// Cancelled: takes out of the Basket exactly what the In Basket Entries added, and leaves them
// unchecked. Anything else in the Basket stays.
export const odaCancel = onCall(async (req) => {
  await requireFamily(req)
  const docs = (await inBasket().get()).docs
  try {
    const operations = removeOperations(docs.map((d) => d.get('basket') as BasketLine))
    if (operations.length > 0) await callOda('manipulate_cart', { operations })
  } catch (e) {
    if (e instanceof OdaAuthError) return { linked: false }
    logger.error('Oda cancel failed', e)
    throw new HttpsError('unavailable', 'Oda svarer ikke')
  }
  const batch = db.batch()
  for (const d of docs) batch.update(d.ref, { basket: FieldValue.delete() })
  await batch.commit()
  return { linked: true }
})
