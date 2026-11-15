import { useMemo, useState } from "react"
import {
    CalendarDays,
    Code,
    FileText,
    Globe,
    Image,
    LayoutGrid,
    ListTodo,
    MapPin,
    Music,
    Paperclip,
    Star,
    Table,
    Tag,
    Video,
    type LucideIcon,
} from "lucide-react"

export type NoteSort = "created_at" | "updated_at"
export type DateField = "created" | "updated"
export type DatePreset = "any" | "today" | "7d" | "30d" | "year" | "custom"
export type TaskStatus = "any" | "open" | "done"

/** A filterable kind of block; one kind can cover several stored TipTap node types. */
export interface BlockKind {
    id: string
    icon: LucideIcon
    nodeTypes: string[]
}

export const BLOCK_KINDS: BlockKind[] = [
    { id: "image", icon: Image, nodeTypes: ["image", "carouselNode"] },
    { id: "video", icon: Video, nodeTypes: ["video", "youtubeEmbed", "tiktokEmbed"] },
    { id: "audio", icon: Music, nodeTypes: ["audio"] },
    { id: "attachment", icon: Paperclip, nodeTypes: ["attachment"] },
    { id: "embed", icon: Globe, nodeTypes: ["threadsEmbed", "instagramEmbed", "wikipediaNode"] },
    { id: "table", icon: Table, nodeTypes: ["table"] },
    { id: "view", icon: LayoutGrid, nodeTypes: ["viewNode"] },
    { id: "todo", icon: ListTodo, nodeTypes: ["taskList"] },
    { id: "code", icon: Code, nodeTypes: ["codeBlock"] },
    { id: "location", icon: MapPin, nodeTypes: ["locationNode", "googleMapNode", "googlePlacesNode", "googleDirectionsNode"] },
    { id: "calendar", icon: CalendarDays, nodeTypes: ["calendarNode"] },
    { id: "tags", icon: Tag, nodeTypes: ["tagsNode"] },
    { id: "rating", icon: Star, nodeTypes: ["ratingNode"] },
    { id: "subPage", icon: FileText, nodeTypes: ["subPage"] },
]

export interface NoteFilters {
    sort: NoteSort
    dateField: DateField
    datePreset: DatePreset
    /** Custom range as local `YYYY-MM-DD` dates, both inclusive. */
    customFrom: string
    customTo: string
    blockKinds: string[]
    /** Calendar block date range as `YYYY-MM-DD`, both inclusive (search only). */
    eventFrom: string
    eventTo: string
    /** To-do status (search only). */
    tasks: TaskStatus
    /** Minimum rating in stars out of 5; 0 is any (search only). */
    minRating: number
}

export const DEFAULT_NOTE_FILTERS: NoteFilters = {
    sort: "created_at",
    dateField: "created",
    datePreset: "any",
    customFrom: "",
    customTo: "",
    blockKinds: [],
    eventFrom: "",
    eventTo: "",
    tasks: "any",
    minRating: 0,
}

/** Query parameters the note list endpoints accept for these filters. */
export interface NoteFilterParams {
    sort?: NoteSort
    types?: string
    dateField?: DateField
    from?: string
    to?: string
    eventFrom?: string
    eventTo?: string
    tasks?: "open" | "done"
    minRating?: string
}

const startOfLocalDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days)
const parseLocalDate = (s: string) => {
    const [y, m, d] = s.split("-").map(Number)
    return y && m && d ? new Date(y, m - 1, d) : null
}

/** Date range as UTC instants: from inclusive, to exclusive. */
function dateRange(f: NoteFilters, now: Date): { from?: Date; to?: Date } {
    const today = startOfLocalDay(now)
    switch (f.datePreset) {
        case "today": return { from: today }
        case "7d": return { from: addDays(today, -6) }
        case "30d": return { from: addDays(today, -29) }
        case "year": return { from: new Date(today.getFullYear() - 1, today.getMonth(), today.getDate() + 1) }
        case "custom": {
            const from = parseLocalDate(f.customFrom) ?? undefined
            const toDay = parseLocalDate(f.customTo)
            return { from, to: toDay ? addDays(toDay, 1) : undefined }
        }
        default: return {}
    }
}

const isoSeconds = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z")

export function toFilterParams(f: NoteFilters, now = new Date()): NoteFilterParams {
    const params: NoteFilterParams = {}
    if (f.sort !== "created_at") params.sort = f.sort
    const types = BLOCK_KINDS.filter((k) => f.blockKinds.includes(k.id)).flatMap((k) => k.nodeTypes)
    if (types.length) params.types = types.join(",")
    const { from, to } = dateRange(f, now)
    if (from || to) {
        params.dateField = f.dateField
        if (from) params.from = isoSeconds(from)
        if (to) params.to = isoSeconds(to)
    }
    if (f.eventFrom) params.eventFrom = f.eventFrom
    if (f.eventTo) params.eventTo = f.eventTo
    if (f.tasks !== "any") params.tasks = f.tasks
    if (f.minRating > 0) params.minRating = String(f.minRating)
    return params
}

/** Number of filters that differ from the defaults (sort is not counted). */
export function countActiveFilters(f: NoteFilters): number {
    return (f.datePreset !== "any" ? 1 : 0) + f.blockKinds.length +
        (f.eventFrom || f.eventTo ? 1 : 0) + (f.tasks !== "any" ? 1 : 0) + (f.minRating > 0 ? 1 : 0)
}

export function useNoteFilters() {
    const [filters, setFilters] = useState<NoteFilters>(DEFAULT_NOTE_FILTERS)
    // Re-derived per local day so presets like "Today" roll over at midnight.
    const day = startOfLocalDay(new Date()).getTime()
    const params = useMemo(() => toFilterParams(filters, new Date(day)), [filters, day])
    const update = (patch: Partial<NoteFilters>) => setFilters((prev) => ({ ...prev, ...patch }))
    const reset = () => setFilters(DEFAULT_NOTE_FILTERS)
    return { filters, params, update, reset, activeCount: countActiveFilters(filters) }
}
