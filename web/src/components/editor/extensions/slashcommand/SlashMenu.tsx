import { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { CommandItem } from './SlashCommand'

interface Props {
  items: CommandItem[]
  editor: any
  command: (item: CommandItem) => void
}

export interface SlashMenuRef {
  onKeyDown: ({ event }: { event: KeyboardEvent }) => boolean
}

export const SlashMenu = forwardRef<SlashMenuRef, Props>(
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

    if (!items.length) return null

    // Group items by category, preserving first-seen order of categories
    const categoryOrder: string[] = []
    const grouped: Record<string, { item: CommandItem; index: number }[]> = {}
    items.forEach((item, i) => {
      const cat = item.category ?? ''
      if (!grouped[cat]) {
        categoryOrder.push(cat)
        grouped[cat] = []
      }
      grouped[cat].push({ item, index: i })
    })

    const rendered: JSX.Element[] = []
    categoryOrder.forEach(cat => {
      if (cat) {
        rendered.push(
          <div key={`cat-${cat}`} className="px-3 pt-2 pb-0.5 text-xs font-semibold text-muted-foreground dark:text-stone-500 uppercase tracking-wide select-none">
            {t(`editor.slashCategories.${cat}`, cat)}
          </div>
        )
      }
      grouped[cat].forEach(({ item, index: i }) => {
        rendered.push(
          <button
            key={i}
            ref={(el) => (itemRefs.current[i] = el!)}
            className={`w-full text-left px-3 py-1.5 rounded-md text-sm flex gap-2 items-center ${i === selectedIndex
                ? 'bg-gray-100 text-gray-900 dark:bg-neutral-900 dark:text-neutral-100'
                : 'hover:bg-gray-100 text-gray-900 dark:hover:bg-stone-950 dark:text-stone-100'
              }`}
            onClick={() => command(item)}
          >
            {item.icon}
            {item.label}
          </button>
        )
      })
    })

    return (
      <div className="bg-white dark:bg-stone-900 shadow-lg rounded-lg border border-gray-200 p-2 w-56">
        <div className='max-h-72 overflow-y-auto'>
          {rendered}
        </div>
      </div>
    )
  }
)
