import { NodeViewProps, NodeViewWrapper } from "@tiptap/react"
import { ChevronUp, ChevronDown, Edit3, Trash2, CalendarDays } from "lucide-react"
import { useState, useRef, useEffect, useCallback } from "react"
import { useDragMenu, NodeTouchMenu } from "@/components/editor/DragMenuContext"

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ── Mini month calendar with the event day highlighted ───────────────────────
function MiniCalendar({ date }: { date: string }) {
  const d = new Date(date)
  if (isNaN(d.getTime())) return null
  const year = d.getFullYear()
  const month = d.getMonth()
  const eventDay = d.getDate()
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  return (
    <div className="w-56 rounded-md border dark:border-neutral-700 bg-white dark:bg-neutral-900 p-2">
      <div className="text-center text-xs font-medium text-gray-700 dark:text-gray-200 mb-1.5">
        {MONTH_NAMES[month]} {year}
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {WEEKDAYS.map(w => (
          <div key={w} className="text-[10px] text-muted-foreground font-medium py-0.5">{w[0]}</div>
        ))}
        {cells.map((day, i) => (
          <div key={i} className="flex items-center justify-center">
            {day !== null && (
              <span className={`flex items-center justify-center w-6 h-6 text-xs rounded-full ${
                day === eventDay
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'text-muted-foreground dark:text-gray-300'
              }`}>
                {day}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const CalendarNodeComponent: React.FC<NodeViewProps> = ({ node, updateAttributes, selected, editor, deleteNode, getPos }) => {
  const { date, title, description } = node.attrs
  const isEditable = editor.isEditable
  const isTouchDevice = window.matchMedia("(pointer: coarse)").matches
  const [isEditing, setIsEditing] = useState(!date && !title)
  const [showCalendar, setShowCalendar] = useState(false)
  const [inputDate, setInputDate] = useState(date ?? '')
  const [inputTitle, setInputTitle] = useState(title ?? '')
  const [inputDescription, setInputDescription] = useState(description ?? '')
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) setTimeout(() => titleRef.current?.focus(), 0)
  }, [isEditing])

  const handleSubmit = () => {
    updateAttributes({ date: inputDate || null, title: inputTitle, description: inputDescription })
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
    if (e.key === 'Escape' && (date || title)) {
      setInputDate(date ?? ''); setInputTitle(title ?? ''); setInputDescription(description ?? ''); setIsEditing(false)
    }
  }

  const handleMoveUp = useCallback(() => {
    const pos = getPos()
    if (pos === undefined) return
    const { state } = editor
    const $pos = state.doc.resolve(pos)
    if ($pos.index() === 0) return
    const nodeBefore = $pos.nodeBefore
    if (!nodeBefore) return
    editor.view.dispatch(state.tr.replaceWith(pos - nodeBefore.nodeSize, pos + node.nodeSize, [node, nodeBefore]))
  }, [editor, node, getPos])

  const handleMoveDown = useCallback(() => {
    const pos = getPos()
    if (pos === undefined) return
    const { state } = editor
    const $pos = state.doc.resolve(pos)
    if ($pos.index() >= $pos.parent.childCount - 1) return
    const nodeAfterPos = pos + node.nodeSize
    const nodeAfter = state.doc.resolve(nodeAfterPos).nodeAfter
    if (!nodeAfter) return
    editor.view.dispatch(state.tr.replaceWith(pos, nodeAfterPos + nodeAfter.nodeSize, [nodeAfter, node]))
  }, [editor, node, getPos])

  const nodeActions = [
    { label: 'Move up', icon: <ChevronUp size={14} />, onClick: handleMoveUp },
    { label: 'Move down', icon: <ChevronDown size={14} />, onClick: handleMoveDown },
    { label: 'Edit', icon: <Edit3 size={14} />, onClick: () => { setInputDate(date ?? ''); setInputTitle(title ?? ''); setInputDescription(description ?? ''); setIsEditing(true) } },
    { label: 'Delete', icon: <Trash2 size={14} />, onClick: deleteNode, variant: 'danger' as const },
  ]

  useDragMenu(getPos, () => nodeActions)

  if (isEditing || (!date && !title)) {
    return (
      <NodeViewWrapper className="calendar-node select-none border dark:border-neutral-700 rounded p-3 bg-gray-100 dark:bg-neutral-800">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays size={18} />
            <span className="text-sm font-medium">Calendar Event</span>
          </div>
          <input ref={titleRef} type="text" className="px-3 py-2 text-sm rounded border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="Event title..." value={inputTitle} onChange={e => setInputTitle(e.target.value)} onKeyDown={handleKeyDown} />
          <input type="date" className="px-3 py-2 text-sm rounded border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500" value={inputDate} onChange={e => setInputDate(e.target.value)} onKeyDown={handleKeyDown} />
          <textarea className="px-3 py-2 text-sm rounded border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" placeholder="Description (optional)..." rows={2} value={inputDescription} onChange={e => setInputDescription(e.target.value)} onKeyDown={handleKeyDown} />
          <div className="flex gap-2">
            <button className="px-3 py-2 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50" onClick={handleSubmit} disabled={!inputTitle.trim() && !inputDate}>Save</button>
            {(date || title) && (
              <button className="px-3 py-2 text-sm rounded border border-gray-300 dark:border-neutral-600 hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-700 dark:text-gray-300 transition-colors" onClick={() => { setInputDate(date ?? ''); setInputTitle(title ?? ''); setInputDescription(description ?? ''); setIsEditing(false) }}>Cancel</button>
            )}
          </div>
        </div>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper>
      <div className="relative group my-1">
        <div
          className="flex flex-wrap items-center gap-1.5 px-1 py-1 cursor-pointer"
          onClick={() => setShowCalendar(s => !s)}
        >
          {title && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-neutral-700 text-muted-foreground dark:text-gray-300 select-none">
              <CalendarDays size={12} className="shrink-0" />
              {title}
            </span>
          )}
        </div>
        {showCalendar && date && (
          <div className="px-1 py-1">
            <MiniCalendar date={date} />
          </div>
        )}
        {isTouchDevice && isEditable && (
          <NodeTouchMenu visible={selected} actions={nodeActions} />
        )}
      </div>
    </NodeViewWrapper>
  )
}

export default CalendarNodeComponent
