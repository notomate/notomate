import { ReactNode, useRef } from "react"
import { useTwoColumn } from "./TwoColumn"
import useMobileSheet from "@/hooks/use-mobile-sheet"

interface TwoColumnSidebarProps {
    children: ReactNode
    className?: string
}

export const TwoColumnSidebar = ({ children, className = "" }: TwoColumnSidebarProps) => {
    const { isSidebarCollapsed, toggleSidebar } = useTwoColumn()
    const containerRef = useRef<HTMLDivElement>(null)
    const { isHidden, isDragging, dragStyle, dragHandleProps } = useMobileSheet({
        open: !isSidebarCollapsed,
        onClose: toggleSidebar,
        scrollRef: containerRef,
    })

    return (
        <>
            {/* Backdrop - only visible on mobile when sidebar is open */}
            {!isSidebarCollapsed && (
                <div
                    className="fixed inset-0 bg-black/50 dark:bg-black/70 z-drawer-backdrop lg:hidden"
                    onClick={() => {
                        toggleSidebar()
                    }}
                />
            )}

            {/* Sidebar */}
            <div
                ref={containerRef}
                className={`${
                    isSidebarCollapsed
                        ? 'translate-y-full lg:translate-y-0'
                        : 'translate-y-0'
                }
                ${isHidden ? 'max-lg:hidden' : ''}
                ${isDragging ? '' : 'transition-transform duration-300 ease-out'}
                fixed bottom-0 left-0 right-0 max-h-[85vh] rounded-t-2xl dark:max-lg:ring-1 dark:max-lg:ring-white/10
                lg:static lg:w-96 lg:max-h-none lg:rounded-none lg:h-screen lg:flex-shrink-0
                overflow-y-auto z-drawer ${className}`}
                style={dragStyle}
            >
                {/* Drag handle - only visible on mobile */}
                <div
                    className="sticky top-0 z-10 flex items-center justify-center py-2 cursor-grab active:cursor-grabbing lg:hidden bg-neutral-100 dark:bg-neutral-900  touch-none"
                    {...dragHandleProps}
                >
                    <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
                </div>
                {children}
            </div>
        </>
    )
}

export default TwoColumnSidebar
