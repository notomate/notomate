import { ReactNode, useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { SearchNote, SearchNotesResult } from "@/api/search"
import NoteMap from "@/components/notemap/NoteMap"
import { WORLD_BBOX, type BBox } from "@/components/notemap/bbox"
import { VIEW_PAGE_SIZE } from "./note-views"

interface NoteMapViewProps {
    /** Identifies the search; the visible area is appended. */
    queryKey: unknown[]
    fetchNotes: (bbox: BBox) => Promise<SearchNotesResult>
    enabled?: boolean
    getLinkTo: (note: SearchNote) => string
    /** Floating over the top left of the map, e.g. a search box. */
    controls?: ReactNode
}

/** A full-size map of the notes' locations that searches the visible area. */
const NoteMapView = ({ queryKey, fetchNotes, enabled = true, getLinkTo, controls }: NoteMapViewProps) => {
    const { t } = useTranslation()
    const [bbox, setBBox] = useState<BBox>(WORLD_BBOX)

    const { data, isFetching } = useQuery({
        queryKey: [...queryKey, bbox],
        queryFn: () => fetchNotes(bbox),
        enabled,
        placeholderData: keepPreviousData,
        refetchOnWindowFocus: false,
    })
    const notes = data?.notes ?? []

    return (
        // `isolate` keeps Leaflet's pane z-indexes (up to 1000) and the controls
        // above them inside this box, below the app's sidebar drawer.
        <div className="relative isolate h-full w-full">
            <NoteMap notes={notes} getLinkTo={getLinkTo} onBoundsChange={setBBox} />
            {/* Above the map panes and controls (up to 1000), within the isolated box. */}
            <div className="absolute top-3 left-3 right-3 sm:right-auto sm:w-80 z-[1000] flex flex-col gap-1.5 pointer-events-none">
                {controls && <div className="pointer-events-auto">{controls}</div>}
                <div className="self-start flex items-center gap-1.5 rounded-md px-2 py-1 text-xs shadow bg-white/90 dark:bg-neutral-900/90 text-gray-700 dark:text-gray-200">
                    {isFetching && <Loader2 size={12} className="animate-spin" />}
                    {notes.length === 0
                        ? t("noteViews.noLocations")
                        : notes.length >= VIEW_PAGE_SIZE
                            ? t("noteViews.capped", { count: VIEW_PAGE_SIZE })
                            : t("noteViews.notesInView", { count: notes.length })}
                </div>
            </div>
        </div>
    )
}

export default NoteMapView
