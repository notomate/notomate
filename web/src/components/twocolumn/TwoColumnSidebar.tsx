import { ReactNode, useEffect, useRef, useState } from "react"
import { useTwoColumn } from "./TwoColumn"

interface TwoColumnSidebarProps {
    children: ReactNode
    className?: string
}

export const TwoColumnSidebar = ({ children, className = "" }: TwoColumnSidebarProps) => {
    const { isSidebarCollapsed, toggleSidebar } = useTwoColumn()
    const [shouldHideOnMobile, setShouldHideOnMobile] = useState(isSidebarCollapsed)
    const [dragOffset, setDragOffset] = useState(0)
    const [isDragging, setIsDragging] = useState(false)
    const startYRef = useRef(0)
    const containerRef = useRef<HTMLDivElement>(null)

    // Handle animation and rendering state for mobile
    useEffect(() => {
        if (!isSidebarCollapsed) {
            // Show immediately when opening
            setShouldHideOnMobile(false)
        } else {
            // Delay hiding until animation completes (300ms)
            const timer = setTimeout(() => {
                setShouldHideOnMobile(true)
            }, 300)
            return () => clearTimeout(timer)
        }
    }, [isSidebarCollapsed])

    // Prevent body scroll when bottom sheet is open on mobile
    useEffect(() => {
        if (!isSidebarCollapsed && window.innerWidth < 1024) {
            // Store original values
            const originalOverflow = document.body.style.overflow
            const originalPosition = document.body.style.position

            // Prevent body scroll
            document.body.style.overflow = 'hidden'

            return () => {
                document.body.style.overflow = originalOverflow
                document.body.style.position = originalPosition
            }
        } else {
            // Ensure body overflow is cleared when sidebar is collapsed or on desktop
            // This prevents the overflow: hidden from persisting after navigation
            if (window.innerWidth < 1024 && document.body.style.overflow === 'hidden') {
                document.body.style.overflow = ''
            }
        }
    }, [isSidebarCollapsed])

    // Cleanup on unmount - ensure overflow is cleared
    useEffect(() => {
        return () => {
            if (window.innerWidth < 1024 && document.body.style.overflow === 'hidden') {
                document.body.style.overflow = ''
            }
        }
    }, [])

    // Handle drag to close on mobile
    const handleDragStart = (clientY: number) => {
        if (window.innerWidth >= 1024) return // Only on mobile
        if (isSidebarCollapsed) return // Only when open

        // Only start drag if the container is scrolled to top
        const container = containerRef.current
        if (container && container.scrollTop > 0) return

        setIsDragging(true)
        startYRef.current = clientY
    }

    const handleDragMove = (clientY: number) => {
        if (!isDragging) return

        const deltaY = clientY - startYRef.current

        // Only allow dragging down
        if (deltaY > 0) {
            setDragOffset(deltaY)
        }
    }

    const handleDragEnd = () => {
        if (!isDragging) return

        setIsDragging(false)

        // Close if dragged down more than 100px
        if (dragOffset > 100) {
            toggleSidebar()
        }

        // Reset drag offset
        setDragOffset(0)
    }

    // Touch event handlers
    const handleTouchStart = (e: React.TouchEvent) => {
        handleDragStart(e.touches[0].clientY)
    }

    const handleTouchMove = (e: React.TouchEvent) => {
        if (isDragging) {
            e.preventDefault() // Prevent scrolling while dragging
            handleDragMove(e.touches[0].clientY)
        }
    }

    const handleTouchEnd = () => {
        handleDragEnd()
    }

    // Mouse event handlers (for testing on desktop)
    const handleMouseDown = (e: React.MouseEvent) => {
        handleDragStart(e.clientY)
    }

    useEffect(() => {
        if (!isDragging) return

        const handleMouseMove = (e: MouseEvent) => {
            handleDragMove(e.clientY)
        }

        const handleMouseUp = () => {
            handleDragEnd()
        }

        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)

        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
        }
    }, [isDragging, dragOffset])

    return (
        <>
            {/* Backdrop - only visible on mobile when sidebar is open */}
            {!isSidebarCollapsed && (
                <div
                    className="fixed inset-0 bg-black/50 z-drawer-backdrop lg:hidden"
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
                ${shouldHideOnMobile ? 'max-lg:hidden' : ''}
                ${isDragging ? '' : 'transition-transform duration-300 ease-out'}
                fixed bottom-0 left-0 right-0 max-h-[85vh] rounded-t-2xl
                lg:static lg:w-96 lg:max-h-none lg:rounded-none lg:h-screen lg:flex-shrink-0
                overflow-y-auto z-drawer ${className}`}
                style={{
                    transform: isDragging ? `translateY(${dragOffset}px)` : undefined,
                }}
            >
                {/* Drag handle - only visible on mobile */}
                <div
                    className="sticky top-0 z-10 flex items-center justify-center py-2 cursor-grab active:cursor-grabbing lg:hidden bg-neutral-100 dark:bg-neutral-900  touch-none"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onMouseDown={handleMouseDown}
                >
                    <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
                </div>
                {children}
            </div>
        </>
    )
}

export default TwoColumnSidebar