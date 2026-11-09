import { markdownToBlocks } from './markdown.js'

/**
 * Block edits against a note room's Y.Doc (layout: collab/src/notes/note-doc.js).
 *
 * Every operation is worked out on a copy first and written in one transaction,
 * so a batch with a bad block id changes nothing, and only blocks that really
 * changed are written: concurrent edits to the others merge as usual.
 */

export const MAX_OPS = 50

const TEXT_TYPES = new Set(['paragraph', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'bullet', 'numbered', 'todo', 'quote', 'callout', 'toggle', 'code'])

export class BlockEditError extends Error {}

function readDoc(ydoc) {
  // toJSON hands out Yjs's own stored objects; edits must not reach them directly.
  const blocks = structuredClone(ydoc.getMap('blocks').toJSON())
  const rootIds = ydoc.getMap('meta').get('rootIds')
  if (!Array.isArray(rootIds)) throw new BlockEditError('The note has no content to edit yet.')
  return { blocks, rootIds: [...rootIds] }
}

class Draft {
  constructor(doc) {
    this.blocks = doc.blocks
    this.rootIds = doc.rootIds
    this.changed = new Set()
    this.removed = new Set()
    this.rootsChanged = false
  }

  require(id) {
    const block = this.blocks[id]
    if (!block) throw new BlockEditError(`Block "${id}" does not exist. Read the note again for current block ids.`)
    return block
  }

  touch(id) {
    this.changed.add(id)
    return this.blocks[id]
  }

  siblings(parentId) {
    return parentId ? this.require(parentId).children : this.rootIds
  }

  setSiblings(parentId, ids) {
    if (parentId) {
      this.touch(parentId).children = ids
    } else {
      this.rootIds = ids
      this.rootsChanged = true
    }
  }

  /** Copy a parsed fragment in, its roots at `index` among the children of `parentId`. */
  insert(fragment, parentId, index) {
    for (const [id, block] of Object.entries(fragment.blocks)) {
      this.blocks[id] = block
      this.changed.add(id)
    }
    for (const id of fragment.rootIds) this.blocks[id].parentId = parentId
    const ids = [...this.siblings(parentId)]
    ids.splice(index, 0, ...fragment.rootIds)
    this.setSiblings(parentId, ids)
  }

  remove(id) {
    const walk = (blockId) => {
      const block = this.blocks[blockId]
      if (!block) return
      for (const child of block.children ?? []) walk(child)
      delete this.blocks[blockId]
      this.changed.delete(blockId)
      this.removed.add(blockId)
    }
    const parentId = this.blocks[id].parentId
    this.setSiblings(parentId, this.siblings(parentId).filter((b) => b !== id))
    walk(id)
  }

  write(ydoc) {
    const blocks = ydoc.getMap('blocks')
    const meta = ydoc.getMap('meta')
    ydoc.transact(() => {
      for (const id of this.removed) blocks.delete(id)
      for (const id of this.changed) blocks.set(id, this.blocks[id])
      if (this.rootsChanged) meta.set('rootIds', this.rootIds)
    })
  }
}

function parse(op) {
  if (typeof op.markdown !== 'string' || !op.markdown.trim()) {
    throw new BlockEditError(`The "${op.op}" operation needs markdown.`)
  }
  const fragment = markdownToBlocks(op.markdown)
  if (!fragment.rootIds.length) throw new BlockEditError(`The "${op.op}" operation has no content.`)
  return fragment
}

function applyInsert(draft, op) {
  const fragment = parse(op)
  if (op.after_block_id) {
    const after = draft.require(op.after_block_id)
    const index = draft.siblings(after.parentId).indexOf(after.id)
    draft.insert(fragment, after.parentId, index + 1)
  } else {
    draft.insert(fragment, null, op.position === 'start' ? 0 : draft.rootIds.length)
  }
}

function applyReplace(draft, op) {
  if (!op.block_id) throw new BlockEditError('The "replace" operation needs block_id.')
  const block = draft.require(op.block_id)
  if (!TEXT_TYPES.has(block.type)) {
    throw new BlockEditError(`Block "${block.id}" is a ${block.type} block and cannot be rewritten; only delete it or insert around it.`)
  }
  const fragment = parse(op)
  const [firstId, ...restIds] = fragment.rootIds
  const first = fragment.blocks[firstId]

  const target = draft.touch(block.id)
  if (first.type === 'paragraph' && !restIds.length && !first.children.length) {
    // Plain text only changes the wording: a heading stays a heading.
    target.html = first.html
  } else {
    target.type = first.type
    target.html = first.html
    target.props = first.props
    for (const childId of first.children) fragment.blocks[childId].parentId = block.id
    target.children = [...first.children, ...(target.children ?? [])]
  }

  for (const childId of first.children) {
    const collect = (id) => {
      draft.blocks[id] = fragment.blocks[id]
      draft.changed.add(id)
      fragment.blocks[id].children.forEach(collect)
    }
    collect(childId)
  }

  if (restIds.length) {
    const rest = { blocks: {}, rootIds: restIds }
    const collect = (id) => {
      rest.blocks[id] = fragment.blocks[id]
      fragment.blocks[id].children.forEach(collect)
    }
    restIds.forEach(collect)
    const index = draft.siblings(target.parentId).indexOf(target.id)
    draft.insert(rest, target.parentId, index + 1)
  }
}

function applyDelete(draft, op) {
  if (!op.block_id) throw new BlockEditError('The "delete" operation needs block_id.')
  draft.require(op.block_id)
  draft.remove(op.block_id)
  if (!draft.rootIds.length) {
    // The editor expects at least one block.
    draft.insert(markdownToBlocks('placeholder'), null, 0)
    draft.blocks[draft.rootIds[0]].html = ''
  }
}

const APPLY = { insert: applyInsert, replace: applyReplace, delete: applyDelete }

/** Apply block operations atomically. Throws BlockEditError and writes nothing on a bad one. */
export function applyBlockOps(ydoc, ops) {
  if (!ops.length) throw new BlockEditError('No operations given.')
  if (ops.length > MAX_OPS) throw new BlockEditError(`At most ${MAX_OPS} operations per call.`)
  const draft = new Draft(readDoc(ydoc))
  for (const op of ops) {
    const apply = APPLY[op.op]
    if (!apply) throw new BlockEditError(`Unknown operation "${op.op}".`)
    apply(draft, op)
  }
  draft.write(ydoc)
  return { blocks: draft.blocks, rootIds: draft.rootIds }
}

export function readNote(ydoc) {
  return readDoc(ydoc)
}
