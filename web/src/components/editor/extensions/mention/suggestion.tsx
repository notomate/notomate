import { ReactRenderer } from '@tiptap/react'
import { SuggestionOptions } from '@tiptap/suggestion'
import tippy, { Instance as TippyInstance } from 'tippy.js'
import { WorkspaceMember } from '@/api/workspace'
import { MentionList, MentionListRef } from './MentionList'

export interface MentionItem {
  id: string
  label: string
  email: string
  avatarUrl?: string
}

export const createMentionSuggestion = (
  getMembers: () => WorkspaceMember[]
): Omit<SuggestionOptions<MentionItem>, 'editor'> => ({
  items: ({ query }) => {
    const q = query.toLowerCase().trim()

    return getMembers()
      .filter((member) =>
        !q ||
        member.user_name.toLowerCase().includes(q) ||
        member.user_email.toLowerCase().includes(q)
      )
      .slice(0, 10)
      .map((member) => ({
        id: member.user_id,
        label: member.user_name,
        email: member.user_email,
        avatarUrl: member.user_avatar_url,
      }))
  },

  render: () => {
    let reactRenderer: ReactRenderer<MentionListRef>
    let popup: TippyInstance[]

    return {
      onStart: (props) => {
        reactRenderer = new ReactRenderer(MentionList, {
          props,
          editor: props.editor,
        })

        popup = tippy('body', {
          getReferenceClientRect: props.clientRect as any,
          appendTo: () => document.body,
          content: reactRenderer.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        })
      },

      onUpdate(props) {
        reactRenderer.updateProps(props)
        popup[0].setProps({
          getReferenceClientRect: props.clientRect as any,
        })
      },

      onKeyDown(props) {
        if (props.event.key === 'Escape') {
          popup[0].hide()
          return true
        }

        return reactRenderer.ref?.onKeyDown?.(props) || false
      },

      onExit() {
        popup[0].destroy()
        reactRenderer.destroy()
      },
    }
  },
})
