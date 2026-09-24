import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { MoreVertical } from 'lucide-react'

export interface MenuAction {
  label: string
  icon: React.ReactNode
  onClick: () => void
  variant?: 'default' | 'danger'
}

interface DragMenuContextValue {
  activePos: number
  setActiveNodeActions: (actions: MenuAction[]) => void
}

export const DragMenuContext = createContext<DragMenuContextValue>({
  activePos: -1,
  setActiveNodeActions: () => {},
})

/**
 * Register actions for this node in the DragHandle menu (non-touch).
 * getActions is called fresh each time this node becomes active.
 */
export function useDragMenu(
  getPos: (() => number | undefined) | undefined,
  getActions: () => MenuAction[]
) {
  const { activePos, setActiveNodeActions } = useContext(DragMenuContext)
  const getActionsRef = useRef(getActions)
  getActionsRef.current = getActions

  useEffect(() => {
    if (!getPos) return
    const pos = getPos()
    if (pos !== undefined && pos === activePos) {
      setActiveNodeActions(getActionsRef.current())
    }
  }, [activePos, getPos, setActiveNodeActions])
}

/**
 * Floating action menu for touch devices — renders a MoreVertical trigger
 * in the top-right corner of the nearest positioned ancestor.
 */
export function NodeTouchMenu({
  visible,
  actions,
}: {
  visible: boolean
  actions: MenuAction[]
}) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Element)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  if (!visible || actions.length === 0) return null

  return (
    <div ref={menuRef} className="absolute top-2 right-2 z-10">
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(v => !v) }}
        className="p-1.5 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-gray-200 dark:border-neutral-600 transition-colors"
      >
        <MoreVertical size={16} className="text-gray-700 dark:text-gray-300" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded shadow-lg z-50 py-1 min-w-[150px]">
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); action.onClick(); setOpen(false) }}
              className={`flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors ${
                action.variant === 'danger'
                  ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800'
              }`}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
