import { RefObject, useEffect, useRef, useState } from "react"

const CLOSE_TRANSITION_MS = 300
const CLOSE_THRESHOLD_PX = 100

interface UseMobileSheetOptions {
  open: boolean
  onClose: () => void
  /** Scroll container of the sheet; dragging only starts when it's scrolled to the top. */
  scrollRef?: RefObject<HTMLElement | null>
}

const isMobile = () => window.innerWidth < 1024

/**
 * Shared behavior for sidebars that turn into a draggable bottom sheet below
 * `lg`: drag the handle down to close, lock background scroll while open, and
 * stay mounted through the closing slide transition.
 */
const useMobileSheet = ({ open, onClose, scrollRef }: UseMobileSheetOptions) => {
  const [isHidden, setIsHidden] = useState(!open)
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const startYRef = useRef(0)

  // Keep the sheet mounted briefly after close so the slide-down transition can play.
  useEffect(() => {
    if (open) {
      setIsHidden(false)
      return
    }
    const timer = setTimeout(() => setIsHidden(true), CLOSE_TRANSITION_MS)
    return () => clearTimeout(timer)
  }, [open])

  // Prevent background scroll while the sheet is open.
  useEffect(() => {
    if (!open || !isMobile()) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = originalOverflow }
  }, [open])

  const handleDragStart = (clientY: number) => {
    if (!isMobile() || !open) return
    if (scrollRef?.current && scrollRef.current.scrollTop > 0) return
    setIsDragging(true)
    startYRef.current = clientY
  }

  const handleDragMove = (clientY: number) => {
    if (!isDragging) return
    const deltaY = clientY - startYRef.current
    if (deltaY > 0) setDragOffset(deltaY)
  }

  const handleDragEnd = () => {
    if (!isDragging) return
    setIsDragging(false)
    if (dragOffset > CLOSE_THRESHOLD_PX) onClose()
    setDragOffset(0)
  }

  // Mouse dragging (for testing on desktop) tracks the pointer outside the handle.
  useEffect(() => {
    if (!isDragging) return
    const handleMouseMove = (e: MouseEvent) => handleDragMove(e.clientY)
    const handleMouseUp = () => handleDragEnd()
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging, dragOffset])

  const dragHandleProps = {
    onTouchStart: (e: React.TouchEvent) => handleDragStart(e.touches[0].clientY),
    onTouchMove: (e: React.TouchEvent) => {
      if (!isDragging) return
      e.preventDefault() // Prevent scrolling while dragging
      handleDragMove(e.touches[0].clientY)
    },
    onTouchEnd: handleDragEnd,
    onMouseDown: (e: React.MouseEvent) => handleDragStart(e.clientY),
  }

  return {
    isHidden,
    isDragging,
    dragStyle: { transform: isDragging ? `translateY(${dragOffset}px)` : undefined },
    dragHandleProps,
  }
}

export default useMobileSheet
