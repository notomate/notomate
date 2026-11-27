import type { LatLngBounds } from "leaflet"

export type BBox = [number, number, number, number]

/** The whole world, used until the map has a viewport of its own. */
export const WORLD_BBOX: BBox = [-180, -90, 180, 90]

const wrapLng = (lng: number) => ((((lng + 180) % 360) + 360) % 360) - 180

/** Leaflet bounds as the search API's bbox; a box across the antimeridian keeps minLng > maxLng. */
export function toBBox(b: LatLngBounds): BBox {
    const south = Math.max(-90, b.getSouth())
    const north = Math.min(90, b.getNorth())
    if (b.getEast() - b.getWest() >= 360) return [-180, south, 180, north]
    return [wrapLng(b.getWest()), south, wrapLng(b.getEast()), north]
}
