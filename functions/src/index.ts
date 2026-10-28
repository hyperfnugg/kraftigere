import { randomBytes } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { logger, setGlobalOptions } from 'firebase-functions/v2'
import { HttpsError, onCall, onRequest, type CallableRequest } from 'firebase-functions/v2/https'
import { OdaAuthError, odaClient, pkce, summarizeCart, type Registration, type Tokens } from './oda.js'

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
