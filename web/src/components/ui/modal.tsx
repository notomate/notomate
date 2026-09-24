import { Dialog } from "radix-ui"
import { X } from "lucide-react"
import { ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: ReactNode
  children: ReactNode
  /** Extra classes for the content box (e.g. to override max-width). */
  className?: string
  /** Render a close (X) button next to the title. */
  showClose?: boolean
  /** Bump the z-index when this modal is stacked on top of another modal. */
  nested?: boolean
}

/**
 * Shared modal shell built on Radix Dialog. Centralizes the overlay, content
 * box, and title styling so every dialog in the app looks and layers the same.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  children,
  className,
  showClose = false,
  nested = false,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn("fixed inset-0 bg-black/50", nested ? "z-[1002]" : "z-[1000]")}
        />
        <Dialog.Content
          className={cn(
            "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-neutral-800 rounded-xl shadow-xl p-6 w-[90vw] max-w-[500px]",
            nested ? "z-[1003]" : "z-[1001]",
            className,
          )}
        >
          {(title || showClose) && (
            <div className="flex items-center justify-between mb-4">
              {title ? (
                <Dialog.Title className="text-xl font-semibold">{title}</Dialog.Title>
              ) : (
                <Dialog.Title className="sr-only">Dialog</Dialog.Title>
              )}
              {showClose && (
                <Dialog.Close asChild>
                  <button
                    aria-label="close"
                    className="p-1 rounded-md text-muted-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    <X size={20} />
                  </button>
                </Dialog.Close>
              )}
            </div>
          )}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
