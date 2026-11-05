// A fake oda.com for e2e, so no test reaches the real one: OAuth endpoints that approve at
// once, and an /mcp with a Basket that starts with 4 items and that manipulate_cart changes,
// and a product_search that answers every query with the same 7 products, or none for a query
// with "ukjent" in it. Tests read and change the Basket at /basket, and put it back at /reset.
// The test emulators' function finds it through ODA_BASE_URL (playwright.config.ts).
import { createServer } from 'node:http'

const FAKE_ODA_PORT = 8866
const base = `http://127.0.0.1:${FAKE_ODA_PORT}`

// Off Sale: filling finds out, and product_search never shows it.
const OFF_SALE = 61999

// Quantities by product id.
const START = { 430: 3, 7: 1 }
let basket = { ...START }

// As on oda.com, the Basket takes products that aren't available, and each line says so.
const UNAVAILABLE = {
  24681: { isAvailable: false, description: 'Midlertidig utsolgt', code: 'unavailable' },
  [OFF_SALE]: { isAvailable: false, description: 'Ikke lenger tilgjengelig', code: 'not_for_sale' },
}
const AVAILABLE = { isAvailable: true, description: '', code: 'available' }

const cart = () => ({
  groups: [
    {
      items: Object.entries(basket).map(([id, quantity]) => ({
        product: { id: Number(id), availability: UNAVAILABLE[id] ?? AVAILABLE },
        quantity,
      })),
    },
  ],
  url: 'https://oda.com/no/cart/',
})

// Quantities are deltas, and a removal stops at zero.
function manipulate(operations) {
  for (const { productId, quantity } of operations) {
    const next = Math.max(0, (basket[productId] ?? 0) + quantity)
    if (next === 0) delete basket[productId]
    else basket[productId] = next
  }
}

const product = (id, name, description, price, isAvailable = true) => ({
  id,
  name,
  description,
  price,
  url: `https://oda.com/no/products/${id}-x/`,
  availability: { isAvailable, code: isAvailable ? 'available' : 'unavailable' },
})

const PRODUCTS = [
  product(430, 'Tine Lettmelk 1% fett', '1% fett, 1 l', '19.40'),
  product(8143, 'Tine Lettmelk 1% fett', '1% fett, 1,75 l', '31.90'),
  product(24681, 'Tine Laktosefri Helmelk', '1 l', '34.40', false),
  product(125, 'TINE Ekte smør', '250 g', '38.90'),
  product(12235, 'TINE Ekte meierismør', '500 g', '69.90'),
  product(901, 'Q Lettmelk', '1 l', '20.90'),
  product(902, 'Q Helmelk', '1 l', '21.90'),
]

// Shaped like oda.com's answer: products per query, prices as strings.
const search = (queries) => ({
  result: queries.map((query) => ({ query, hasMore: false, products: query.toLowerCase().includes('ukjent') ? [] : PRODUCTS })),
})

let n = 0

function json(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers })
  res.end(JSON.stringify(body))
}

createServer(async (req, res) => {
  const url = new URL(req.url, base)
  let body = ''
  for await (const chunk of req) body += chunk

  switch (url.pathname) {
    // POSTed operations change the Basket as if on oda.com.
    case '/basket':
      if (req.method === 'POST') manipulate(JSON.parse(body))
      return json(res, 200, basket)
    case '/reset':
      basket = { ...START }
      return json(res, 200, basket)
    case '/o/register/':
      n++
      return json(res, 201, {
        client_id: `client${n}`,
        registration_access_token: 'registration',
        registration_client_uri: `${base}/o/register/client${n}`,
      })
    // The Family Member "signs in and approves" at once.
    case '/o/authorize/': {
      const back = new URL(url.searchParams.get('redirect_uri'))
      back.searchParams.set('code', 'code')
      back.searchParams.set('state', url.searchParams.get('state'))
      res.writeHead(302, { Location: back.toString() })
      return res.end()
    }
    case '/o/token/':
      n++
      return json(res, 200, { access_token: `access${n}`, refresh_token: `refresh${n}`, expires_in: 3600 })
    case '/mcp': {
      const message = JSON.parse(body)
      if (message.method === 'initialize') {
        return json(res, 200, { jsonrpc: '2.0', id: message.id, result: {} }, { 'Mcp-Session-Id': 'session' })
      }
      if (!('id' in message)) {
        res.writeHead(202)
        return res.end()
      }
      const tool = message.params?.name
      const args = message.params?.arguments ?? {}
      if (tool === 'manipulate_cart') manipulate(args.operations)
      const text = JSON.stringify(tool === 'product_search' ? search(args.queries) : cart())
      return json(res, 200, { jsonrpc: '2.0', id: message.id, result: { content: [{ type: 'text', text }] } })
    }
    default:
      return json(res, 404, {})
  }
}).listen(FAKE_ODA_PORT, '127.0.0.1')
