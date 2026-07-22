import { FC, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { Placeholder } from "@tiptap/extensions"
import { TaskItem, TaskList } from "@tiptap/extension-list"
import { Mention } from "@tiptap/extension-mention"
import { Bold, Italic, Strikethrough, Code, List, ListOrdered, ListChecks, Quote, Code2 } from "lucide-react"
import { WorkspaceMember } from "@/api/workspace"
import { createMentionSuggestion } from "@/components/editor/extensions/mention/suggestion"
import { docToMarkdown, markdownToDoc } from "./commentDocConvert"

interface CommentEditorProps {
  value: string
  onChange: (value: string) => void
  members: WorkspaceMember[]
  placeholder?: string
  className?: string
  autoFocus?: boolean
  minHeight?: number
  onBlur?: () => void
}

const CommentEditor: FC<CommentEditorProps> = ({
  value, onChange, members, placeholder, className = "", autoFocus, minHeight = 72, onBlur,
}) => {
  const { t } = useTranslation()
  const membersRef = useRef<WorkspaceMember[]>(members)
  useEffect(() => { membersRef.current = members }, [members])

  // The editor owns its own ProseMirror doc; `value` (markdown) is only re-applied when it
  // changes from outside (e.g. cleared after submit), never as an echo of our own onChange.
  const lastEmitted = useRef(value)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        horizontalRule: false,
        underline: false,
        link: false,
        codeBlock: {
          HTMLAttributes: { class: "rounded bg-gray-100 dark:bg-neutral-800 p-2 font-mono text-xs" },
        },
        blockquote: {
          HTMLAttributes: { class: "border-l-2 border-gray-300 dark:border-neutral-600 pl-2 text-gray-500 dark:text-gray-400" },
        },
      }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
      TaskList.configure({ HTMLAttributes: { class: "list-none" } }),
      TaskItem,
      Mention.configure({
        HTMLAttributes: { class: "note-comment-mention" },
        suggestion: createMentionSuggestion(() => membersRef.current),
      }),
    ],
    autofocus: autoFocus ? "end" : false,
    content: markdownToDoc(value),
    editorProps: {
      attributes: {
        class: `focus:outline-none note-comment-body ${className}`,
        style: `min-height: ${minHeight}px`,
      },
    },
    onUpdate: ({ editor: e }) => {
      const markdown = docToMarkdown(e.getJSON())
      lastEmitted.current = markdown
      onChange(markdown)
    },
    onBlur: () => onBlur?.(),
  })

  useEffect(() => {
    if (!editor) return
    if (value === lastEmitted.current) return
    lastEmitted.current = value
    editor.commands.setContent(markdownToDoc(value), { emitUpdate: false })
  }, [value, editor])

  const toolbarItems = editor ? [
    { icon: Bold, title: t("comments.editor.bold"), onClick: () => editor.chain().focus().toggleBold().run() },
    { icon: Italic, title: t("comments.editor.italic"), onClick: () => editor.chain().focus().toggleItalic().run() },
    { icon: Strikethrough, title: t("comments.editor.strike"), onClick: () => editor.chain().focus().toggleStrike().run() },
    { icon: Code, title: t("comments.editor.code"), onClick: () => editor.chain().focus().toggleCode().run() },
    { icon: List, title: t("comments.editor.bulletList"), onClick: () => editor.chain().focus().toggleBulletList().run() },
    { icon: ListOrdered, title: t("comments.editor.orderedList"), onClick: () => editor.chain().focus().toggleOrderedList().run() },
    { icon: ListChecks, title: t("comments.editor.taskList"), onClick: () => editor.chain().focus().toggleTaskList().run() },
    { icon: Quote, title: t("comments.editor.blockquote"), onClick: () => editor.chain().focus().toggleBlockquote().run() },
    { icon: Code2, title: t("comments.editor.codeBlock"), onClick: () => editor.chain().focus().toggleCodeBlock().run() },
  ] : []

  return (
    <div className="flex-1 min-w-0 border dark:border-neutral-600 rounded bg-white dark:bg-neutral-900 focus-within:ring-1 focus-within:ring-primary overflow-hidden">
      <div className="flex items-center gap-0.5 px-1 py-0.5 border-b dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800/50 overflow-x-auto hide-scrollbar">
        {toolbarItems.map(({ icon: Icon, title, onClick }, i) => (
          <button
            key={i}
            type="button"
            title={title}
            className="p-1 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700 hover:text-gray-800 dark:hover:text-gray-100 shrink-0"
            onMouseDown={e => e.preventDefault()}
            onClick={onClick}
          >
            <Icon size={13} />
          </button>
        ))}
      </div>
      <EditorContent editor={editor} className="px-2 py-1.5 max-h-64 overflow-y-auto" />
    </div>
  )
}

export default CommentEditor
