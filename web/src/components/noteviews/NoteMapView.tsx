import { ComponentProps, ReactNode, useRef, useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useLocation } from "react-router-dom"
import { Loader2, MapPin, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { NoteData } from "@/api/note"
import type { SearchNotesResult } from "@/api/search"
import NoteList from "@/components/notecard/NoteList"
import NoteMap from "@/components/notemap/NoteMap"
import type { NotePlace } from "@/components/notemap/places"
import { WORLD_BBOX, type BBox } from "@/components/notemap/bbox"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { useIsLg } from "@/hooks/use-media-query"
import { VIEW_PAGE_SIZE } from "./note-views"

interface NoteMapViewProps {
    /** Identifies the search; the visible area is appended. */
    queryKey: unknown[]
    fetchNotes: (bbox: BBox) => Promise<SearchNotesResult>
    enabled?: boolean
    getLinkTo: (note: NoteData) => string
    /** Floating over the top left of the map, e.g. a search box. */
    controls?: ReactNode
    /** Passed to the list of a clicked pin's notes. */
    listProps?: Omit<ComponentProps<typeof NoteList>, "notes" | "getLinkTo">
}

/** The notes at a clicked pin: its place, how many, and their cards. */
const PlaceNotes = ({ place, onClose, getLinkTo, listProps }: {
    place: NotePlace
    onClose: () => void
    getLinkTo: (note: NoteData) => string
    listProps?: NoteMapViewProps["listProps"]
}) => {
    const { t } = useTranslation()
    const { name, address } = place.location
    return (
        <>
            <div className="shrink-0 flex items-start gap-2 px-4 pt-2 pb-3 lg:pt-4 border-b border-neutral-200 dark:border-neutral-800">
                <MapPin size={18} className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
                <div className="flex-1 min-w-0">
                    <div className="font-medium truncate text-gray-900 dark:text-gray-100">{name || address || t("noteViews.unnamedPlace")}</div>
                    {name && address && address !== name && (
                        <div className="text-xs text-muted-foreground truncate">{address}</div>
                    )}
                    <div className="text-xs text-muted-foreground mt-0.5">{t("noteViews.notesAtPlace", { count: place.notes.length })}</div>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label={t("common.close")}
                    className="p-1 -mr-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-muted-foreground"
                >
                    <X size={18} />
                </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto py-3">
                <NoteList notes={place.notes} getLinkTo={getLinkTo} maxNodes={40} {...listProps} />
            </div>
        </>
    )
}

/**
 * A full-size map of the notes' locations that searches the visible area.
 * Clicking a pin lists its notes beside the map, or in a bottom sheet on one column.
 */
const NoteMapView = ({ queryKey, fetchNotes, enabled = true, getLinkTo, controls, listProps }: NoteMapViewProps) => {
    const { t } = useTranslation()
    const isLg = useIsLg()
    const [bbox, setBBox] = useState<BBox>(WORLD_BBOX)
    // A snapshot, so the list stays put when panning refetches the pins.
    const [selected, setSelected] = useState<NotePlace | null>(null)
    // What the sheet shows while it slides away after closing.
    const lastSelected = useRef<NotePlace | null>(null)
    if (selected) lastSelected.current = selected

    // The sheet is portaled to the body, so hide it while a note opened from it
    // covers this (still mounted) page, and bring it back on return.
    const { pathname } = useLocation()
    const [homePath] = useState(pathname)
    const onPage = pathname === homePath

    const { data, isFetching } = useQuery({
        queryKey: [...queryKey, bbox],
        queryFn: () => fetchNotes(bbox),
        enabled,
        placeholderData: keepPreviousData,
        refetchOnWindowFocus: false,
    })
    const notes = data?.notes ?? []
    const close = () => setSelected(null)

    return (
        <div className="h-full w-full flex">
            {/* `isolate` keeps Leaflet's pane z-indexes (up to 1000) and the controls
                above them inside this box, below the app's sidebar drawer. */}
            <div className="relative isolate h-full flex-1 min-w-0">
                <NoteMap notes={notes} onBoundsChange={setBBox} selectedKey={selected?.key} onSelect={setSelected} />
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
            {isLg && selected && (
                <aside className="w-96 shrink-0 h-full flex flex-col border-l border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950">
                    <PlaceNotes place={selected} onClose={close} getLinkTo={getLinkTo} listProps={listProps} />
                </aside>
            )}
            {!isLg && (
                <BottomSheet
                    open={!!selected && onPage}
                    onOpenChange={(open) => { if (!open) close() }}
                    className="max-h-[70dvh] flex flex-col bg-neutral-50 dark:bg-neutral-950"
                >
                    {lastSelected.current && <PlaceNotes place={lastSelected.current} onClose={close} getLinkTo={getLinkTo} listProps={listProps} />}
                </BottomSheet>
            )}
        </div>
    )
}

export default NoteMapView
