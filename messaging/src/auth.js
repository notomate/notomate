import jwt from 'jsonwebtoken'

const APP_SECRET = process.env.APP_SECRET || 'default_secret'

/**
 * Authenticates a Socket.IO connection using either a personal API key
 * (Authorization: Bearer <key> header) or a JWT cookie (token=...), the
 * same two paths REST routes accept (see api/internal/api/middlewares/auth.go).
 * Returns { id, name } on success, or null when unauthenticated.
 */
export async function authenticateSocket(socket, db) {
  const headers = socket.handshake.headers || {}

  const authHeader = headers.authorization || ''
  const apiKey = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null

  if (apiKey) {
    const user = await db.validateApiKey(apiKey)
    if (user && !user.disabled) {
      return { id: user.id, name: user.name }
    }
    return null
  }

  const cookieHeader = headers.cookie || ''
  const tokenMatch = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/)
  const token = tokenMatch ? tokenMatch[1] : null
  if (!token) return null

  try {
    const decoded = jwt.verify(token, APP_SECRET)
    const user = await db.findUser(decoded.id)
    if (user && !user.disabled) {
      return { id: user.id, name: user.name }
    }
  } catch (_) {
    // Invalid/expired token -> unauthenticated
  }
  return null
}
