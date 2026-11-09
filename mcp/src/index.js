import { createServer } from 'node:http'
import { toNodeHandler } from '@modelcontextprotocol/node'
import { createMcpHandler } from '@modelcontextprotocol/server'
import { createApi, ApiError } from './api.js'
import { buildServer } from './tools.js'

const PORT = parseInt(process.env.PORT || '5000', 10)
const API_URL = process.env.API_URL || 'http://localhost:8080'
const COLLAB_URL = process.env.COLLAB_URL || 'ws://localhost:3000'
const PUBLIC_URL = (process.env.APP_PUBLIC_URL || '').replace(/\/+$/, '')

const PROTECTED_RESOURCE_PATH = '/.well-known/oauth-protected-resource'

// Browser-origin calls are only expected from the app itself; other clients send no Origin.
const ALLOWED_ORIGINS = new Set(
  [PUBLIC_URL, ...(process.env.MCP_ALLOWED_ORIGINS || '').split(',')].map((o) => o.trim()).filter(Boolean),
)

function publicUrl(req) {
  if (PUBLIC_URL) return PUBLIC_URL
  return `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`
}

function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers })
  res.end(JSON.stringify(body))
}

function unauthorized(req, res) {
  const metadata = `${publicUrl(req)}${PROTECTED_RESOURCE_PATH}/mcp`
  sendJson(res, 401, { error: 'invalid_token' }, {
    'WWW-Authenticate': `Bearer resource_metadata="${metadata}", scope="mcp:read mcp:write"`,
  })
}

function bearerToken(req) {
  const match = /^Bearer (.+)$/.exec(req.headers.authorization || '')
  return match ? match[1] : null
}

/** Checks the token against the API; returns SDK auth info, or null when it is not valid. */
async function authenticate(token) {
  try {
    const info = await createApi({ apiUrl: API_URL, token }).tokenInfo()
    return {
      token,
      clientId: info.user_id,
      scopes: info.scope ? [info.scope] : ['mcp:read', 'mcp:write'],
    }
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) return null
    throw err
  }
}

const handler = createMcpHandler(
  ({ authInfo }) =>
    buildServer({
      apiUrl: API_URL,
      collabUrl: COLLAB_URL,
      token: authInfo.token,
      canWrite: authInfo.scopes.includes('mcp:write'),
    }),
  { onerror: (err) => console.error('[mcp]', err) },
)
const serveMcp = toNodeHandler(handler, { onerror: (err) => console.error('[mcp]', err) })

async function handleMcp(req, res) {
  const { origin } = req.headers
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    sendJson(res, 403, { error: 'origin_not_allowed' })
    return
  }
  const token = bearerToken(req)
  if (!token) {
    unauthorized(req, res)
    return
  }
  const auth = await authenticate(token)
  if (!auth) {
    unauthorized(req, res)
    return
  }
  req.auth = auth
  await serveMcp(req, res)
}

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://internal')
  try {
    if (pathname === '/mcp') {
      await handleMcp(req, res)
    } else if (pathname === PROTECTED_RESOURCE_PATH || pathname === `${PROTECTED_RESOURCE_PATH}/mcp`) {
      const base = publicUrl(req)
      sendJson(res, 200, {
        resource: `${base}/mcp`,
        authorization_servers: [base],
        bearer_methods_supported: ['header'],
        scopes_supported: ['mcp:read', 'mcp:write'],
      })
    } else if (pathname === '/healthz') {
      sendJson(res, 200, { status: 'ok' })
    } else {
      sendJson(res, 404, { error: 'not_found' })
    }
  } catch (err) {
    console.error('[mcp] request failed:', err)
    if (!res.headersSent) sendJson(res, 500, { error: 'internal_error' })
    else res.end()
  }
})

server.listen(PORT, () => console.log(`[mcp] listening on :${PORT}`))

async function shutdown() {
  server.close()
  await handler.close()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
