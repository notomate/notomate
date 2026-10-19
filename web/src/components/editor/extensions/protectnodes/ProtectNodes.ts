import { Extension } from '@tiptap/core'
import { NodeSelection, type EditorState } from '@tiptap/pm/state'
import type { Node as PMNode } from '@tiptap/pm/model'

// Block atoms (images, embeds, maps, views, ...) hold no editable text, so a
// stray Backspace/Delete would silently wipe them. They can still be removed
// through the drag menu or their own delete buttons.
const isProtected = (node: PMNode) => node.isBlock && node.isAtom

const selectionHasProtectedNode = (state: EditorState) => {
  const { selection, doc } = state
  if (selection instanceof NodeSelection) return isProtected(selection.node)
  if (selection.empty) return false

  let found = false
  selection.ranges.forEach(({ $from, $to }) => {
    doc.nodesBetween($from.pos, $to.pos, node => {
      if (found) return false
      if (isProtected(node)) found = true
    })
  })
  return found
}

export const ProtectNodes = Extension.create({
  name: 'protectNodes',

  // Run before the core keymap, which would delete the selection.
  priority: 1000,

  addKeyboardShortcuts() {
    const block = () => selectionHasProtectedNode(this.editor.state)
    return {
      Backspace: block,
      'Mod-Backspace': block,
      'Shift-Backspace': block,
      Delete: block,
      'Mod-Delete': block,
    }
  },
})
