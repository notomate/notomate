import { CommandProps, Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import GooglePlacesNodeComponent from './GooglePlacesNodeComponent'
import { jsonAttribute } from './shared/attrs'

export const GooglePlacesNode = Node.create({
  name: 'googlePlacesNode',

  group: 'block',
  atom: true,

  addOptions() {
    return {
      workspaceId: '',
    }
  },

  addAttributes() {
    return {
      query: { default: '' },
      places: jsonAttribute('places', []),
      fetchedAt: { default: null },
    }
  },

  parseHTML() {
    return [{ tag: 'google-places-node' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['google-places-node', mergeAttributes(HTMLAttributes)]
  },

  addCommands() {
    return {
      ...this.parent?.(),
      setGooglePlacesNode:
        () =>
        ({ chain }: CommandProps) =>
          chain().insertContent({ type: this.name }).run(),
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(GooglePlacesNodeComponent)
  },
})
