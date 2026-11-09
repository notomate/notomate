export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const REQUEST_TIMEOUT_MS = 15000

async function readError(response) {
  const text = await response.text()
  try {
    const body = JSON.parse(text)
    return body.message || body.error || text
  } catch {
    return text || response.statusText
  }
}

/** REST client acting as the caller: the API applies its own permission checks. */
export function createApi({ apiUrl, token }) {
  async function request(method, path, { query, body, headers } = {}) {
    const url = new URL(`/api/v1${path}`, apiUrl)
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value))
    }
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!response.ok) throw new ApiError(response.status, await readError(response))
    return response.status === 204 ? null : response.json()
  }

  const workspace = (id) => `/workspaces/${encodeURIComponent(id)}`
  const note = (ws, id) => `${workspace(ws)}/notes/${encodeURIComponent(id)}`
  const channel = (ws, id) => `${workspace(ws)}/channels/${encodeURIComponent(id)}`

  return {
    tokenInfo: () => request('GET', '/oauth/tokeninfo'),
    listWorkspaces: () => request('GET', '/workspaces'),
    listNotes: (ws, query) => request('GET', `${workspace(ws)}/notes`, { query }),
    getNote: (ws, id) => request('GET', note(ws, id)),
    createNote: (ws, body) =>
      request('POST', `${workspace(ws)}/notes`, { body, headers: { 'X-Content-Format': 'markdown' } }),
    listComments: (ws, id) => request('GET', `${note(ws, id)}/comments`),
    addComment: (ws, id, body) => request('POST', `${note(ws, id)}/comments`, { body }),
    listChannels: (ws) => request('GET', `${workspace(ws)}/channels`),
    listMessages: (ws, id) => request('GET', `${channel(ws, id)}/messages`),
    sendMessage: (ws, id, body) => request('POST', `${channel(ws, id)}/messages`, { body }),
  }
}
