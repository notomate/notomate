import { ChangeEvent, FC, KeyboardEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"
import { Bold, Italic, Strikethrough, Code, List, ListOrdered, ListChecks, Quote, Code2, Paperclip } from "lucide-react"
import { WorkspaceMember } from "@/api/workspace"
import { uploadFile, getFileDownloadUrl } from "@/api/file"
import { useToastStore } from "@/stores/toast"
import { Z_INDEX } from "@/lib/zIndex"
import { MentionItem, MentionList, MentionListRef } from "./MentionList"
import { TextEdit, activeMention, fenceLines, markdownToText, prefixLines, textToMarkdown, wrapSelection } from "./commentText"

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

const MAX_HEIGHT = 256

const CommentEditor: FC<CommentEditorProps> = ({
  value, onChange, members, workspaceId, placeholder, className = "", autoFocus, minHeight = 72, onBlur, focusRing = true,
}) => {
  const { t } = useTranslation()
  const { addToast } = useToastStore()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const mentionListRef = useRef<MentionListRef>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  // The native file picker steals focus as soon as it opens, which fires a real blur event on
  // the editor. Suppress the `onBlur` callback (e.g. collapse-when-empty) for that entire
  // round trip so an in-progress attach doesn't get treated as "user left with nothing typed".
  const attachingRef = useRef(false)

  // Mentions picked from the list or loaded with `value`; they win over same-named members.
  const pickedMentions = useRef(new Map<string, string>())
  const [text, setText] = useState(() => {
    const parsed = markdownToText(value)
    parsed.mentions.forEach(m => pickedMentions.current.set(m.label, m.id))
    return parsed.text
  })
  // `value` is only re-applied when it changes from outside (e.g. cleared after submit),
  // never as an echo of our own onChange.
  const lastEmitted = useRef(value)

  // Caret position while focused; null when blurred, which closes the mention list.
  const [caret, setCaret] = useState<number | null>(null)
  const [dismissedAt, setDismissedAt] = useState<number | null>(null)

  const toMarkdown = (next: string) => {
    const mentions = new Map(members.filter(m => m.user_name).map(m => [m.user_name, m.user_id]))
    pickedMentions.current.forEach((id, label) => mentions.set(label, id))
    return textToMarkdown(next, mentions)
  }

  const handleText = (next: string) => {
    setText(next)
    const markdown = toMarkdown(next)
    lastEmitted.current = markdown
    onChange(markdown)
  }

  useEffect(() => {
    if (value === lastEmitted.current) return
    lastEmitted.current = value
    const parsed = markdownToText(value)
    parsed.mentions.forEach(m => pickedMentions.current.set(m.label, m.id))
    setText(parsed.text)
  }, [value])

  useEffect(() => {
    if (!autoFocus) return
    const ta = textareaRef.current
    if (!ta) return
    ta.focus()
    ta.setSelectionRange(ta.value.length, ta.value.length)
  }, [autoFocus])

  // Grow with the content up to MAX_HEIGHT, then scroll.
  useLayoutEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = "auto"
    ta.style.height = `${Math.min(Math.max(ta.scrollHeight, minHeight), MAX_HEIGHT)}px`
  }, [text, minHeight])

  // Goes through the browser's editing commands so the change stays on the undo stack.
  const applyEdit = (edit: TextEdit) => {
    const ta = textareaRef.current
    if (!ta) return
    ta.focus()
    ta.setSelectionRange(edit.start, edit.end)
    if (!document.execCommand("insertText", false, edit.insert)) {
      ta.setRangeText(edit.insert, edit.start, edit.end, "end")
      handleText(ta.value)
    }
    ta.setSelectionRange(edit.selStart, edit.selEnd)
    setCaret(edit.selEnd)
  }

  const runOnSelection = (edit: (text: string, start: number, end: number) => TextEdit) => {
    const ta = textareaRef.current
    if (!ta) return
    applyEdit(edit(ta.value, ta.selectionStart, ta.selectionEnd))
  }

  const found = caret === null ? null : activeMention(text, caret)
  const mention = found && found.from !== dismissedAt ? found : null
  const mentionQuery = mention?.query ?? null
  // Memoized so the list keeps its highlighted row between renders.
  const mentionItems: MentionItem[] = useMemo(() => {
    if (mentionQuery === null) return []
    const q = mentionQuery.toLowerCase()
    return members
      .filter(m => !q || m.user_name.toLowerCase().includes(q) || m.user_email.toLowerCase().includes(q))
      .slice(0, 10)
      .map(m => ({ id: m.user_id, label: m.user_name, email: m.user_email, avatarUrl: m.user_avatar_url }))
  }, [members, mentionQuery])

  const pickMention = (item: MentionItem) => {
    if (!mention || caret === null) return
    pickedMentions.current.set(item.label, item.id)
    const insert = `@${item.label} `
    const end = mention.from + insert.length
    applyEdit({ start: mention.from, end: caret, insert, selStart: end, selEnd: end })
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!mention) return
    if (e.key === "Escape") {
      e.preventDefault()
      setDismissedAt(mention.from)
      return
    }
    // With nothing to pick, keys (Enter in particular) keep their normal meaning.
    if (!mentionItems.length) return
    if (e.key === "Tab") {
      e.preventDefault()
      pickMention(mentionItems[0])
      return
    }
    if (mentionListRef.current?.onKeyDown({ event: e.nativeEvent })) e.preventDefault()
  }

  const syncCaret = () => {
    const ta = textareaRef.current
    if (ta) setCaret(ta.selectionStart)
  }

  const toolbarItems = [
    { icon: Bold, title: t("comments.editor.bold"), onClick: () => runOnSelection((s, a, b) => wrapSelection(s, a, b, "**")) },
    { icon: Italic, title: t("comments.editor.italic"), onClick: () => runOnSelection((s, a, b) => wrapSelection(s, a, b, "*")) },
    { icon: Strikethrough, title: t("comments.editor.strike"), onClick: () => runOnSelection((s, a, b) => wrapSelection(s, a, b, "~~")) },
    { icon: Code, title: t("comments.editor.code"), onClick: () => runOnSelection((s, a, b) => wrapSelection(s, a, b, "`")) },
    { icon: List, title: t("comments.editor.bulletList"), onClick: () => runOnSelection((s, a, b) => prefixLines(s, a, b, () => "- ")) },
    { icon: ListOrdered, title: t("comments.editor.orderedList"), onClick: () => runOnSelection((s, a, b) => prefixLines(s, a, b, i => `${i + 1}. `)) },
    // "*" rather than "-": CommonMark would merge a task list into an adjacent "-" bullet list.
    { icon: ListChecks, title: t("comments.editor.taskList"), onClick: () => runOnSelection((s, a, b) => prefixLines(s, a, b, () => "* [ ] ")) },
    { icon: Quote, title: t("comments.editor.blockquote"), onClick: () => runOnSelection((s, a, b) => prefixLines(s, a, b, () => "> ")) },
    { icon: Code2, title: t("comments.editor.codeBlock"), onClick: () => runOnSelection(fenceLines) },
  ]

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
    if (!file) {
      attachingRef.current = false
      return
    }
    setUploading(true)
    try {
      const res = await uploadFile(workspaceId, file)
      const url = getFileDownloadUrl(workspaceId, res.filename)
      const name = res.original_name.replace(/[[\]]/g, m => `\\${m}`)
      runOnSelection((_, start, end) => {
        const insert = `![${name}](${url})`
        return { start, end, insert, selStart: start + insert.length, selEnd: start + insert.length }
      })
    } catch {
      addToast({ title: t("messaging.uploadFileFailed"), type: "error" })
    } finally {
      setUploading(false)
      attachingRef.current = false
    }
  }

  // The list floats below the textarea, or above it when there's no room (e.g. the channel
  // composer pinned to the bottom of the screen).
  const rect = mention ? textareaRef.current?.getBoundingClientRect() : undefined
  const mentionPopup = rect && createPortal(
    <div
      style={{
        position: "fixed",
        left: rect.left,
        zIndex: Z_INDEX.popover,
        ...(rect.bottom + 320 > window.innerHeight ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
      }}
      // Keep focus (and the caret) in the textarea while clicking an item.
      onMouseDown={e => e.preventDefault()}
    >
      <MentionList ref={mentionListRef} items={mentionItems} command={pickMention} />
    </div>,
    document.body,
  )

  return (
    <div className={`flex-1 min-w-0 border dark:border-neutral-600 rounded bg-white dark:bg-neutral-900 overflow-hidden ${focusRing ? "focus-within:ring-1 focus-within:ring-primary" : ""}`}>
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />
      <div className="flex items-center gap-0.5 px-1 py-0.5 border-b dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800/50 overflow-x-auto hide-scrollbar">
        {toolbarItems.map(({ icon: Icon, title, onClick }, i) => (
          <button
            key={i}
            type="button"
            title={title}
            className="p-1 rounded text-muted-foreground hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-gray-800 dark:hover:text-gray-100 shrink-0"
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
          className="p-1 rounded text-muted-foreground hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-gray-800 dark:hover:text-gray-100 shrink-0 disabled:opacity-40"
          onMouseDown={e => e.preventDefault()}
          onClick={handleAttachClick}
        >
          <Paperclip size={13} />
        </button>
      </div>
      <textarea
        ref={textareaRef}
        className={`block w-full resize-none bg-transparent px-2 py-1.5 leading-relaxed focus:outline-none overflow-y-auto placeholder:text-muted-foreground ${className}`}
        style={{ minHeight, maxHeight: MAX_HEIGHT }}
        placeholder={placeholder}
        value={text}
        onChange={e => { handleText(e.target.value); setCaret(e.target.selectionStart) }}
        onKeyDown={handleKeyDown}
        onKeyUp={syncCaret}
        onClick={syncCaret}
        onSelect={syncCaret}
        onBlur={() => {
          setDismissedAt(null)
          setCaret(null)
          if (attachingRef.current) return
          onBlur?.()
        }}
        onFocus={syncCaret}
      />
      {mentionPopup}
    </div>
  )
}

export default CommentEditor
