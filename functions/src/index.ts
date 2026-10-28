import { randomBytes } from 'node:crypto'
import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { logger, setGlobalOptions } from 'firebase-functions/v2'
import { HttpsError, onCall, onRequest, type CallableRequest } from 'firebase-functions/v2/https'
import { odaClient, pkce, type Registration, type Tokens } from './oda.js'

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
}
const linkRef = db.doc('config/odaLink')

async function readLink() {
  return ((await linkRef.get()).data() ?? {}) as OdaLink
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
    res.redirect(`${pending.returnTo}?oda=linked`)
  } catch (e) {
    logger.error('Oda code exchange failed', e)
    await linkRef.update({ pending: FieldValue.delete() })
    res.redirect(`${pending.returnTo}?oda=error`)
  }
})
