import { Node, mergeAttributes } from '@tiptap/core'
import ImageComponent from './ImageComponent'
import { ReactNodeViewRenderer } from '@tiptap/react'

export const ImageNode = Node.create({
  name: 'image',

  group: 'block',
  atom: true,
  
  addOptions() {
    return {
      upload: async (file: File) => {
        return{
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
      // Original image size, so the node can reserve its space before the
      // image loads. Missing on images inserted before this was tracked.
      width: {
        default: null,
        parseHTML: (el: HTMLElement) => Number(el.getAttribute('width')) || null,
      },
      height: {
        default: null,
        parseHTML: (el: HTMLElement) => Number(el.getAttribute('height')) || null,
      },
      // Set (with no src) while a pasted image is still uploading; see
      // pendingImages.ts.
      uploadId: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-upload-id'),
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.uploadId ? { 'data-upload-id': attrs.uploadId } : {},
      },
    }
  },

  parseHTML() {
    return [{ tag: 'image-node' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['image-node', mergeAttributes(HTMLAttributes)]
  },

  addCommands() {
    return {
      ...this.parent?.(),
      setImage:
        (options: { src: string; name: string; width?: number; height?: number }) =>
        ({ chain }:any) =>
          chain()
            .insertContent({
              type: this.name,
              attrs: options,
            })
            .run(),
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageComponent)
  },
})