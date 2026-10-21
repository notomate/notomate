import type { TFunction } from 'i18next'
import { defaultMessages, type EditorMessages } from '@notomate/editor'

/** Editor text that already has an app-wide key. */
const SHARED_KEYS: Partial<Record<keyof EditorMessages, string>> = {
  placeholder: 'editor.placeholder',
  untitled: 'editor.titlePlaceholder',
  paragraph: 'editor.Paragraph',
  heading1: 'editor.Heading 1',
  heading2: 'editor.Heading 2',
  heading3: 'editor.Heading 3',
  bulletList: 'editor.BulletList',
  todoList: 'editor.TaskList',
  quote: 'editor.Quote',
  code: 'editor.Code',
  image: 'editor.Image',
  moveUp: 'editor.moveUp',
  moveDown: 'editor.moveDown',
}

/**
 * The block editor's UI text from i18next: shared keys above, everything else under
 * `editor.ui.*`. Missing translations fall back to the editor's English defaults.
 */
export function editorMessages(t: TFunction): Partial<EditorMessages> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(defaultMessages)) {
    if (typeof value !== 'string') continue
    out[key] = t(SHARED_KEYS[key as keyof EditorMessages] ?? `editor.ui.${key}`, { defaultValue: value })
  }
  out.colors = Object.fromEntries(
    Object.entries(defaultMessages.colors).map(([k, v]) => [k, t(`editor.ui.colors.${k}`, { defaultValue: v })]),
  )
  const d = defaultMessages
  out.selectedBlocks = (n: number) => t('editor.ui.selectedBlocks', { count: n, defaultValue: d.selectedBlocks(n) })
  out.colorBackground = (color: string) =>
    t('editor.ui.colorBackground', { color, defaultValue: d.colorBackground(color) })
  out.peersOnline = (n: number) => t('editor.ui.peersOnline', { count: n, defaultValue: d.peersOnline(n) })
  out.you = (name: string) => t('editor.ui.you', { name, defaultValue: d.you(name) })
  return out as Partial<EditorMessages>
}
