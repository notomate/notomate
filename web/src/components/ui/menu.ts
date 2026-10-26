import { cn } from "@/lib/utils"

/*
 * Shared menu styles, mirroring the editor's block menu (packages/editor
 * `.menu` / `.menu-item` / `.block-menu.sheet`) so every menu in the app —
 * desktop dropdown or mobile bottom sheet — has the same spacing.
 */

/** Dropdown surface; callers add positioning and width. */
export const menuSurfaceClass =
  "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border dark:border-neutral-700 rounded-md shadow-lg"

/** Item list wrapper inside a dropdown or bottom sheet. */
export const menuListClass = "flex flex-col py-1.5"

/** A menu row; `sheet` gives touch-sized rows like the editor's sheet. */
export const menuItemClass = (sheet: boolean, danger = false) =>
  cn(
    "flex items-center gap-2.5 mx-1 px-2.5 py-1 rounded text-left transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800",
    sheet ? "min-h-11 text-base" : "min-h-7 text-sm",
    danger && "text-red-500",
  )

/** Fixed-size icon slot at the start of a menu row. */
export const menuIconClass = (danger = false) =>
  cn("shrink-0 grid place-items-center w-[22px] h-[22px]", !danger && "text-neutral-500 dark:text-neutral-400")
