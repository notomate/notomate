import { CommandProps, Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import GoogleDirectionsNodeComponent from './GoogleDirectionsNodeComponent'
import { jsonAttribute } from './shared/attrs'

export const GoogleDirectionsNode = Node.create({
  name: 'googleDirectionsNode',

  group: 'block',
  atom: true,

  addOptions() {
    return {
      workspaceId: '',
    }
  },

  addAttributes() {
    return {
      waypoints: jsonAttribute('waypoints', []),
      travelMode: { default: 'DRIVE' },
      optimize: { default: false },
      result: jsonAttribute('result', null),
      alternatives: jsonAttribute('alternatives', null),
    }
  },

  parseHTML() {
    return [{ tag: 'google-directions-node' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['google-directions-node', mergeAttributes(HTMLAttributes)]
  },

  addCommands() {
    return {
      ...this.parent?.(),
      setGoogleDirectionsNode:
        () =>
        ({ chain }: CommandProps) =>
          chain().insertContent({ type: this.name }).run(),
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(GoogleDirectionsNodeComponent)
  },
})
