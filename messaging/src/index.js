import { createServer } from 'http'
import { Server } from 'socket.io'
import { createGrpcClient } from './grpc/client.js'
import { authenticateSocket } from './auth.js'

// NOTE: Socket.IO room state (io.sockets.adapter.rooms) is in-memory and
// per-process. This design assumes exactly one replica of this service; a
// horizontally-scaled deployment would need a Redis adapter (for
// cross-instance broadcast) and sticky sessions (so a room's "first joiner"
// check stays meaningful), neither of which is set up here.

const PORT = parseInt(process.env.PORT || '4000', 10)
const GRPC_ADDR = process.env.GRPC_ADDR || 'localhost:50051'
const APP_SECRET = process.env.APP_SECRET || 'default_secret'

const db = createGrpcClient(GRPC_ADDR)

// IMPORTANT: do NOT pass a catch-all callback into createServer() — Socket.IO
// attaches its own 'request' listener via `new Server(httpServer)` below,
// and Node invokes every 'request' listener registered on the server for
// each incoming request. This listener only ever handles POST
// /internal/broadcast and returns without ending the response for anything
// else, so Socket.IO's own listener still gets to serve /socket.io/* requests.
const httpServer = createServer()

httpServer.on('request', (req, res) => {
  if (req.method !== 'POST' || req.url !== '/internal/broadcast') return

  if (req.headers['x-internal-secret'] !== APP_SECRET) {
    res.writeHead(401)
    res.end()
    return
  }

  let body = ''
  req.on('data', (chunk) => { body += chunk })
  req.on('end', () => {
    try {
      const { channel_id, type, message } = JSON.parse(body)
      io.to(`channel:${channel_id}`).emit(`message:${type}`, message)
      res.writeHead(204)
      res.end()
    } catch (err) {
      console.error('[messaging] /internal/broadcast', err)
      res.writeHead(400)
      res.end()
    }
  })
})

const io = new Server(httpServer)

// Stage 1: authenticate the connecting user (Bearer API key or JWT cookie).
io.use(async (socket, next) => {
  const user = await authenticateSocket(socket, db)
  if (!user) return next(new Error('unauthorized'))
  socket.data.user = user
  next()
})

// Stage 2: authorize the specific channel this socket wants to join. Each
// socket connection is scoped to exactly one channel, mirroring the
// frontend's one-connection-per-open-ChannelView lifecycle.
io.use(async (socket, next) => {
  const channelId = socket.handshake.auth?.channelId
  if (!channelId) return next(new Error('channelId required'))

  const channel = await db.getChannel(channelId)
  if (!channel) return next(new Error('channel not found'))

  const isMember = await db.isWorkspaceMember(socket.data.user.id, channel.workspace_id)
  if (!isMember) return next(new Error('forbidden'))

  socket.data.channel = channel
  next()
})

// Returns the deduplicated list of user IDs with a socket currently joined
// to the room, derived from the adapter's live socket set (no separate
// counter to keep in sync).
function getOnlineUserIds(roomName) {
  const socketIds = io.sockets.adapter.rooms.get(roomName)
  if (!socketIds) return []
  const userIds = new Set()
  for (const id of socketIds) {
    const s = io.sockets.sockets.get(id)
    if (s) userIds.add(s.data.user.id)
  }
  return [...userIds]
}

io.on('connection', (socket) => {
  const { user, channel } = socket.data
  const roomName = `channel:${channel.id}`

  // Hard rule: check-then-join must be two adjacent synchronous lines with
  // no `await` in between. Node's single-threaded event loop then
  // guarantees no other connection handler can interleave between the
  // emptiness check and the join, so this can never double-fire or miss a
  // "room created" transition.
  const wasEmpty = !io.sockets.adapter.rooms.get(roomName)
  socket.join(roomName)
  if (wasEmpty) {
    db.notifyRoomCreated(channel.id, user.id).catch((err) => console.error('[messaging] notifyRoomCreated', err))
  }
  db.notifyClientConnected(channel.id, user.id).catch((err) => console.error('[messaging] notifyClientConnected', err))
  io.to(roomName).emit('presence:update', { userIds: getOnlineUserIds(roomName) })

  socket.on('message:send', async ({ body } = {}, ack) => {
    try {
      const message = await db.createMessage(channel.workspace_id, channel.id, body, user.id)
      // io.to (not socket.to) so the sender's own tab receives the message
      // back through the same channel it sent it on, instead of relying on
      // an optimistic local append.
      io.to(roomName).emit('message:new', message)
      ack?.({ ok: true })
    } catch (err) {
      console.error('[messaging] createMessage', err)
      ack?.({ ok: false })
    }
  })

  socket.on('disconnect', () => {
    // Fires unconditionally on every disconnect - there's no "room
    // destroyed" event, so no emptiness check is needed here.
    db.notifyClientDisconnected(channel.id, user.id).catch((err) => console.error('[messaging] notifyClientDisconnected', err))
    // Socket.IO removes the socket from its rooms before emitting
    // 'disconnect', so getOnlineUserIds(roomName) here already reflects the
    // departure - the remaining sockets in the room get the updated list.
    io.to(roomName).emit('presence:update', { userIds: getOnlineUserIds(roomName) })
  })
})

httpServer.listen(PORT, () => {
  console.log(`[messaging] listening on :${PORT}`)
})

async function shutdown() {
  io.close()
  db.close()
  process.exit(0)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
