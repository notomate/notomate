import { CommandProps, Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import GoogleMapNodeComponent from './GoogleMapNodeComponent'
import { jsonAttribute } from './shared/attrs'

export const GoogleMapNode = Node.create({
  name: 'googleMapNode',

  group: 'block',
  atom: true,

  addOptions() {
    return {
      workspaceId: '',
    }
  },

  addAttributes() {
    return {
      title: { default: '' },
      center: jsonAttribute('center', null),
      zoom: { default: 13 },
      markers: jsonAttribute('markers', []),
      route: jsonAttribute('route', null),
    }
  },

  parseHTML() {
    return [{ tag: 'google-map-node' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['google-map-node', mergeAttributes(HTMLAttributes)]
  },

  addCommands() {
    return {
      ...this.parent?.(),
      setGoogleMapNode:
        () =>
        ({ chain }: CommandProps) =>
          chain().insertContent({ type: this.name }).run(),
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(GoogleMapNodeComponent)
  },
})
