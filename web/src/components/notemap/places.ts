import type { NoteLocation, SearchNote } from "@/api/search"

/** Every note with a location at one spot; one pin on the map. */
export interface NotePlace {
    key: string
    location: NoteLocation
    notes: SearchNote[]
}

/** Groups the notes' locations by coordinates (to about a metre), so a shared spot is one pin. */
export const groupPlaces = (notes: SearchNote[]): NotePlace[] => {
    const places = new Map<string, NotePlace>()
    for (const note of notes) {
        for (const loc of note.locations ?? []) {
            const key = `${loc.lat.toFixed(5)},${loc.lng.toFixed(5)}`
            const place = places.get(key)
            if (!place) places.set(key, { key, location: loc, notes: [note] })
            else if (!place.notes.includes(note)) place.notes.push(note)
        }
    }
    return [...places.values()]
}
