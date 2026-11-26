import { MutableRefObject, ReactNode, useState } from "react"
import { Search, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import useMediaQuery, { useIsLg } from "@/hooks/use-media-query"
import { NoteFilterButton, NoteFilterDrawer, NoteFilterPanel, NoteFilterSheet } from "./NoteFilterPanel"
import type { NoteFilters } from "./note-filters"

interface FilteredNoteListLayoutProps {
    scrollRef: MutableRefObject<HTMLDivElement | null>
    query: string
    onQueryChange: (query: string) => void
    placeholder: string
    filters: NoteFilters
    onFiltersChange: (patch: Partial<NoteFilters>) => void
    /** Resets every filter, including page-specific ones like the creator. */
    onReset: () => void
    /** Active filters, for the toggle button badge. */
    activeCount: number
    canReset: boolean
    /** Creator control rendered inside the filter panel. */
    creator?: ReactNode
    /** Tag filter control rendered inside the filter panel. */
    tags?: ReactNode
    /** Shows the block content filters, for pages backed by the search index. */
    contentFilters?: boolean
    /** Shown above the list, e.g. a notice that results may be incomplete. */
    notice?: ReactNode
    /** Shown under the search bar while the panel is closed (e.g. a clicked-creator chip). */
    chips?: ReactNode
    /** Shown above the search bar, scrolling with the list (e.g. a page heading). */
    header?: ReactNode
    children: ReactNode
}

/**
 * Search bar and note list with a toggleable filter panel, closed by default.
 * From `xl` the panel is a right column beside the list; between `lg` and `xl`
 * it is a drawer from the right; below `lg` it is a bottom sheet.
 */
export function FilteredNoteListLayout({
    scrollRef, query, onQueryChange, placeholder, filters, onFiltersChange, onReset,
    activeCount, canReset, creator, tags, contentFilters, chips, notice, header, children,
}: FilteredNoteListLayoutProps) {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)
    const isLg = useIsLg()
    const isXl = useMediaQuery("(min-width: 1280px)")

    const panel = { filters, onChange: onFiltersChange, onReset, creator, tags, contentFilters, canReset }
    const close = () => setOpen(false)
    const showColumn = open && isXl

    return (
        <div className="h-full flex bg-neutral-50 dark:bg-neutral-950">
            <div ref={scrollRef} className="flex-1 min-w-0 overflow-auto">
                <div className="w-full lg:max-w-[600px] mx-auto">
                    {header}
                    <div className="px-2 pt-2 xl:pt-4 pb-2">
                        <div className="flex items-center gap-1">
                            <div className="relative flex-1 min-w-0">
                                <Search
                                    size={16}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                                />
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(e) => onQueryChange(e.target.value)}
                                    placeholder={placeholder}
                                    className="w-full pl-9 pr-9 py-2.5 text-sm rounded-lg bg-neutral-50 dark:bg-neutral-950 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none"
                                />
                                {query && (
                                    <button
                                        onClick={() => onQueryChange("")}
                                        title={t("common.clear")}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-red-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>
                            <NoteFilterButton activeCount={activeCount} pressed={open} onClick={() => setOpen((o) => !o)} />
                        </div>
                        {chips && !showColumn && <div className="px-2 pt-2 flex flex-wrap items-center gap-1.5">{chips}</div>}
                        {notice && <div className="px-3 pt-2 text-xs text-muted-foreground">{notice}</div>}
                    </div>
                    {children}
                </div>
            </div>
            {showColumn && (
                <aside className="w-72 shrink-0 h-full overflow-y-auto border-l border-neutral-200 dark:border-neutral-800 px-4 pt-4 pb-6">
                    <NoteFilterPanel {...panel} onClose={close} />
                </aside>
            )}
            <NoteFilterDrawer open={open && isLg && !isXl} onOpenChange={setOpen} {...panel} />
            <NoteFilterSheet open={open && !isLg} onOpenChange={setOpen} {...panel} />
        </div>
    )
}
