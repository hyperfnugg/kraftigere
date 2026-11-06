import { createHash } from 'node:crypto'
import { describe, expect, test } from 'vitest'
import {
  OdaAuthError,
  addOperations,
  fillEntries,
  odaClient,
  onePackEach,
  packChanges,
  packRequest,
  pkce,
  removeOperations,
  resultsPerQuery,
  searchResults,
  substituteEntries,
  summarizeCart,
  unavailableProducts,
  undoChange,
  waitingLine,
  type BasketLine,
} from '../../functions/src/oda'

const BASE = 'https://oda.test'

type Call = { url: string; headers: Record<string, string>; body: string }

// A fake fetch that records each request and answers from a list, in order.
function fakeFetch(...responses: Response[]) {
  const calls: Call[] = []
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, headers: init.headers as Record<string, string>, body: init.body as string })
    const res = responses.shift()
    if (!res) throw new Error(`unexpected request: ${url}`)
    return res
  }) as typeof fetch
  return { calls, client: odaClient(BASE, impl) }
}

const json = (body: object, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } })

describe('pkce', () => {
  test('the challenge is the S256 hash of the verifier', () => {
    const { verifier, challenge } = pkce()
    expect(verifier).toMatch(/^[\w-]{43}$/)
    expect(challenge).toBe(createHash('sha256').update(verifier).digest('base64url'))
  })
})

describe('odaClient', () => {
  test('register sends a public client and returns its management handles', async () => {
    const { calls, client } = fakeFetch(
      json({ client_id: 'c1', registration_access_token: 'rat', registration_client_uri: `${BASE}/o/register/c1` }, { status: 201 }),
    )
    expect(await client.register('http://127.0.0.1/cb')).toEqual({
      clientId: 'c1',
      registrationAccessToken: 'rat',
      registrationClientUri: `${BASE}/o/register/c1`,
    })
    expect(calls[0].url).toBe(`${BASE}/o/register/`)
    expect(JSON.parse(calls[0].body)).toMatchObject({ redirect_uris: ['http://127.0.0.1/cb'], token_endpoint_auth_method: 'none' })
  })

  test('authorizeUrl asks for scope mcp on the MCP resource with PKCE', () => {
    const url = new URL(fakeFetch().client.authorizeUrl('c1', 'http://127.0.0.1/cb', 'chal', 'st'))
    expect(url.origin + url.pathname).toBe(`${BASE}/o/authorize/`)
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: 'code',
      client_id: 'c1',
      redirect_uri: 'http://127.0.0.1/cb',
      code_challenge: 'chal',
      code_challenge_method: 'S256',
      resource: `${BASE}/mcp`,
      scope: 'mcp',
      state: 'st',
    })
  })

  test('exchangeCode posts the code and verifier and returns when the token expires', async () => {
    const { calls, client } = fakeFetch(json({ access_token: 'a', refresh_token: 'r', expires_in: 3600 }))
    const before = Date.now()
    const tokens = await client.exchangeCode('c1', 'http://127.0.0.1/cb', 'code', 'ver')
    expect(tokens).toMatchObject({ accessToken: 'a', refreshToken: 'r' })
    expect(tokens.expiresAt).toBeGreaterThanOrEqual(before + 3600_000)
    expect(calls[0].url).toBe(`${BASE}/o/token/`)
    expect(Object.fromEntries(new URLSearchParams(calls[0].body))).toEqual({
      grant_type: 'authorization_code',
      client_id: 'c1',
      redirect_uri: 'http://127.0.0.1/cb',
      code: 'code',
      code_verifier: 'ver',
      resource: `${BASE}/mcp`,
    })
  })

  test('refresh returns the rotated pair', async () => {
    const { calls, client } = fakeFetch(json({ access_token: 'a2', refresh_token: 'r2', expires_in: 3600 }))
    expect(await client.refresh('c1', 'r1')).toMatchObject({ accessToken: 'a2', refreshToken: 'r2' })
    expect(new URLSearchParams(calls[0].body).get('grant_type')).toBe('refresh_token')
    expect(new URLSearchParams(calls[0].body).get('refresh_token')).toBe('r1')
  })

  test('a refused refresh is an OdaAuthError', async () => {
    const { client } = fakeFetch(json({ error: 'invalid_grant' }, { status: 400 }))
    await expect(client.refresh('c1', 'old')).rejects.toBeInstanceOf(OdaAuthError)
  })

  test('callTool opens a session and returns the tool result', async () => {
    const { calls, client } = fakeFetch(
      json({ jsonrpc: '2.0', id: 1, result: { protocolVersion: '2025-06-18' } }, { headers: { 'Mcp-Session-Id': 's1' } }),
      new Response(null, { status: 202 }),
      // Streamable HTTP may answer with server-sent events.
      new Response(
        `event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', id: 2, result: { content: [{ type: 'text', text: '{"items":[]}' }] } })}\n\n`,
        { headers: { 'Content-Type': 'text/event-stream' } },
      ),
    )
    expect(await client.callTool('tok', 'get_cart')).toEqual({ items: [] })
    expect(calls.map((c) => JSON.parse(c.body).method)).toEqual(['initialize', 'notifications/initialized', 'tools/call'])
    expect(calls[2].headers).toMatchObject({ Authorization: 'Bearer tok', 'Mcp-Session-Id': 's1' })
    expect(JSON.parse(calls[2].body).params).toEqual({ name: 'get_cart', arguments: {} })
  })

  test('callTool prefers structured content', async () => {
    const { client } = fakeFetch(
      json({ jsonrpc: '2.0', id: 1, result: {} }),
      new Response(null, { status: 202 }),
      json({ jsonrpc: '2.0', id: 2, result: { content: [{ type: 'text', text: 'not json' }], structuredContent: { n: 1 } } }),
    )
    expect(await client.callTool('tok', 'get_cart')).toEqual({ n: 1 })
  })

  test('a tool error throws', async () => {
    const { client } = fakeFetch(
      json({ jsonrpc: '2.0', id: 1, result: {} }),
      new Response(null, { status: 202 }),
      json({ jsonrpc: '2.0', id: 2, result: { isError: true, content: [{ type: 'text', text: 'nope' }] } }),
    )
    await expect(client.callTool('tok', 'get_cart')).rejects.toThrow('get_cart: nope')
  })

  test('an expired access token is an OdaAuthError', async () => {
    const { client } = fakeFetch(new Response(null, { status: 401 }))
    await expect(client.callTool('old', 'get_cart')).rejects.toBeInstanceOf(OdaAuthError)
  })
})

describe('summarizeCart', () => {
  test('counts the quantity of every line, in every group', () => {
    const cart = {
      groups: [
        { source: 'search', items: [{ product: { id: 430, price: 21.9 }, quantity: 2 }, { product: { id: 7 }, quantity: 1 }] },
        { source: 'recipe', items: [{ product: { id: 9 }, quantity: 1 }] },
      ],
      totals: { total: 99 },
      url: 'https://oda.com/no/cart/',
    }
    expect(summarizeCart(cart)).toEqual({ items: 4, url: 'https://oda.com/no/cart/' })
  })

  test('an empty cart has no items and falls back to the cart link', () => {
    expect(summarizeCart({ groups: [] })).toEqual({ items: 0, url: 'https://oda.com/no/cart/' })
  })
})

describe('searchResults', () => {
  const product = (id: number, extra: object = {}) => ({
    id,
    name: `Produkt ${id}`,
    description: '1 l',
    price: 21.9,
    brand: 'Tine',
    availability: { isAvailable: true, code: 'available' },
    ...extra,
  })

  // The shape oda.com answered with on 2026-10-28, prices as strings.
  test('maps products from every query, once each', () => {
    const answer = {
      result: [
        { query: 'melk', hasMore: true, products: [product(430), product(7, { price: '21.90' })] },
        { query: 'lettmelk', hasMore: false, products: [product(430)] },
      ],
    }
    expect(searchResults(answer)).toEqual([
      { id: 430, name: 'Produkt 430', packText: '1 l', price: 21.9, available: true },
      { id: 7, name: 'Produkt 7', packText: '1 l', price: 21.9, available: true },
    ])
  })

  test('marks unavailable products and tolerates missing fields', () => {
    expect(searchResults([product(1, { availability: { isAvailable: false } }), { id: 2, name: 'Bare navn' }])).toEqual([
      { id: 1, name: 'Produkt 1', packText: '1 l', price: 21.9, available: false },
      { id: 2, name: 'Bare navn', packText: '', price: null, available: true },
    ])
  })

  test('resultsPerQuery keeps the products of each query apart, in the order asked', () => {
    const answer = {
      result: [
        { query: 'smør', hasMore: false, products: [product(125)] },
        { query: 'melk', hasMore: true, products: [product(430), product(7)] },
      ],
    }
    expect(resultsPerQuery(answer, ['melk', 'smør', 'sokker']).map((ps) => ps.map((p) => p.id))).toEqual([[430, 7], [125], []])
  })

  test('keeps at most 20', () => {
    expect(searchResults({ products: Array.from({ length: 25 }, (_, i) => product(i + 1)) })).toHaveLength(20)
  })
})

describe('fillEntries', () => {
  test('takes the ids of the Entries', () => {
    expect(fillEntries(['a', 'b'])).toEqual(['a', 'b'])
  })

  test('refuses anything else', () => {
    for (const id of ['', 'a/b', 7, 'x'.repeat(101), null]) expect(fillEntries([id])).toBeNull()
    expect(fillEntries(['a', 'a'])).toBeNull()
    expect(fillEntries([])).toBeNull()
    expect(fillEntries(undefined)).toBeNull()
    expect(fillEntries(Array.from({ length: 201 }, (_, i) => `e${i}`))).toBeNull()
  })
})

describe('removeOperations', () => {
  test('takes out exactly the packs each Entry added', () => {
    expect(removeOperations([{ productId: 430, quantity: 1 }, { productId: 7, quantity: 2 }])).toEqual([
      { productId: 430, quantity: -1 },
      { productId: 7, quantity: -2 },
    ])
    expect(removeOperations([])).toEqual([])
  })
})

describe('unavailableProducts', () => {
  const line = (id: number, availability: object) => ({ product: { id, availability }, quantity: 1 })
  // As oda.com answered on 2026-11-04.
  const offSale = { isAvailable: false, description: 'Ikke lenger tilgjengelig', code: 'not_for_sale' }
  const available = { isAvailable: true, description: '', code: 'available' }

  test('finds what is unavailable, and whether it is Off Sale', () => {
    const cart = { groups: [{ items: [line(1, available), line(2, offSale)] }, { items: [line(3, { isAvailable: false, code: 'sold_out' })] }] }
    expect([...unavailableProducts(cart, [1, 2, 3])]).toEqual([
      [2, { gone: true }],
      [3, { gone: false }],
    ])
  })

  test('counts a product the cart does not hold', () => {
    expect([...unavailableProducts({ groups: [] }, [1])]).toEqual([[1, { gone: false }]])
  })

  test('looks only at the products asked about', () => {
    expect(unavailableProducts({ groups: [{ items: [line(1, available), line(2, offSale)] }] }, [1]).size).toBe(0)
  })

  test('reads nothing from an answer with no groups', () => {
    expect(unavailableProducts({ url: 'x' }, [1]).size).toBe(0)
    expect(unavailableProducts(null, [1]).size).toBe(0)
  })
})

describe('substituteEntries', () => {
  const product = { id: 901, name: 'Q Lettmelk', packText: '1 l' }

  test('takes the fields it needs, and none is fine', () => {
    expect(substituteEntries([])).toEqual([])
    expect(substituteEntries([{ id: 'e1', quantity: 2, product: { ...product, price: 3 }, x: 1 }])).toEqual([{ id: 'e1', product }])
  })

  test('refuses what makes no sense', () => {
    expect(substituteEntries('e1')).toBeNull()
    expect(substituteEntries([{ id: 'a/b', product }])).toBeNull()
    expect(substituteEntries([{ id: 'e1' }])).toBeNull()
    expect(substituteEntries([{ id: 'e1', product: { ...product, id: 0 } }])).toBeNull()
    expect(substituteEntries([{ id: 'e1', product: { ...product, name: 5 } }])).toBeNull()
    expect(substituteEntries([{ id: 'e1', product: { ...product, packText: 'x'.repeat(501) } }])).toBeNull()
    expect(substituteEntries([{ id: 'e1', product }, { id: 'e1', product }])).toBeNull()
  })
})

describe('onePackEach', () => {
  test('the first Entry on each Oda Product holds one pack, the others share it, none counted', () => {
    expect(onePackEach([{ productId: 1, name: 'a' }, { productId: 2 }, { productId: 1, name: 'a' }])).toEqual([
      { productId: 1, name: 'a', quantity: 1, uncounted: true },
      { productId: 2, quantity: 1, uncounted: true },
      { productId: 1, name: 'a', quantity: 0, uncounted: true, shared: true },
    ])
  })
})

describe('waitingLine', () => {
  test('an unavailable line, shared or not, waits for a Substitute', () => {
    const line = { productId: 1, quantity: 0, name: 'a', packText: 'b', shared: true, uncounted: true }
    expect(waitingLine(line, false)).toEqual({ productId: 1, quantity: 0, name: 'a', packText: 'b' })
    expect(waitingLine({ ...line, quantity: 1, shared: false }, true)).toEqual({ productId: 1, quantity: 0, name: 'a', packText: 'b', gone: true })
  })
})

describe('packRequest', () => {
  test('takes counts by product, and whether they are starting counts', () => {
    expect(packRequest({ products: [{ productId: 1, count: 25, x: 1 }] })).toEqual({ products: [{ productId: 1, count: 25 }], starting: false })
    expect(packRequest({ products: [{ productId: 1, count: 1 }], starting: true })?.starting).toBe(true)
  })

  test('refuses anything else', () => {
    for (const count of [0, -1, 1.5, '2', null]) expect(packRequest({ products: [{ productId: 1, count }] })).toBeNull()
    for (const productId of [0, 1.5, '1', null]) expect(packRequest({ products: [{ productId, count: 1 }] })).toBeNull()
    expect(packRequest({ products: [{ productId: 1, count: 1 }, { productId: 1, count: 2 }] })).toBeNull()
    expect(packRequest({ products: [] })).toBeNull()
    expect(packRequest({ products: [null] })).toBeNull()
    expect(packRequest({})).toBeNull()
    expect(packRequest(null)).toBeNull()
  })
})

describe('packChanges', () => {
  const entry = (id: string, line: Partial<BasketLine>) => ({ id, line: { productId: 1, quantity: 0, ...line } })
  const uncounted = [entry('a', { quantity: 1, uncounted: true }), entry('b', { shared: true, uncounted: true })]

  test('moves the count to the first Entry, the others shared, and clears the mark', () => {
    expect(packChanges(uncounted, [{ productId: 1, count: 3 }], true)).toEqual({
      writes: [entry('a', { quantity: 3 }), entry('b', { shared: true })],
      changes: [{ productId: 1, quantity: 2, count: 3, marked: ['a', 'b'] }],
    })
  })

  test('two lines holding one product become one, by the difference', () => {
    const lines = [entry('b', { quantity: 1, uncounted: true }), entry('a', { quantity: 1, uncounted: true })]
    expect(packChanges(lines, [{ productId: 1, count: 1 }], true)).toEqual({
      writes: [entry('a', { quantity: 1 }), entry('b', { shared: true })],
      changes: [{ productId: 1, quantity: -1, count: 1, marked: ['a', 'b'] }],
    })
  })

  test('no difference clears the mark with no change to the Basket', () => {
    expect(packChanges(uncounted, [{ productId: 1, count: 1 }], true)).toEqual({
      writes: [entry('a', { quantity: 1 }), entry('b', { shared: true })],
      changes: [],
    })
  })

  test('starting counts leave alone a product already counted', () => {
    const counted = [entry('a', { quantity: 4 })]
    expect(packChanges(counted, [{ productId: 1, count: 2 }], true)).toEqual({ writes: [], changes: [] })
  })

  test('a set count changes a product already counted', () => {
    expect(packChanges([entry('a', { quantity: 4 })], [{ productId: 1, count: 2 }], false)?.changes).toEqual([
      { productId: 1, quantity: -2, count: 2, marked: [] },
    ])
  })

  test('ignores Left Out lines, lines waiting, and products with no packs', () => {
    const lines = [entry('a', { quantity: 2 }), entry('b', { left: true }), entry('c', {}), entry('d', { productId: 2, left: true }), entry('e', { productId: 3 })]
    expect(packChanges(lines, [{ productId: 1, count: 2 }, { productId: 2, count: 3 }, { productId: 3, count: 3 }, { productId: 4, count: 3 }], false)).toEqual({
      writes: [entry('a', { quantity: 2 })],
      changes: [],
    })
  })

  test('refuses only raising above the most allowed', () => {
    expect(packChanges([entry('a', { quantity: 20 })], [{ productId: 1, count: 21 }], false)).toBeNull()
    expect(packChanges([entry('a', { quantity: 25 })], [{ productId: 1, count: 26 }], false)).toBeNull()
    expect(packChanges([entry('a', { quantity: 25 })], [{ productId: 1, count: 24 }], false)?.changes[0].quantity).toBe(-1)
    expect(packChanges([entry('a', { quantity: 25 })], [{ productId: 1, count: 25 }], false)?.changes).toEqual([])
  })
})

describe('undoChange', () => {
  const entry = (id: string, line: Partial<BasketLine>) => ({ id, line: { productId: 1, quantity: 0, ...line } })
  const change = { productId: 1, quantity: 2, count: 3, marked: ['a', 'b'] }

  test('takes back the difference and restores the mark', () => {
    expect(undoChange([entry('a', { quantity: 3 }), entry('b', { shared: true })], change)).toEqual([
      entry('a', { quantity: 1, uncounted: true }),
      entry('b', { shared: true, uncounted: true }),
    ])
  })

  test('takes back only its own difference when another device has changed the count', () => {
    expect(undoChange([entry('a', { quantity: 5 }), entry('b', { shared: true })], change)).toEqual([
      entry('a', { quantity: 3 }),
      entry('b', { shared: true }),
    ])
  })

  test('never leaves less than one pack', () => {
    expect(undoChange([entry('a', { quantity: 1 })], change)).toEqual([entry('a', { quantity: 1 })])
  })

  test('does nothing for a line that is gone', () => {
    expect(undoChange([], change)).toEqual([])
    expect(undoChange([entry('c', { productId: 2, quantity: 3 })], change)).toEqual([])
  })
})

describe('Basket operations', () => {
  test('adding sends only the product and the packs, and only lines with packs', () => {
    expect(addOperations([{ productId: 1, quantity: 2, name: 'x', packText: 'y' }, { productId: 1, quantity: 0, shared: true }])).toEqual([{ productId: 1, quantity: 2 }])
  })

  test('removing leaves out Entries with no packs', () => {
    expect(removeOperations([{ productId: 1, quantity: 2, name: 'x' }, { productId: 2, quantity: 0, left: true }])).toEqual([{ productId: 1, quantity: -2 }])
  })
})
