import { getGooglePhotoUrl, type LocalizedValues, type PlaceDetails, type Route, type RouteStep, type TravelMode } from '@/api/googleMaps'

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

// The ride part of a transit step: which bus or train, and where to get on/off.
export interface StoredTransit {
  line?: string
  lineShort?: string
  color?: string
  textColor?: string
  vehicle?: string
  vehicleType?: string
  vehicleIcon?: string
  agency?: string
  headsign?: string
  departureStop?: string
  arrivalStop?: string
  departureTime?: string
  arrivalTime?: string
  stopCount?: number
  trip?: string
}

export interface StoredStep {
  instructions?: string
  distance?: string
  duration?: string
  maneuver?: string
  travelMode?: string
  transit?: StoredTransit
}

export interface StoredLeg {
  distanceMeters?: number
  duration?: string
  localizedValues?: LocalizedValues
  steps?: StoredStep[]
}

// A trimmed copy of a Routes API route, small enough to keep in node attrs.
export interface StoredRoute {
  // Position in Google's response, so alternatives keep their order.
  index?: number
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
  // The chosen route; the others Google offered are kept in alternatives.
  result: StoredRoute | null
  alternatives?: StoredRoute[] | null
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

// Stores Google's best route as the chosen one and the rest as alternatives.
export const toStoredRoutes = (routes: Route[]) => {
  const [result, ...alternatives] = routes.map((r, i) => ({ ...toStoredRoute(r, true), index: i }))
  return { result, alternatives: alternatives.length ? alternatives : null }
}

// Makes `chosen` the selected route, moving the previous one back into the
// alternatives.
export const chooseRoute = (result: StoredRoute, alternatives: StoredRoute[], chosen: StoredRoute) => ({
  result: chosen,
  alternatives: [result, ...alternatives.filter(r => r !== chosen)].sort((a, b) => (a.index ?? 0) - (b.index ?? 0)),
})

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
          .filter(s => s.navigationInstruction?.instructions || s.transitDetails)
          .map(s => ({
            instructions: s.navigationInstruction?.instructions,
            maneuver: s.navigationInstruction?.maneuver,
            distance: s.localizedValues?.distance?.text,
            duration: s.transitDetails ? s.localizedValues?.staticDuration?.text ?? formatDuration(s.staticDuration) : undefined,
            travelMode: s.travelMode,
            transit: toStoredTransit(s),
          }))
      : undefined,
  })),
})

// Google returns protocol-relative icon URLs ("//maps.gstatic.com/...").
const absoluteUrl = (uri?: string) => (uri?.startsWith('//') ? `https:${uri}` : uri)

const toStoredTransit = (step: RouteStep): StoredTransit | undefined => {
  const d = step.transitDetails
  if (!d) return undefined
  const line = d.transitLine
  return {
    line: line?.name,
    lineShort: line?.nameShort,
    color: line?.color,
    textColor: line?.textColor,
    vehicle: line?.vehicle?.name?.text,
    vehicleType: line?.vehicle?.type,
    vehicleIcon: absoluteUrl(line?.vehicle?.localIconUri ?? line?.vehicle?.iconUri),
    agency: line?.agencies?.[0]?.name,
    headsign: d.headsign,
    departureStop: d.stopDetails?.departureStop?.name,
    arrivalStop: d.stopDetails?.arrivalStop?.name,
    departureTime: d.localizedValues?.departureTime?.time?.text,
    arrivalTime: d.localizedValues?.arrivalTime?.time?.text,
    stopCount: d.stopCount,
    trip: d.tripShortText,
  }
}

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
