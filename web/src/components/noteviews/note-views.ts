/** The most notes the search API returns at once. */
export const VIEW_PAGE_SIZE = 100

export type NoteView = "list" | "calendar" | "map"

export const parseNoteView = (v: string | null): NoteView => (v === "calendar" || v === "map" ? v : "list")
