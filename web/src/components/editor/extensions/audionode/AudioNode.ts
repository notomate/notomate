import { Node, mergeAttributes } from '@tiptap/core'
import AudioNodeComponent from './AudioNodeComponent'
import { ReactNodeViewRenderer } from '@tiptap/react'

export const AudioNode = Node.create({
  name: 'audio',

  group: 'block',
  atom: true,

  addOptions() {
    return {
      upload: async (file: File) => {
        return {
          url: URL.createObjectURL(file), name: file.name
        }
      },
      workspaceId: '',
      listFiles: async () => {
        return { files: [] }
      }
    }
  },

  addAttributes() {
    return {
      src: { default: null },
      name: { default: null },
    }
  },

  parseHTML() {
    return [{ tag: 'audio-node' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['audio-node', mergeAttributes(HTMLAttributes)]
  },

  addCommands() {
    return {
      ...this.parent?.(),
      setAudio:
        (options: { src: string; name: string }) =>
        ({ chain }: any) =>
          chain()
            .insertContent({
              type: this.name,
              attrs: options,
            })
            .run(),
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(AudioNodeComponent)
  },
})
