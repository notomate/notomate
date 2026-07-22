import { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import Avatar from '@/components/avatar/Avatar'
import { MentionItem } from './suggestion'

interface Props {
  items: MentionItem[]
  command: (item: MentionItem) => void
}

export interface MentionListRef {
  onKeyDown: ({ event }: { event: KeyboardEvent }) => boolean
}

export const MentionList = forwardRef<MentionListRef, Props>(
  ({ items, command }, ref) => {
    const { t } = useTranslation()
    const [selectedIndex, setSelectedIndex] = useState(0)
    const itemRefs = useRef<HTMLButtonElement[]>([])

    useEffect(() => {
      setSelectedIndex(0)
    }, [items])

    useEffect(() => {
      const el = itemRefs.current[selectedIndex]
      if (el) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }, [selectedIndex])

    const upHandler = () => {
      setSelectedIndex((prev) => (prev - 1 + items.length) % items.length)
    }

    const downHandler = () => {
      setSelectedIndex((prev) => (prev + 1) % items.length)
    }

    const enterHandler = () => {
      const selected = items[selectedIndex]
      if (selected) {
        command(selected)
      }
    }

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === 'ArrowUp') {
          upHandler()
          return true
        }
        if (event.key === 'ArrowDown') {
          downHandler()
          return true
        }
        if (event.key === 'Enter') {
          enterHandler()
          return true
        }
        return false
      },
    }))

    if (!items.length) {
      return (
        <div className="bg-white dark:bg-stone-900 shadow-lg rounded-lg border border-gray-200 p-2 w-64 text-sm text-gray-400 dark:text-stone-500">
          {t('editor.mention.noResults')}
        </div>
      )
    }

    return (
      <div className="bg-white dark:bg-stone-900 shadow-lg rounded-lg border border-gray-200 p-2 w-64">
        <div className="max-h-72 overflow-y-auto">
          {items.map((item, i) => (
            <button
              key={item.id}
              ref={(el) => (itemRefs.current[i] = el!)}
              className={`w-full text-left px-2 py-1.5 rounded-md text-sm flex gap-2 items-center ${i === selectedIndex
                  ? 'bg-gray-200 text-gray-950 dark:bg-stone-950 dark:text-stone-200'
                  : 'hover:bg-gray-100 text-gray-900 dark:hover:bg-stone-950 dark:text-stone-100'
                }`}
              onClick={() => command(item)}
            >
              <Avatar name={item.label} avatarUrl={item.avatarUrl} size={22} />
              <div className="min-w-0 flex flex-col">
                <span className="truncate leading-tight">{item.label}</span>
                <span className="truncate leading-tight text-xs text-gray-400 dark:text-stone-500">{item.email}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }
)
