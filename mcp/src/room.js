import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider'
import WebSocket from 'ws'
import * as Y from 'yjs'

const ROOM_TIMEOUT_MS = 10000

class RoomError extends Error {}

/** Resolves once `ready()` holds, checking on each of the provider's events. */
function waitFor(provider, events, ready, what) {
  return new Promise((resolve, reject) => {
    const check = () => {
      if (!ready()) return
      finish()
      resolve()
    }
    const timer = setTimeout(() => {
      finish()
      reject(new RoomError(`Timed out waiting for the note room: ${what}.`))
    }, ROOM_TIMEOUT_MS)
    function finish() {
      clearTimeout(timer)
      for (const event of events) provider.off(event, check)
    }
    for (const event of events) provider.on(event, check)
    check()
  })
}

/**
 * Join a note's collab room as the token's user, run `fn(ydoc, room)`, and leave
 * once the server has acknowledged every change. Going through the room is what
 * keeps a write from being overwritten by, or overwriting, someone editing live.
 * collab enforces access itself from the same bearer token.
 */
export async function withRoom({ collabUrl, token, noteId }, fn) {
  class AuthorizedWebSocket extends WebSocket {
    constructor(url, protocols) {
      super(url, protocols, { headers: { Authorization: `Bearer ${token}` } })
    }
  }

  const document = new Y.Doc()
  let closeReason = null
  const socket = new HocuspocusProviderWebsocket({
    url: collabUrl,
    WebSocketPolyfill: AuthorizedWebSocket,
    maxAttempts: 1,
    onClose: ({ event }) => {
      if (event?.reason) closeReason = event.reason
    },
  })
  const provider = new HocuspocusProvider({
    websocketProvider: socket,
    name: `note:${noteId}`,
    document,
  })
  provider.attach()

  try {
    try {
      await waitFor(provider, ['synced'], () => provider.isSynced, 'join')
    } catch (err) {
      throw closeReason ? new RoomError(`Could not open the note: ${closeReason}.`) : err
    }
    const result = await fn(document, { readOnly: provider.authorizedScope === 'readonly' })
    await waitFor(provider, ['unsyncedChanges'], () => !provider.hasUnsyncedChanges, 'save')
    return result
  } finally {
    provider.destroy()
    socket.destroy()
    document.destroy()
  }
}
