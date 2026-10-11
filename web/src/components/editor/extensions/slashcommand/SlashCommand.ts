import { Extension } from '@tiptap/core'
import Suggestion, { SuggestionOptions } from '@tiptap/suggestion'
import { ReactRenderer } from '@tiptap/react'
import { Z_INDEX } from '@/lib/zIndex'
import tippy, { Instance as TippyInstance } from 'tippy.js'
import { SlashMenu } from './SlashMenu'
import { ReactNode } from 'react'

export interface CommandItem {
  icon?: ReactNode
  label: string
  category?: string
  keywords?: string[]
  command: (ctx: { editor: any }) => void
}

export const SlashCommand = Extension.create({
  name: 'slash-command',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({ editor, range, props }) => {
          editor.chain().focus().deleteRange(range).run()
          props.command({ editor })
        },
        render: () => {
          let reactRenderer: any
          let popup: TippyInstance[]

          return {
            onStart: (props) => {
              reactRenderer = new ReactRenderer(SlashMenu, {
                props: {
                  ...props,
                  editor: props.editor,
                  command: props.command,
                },
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
                zIndex: Z_INDEX.popover,
              })
            },

            onUpdate(props) {
              reactRenderer.updateProps({
                ...props,
                editor: props.editor,
                command: props.command,
              })
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
      } as Partial<SuggestionOptions>,
    }
  },

  addProseMirrorPlugins() {
    return [Suggestion({ ...this.options.suggestion, editor: this.editor })]
  },
})
