import * as React from "react"
import { Progress as ProgressPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"

interface ProgressProps extends React.ComponentProps<typeof ProgressPrimitive.Root> {
  /** 0-100 */
  value: number
  indicatorClassName?: string
}

/** Thin horizontal progress bar. */
function Progress({ value, className, indicatorClassName, ...props }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <ProgressPrimitive.Root
      value={clamped}
      className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn("h-full w-full bg-blue-500 transition-transform duration-300 ease-out", indicatorClassName)}
        style={{ transform: `translateX(-${100 - clamped}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
