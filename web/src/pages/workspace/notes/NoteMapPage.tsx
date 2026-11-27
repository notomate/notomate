import { useEffect, useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { Loader2, Search, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { searchNotes } from "@/api/search"
import useCurrentWorkspaceId from "@/hooks/use-currentworkspace-id"
import NoteMap from "@/components/notemap/NoteMap"
import { WORLD_BBOX, type BBox } from "@/components/notemap/bbox"

/** The most notes the search API returns at once. */
const PAGE_SIZE = 100

/** Workspace map: a full-page map of every location in the workspace's notes. */
const NoteMapPage = () => {
    const { t } = useTranslation()
    const workspaceId = useCurrentWorkspaceId()
    const [bbox, setBBox] = useState<BBox>(WORLD_BBOX)
    const [query, setQuery] = useState("")
    const [debouncedQuery, setDebouncedQuery] = useState("")

    useEffect(() => {
        const handler = setTimeout(() => setDebouncedQuery(query.trim()), 300)
        return () => clearTimeout(handler)
    }, [query])

    const { data, isFetching } = useQuery({
        queryKey: ["notes-map", workspaceId, debouncedQuery, bbox],
        queryFn: () => searchNotes(workspaceId, { query: debouncedQuery, bbox, pageNumber: 1, pageSize: PAGE_SIZE }),
        enabled: !!workspaceId,
        placeholderData: keepPreviousData,
        refetchOnWindowFocus: false,
    })
    const notes = data?.notes ?? []

    return (
        <div className="relative h-full w-full">
            <NoteMap notes={notes} workspaceId={workspaceId} onBoundsChange={setBBox} />
            {/* Above the map panes (z-index 1 container, markers at 600). */}
            <div className="absolute top-3 left-3 right-3 sm:right-auto sm:w-80 z-[1000] flex flex-col gap-1.5 pointer-events-none">
                <div className="relative pointer-events-auto">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={t("placeholder.search")}
                        className="w-full pl-9 pr-9 py-2.5 text-sm rounded-lg shadow-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 outline-none"
                    />
                    {query && (
                        <button
                            onClick={() => setQuery("")}
                            title={t("common.clear")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-red-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
                <div className="self-start flex items-center gap-1.5 rounded-md px-2 py-1 text-xs shadow bg-white/90 dark:bg-neutral-900/90 text-gray-700 dark:text-gray-200">
                    {isFetching && <Loader2 size={12} className="animate-spin" />}
                    {notes.length === 0
                        ? t("noteViews.noLocations")
                        : notes.length >= PAGE_SIZE
                            ? t("noteViews.capped", { count: PAGE_SIZE })
                            : t("noteViews.notesInView", { count: notes.length })}
                </div>
            </div>
        </div>
    )
}

export default NoteMapPage
