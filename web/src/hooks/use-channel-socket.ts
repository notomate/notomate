import { useEffect, useRef, useState, useCallback } from "react"
import { io, Socket } from "socket.io-client"
import { MessageData } from "@/api/message"

interface UseChannelSocketOptions {
  channelId: string
  workspaceId: string
  enabled: boolean
  onMessageNew: (message: MessageData) => void
  onMessageUpdated: (message: MessageData) => void
  onMessageDeleted: (message: MessageData) => void
  onResync: () => void
}

export function useChannelSocket(options: UseChannelSocketOptions) {
  const { channelId, workspaceId, enabled } = options

  // Kept in a ref so the connect effect below doesn't need these callbacks
  // in its dependency array (they're recreated every render in ChannelView).
  const callbacksRef = useRef(options)
  callbacksRef.current = options

  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    if (!enabled || !channelId || !workspaceId) return

    const socket = io(window.location.origin, {
      withCredentials: true,
      auth: { channelId },
    })
    socketRef.current = socket

    socket.on("connect", () => {
      setIsConnected(true)
      // Polling used to self-heal any gap from a dropped connection; a
      // resync refetch on every (re)connect replaces that safety net.
      callbacksRef.current.onResync()
    })
    socket.on("disconnect", () => setIsConnected(false))
    socket.on("message:new", (message: MessageData) => callbacksRef.current.onMessageNew(message))
    socket.on("message:updated", (message: MessageData) => callbacksRef.current.onMessageUpdated(message))
    socket.on("message:deleted", (message: MessageData) => callbacksRef.current.onMessageDeleted(message))

    return () => {
      socket.disconnect()
      socketRef.current = null
      setIsConnected(false)
    }
  }, [channelId, workspaceId, enabled])

  const sendMessage = useCallback((body: string, onError?: () => void) => {
    const socket = socketRef.current
    if (!socket) {
      onError?.()
      return
    }
    socket.emit("message:send", { body }, (ack?: { ok: boolean }) => {
      if (!ack?.ok) onError?.()
    })
  }, [])

  return { isConnected, sendMessage }
}
