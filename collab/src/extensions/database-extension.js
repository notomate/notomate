import * as Y from 'yjs'
import { migrateLegacyContent, readNoteContent, seedNoteDoc } from '../notes/note-doc.js'

/**
 * Database persistence extension for Hocuspocus
 *
 * Handles loading documents from the database (onLoadDocument) by reading
 * from the original application tables via gRPC, and writing back
 * human-readable data on save (onStoreDocument).
 *
 * Y.js binary state is NOT persisted — documents are re-initialized from
 * the source tables each time the server starts or a room is first opened.
 *
 * Document naming convention:
 *   note:{noteId}         - Note documents (layout: ../notes/note-doc.js)
 *   whiteboard:{viewId}   - Whiteboard documents
 *   spreadsheet:{viewId}  - Spreadsheet documents
 */
export class DatabaseExtension {
  constructor({ db }) {
    this.db = db
  }

  /**
   * Parse documentName into { type, id }
   */
  parseDocumentName(documentName) {
    const colonIdx = documentName.indexOf(':')
    if (colonIdx === -1) {
      return { type: 'unknown', id: documentName }
    }
    return {
      type: documentName.substring(0, colonIdx),
      id: documentName.substring(colonIdx + 1),
    }
  }

  /**
   * Called when a document is loaded (first client connects to a room).
   * Always initializes from the original application tables.
   */
  async onLoadDocument(data) {
    const { documentName, document } = data
    const { type, id } = this.parseDocumentName(documentName)

    try {
      switch (type) {
        case 'note':
          await this.initializeNote(document, id)
          break
        case 'whiteboard':
          await this.initializeWhiteboard(document, id)
          break
        case 'spreadsheet':
          await this.initializeSpreadsheet(document, id)
          break
        default:
          break
      }
    } catch (err) {
      console.error(`[DB] Error loading document ${documentName}:`, err)
    }
  }

  /**
   * Fold whole-document writes from older note clients (content.data) into blocks.
   */
  async onChange(data) {
    if (this.parseDocumentName(data.documentName).type !== 'note') return
    try {
      migrateLegacyContent(data.document)
    } catch (err) {
      console.error(`[DB] Error migrating legacy content in ${data.documentName}:`, err)
    }
  }

  /**
   * Called after document changes (debounced by Hocuspocus).
   * Extracts human-readable data and saves to original application tables.
   */
  async onStoreDocument(data) {
    const { documentName, document } = data
    const { type, id } = this.parseDocumentName(documentName)

    try {
      switch (type) {
        case 'note':
          await this.persistNote(document, id, data)
          break
        case 'whiteboard':
          await this.persistWhiteboard(document, id)
          break
        case 'spreadsheet':
          await this.persistSpreadsheet(document, id)
          break
      }
    } catch (err) {
      console.error(`[DB] Error storing document ${documentName}:`, err)
    }
  }

  /**
   * Initialize a note Y.Doc from the notes table
   */
  async initializeNote(document, noteId) {
    const note = await this.db.findNote(noteId)
    if (!note) {
      return
    }

    seedNoteDoc(document, note)
  }

  /**
   * Initialize a whiteboard Y.Doc from views + view_objects tables
   */
  async initializeWhiteboard(document, viewId) {
    const view = await this.db.findView(viewId)
    if (!view) {
      return
    }

    document.transact(() => {
      const canvasObjects = document.getMap('canvas-objects')
      if (view.data) {
        try {
          const parsed = JSON.parse(view.data)
          if (parsed && typeof parsed === 'object') {
            for (const [key, value] of Object.entries(parsed)) {
              canvasObjects.set(key, value)
            }
          }
        } catch (e) {
          console.error(`[DB] Error parsing whiteboard canvas data:`, e)
        }
      }
    })

    // Load view objects (async gRPC call)
    try {
      const viewObjects = await this.db.findViewObjectsByViewId(viewId)
      if (viewObjects && viewObjects.length > 0) {
        document.transact(() => {
          const yViewObjects = document.getMap('view-objects')
          for (const obj of viewObjects) {
            yViewObjects.set(obj.id, {
              id: obj.id,
              type: obj.type,
              name: obj.name,
              data: obj.data,
              created_by: obj.created_by,
              updated_by: obj.updated_by,
              created_at: obj.created_at,
              updated_at: obj.updated_at,
            })
          }
        })
      }
    } catch (e) {
      console.error(`[DB] Error loading view objects:`, e)
    }
  }

  /**
   * Initialize a spreadsheet Y.Doc from views.data
   */
  async initializeSpreadsheet(document, viewId) {
    const view = await this.db.findView(viewId)
    if (!view) {
      return
    }

    if (view.data) {
      try {
        const parsed = JSON.parse(view.data)
        document.transact(() => {
          const ySpreadsheet = document.getMap('spreadsheet')
          if (Array.isArray(parsed)) {
            for (const sheet of parsed) {
              if (sheet.id) {
                ySpreadsheet.set(sheet.id, sheet)
              }
            }
          } else if (parsed && typeof parsed === 'object') {
            for (const [key, value] of Object.entries(parsed)) {
              ySpreadsheet.set(key, value)
            }
          }
        })
      } catch (e) {
        console.error(`[DB] Error parsing spreadsheet data:`, e)
      }
    }
  }

  /**
   * Persist note Y.Doc back to notes table
   */
  async persistNote(document, noteId, data) {
    const yMeta = document.getMap('meta')

    // null when the room was never seeded: keep the stored body rather than blank it.
    const content = readNoteContent(document)
    const title = yMeta.get('title')
    const now = new Date().toISOString()
    const updatedBy = data.lastContext?.userId || 'system'

    const note = await this.db.findNote(noteId)
    if (!note) return

    await this.db.updateNote(noteId, {
      title: title !== undefined ? title : note.title,
      content: content ?? note.content,
      updated_at: now,
      updated_by: updatedBy,
    })
  }

  /**
   * Persist whiteboard Y.Doc back to views + view_objects tables
   */
  async persistWhiteboard(document, viewId) {
    const canvasObjects = document.getMap('canvas-objects')
    const yViewObjects = document.getMap('view-objects')
    const now = new Date().toISOString()

    // Save canvas objects to views.data
    const canvasData = {}
    canvasObjects.forEach((value, key) => {
      canvasData[key] = value
    })
    await this.db.updateViewData(viewId, JSON.stringify(canvasData), now)

    // Sync view objects to view_objects table
    const currentViewObjects = {}
    yViewObjects.forEach((value, key) => {
      currentViewObjects[key] = value
    })

    const dbObjects = await this.db.findViewObjectsByViewId(viewId)
    const dbObjectIds = new Set(dbObjects.map(o => o.id))
    const currentIds = new Set(Object.keys(currentViewObjects))

    // Delete objects no longer in Y.js
    for (const obj of dbObjects) {
      if (!currentIds.has(obj.id)) {
        await this.db.deleteViewObject(obj.id)
      }
    }

    // Create or update objects from Y.js
    for (const [id, obj] of Object.entries(currentViewObjects)) {
      if (dbObjectIds.has(id)) {
        await this.db.updateViewObject(id, {
          name: obj.name || '',
          type: obj.type || '',
          data: typeof obj.data === 'string' ? obj.data : JSON.stringify(obj.data || {}),
          updated_by: obj.updated_by || 'system',
          updated_at: now,
        })
      } else {
        await this.db.createViewObject({
          id,
          view_id: viewId,
          name: obj.name || '',
          type: obj.type || '',
          data: typeof obj.data === 'string' ? obj.data : JSON.stringify(obj.data || {}),
          created_by: obj.created_by || 'system',
          updated_by: obj.updated_by || 'system',
          created_at: obj.created_at || now,
          updated_at: now,
        })
      }
    }
  }

  /**
   * Persist spreadsheet Y.Doc back to views.data
   */
  async persistSpreadsheet(document, viewId) {
    const ySpreadsheet = document.getMap('spreadsheet')
    const now = new Date().toISOString()

    const sheetsArray = []
    ySpreadsheet.forEach((value, key) => {
      if (!key.startsWith('_')) {
        sheetsArray.push(value)
      }
    })
    sheetsArray.sort((a, b) => (a.order || 0) - (b.order || 0))

    await this.db.updateViewData(viewId, JSON.stringify(sheetsArray), now)
  }
}
