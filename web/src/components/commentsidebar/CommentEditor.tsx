import { ChangeEvent, FC, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { Placeholder } from "@tiptap/extensions"
import { TaskItem, TaskList } from "@tiptap/extension-list"
import { Mention } from "@tiptap/extension-mention"
import { Bold, Italic, Strikethrough, Code, List, ListOrdered, ListChecks, Quote, Code2, Paperclip } from "lucide-react"
import { WorkspaceMember } from "@/api/workspace"
import { uploadFile, getFileDownloadUrl } from "@/api/file"
import { useToastStore } from "@/stores/toast"
import { createMentionSuggestion } from "@/components/editor/extensions/mention/suggestion"
import { docToMarkdown, markdownToDoc } from "./commentDocConvert"
import { CommentAttachment } from "./commentAttachmentNode"
import { isImageAttachmentUrl } from "./commentMarkdown"

interface CommentEditorProps {
  value: string
  onChange: (value: string) => void
  members: WorkspaceMember[]
  /** Workspace the uploaded-file toolbar button attaches files into. */
  workspaceId: string
  placeholder?: string
  className?: string
  autoFocus?: boolean
  minHeight?: number
  onBlur?: () => void
  /** Show a primary-colored ring around the editor while focused. Defaults to true. */
  focusRing?: boolean
}

const CommentEditor: FC<CommentEditorProps> = ({
  value, onChange, members, workspaceId, placeholder, className = "", autoFocus, minHeight = 72, onBlur, focusRing = true,
}) => {
  const { t } = useTranslation()
  const { addToast } = useToastStore()
  const membersRef = useRef<WorkspaceMember[]>(members)
  useEffect(() => { membersRef.current = members }, [members])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  // The native file picker steals focus as soon as it opens, which fires a real blur event on
  // the editor. Suppress the `onBlur` callback (e.g. collapse-when-empty) for that entire
  // round trip so an in-progress attach doesn't get treated as "user left with nothing typed".
  const attachingRef = useRef(false)

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
      CommentAttachment,
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
    onBlur: () => {
      if (attachingRef.current) return
      onBlur?.()
    },
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

  const handleAttachClick = () => {
    attachingRef.current = true
    fileInputRef.current?.click()
    // If the user dismisses the picker without choosing a file, `change` never fires, so this
    // is the only signal we get back. Give the (possibly still-firing) change event a head
    // start before releasing the guard.
    const releaseOnCancel = () => {
      window.removeEventListener("focus", releaseOnCancel)
      setTimeout(() => { attachingRef.current = false }, 300)
    }
    window.addEventListener("focus", releaseOnCancel)
  }

  const handleFileSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !editor) {
      attachingRef.current = false
      return
    }
    setUploading(true)
    try {
      const res = await uploadFile(workspaceId, file)
      const url = getFileDownloadUrl(workspaceId, res.filename)
      editor.chain().focus().insertContent({
        type: "commentAttachment",
        attrs: { url, name: res.original_name, isImage: isImageAttachmentUrl(url) },
      }).run()
    } catch {
      addToast({ title: t("messaging.uploadFileFailed"), type: "error" })
    } finally {
      setUploading(false)
      attachingRef.current = false
    }
  }

  return (
    <div className={`flex-1 min-w-0 border dark:border-neutral-600 rounded bg-white dark:bg-neutral-900 overflow-hidden ${focusRing ? "focus-within:ring-1 focus-within:ring-primary" : ""}`}>
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />
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
        <button
          type="button"
          title={t("messaging.attachFile") as string}
          disabled={uploading}
          className="p-1 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700 hover:text-gray-800 dark:hover:text-gray-100 shrink-0 disabled:opacity-40"
          onMouseDown={e => e.preventDefault()}
          onClick={handleAttachClick}
        >
          <Paperclip size={13} />
        </button>
      </div>
      <EditorContent editor={editor} className="px-2 py-1.5 max-h-64 overflow-y-auto" />
    </div>
  )
}

export default CommentEditor
