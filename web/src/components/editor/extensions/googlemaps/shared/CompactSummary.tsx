import { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { ChevronDown, ChevronUp, Navigation } from "lucide-react"
import type { TravelMode } from "@/api/googleMaps"
import { MarkerIcon } from "./MapParts"
import { RatingStars } from "./PlaceDetailView"
import { MapMarker, StoredRoute, Waypoint, formatDistance, formatDuration, placeThumbnailUrl, waypointColor, waypointLabel } from "./types"

// Google Maps nodes start as a short summary; clicking it (or editing the
// node) switches to the full map view.

const MAX_ITEMS = 3

export const ExpandToggle = ({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) => {
  const { t } = useTranslation()
  const label = expanded ? t("actions.collapse") : t("actions.expand")
  return (
    <button
      type="button"
      className="p-1 rounded text-muted-foreground hover:bg-gray-200 dark:hover:bg-neutral-700 shrink-0"
      onClick={onToggle}
      title={label}
      aria-label={label}
      aria-expanded={expanded}
    >
      {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
    </button>
  )
}

// The clickable summary body shown while a node is collapsed.
export const CompactBody = ({ onExpand, children }: { onExpand: () => void; children: ReactNode }) => {
  const { t } = useTranslation()
  return (
    <div
      role="button"
      tabIndex={0}
      className="flex flex-col gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-800/60"
      onClick={onExpand}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onExpand() } }}
      title={t("actions.expand")}
    >
      {children}
    </div>
  )
}

// The read-only frame (rendered pages): header plus summary or full view.
export const CompactFrame = ({ icon, title, expanded, onToggle, children }: {
  icon: ReactNode
  title: string
  expanded: boolean
  onToggle: () => void
  children: ReactNode
}) => (
  <div className="border dark:border-neutral-700 rounded-lg overflow-hidden bg-white dark:bg-neutral-900">
    <div className="flex items-center gap-2 px-3 py-2 border-b dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className="flex-1 text-sm font-medium truncate">{title}</span>
      <ExpandToggle expanded={expanded} onToggle={onToggle} />
    </div>
    {children}
  </div>
)

const RouteLine = ({ route, travelMode }: { route: StoredRoute; travelMode?: TravelMode }) => {
  const { t } = useTranslation()
  const duration = route.localizedValues?.duration?.text ?? formatDuration(route.duration)
  const distance = route.localizedValues?.distance?.text ?? formatDistance(route.distanceMeters)
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Navigation size={12} className="shrink-0" />
      <span className="font-semibold text-gray-900 dark:text-gray-100">{duration}</span>
      {distance && <span>· {distance}</span>}
      {travelMode && <span>· {t(`googleMaps.travelMode.${travelMode}`)}</span>}
    </div>
  )
}

const MoreCount = ({ count }: { count: number }) =>
  count > 0 ? <span className="text-xs text-muted-foreground">+{count}</span> : null

// Google Map and Google Places nodes: the first few markers and the route.
export const MarkersSummary = ({ markers, workspaceId, route, travelMode, emptyText }: {
  markers: MapMarker[]
  workspaceId?: string
  route?: StoredRoute | null
  travelMode?: TravelMode
  emptyText: string
}) => {
  if (!markers.length) return <p className="text-xs text-muted-foreground">{emptyText}</p>
  return (
    <>
      <ul className="list-none flex flex-col gap-1.5">
        {markers.slice(0, MAX_ITEMS).map((m, i) => (
          <li key={m.id} className="flex items-center gap-2 min-w-0">
            <MarkerIcon label={String(i + 1)} color={m.color} imageUrl={placeThumbnailUrl(workspaceId, m.details)} size={20} imageSize={32} />
            <span className="flex-1 min-w-0">
              <span className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium truncate">{m.details?.displayName?.text ?? m.name}</span>
                {m.details?.rating != null && <RatingStars rating={m.details.rating} count={m.details.userRatingCount} />}
              </span>
              {(m.details?.formattedAddress ?? m.address) && (
                <span className="block text-xs text-muted-foreground truncate">{m.details?.formattedAddress ?? m.address}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <MoreCount count={markers.length - MAX_ITEMS} />
      {route && <RouteLine route={route} travelMode={travelMode} />}
    </>
  )
}

// Google Directions node: the stops in order and the route totals.
export const DirectionsSummary = ({ waypoints, result, travelMode, emptyText }: {
  waypoints: Waypoint[]
  result: StoredRoute | null
  travelMode?: TravelMode
  emptyText: string
}) => {
  if (!waypoints.length) return <p className="text-xs text-muted-foreground">{emptyText}</p>
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm min-w-0">
        {waypoints.map((w, i) => (
          <span key={w.id} className="inline-flex items-center gap-1 min-w-0">
            {i > 0 && <span className="text-muted-foreground">→</span>}
            <span
              className="shrink-0 w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center"
              style={{ background: waypointColor(i, waypoints.length) }}
            >
              {waypointLabel(i)}
            </span>
            <span className="truncate max-w-[12rem]">{w.name}</span>
          </span>
        ))}
      </div>
      {result && <RouteLine route={result} travelMode={travelMode} />}
    </>
  )
}
