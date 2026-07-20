import { Mark, mergeAttributes } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

export const COMMENT_CLICK_EVENT = 'note-comment-click'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    comment: {
      setComment: (threadId: string) => ReturnType
      unsetComment: (threadId: string) => ReturnType
    }
  }
}

export const CommentMark = Mark.create({
  name: 'comment',

  excludes: '',
  inclusive: false,

  addAttributes() {
    return {
      threadId: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-comment-thread-id'),
        renderHTML: (attrs: { threadId: string }) => ({ 'data-comment-thread-id': attrs.threadId }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-comment-thread-id]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'note-comment-mark' }), 0]
  },

  addCommands() {
    return {
      setComment:
        (threadId: string) =>
        ({ commands }: any) =>
          commands.setMark(this.name, { threadId }),
      unsetComment:
        (threadId: string) =>
        ({ tr, state, dispatch }: any) => {
          state.doc.descendants((node: any, pos: number) => {
            node.marks.forEach((mark: any) => {
              if (mark.type.name === 'comment' && mark.attrs.threadId === threadId) {
                tr.removeMark(pos, pos + node.nodeSize, mark.type)
              }
            })
          })
          if (dispatch) dispatch(tr)
          return true
        },
    } as any
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('commentMarkClick'),
        props: {
          handleClick: (_view, _pos, event) => {
            const target = (event.target as HTMLElement)?.closest('[data-comment-thread-id]')
            if (!target) return false
            const threadId = target.getAttribute('data-comment-thread-id')
            if (!threadId) return false
            document.dispatchEvent(new CustomEvent(COMMENT_CLICK_EVENT, { detail: { threadId } }))
            return false
          },
        },
      }),
    ]
  },
})
