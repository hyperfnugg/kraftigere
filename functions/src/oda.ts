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
