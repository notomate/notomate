import { ReactNode } from "react"
import { Menu } from "lucide-react"

interface MobileTopBarProps {
    title: string
    onOpenSidebar: () => void
    rightActions?: ReactNode
}

const MobileTopBar = ({ title, onOpenSidebar, rightActions }: MobileTopBarProps) => {
    return (
        <div className="shrink-0 py-3 pl-4 pr-5 lg:hidden flex items-center justify-between border-b border-neutral-200 dark:border-neutral-700">
            <button
                aria-label="open sidebar"
                className="p-2 -ml-2 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 text-gray-600 dark:text-gray-400"
                onClick={onOpenSidebar}
            >
                <Menu size={16} />
            </button>
            <span className="font-semibold text-gray-700 dark:text-gray-200 truncate px-2">
                {title}
            </span>
            {rightActions ?? <div className="w-8" />}
        </div>
    )
}

export default MobileTopBar
