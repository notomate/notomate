import { getGooglePhotoUrl, type LocalizedValues, type PlaceDetails, type Route, type TravelMode } from '@/api/googleMaps'

export interface MapMarker {
  id: string
  placeId?: string
  lat: number
  lng: number
  name: string
  address?: string
  note?: string
  color?: string
  // Snapshot of the place's details, so read-only pages can show them.
  details?: PlaceDetails
}

export interface StoredLeg {
  distanceMeters?: number
  duration?: string
  localizedValues?: LocalizedValues
  steps?: { instructions?: string; distance?: string; maneuver?: string }[]
}

// A trimmed copy of a Routes API route, small enough to keep in node attrs.
export interface StoredRoute {
  distanceMeters?: number
  duration?: string
  localizedValues?: LocalizedValues
  encodedPolyline?: string
  legs: StoredLeg[]
  warnings?: string[]
  computedAt: string
}

export interface MapRoute {
  markerIds: string[]
  travelMode: TravelMode
  optimize: boolean
  result: StoredRoute | null
}

export interface Waypoint {
  id: string
  placeId?: string
  name: string
  address?: string
  lat: number
  lng: number
}

export const MARKER_COLORS = ['#ea4335', '#4285f4', '#34a853', '#fbbc04', '#a142f4', '#ff6d01']

export const TRAVEL_MODES: TravelMode[] = ['DRIVE', 'WALK', 'BICYCLE', 'TWO_WHEELER', 'TRANSIT']

export const DEFAULT_CENTER = { lat: 25.033, lng: 121.5654 }

export const MAX_PHOTOS = 10

export const newId = () => Math.random().toString(36).slice(2, 10)

// Keeps the parts of place details a note needs, bounding the node size.
// Cached details fetched before reviews were dropped may still carry them.
export const trimPlace = (p: PlaceDetails): PlaceDetails => {
  const { reviews, ...rest } = p as PlaceDetails & { reviews?: unknown }
  void reviews
  return { ...rest, photos: p.photos?.slice(0, MAX_PHOTOS) }
}

export const toStoredRoute = (route: Route, withSteps: boolean): StoredRoute => ({
  distanceMeters: route.distanceMeters,
  duration: route.duration,
  localizedValues: route.localizedValues,
  encodedPolyline: route.polyline?.encodedPolyline,
  warnings: route.warnings,
  computedAt: new Date().toISOString(),
  legs: (route.legs ?? []).map(leg => ({
    distanceMeters: leg.distanceMeters,
    duration: leg.duration,
    localizedValues: leg.localizedValues,
    steps: withSteps
      ? (leg.steps ?? [])
          .filter(s => s.navigationInstruction?.instructions)
          .map(s => ({
            instructions: s.navigationInstruction?.instructions,
            maneuver: s.navigationInstruction?.maneuver,
            distance: s.localizedValues?.distance?.text,
          }))
      : undefined,
  })),
})

// "1234s" -> "20 min"
export const formatDuration = (duration?: string): string => {
  const seconds = parseInt(duration ?? '', 10)
  if (!Number.isFinite(seconds)) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return h > 0 ? `${h} h ${m} min` : `${m} min`
}

export const formatDistance = (meters?: number): string => {
  if (meters == null) return ''
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`
}

// Decodes Google's encoded polyline format into [lat, lng] pairs.
export const decodePolyline = (encoded: string): [number, number][] => {
  const points: [number, number][] = []
  let index = 0
  let lat = 0
  let lng = 0
  while (index < encoded.length) {
    for (const axis of [0, 1]) {
      let result = 0
      let shift = 0
      let b: number
      do {
        b = encoded.charCodeAt(index++) - 63
        result |= (b & 0x1f) << shift
        shift += 5
      } while (b >= 0x20 && index < encoded.length)
      const delta = result & 1 ? ~(result >> 1) : result >> 1
      if (axis === 0) lat += delta
      else lng += delta
    }
    points.push([lat / 1e5, lng / 1e5])
  }
  return points
}

export const waypointLabel = (i: number) => String.fromCharCode(65 + (i % 26))

// Start green, end red, stops in between blue - like Google Maps.
export const waypointColor = (i: number, count: number) =>
  i === 0 ? '#34a853' : i === count - 1 ? '#ea4335' : '#4285f4'

// Thumbnail for a place marker: its first stored photo, if any.
export const placeThumbnailUrl = (workspaceId: string | undefined, place?: PlaceDetails) => {
  const photo = place?.photos?.[0]
  return workspaceId && photo ? getGooglePhotoUrl(workspaceId, photo.name, 200) : undefined
}
