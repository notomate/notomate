import jwt from 'jsonwebtoken'

/**
 * Auth extension for Hocuspocus
 * Validates JWT cookie and checks permissions via gRPC calls to the Go API.
 * nginx sets X-Public-Access header to distinguish public/authenticated endpoints.
 */
export class AuthExtension {
  constructor({ db }) {
    this.db = db
  }

  async onConnect(data) {
    const isPublic = data.requestHeaders.get('x-public-access') === 'true'

    let userId = null
    let userName = 'Anonymous'
    let keyScope = ''

    // STEP 1: Check for Authorization header with Bearer token (API Key)
    const authHeader = data.requestHeaders.get('authorization') || ''
    const apiKey = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null

    if (apiKey) {
      const user = await this.db.validateApiKey(apiKey)
      if (user && !user.disabled) {
        userId = user.id
        userName = user.name
        keyScope = user.scope || ''
      }
    } else {
      // STEP 2: Fall back to JWT cookie authentication
      const cookieHeader = data.requestHeaders.get('cookie') || ''
      const tokenMatch = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/)
      const token = tokenMatch ? tokenMatch[1] : null

      if (token) {
        try {
          const secret = process.env.APP_SECRET || 'default_secret'
          const decoded = jwt.verify(token, secret)
          const user = await this.db.findUser(decoded.id)
          if (user && !user.disabled) {
            userId = user.id
            userName = user.name
          }
        } catch (_) {
          // Invalid token → treat as anonymous
        }
      }
    }

    // Parse document name: "note:{id}", "whiteboard:{id}", "spreadsheet:{id}"
    const colonIdx = data.documentName.indexOf(':')
    const docType = colonIdx !== -1 ? data.documentName.substring(0, colonIdx) : data.documentName
    const resourceId = colonIdx !== -1 ? data.documentName.substring(colonIdx + 1) : ''

    let access = 'write'
    if (docType === 'note') {
      const note = await this.db.findNote(resourceId)
      if (!note) throw new Error('Note not found')
      access = await this.accessLevel(note, userId, { creatorOnlyWhenPrivate: true })
    } else if (docType === 'whiteboard' || docType === 'spreadsheet') {
      const view = await this.db.findView(resourceId)
      if (!view) throw new Error('View not found')
      access = await this.accessLevel(view, userId)
    }
    if (!access) throw new Error('Access denied')

    // Scoped (MCP) keys only ever edit notes, and only with the write scope.
    const scopeCanWrite = keyScope === '' || (keyScope === 'mcp:write' && docType === 'note')
    if (isPublic || access === 'read' || !scopeCanWrite) {
      data.connectionConfig.readOnly = true
    }

    data.context.userId = userId || 'anonymous'
    data.context.userName = userName
  }

  /**
   * 'write', 'read', or null when the user may not open the room. Mirrors the REST
   * handlers: a private note belongs to its creator, and only workspace members
   * edit; anyone may read a public resource.
   */
  async accessLevel(resource, userId, { creatorOnlyWhenPrivate = false } = {}) {
    const isMember = userId != null && (await this.db.isWorkspaceMember(userId, resource.workspace_id))
    if (resource.visibility === 'public') return isMember ? 'write' : 'read'
    if (!isMember) return null
    if (creatorOnlyWhenPrivate && resource.visibility === 'private' && resource.created_by !== userId) return null
    return 'write'
  }
}
