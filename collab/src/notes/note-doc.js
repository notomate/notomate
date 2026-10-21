import { docToTiptap, parseTiptap, repairOrphans, tiptapToDoc } from '@notomate/editor/convert'

/**
 * Y.Doc layout of a note room, shared with the web editor
 * (web/src/hooks/use-note-collab.ts):
 *
 *   blocks: Y.Map<blockId, Block>   one entry per editor block, so concurrent edits
 *                                    to different blocks merge instead of overwriting
 *   meta:   Y.Map { title, rootIds }
 *
 * notes.content stays TipTap JSON; it is converted on load and on store.
 *
 * Older writers (the MCP collab client, web tabs opened before the switch) put the
 * whole TipTap JSON string in content.data. LEGACY_KEY writes are folded into blocks.
 */
export const LEGACY_MAP = 'content'
export const LEGACY_KEY = 'data'

const MIGRATE_ORIGIN = 'note-legacy-migration'

/** Replace the room's blocks with a TipTap JSON string. */
function writeTiptap(document, content) {
  const { doc, error } = parseTiptap(content)
  if (error) console.error('[note-doc] unreadable note content, starting from an empty document')
  const converted = tiptapToDoc(doc)
  const blocks = document.getMap('blocks')
  const meta = document.getMap('meta')
  for (const id of [...blocks.keys()]) blocks.delete(id)
  for (const [id, block] of Object.entries(converted.blocks)) blocks.set(id, block)
  meta.set('rootIds', converted.rootIds)
}

/** Seed an empty room from the notes table. */
export function seedNoteDoc(document, note) {
  document.transact(() => {
    const meta = document.getMap('meta')
    if (!meta.has('rootIds')) writeTiptap(document, note.content)
    if (!meta.has('title')) meta.set('title', note.title || '')
  })
}

/** The room as TipTap JSON, or null when it was never seeded (nothing safe to store). */
export function readNoteContent(document) {
  const meta = document.getMap('meta')
  const rootIds = meta.get('rootIds')
  if (!Array.isArray(rootIds)) return null
  const doc = repairOrphans({ title: '', blocks: document.getMap('blocks').toJSON(), rootIds })
  return JSON.stringify(docToTiptap(doc))
}

/** Fold a legacy whole-document write into blocks. Returns true when one was found. */
export function migrateLegacyContent(document) {
  const legacy = document.getMap(LEGACY_MAP)
  const content = legacy.get(LEGACY_KEY)
  if (content === undefined) return false
  document.transact(() => {
    writeTiptap(document, typeof content === 'string' ? content : JSON.stringify(content))
    legacy.delete(LEGACY_KEY)
  }, MIGRATE_ORIGIN)
  return true
}
