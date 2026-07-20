import { FC, KeyboardEvent, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { WorkspaceMember } from "@/api/workspace"
import Avatar from "@/components/avatar/Avatar"
import { mentionToken } from "./commentMarkdown"

interface MentionTextareaProps {
  value: string
  onChange: (value: string) => void
  members: WorkspaceMember[]
  placeholder?: string
  rows?: number
  className?: string
  autoFocus?: boolean
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void
}

interface MentionState {
  query: string
  start: number
  activeIndex: number
  top: number
  left: number
}

// Mirrors the textarea's text-affecting styles onto a hidden div so we can
// measure where the caret actually sits on screen (there's no native API for this).
const MIRRORED_PROPS: (keyof CSSStyleDeclaration)[] = [
  "boxSizing", "width", "height", "overflowX", "overflowY",
  "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth", "borderStyle",
  "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "fontStyle", "fontVariant", "fontWeight", "fontSize", "lineHeight", "fontFamily",
  "textAlign", "textTransform", "textIndent", "letterSpacing", "wordSpacing", "whiteSpace", "wordBreak",
]

function getCaretCoordinates(textarea: HTMLTextAreaElement, position: number) {
  const div = document.createElement("div")
  const computed = window.getComputedStyle(textarea)

  div.style.position = "absolute"
  div.style.visibility = "hidden"
  div.style.whiteSpace = "pre-wrap"
  div.style.wordWrap = "break-word"
  const divStyle = div.style as unknown as Record<string, string>
  const computedStyle = computed as unknown as Record<string, string>
  MIRRORED_PROPS.forEach(prop => {
    divStyle[prop as string] = computedStyle[prop as string]
  })
  div.style.width = computed.width

  document.body.appendChild(div)
  div.textContent = textarea.value.substring(0, position)
  const span = document.createElement("span")
  span.textContent = textarea.value.substring(position) || "."
  div.appendChild(span)

  const coordinates = {
    top: span.offsetTop - textarea.scrollTop,
    left: span.offsetLeft - textarea.scrollLeft,
    height: parseInt(computed.lineHeight || "16", 10) || 16,
  }
  document.body.removeChild(div)
  return coordinates
}

const MentionTextarea: FC<MentionTextareaProps> = ({
  value, onChange, members, placeholder, rows = 2, className = "", autoFocus, onKeyDown,
}) => {
  const { t } = useTranslation()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [mention, setMention] = useState<MentionState | null>(null)

  const filtered = mention
    ? members
        .filter(m => {
          const q = mention.query.toLowerCase()
          return !q || m.user_name.toLowerCase().includes(q) || m.user_email.toLowerCase().includes(q)
        })
        .slice(0, 6)
    : []

  useEffect(() => {
    if (mention && mention.activeIndex >= filtered.length) {
      setMention(m => (m ? { ...m, activeIndex: 0 } : m))
    }
  }, [filtered.length, mention])

  const updateMentionState = (textarea: HTMLTextAreaElement) => {
    const cursor = textarea.selectionStart ?? textarea.value.length
    const before = textarea.value.slice(0, cursor)
    const match = /(^|\s)@([^\s@]{0,30})$/.exec(before)
    if (!match) {
      setMention(null)
      return
    }
    const query = match[2]
    const start = cursor - query.length - 1
    const coords = getCaretCoordinates(textarea, start)
    setMention({ query, start, activeIndex: 0, top: coords.top + coords.height, left: coords.left })
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value)
    updateMentionState(e.target)
  }

  const insertMention = (member: WorkspaceMember) => {
    const textarea = textareaRef.current
    if (!textarea || !mention) return
    const cursor = textarea.selectionStart ?? value.length
    const inserted = `${mentionToken(member.user_name, member.user_id)} `
    const next = value.slice(0, mention.start) + inserted + value.slice(cursor)
    onChange(next)
    setMention(null)
    requestAnimationFrame(() => {
      const pos = mention.start + inserted.length
      textarea.focus()
      textarea.setSelectionRange(pos, pos)
    })
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention && filtered.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setMention(m => (m ? { ...m, activeIndex: (m.activeIndex + 1) % filtered.length } : m))
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setMention(m => (m ? { ...m, activeIndex: (m.activeIndex - 1 + filtered.length) % filtered.length } : m))
        return
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault()
        insertMention(filtered[mention.activeIndex])
        return
      }
      if (e.key === "Escape") {
        e.preventDefault()
        setMention(null)
        return
      }
    }
    onKeyDown?.(e)
  }

  return (
    <div className="relative flex-1">
      <textarea
        ref={textareaRef}
        autoFocus={autoFocus}
        className={className}
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onClick={e => updateMentionState(e.currentTarget)}
        onBlur={() => window.setTimeout(() => setMention(null), 150)}
      />
      {mention && filtered.length > 0 && (
        <div
          className="absolute z-20 w-56 bg-white dark:bg-neutral-900 shadow-lg rounded-lg border border-gray-200 dark:border-neutral-700 p-1"
          style={{ top: mention.top, left: mention.left }}
        >
          {filtered.map((member, i) => (
            <button
              key={member.user_id}
              type="button"
              className={`w-full text-left px-2 py-1.5 rounded-md text-sm flex gap-2 items-center ${
                i === mention.activeIndex
                  ? "bg-gray-200 text-gray-950 dark:bg-neutral-700 dark:text-gray-100"
                  : "hover:bg-gray-100 text-gray-900 dark:hover:bg-neutral-800 dark:text-gray-100"
              }`}
              onMouseDown={e => e.preventDefault()}
              onClick={() => insertMention(member)}
            >
              <Avatar name={member.user_name} size={20} />
              <div className="min-w-0 flex flex-col">
                <span className="truncate leading-tight">{member.user_name}</span>
                <span className="truncate leading-tight text-xs text-gray-400 dark:text-gray-500">{member.user_email}</span>
              </div>
            </button>
          ))}
        </div>
      )}
      {mention && filtered.length === 0 && (
        <div
          className="absolute z-20 w-56 bg-white dark:bg-neutral-900 shadow-lg rounded-lg border border-gray-200 dark:border-neutral-700 p-2 text-sm text-gray-400"
          style={{ top: mention.top, left: mention.left }}
        >
          {t("editor.mention.noResults")}
        </div>
      )}
    </div>
  )
}

export default MentionTextarea
