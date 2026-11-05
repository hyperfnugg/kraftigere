// A small client for Oda's MCP server (https://oda.com/mcp) and its OAuth 2.1 endpoints, with
// plain fetch. Findings behind it are in docs/research/oda-routes.md.
import { createHash, randomBytes } from 'node:crypto'

export type Registration = { clientId: string; registrationAccessToken: string; registrationClientUri: string }
export type Tokens = { accessToken: string; refreshToken: string; expiresAt: number }

// Oda refused the token: the link is broken or was never made, so a Family Member links again.
export class OdaAuthError extends Error {}

export function pkce() {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

export function odaClient(baseUrl: string, fetchImpl: typeof fetch = fetch) {
  const resource = `${baseUrl}/mcp`

  async function post(url: string, body: URLSearchParams | object, headers: Record<string, string> = {}) {
    const form = body instanceof URLSearchParams
    return fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json', ...headers },
      body: form ? body.toString() : JSON.stringify(body),
    })
  }

  async function token(params: Record<string, string>): Promise<Tokens> {
    const res = await post(`${baseUrl}/o/token/`, new URLSearchParams(params))
    if (res.status === 400 || res.status === 401) throw new OdaAuthError(`token: ${res.status} ${await res.text()}`)
    if (!res.ok) throw new Error(`token: ${res.status} ${await res.text()}`)
    const json = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number }
    return { accessToken: json.access_token, refreshToken: json.refresh_token, expiresAt: Date.now() + json.expires_in * 1000 }
  }

  // One MCP request. Streamable HTTP answers with JSON or with server-sent events.
  async function rpc(accessToken: string, sessionId: string | undefined, message: object) {
    const res = await post(resource, message, {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': '2025-06-18',
      ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {}),
    })
    if (res.status === 401) throw new OdaAuthError('mcp: 401')
    if (!res.ok) throw new Error(`mcp: ${res.status} ${await res.text()}`)
    const text = await res.text()
    if (!('id' in message)) return { sessionId: res.headers.get('Mcp-Session-Id') ?? undefined, result: undefined }
    const messages = res.headers.get('Content-Type')?.startsWith('text/event-stream')
      ? text.split('\n').filter((line) => line.startsWith('data:')).map((line) => JSON.parse(line.slice(5)))
      : [JSON.parse(text)]
    const reply = messages.find((m) => m.id === (message as { id: unknown }).id)
    if (!reply) throw new Error('mcp: no reply')
    if (reply.error) throw new Error(`mcp: ${reply.error.message}`)
    return { sessionId: res.headers.get('Mcp-Session-Id') ?? undefined, result: reply.result }
  }

  return {
    async register(redirectUri: string): Promise<Registration> {
      const res = await post(`${baseUrl}/o/register/`, {
        client_name: 'Kraft',
        redirect_uris: [redirectUri],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
        scope: 'mcp',
      })
      if (!res.ok) throw new Error(`register: ${res.status} ${await res.text()}`)
      const json = (await res.json()) as { client_id: string; registration_access_token: string; registration_client_uri: string }
      return {
        clientId: json.client_id,
        registrationAccessToken: json.registration_access_token,
        registrationClientUri: json.registration_client_uri,
      }
    },

    authorizeUrl(clientId: string, redirectUri: string, challenge: string, state: string) {
      const url = new URL(`${baseUrl}/o/authorize/`)
      url.search = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        resource,
        scope: 'mcp',
        state,
      }).toString()
      return url.toString()
    },

    exchangeCode(clientId: string, redirectUri: string, code: string, verifier: string) {
      return token({ grant_type: 'authorization_code', client_id: clientId, redirect_uri: redirectUri, code, code_verifier: verifier, resource })
    },

    // Refresh tokens rotate: the caller saves the new pair every time.
    refresh(clientId: string, refreshToken: string) {
      return token({ grant_type: 'refresh_token', client_id: clientId, refresh_token: refreshToken, resource })
    },

    // Opens a session and calls one tool. Returns the tool's structured content, or its text as JSON.
    async callTool(accessToken: string, name: string, args: object = {}): Promise<unknown> {
      const init = await rpc(accessToken, undefined, {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'Kraft', version: '1.0.0' } },
      })
      await rpc(accessToken, init.sessionId, { jsonrpc: '2.0', method: 'notifications/initialized' })
      const { result } = await rpc(accessToken, init.sessionId, {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name, arguments: args },
      })
      const text = result.content?.find((c: { type: string }) => c.type === 'text')?.text
      if (result.isError) throw new Error(`${name}: ${text}`)
      return result.structuredContent ?? JSON.parse(text)
    },
  }
}

// What Shop shows of a get_cart answer: how many items, and the link to the Basket on oda.com.
// The cart groups its lines by source, so every line with a quantity counts, wherever it is.
export function summarizeCart(cart: unknown) {
  let items = 0
  const visit = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(visit)
    else if (value && typeof value === 'object') {
      const quantity = (value as { quantity?: unknown }).quantity
      if (typeof quantity === 'number') items += quantity
      else Object.values(value).forEach(visit)
    }
  }
  visit(cart)
  const url = (cart as { url?: unknown } | null)?.url
  return { items, url: typeof url === 'string' ? url : 'https://oda.com/no/cart/' }
}

export type OdaProduct = { id: number; name: string; packText: string; price: number | null; available: boolean }

// The products in a product_search answer, at most 20. The answer groups them per query, so
// every object with a numeric id and a name counts, wherever it is, once.
export function searchResults(answer: unknown): OdaProduct[] {
  const products = new Map<number, OdaProduct>()
  const visit = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(visit)
    else if (value && typeof value === 'object') {
      const p = value as { id?: unknown; name?: unknown; description?: unknown; price?: unknown; availability?: { isAvailable?: unknown } }
      if (typeof p.id === 'number' && typeof p.name === 'string') {
        if (!products.has(p.id)) {
          products.set(p.id, {
            id: p.id,
            name: p.name,
            packText: typeof p.description === 'string' ? p.description : '',
            price: typeof p.price === 'number' ? p.price : typeof p.price === 'string' && p.price !== '' ? Number(p.price) : null,
            available: p.availability?.isAvailable !== false,
          })
        }
      } else Object.values(value).forEach(visit)
    }
  }
  visit(answer)
  return [...products.values()].slice(0, 20)
}

// The products of a product_search answer for several queries, per query in the order asked.
// The answer names each group's query; a query it has no group for gets none.
export function resultsPerQuery(answer: unknown, queries: string[]): OdaProduct[][] {
  const groups = (answer as { result?: { query?: unknown }[] } | null)?.result ?? []
  return queries.map((query) => searchResults(groups.find((g) => g.query === query) ?? []))
}

// What one Entry put in the Basket: packs of an Oda Product. No packs means the product wasn't
// available: `gone` if it's Off Sale, and `left` once the Entry is Left Out.
export type BasketLine = { productId: number; quantity: number; name?: string; packText?: string; gone?: boolean; left?: boolean }

const MAX_ENTRIES = 200
const MAX_PACKS = 20

// The Entries and Pack Counts odaFill was asked for, or null if they don't make sense.
export function fillEntries(raw: unknown): { id: string; quantity: number }[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_ENTRIES) return null
  const valid = raw.every(
    (e) => typeof e?.id === 'string' && /^[^/]{1,100}$/.test(e.id) && Number.isInteger(e.quantity) && e.quantity >= 1 && e.quantity <= MAX_PACKS,
  )
  if (!valid || new Set(raw.map((e) => e.id)).size !== raw.length) return null
  return raw.map(({ id, quantity }) => ({ id, quantity }))
}

const MAX_NAME = 500

// The Substitutes odaSubstitute was asked for, or null if they don't make sense. None is fine:
// that's "Hopp over".
export function substituteEntries(raw: unknown): { id: string; quantity: number; product: { id: number; name: string; packText: string } }[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_ENTRIES) return null
  const text = (t: unknown) => typeof t === 'string' && t.length <= MAX_NAME
  const valid = raw.every(
    (e) =>
      typeof e?.id === 'string' &&
      /^[^/]{1,100}$/.test(e.id) &&
      Number.isInteger(e.quantity) &&
      e.quantity >= 1 &&
      e.quantity <= MAX_PACKS &&
      Number.isInteger(e.product?.id) &&
      e.product.id > 0 &&
      text(e.product.name) &&
      text(e.product.packText),
  )
  if (!valid || new Set(raw.map((e) => e.id)).size !== raw.length) return null
  return raw.map(({ id, quantity, product }) => ({ id, quantity, product: { id: product.id, name: product.name, packText: product.packText } }))
}

// Which of the products aren't available by a manipulate_cart answer, which is the full cart:
// each one's id, and whether it's Off Sale. A product the cart doesn't hold counts too. An answer
// with no groups says nothing.
export function unavailableProducts(cart: unknown, productIds: number[]): Map<number, { gone: boolean }> {
  const unavailable = new Map<number, { gone: boolean }>()
  const groups = (cart as { groups?: unknown } | null)?.groups
  if (!Array.isArray(groups)) return unavailable
  type Line = { product?: { id?: unknown; availability?: { isAvailable?: unknown; code?: unknown } } }
  const lines: Line[] = groups.flatMap((g) => g?.items ?? [])
  for (const id of productIds) {
    const line = lines.find((l) => l.product?.id === id)
    if (!line) unavailable.set(id, { gone: false })
    else if (line.product?.availability?.isAvailable === false) unavailable.set(id, { gone: line.product.availability.code === 'not_for_sale' })
  }
  return unavailable
}

// The manipulate_cart operations that put these packs in the Basket.
export function addOperations(lines: BasketLine[]) {
  return lines.map(({ productId, quantity }) => ({ productId, quantity }))
}

// The manipulate_cart operations that take out exactly what the In Basket Entries added.
// Removals stop at zero, and anything else in the Basket stays.
export function removeOperations(added: BasketLine[]) {
  return added.filter((l) => l.quantity > 0).map(({ productId, quantity }) => ({ productId, quantity: -quantity }))
}
