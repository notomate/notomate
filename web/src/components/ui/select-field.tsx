import { Select } from "radix-ui"
import { Check, ChevronDown, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { menuSurfaceClass } from "@/components/ui/menu"

export interface SelectFieldOption {
  /** Must not be empty: Radix reserves "" for clearing the selection. */
  value: string
  label: string
  icon?: LucideIcon
}

interface SelectFieldProps {
  value: string
  onChange: (value: string) => void
  options: SelectFieldOption[]
  "aria-label"?: string
  className?: string
}

/** Full-width form select; its list is portaled above modals. */
export function SelectField({ value, onChange, options, className, "aria-label": ariaLabel }: SelectFieldProps) {
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger
        aria-label={ariaLabel}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-md border bg-white px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-neutral-700 dark:bg-neutral-900",
          className,
        )}
      >
        <span className="truncate">
          <Select.Value />
        </span>
        <Select.Icon className="shrink-0 text-neutral-500 dark:text-neutral-400">
          <ChevronDown size={16} />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={4}
          className={cn(
            "z-popover w-[var(--radix-select-trigger-width)] max-h-[var(--radix-select-content-available-height)] overflow-hidden",
            menuSurfaceClass,
          )}
        >
          <Select.Viewport className="py-1.5">
            {options.map((option) => (
              <Select.Item
                key={option.value}
                value={option.value}
                className="relative mx-1 flex min-h-9 cursor-pointer select-none items-center rounded py-1 pl-2.5 pr-8 text-sm outline-none data-[highlighted]:bg-neutral-100 dark:data-[highlighted]:bg-neutral-800"
              >
                <Select.ItemText>
                  <span className="flex items-center gap-2">
                    {option.icon && <option.icon size={16} className="shrink-0" />}
                    {option.label}
                  </span>
                </Select.ItemText>
                <Select.ItemIndicator className="absolute right-2">
                  <Check size={16} />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}
