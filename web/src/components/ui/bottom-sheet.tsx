import { ReactNode, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

const TRANSITION_MS = 200

export interface BottomSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
  /** Extra classes for the sheet panel (e.g. max height, flex layout). */
  className?: string
}

/**
 * Shared mobile bottom sheet. Centralizes the backdrop, panel surface, drag
 * handle and slide transition so every sheet in the app looks the same.
 */
export function BottomSheet({ open, onOpenChange, children, className }: BottomSheetProps) {
  // Stay mounted through the closing transition; `visible` drives the slide.
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      // Wait a frame so the panel starts off-screen and actually slides in.
      const frame = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(frame)
    }
    setVisible(false)
    const timer = setTimeout(() => setMounted(false), TRANSITION_MS)
    return () => clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false)
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [open, onOpenChange])

  if (!mounted) return null

  return createPortal(
    <>
      <div
        className={cn(
          "fixed inset-0 bg-black/40 dark:bg-black/70 z-drawer-backdrop transition-opacity duration-200",
          visible ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={() => onOpenChange(false)}
      />
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 rounded-t-xl pb-[calc(4px+env(safe-area-inset-bottom))] dark:ring-1 dark:ring-white/10 z-drawer shadow-xl transition-transform duration-200 ease-out",
          visible ? "translate-y-0" : "translate-y-full",
          className,
        )}
      >
        <div className="shrink-0 flex justify-center pt-2.5 pb-0.5">
          <div className="w-9 h-1 bg-neutral-300 dark:bg-neutral-600 rounded-full" />
        </div>
        {children}
      </div>
    </>,
    document.body,
  )
}
