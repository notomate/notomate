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

    // STEP 1: Check for Authorization header with Bearer token (API Key)
    const authHeader = data.requestHeaders.get('authorization') || ''
    const apiKey = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null

    if (apiKey) {
      const user = await this.db.validateApiKey(apiKey)
      if (user && !user.disabled) {
        userId = user.id
        userName = user.name
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

    if (docType === 'note') {
      const note = await this.db.findNote(resourceId)
      if (!note) throw new Error('Note not found')
      if (!(await this.checkAccess(note, userId))) throw new Error('Access denied')
    } else if (docType === 'whiteboard' || docType === 'spreadsheet') {
      const view = await this.db.findView(resourceId)
      if (!view) throw new Error('View not found')
      if (!(await this.checkAccess(view, userId))) throw new Error('Access denied')
    }

    if (isPublic) {
      data.connectionConfig.readOnly = true
    }

    data.context.userId = userId || 'anonymous'
    data.context.userName = userName
  }

  async checkAccess(resource, userId) {
    if (resource.visibility === 'public') return true
    return userId != null && (await this.db.isWorkspaceMember(userId, resource.workspace_id))
  }
}
