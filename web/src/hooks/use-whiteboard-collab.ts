import { useEffect, useRef, useState, useCallback } from 'react'
import { HocuspocusProvider } from '@hocuspocus/provider'
import * as Y from 'yjs'

interface UseWhiteboardCollabOptions {
  viewId: string
  workspaceId: string
  enabled: boolean
  isPublic?: boolean
}

export interface CanvasObject {
  id: string
  type: 'stroke' | 'shape'
  data: any
}

export interface ViewObject {
  id: string
  type: string
  name: string
  data: any
  created_by?: string
  updated_by?: string
  created_at?: string
  updated_at?: string
}

export function useWhiteboardCollab(options: UseWhiteboardCollabOptions) {
  const { viewId, workspaceId, enabled, isPublic = false } = options

  const providerRef = useRef<HocuspocusProvider | null>(null)
  const yDocRef = useRef<Y.Doc | null>(null)
  const yCanvasRef = useRef<Y.Map<any> | null>(null)
  const yViewObjectsRef = useRef<Y.Map<any> | null>(null)
  const undoManagerRef = useRef<Y.UndoManager | null>(null)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const [isConnected, setIsConnected] = useState(false)
  const [isSynced, setIsSynced] = useState(false)
  const [canvasObjects, setCanvasObjects] = useState<Map<string, CanvasObject>>(new Map())
  const [viewObjects, setViewObjects] = useState<Map<string, ViewObject>>(new Map())

  useEffect(() => {
    if (!enabled || !viewId) return
    if (!isPublic && !workspaceId) return

    // Create Y.js document
    const yDoc = new Y.Doc()
    const yCanvas = yDoc.getMap('canvas-objects')
    const yViewObjs = yDoc.getMap('view-objects')

    yDocRef.current = yDoc
    yCanvasRef.current = yCanvas
    yViewObjectsRef.current = yViewObjs

    // Per-user undo history. Y.UndoManager only tracks transactions with a `null`
    // origin, i.e. this client's own edits — remote updates applied by the
    // provider are never undone. Edits within captureTimeout are merged into one
    // step (e.g. typing in the text panel, or the batch sent when a drag ends).
    const undoManager = new Y.UndoManager([yCanvas, yViewObjs], { captureTimeout: 400 })
    undoManagerRef.current = undoManager
    const updateUndoState = () => {
      setCanUndo(undoManager.undoStack.length > 0)
      setCanRedo(undoManager.redoStack.length > 0)
    }
    undoManager.on('stack-item-added', updateUndoState)
    undoManager.on('stack-item-popped', updateUndoState)
    undoManager.on('stack-cleared', updateUndoState)

    // Build WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const path = isPublic ? `/ws/public/views/${viewId}` : `/ws/views/${viewId}`
    const url = `${protocol}//${window.location.host}${path}`

    // Create HocuspocusProvider
    const provider = new HocuspocusProvider({
      url,
      name: `whiteboard:${viewId}`,
      document: yDoc,
      onConnect() {
        setIsConnected(true)
      },
      onDisconnect() {
        setIsConnected(false)
        setIsSynced(false)
      },
      onSynced() {
        setIsSynced(true)
        // Read initial state from Y.Maps after sync
        syncCanvasFromYjs()
        syncViewObjectsFromYjs()
      },
    })

    providerRef.current = provider

    // Observe canvas objects changes
    const canvasObserver = () => {
      syncCanvasFromYjs()
    }
    yCanvas.observeDeep(canvasObserver)

    // Observe view objects changes
    const viewObjectsObserver = () => {
      syncViewObjectsFromYjs()
    }
    yViewObjs.observeDeep(viewObjectsObserver)

    function syncCanvasFromYjs() {
      const map = new Map<string, CanvasObject>()
      yCanvas.forEach((value, key) => {
        map.set(key, value as CanvasObject)
      })
      setCanvasObjects(map)
    }

    function syncViewObjectsFromYjs() {
      const map = new Map<string, ViewObject>()
      yViewObjs.forEach((value, key) => {
        const obj = value as ViewObject
        // Parse data if it's a string
        if (typeof obj.data === 'string') {
          try {
            map.set(key, { ...obj, data: JSON.parse(obj.data) })
          } catch {
            map.set(key, obj)
          }
        } else {
          map.set(key, obj)
        }
      })
      setViewObjects(map)
    }

    return () => {
      undoManager.destroy()
      undoManagerRef.current = null
      setCanUndo(false)
      setCanRedo(false)
      yCanvas.unobserveDeep(canvasObserver)
      yViewObjs.unobserveDeep(viewObjectsObserver)
      provider.destroy()
      yDoc.destroy()
      providerRef.current = null
      yDocRef.current = null
      yCanvasRef.current = null
      yViewObjectsRef.current = null
      setIsConnected(false)
      setIsSynced(false)
      setCanvasObjects(new Map())
      setViewObjects(new Map())
    }
  }, [viewId, workspaceId, enabled, isPublic])

  // Canvas object operations
  const addCanvasObject = useCallback((obj: CanvasObject) => {
    if (isPublic) return
    yCanvasRef.current?.set(obj.id, obj)
  }, [isPublic])

  const updateCanvasObject = useCallback((obj: CanvasObject) => {
    if (isPublic) return
    yCanvasRef.current?.set(obj.id, obj)
  }, [isPublic])

  const deleteCanvasObject = useCallback((id: string) => {
    if (isPublic) return
    yCanvasRef.current?.delete(id)
  }, [isPublic])

  // View object operations
  const addViewObject = useCallback((obj: ViewObject) => {
    if (isPublic) return
    yViewObjectsRef.current?.set(obj.id, obj)
  }, [isPublic])

  const updateViewObject = useCallback((obj: ViewObject) => {
    if (isPublic) return
    yViewObjectsRef.current?.set(obj.id, obj)
  }, [isPublic])

  const deleteViewObject = useCallback((id: string) => {
    if (isPublic) return
    yViewObjectsRef.current?.delete(id)
  }, [isPublic])

  const clearAll = useCallback(() => {
    if (isPublic) return
    const yDoc = yDocRef.current
    if (yDoc) {
      yDoc.transact(() => {
        yCanvasRef.current?.forEach((_, key) => {
          yCanvasRef.current?.delete(key)
        })
        yViewObjectsRef.current?.forEach((_, key) => {
          yViewObjectsRef.current?.delete(key)
        })
      })
    }
  }, [isPublic])

  const undo = useCallback(() => {
    if (isPublic) return
    undoManagerRef.current?.undo()
  }, [isPublic])

  const redo = useCallback(() => {
    if (isPublic) return
    undoManagerRef.current?.redo()
  }, [isPublic])

  // Compatibility: sendUpdate wrapper for easy migration
  const sendUpdate = useCallback((message: any) => {
    if (isPublic) return

    switch (message.type) {
      case 'add_canvas_object':
      case 'update_canvas_object':
        if (message.object) {
          yCanvasRef.current?.set(message.object.id, message.object)
        }
        break
      case 'delete_canvas_object':
        if (message.id) {
          yCanvasRef.current?.delete(message.id)
        }
        break
      case 'add_view_object':
      case 'update_view_object':
        if (message.object) {
          yViewObjectsRef.current?.set(message.object.id, message.object)
        }
        break
      case 'delete_view_object':
        if (message.id) {
          yViewObjectsRef.current?.delete(message.id)
        }
        break
      case 'clear_all':
        clearAll()
        break
    }
  }, [isPublic, clearAll])

  return {
    isConnected,
    isSynced,
    isInitialized: isSynced,
    canvasObjects,
    viewObjects,
    sendUpdate,
    undo,
    redo,
    canUndo,
    canRedo,
    addCanvasObject,
    updateCanvasObject,
    deleteCanvasObject,
    addViewObject,
    updateViewObject,
    deleteViewObject,
    clearAll,
    yDoc: yDocRef.current,
    provider: providerRef.current,
  }
}
