import { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { ChevronDown, ChevronUp, MapPin } from "lucide-react"
import type { MapMarker, Waypoint } from "./types"

// Google Maps nodes start as a short summary; clicking it (or editing the
// node) switches to the full map view.

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
      className="flex flex-col gap-2 cursor-pointer"
      onClick={onExpand}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onExpand() } }}
      title={t("actions.expand")}
    >
      {children}
    </div>
  )
}

// Unframed (collapsed) nodes show just the summary,
// with no outer box or header.
export const frameClass = (framed: boolean) =>
  framed ? "border dark:border-neutral-700 rounded-lg overflow-hidden bg-white dark:bg-neutral-900" : ""

// The read-only frame (rendered pages): header plus summary or full view.
export const CompactFrame = ({ icon, title, expanded, onToggle, framed = true, children }: {
  icon: ReactNode
  title: string
  expanded: boolean
  onToggle: () => void
  framed?: boolean
  children: ReactNode
}) => (
  <div className={frameClass(framed)}>
    {framed && (
      <div className="flex items-center gap-2 px-3 py-2 border-b dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800">
        <span className="text-muted-foreground shrink-0">{icon}</span>
        <span className="flex-1 text-sm font-medium truncate">{title}</span>
        <ExpandToggle expanded={expanded} onToggle={onToggle} />
      </div>
    )}
    {children}
  </div>
)

// All Google Maps summaries show only a pin and the place name.
const PlaceNames = ({ places, emptyText }: {
  places: { id: string; name: string }[]
  emptyText: string
}) => {
  const { t } = useTranslation()
  if (!places.length) return <p className="text-xs text-muted-foreground">{emptyText}</p>
  const names = places.slice(0, 2).map(place => place.name).join(t("googleMaps.summarySeparator"))
  const summary = places.length > 2
    ? t("googleMaps.summaryMore", { names, count: places.length - 2 })
    : names
  return (
    <div className="flex items-center gap-2 min-w-0">
      <MapPin size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 text-sm font-semibold text-muted-foreground truncate">{summary}</span>
    </div>
  )
}

export const MarkersSummary = ({ markers, emptyText }: {
  markers: MapMarker[]
  emptyText: string
}) => (
  <PlaceNames
    places={markers.map(marker => ({ id: marker.id, name: marker.details?.displayName?.text ?? marker.name }))}
    emptyText={emptyText}
  />
)

export const DirectionsSummary = ({ waypoints, emptyText }: {
  waypoints: Waypoint[]
  emptyText: string
}) => <PlaceNames places={waypoints} emptyText={emptyText} />
