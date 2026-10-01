import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { AdvancedMarker, useMap } from "@vis.gl/react-google-maps"
import { MapContainer, TileLayer, Marker, Polyline as LeafletPolyline, Tooltip, ZoomControl, useMap as useLeafletMap } from "react-leaflet"
import { DivIcon, LatLngBounds } from "leaflet"
import { ChevronDown, ChevronRight } from "lucide-react"
import { LatLng } from "@/api/googleMaps"
import { StoredRoute, decodePolyline, formatDistance, formatDuration } from "./types"

// ── Live (Google) map parts ─────────────────────────────────────────────────

// A marker's icon: the place photo as a round thumbnail when there is one,
// otherwise a numbered colour badge. Used on maps and in marker lists.
export const MarkerIcon = ({
  label, color = "#ea4335", imageUrl, size = 20, imageSize = size,
}: { label?: string; color?: string; imageUrl?: string; size?: number; imageSize?: number }) => {
  const [failed, setFailed] = useState(false)
  if (imageUrl && !failed) {
    return (
      <img
        src={imageUrl}
        alt=""
        onError={() => setFailed(true)}
        className="shrink-0 rounded-full object-cover bg-gray-100 dark:bg-neutral-800"
        style={{ width: imageSize, height: imageSize, border: `2px solid ${color}` }}
      />
    )
  }
  return (
    <span
      className="shrink-0 rounded-full text-white font-bold flex items-center justify-center"
      style={{ background: color, width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.42)) }}
    >
      {label}
    </span>
  )
}

export const MarkerBadge = ({ label, color = "#ea4335", active, imageUrl }: { label?: string; color?: string; active?: boolean; imageUrl?: string }) => (
  <div
    className="rounded-full border-2 border-white shadow-md transition-transform"
    style={{ transform: active ? "scale(1.25)" : undefined }}
  >
    <MarkerIcon label={label} color={color} imageUrl={imageUrl} size={24} imageSize={36} />
  </div>
)

export const LabeledMarker = ({
  position, label, color, title, active, onClick, imageUrl,
}: { position: LatLng; label?: string; color?: string; title?: string; active?: boolean; onClick?: () => void; imageUrl?: string }) => (
  <AdvancedMarker position={position} title={title} onClick={onClick} zIndex={active ? 1000 : undefined}>
    <MarkerBadge label={label} color={color} active={active} imageUrl={imageUrl} />
  </AdvancedMarker>
)

// Fits the Google map to the given points whenever `fitKey` changes.
export const FitBounds = ({ points, fitKey }: { points: LatLng[]; fitKey: string }) => {
  const map = useMap()
  const lastKey = useRef<string | null>(null)
  useEffect(() => {
    if (!map || !points.length || lastKey.current === fitKey) return
    lastKey.current = fitKey
    if (points.length === 1) {
      map.panTo(points[0])
      if ((map.getZoom() ?? 0) < 14) map.setZoom(15)
      return
    }
    const bounds = new google.maps.LatLngBounds()
    points.forEach(p => bounds.extend(p))
    map.fitBounds(bounds, 48)
  }, [map, points, fitKey])
  return null
}

// Pans to `target` each time `trigger` changes.
export const PanTo = ({ target, trigger }: { target: LatLng | null; trigger: number }) => {
  const map = useMap()
  const lastTrigger = useRef(trigger)
  useEffect(() => {
    if (!map || !target || trigger === lastTrigger.current) return
    lastTrigger.current = trigger
    map.panTo(target)
    if ((map.getZoom() ?? 0) < 14) map.setZoom(15)
  }, [map, target, trigger])
  return null
}

// ── Route summary (shared by live and read-only views) ──────────────────────

export const RouteSummary = ({ route, stopNames }: { route: StoredRoute; stopNames: string[] }) => {
  const { t } = useTranslation()
  const [openLeg, setOpenLeg] = useState<number | null>(null)
  const total = route.localizedValues?.distance?.text ?? formatDistance(route.distanceMeters)
  const duration = route.localizedValues?.duration?.text ?? formatDuration(route.duration)

  return (
    <div className="flex flex-col gap-1.5 text-xs">
      <div className="flex items-baseline gap-2">
        <span className="text-base font-semibold text-gray-900 dark:text-gray-100">{duration}</span>
        <span className="text-muted-foreground">{total}</span>
      </div>
      {route.legs.map((leg, i) => {
        const hasSteps = !!leg.steps?.length
        const open = openLeg === i
        return (
          <div key={i} className="border-t dark:border-neutral-700 pt-1.5">
            <button
              type="button"
              className="w-full flex items-center gap-1.5 text-left disabled:cursor-default"
              disabled={!hasSteps}
              onClick={() => setOpenLeg(open ? null : i)}
            >
              {hasSteps ? (open ? <ChevronDown size={12} /> : <ChevronRight size={12} />) : <span className="w-3" />}
              <span className="truncate flex-1">
                {stopNames[i] ?? "?"} → {stopNames[i + 1] ?? "?"}
              </span>
              <span className="shrink-0 text-muted-foreground">
                {leg.localizedValues?.duration?.text ?? formatDuration(leg.duration)} · {leg.localizedValues?.distance?.text ?? formatDistance(leg.distanceMeters)}
              </span>
            </button>
            {open && (
              <ol className="list-none mt-1 ml-4 flex flex-col gap-1 text-gray-700 dark:text-gray-300">
                {leg.steps!.map((s, j) => (
                  <li key={j}>
                    {s.instructions}
                    {s.distance && <span className="text-muted-foreground"> · {s.distance}</span>}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )
      })}
      {route.warnings?.map(w => <p key={w} className="text-amber-600">{w}</p>)}
      <span className="text-[10px] text-muted-foreground">{t("googleMaps.attribution")}</span>
    </div>
  )
}

// ── Read-only Leaflet map, used where the Google key must not be exposed ────

export interface StaticPoint extends LatLng {
  label?: string
  color?: string
  title?: string
  imageUrl?: string
}

const escapeHtml = (v: string) => v.replace(/[<>&"']/g, c => `&#${c.charCodeAt(0)};`)

const badgeIcon = (label = "", color = "#ea4335", active = false, imageUrl?: string) => {
  const size = imageUrl ? (active ? 46 : 38) : active ? 30 : 24
  const ring = `border:2px solid white;box-shadow:0 0 0 2px ${color},0 1px ${active ? 6 : 3}px rgba(0,0,0,.45)`
  // The badge colour shows through if the thumbnail fails to load.
  const inner = imageUrl
    ? `<img src="${escapeHtml(imageUrl)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:9999px" onerror="this.remove()">`
    : escapeHtml(label)
  return new DivIcon({
    className: "",
    html: `<div style="background:${color};width:${size}px;height:${size}px;border-radius:9999px;overflow:hidden;${ring};color:white;font:bold 11px sans-serif;display:flex;align-items:center;justify-content:center">${inner}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

const LeafletFit = ({ bounds }: { bounds: LatLngBounds | null }) => {
  const map = useLeafletMap()
  useEffect(() => {
    if (bounds?.isValid()) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 16 })
  }, [map, bounds])
  return null
}

// Leaflet only re-measures on window resize; also follow container size
// changes (fullscreen, sidebar layout).
const LeafletAutoResize = () => {
  const map = useLeafletMap()
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map])
  return null
}

// Pans to `target` each time `trigger` changes.
const LeafletPanTo = ({ target, trigger }: { target: LatLng | null; trigger: number }) => {
  const map = useLeafletMap()
  const lastTrigger = useRef(trigger)
  useEffect(() => {
    if (!target || trigger === lastTrigger.current) return
    lastTrigger.current = trigger
    map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 15), { duration: 0.6 })
  }, [map, target, trigger])
  return null
}

interface StaticRouteMapProps {
  points: StaticPoint[]
  encodedPolyline?: string
  // Pixel height, or any CSS height such as "100%".
  height?: number | string
  // Rounded border around the map; off when it sits inside another frame.
  framed?: boolean
  activeIndex?: number | null
  onPointClick?: (index: number) => void
  panTarget?: LatLng | null
  panTrigger?: number
  zoomPosition?: "topleft" | "topright" | "bottomleft" | "bottomright"
}

export const StaticRouteMap = ({
  points, encodedPolyline, height = 260, framed = true, activeIndex, onPointClick, panTarget = null, panTrigger = 0, zoomPosition = "topleft",
}: StaticRouteMapProps) => {
  const path = useMemo(() => (encodedPolyline ? decodePolyline(encodedPolyline) : []), [encodedPolyline])
  const bounds = useMemo(() => {
    const all: [number, number][] = [...points.map(p => [p.lat, p.lng] as [number, number]), ...path]
    return all.length ? new LatLngBounds(all) : null
  }, [points, path])

  if (!bounds) return null
  return (
    <div style={{ height }} className={`w-full overflow-hidden ${framed ? "rounded-md border dark:border-neutral-700" : ""}`}>
      <MapContainer center={bounds.getCenter()} zoom={13} className="h-full w-full" scrollWheelZoom={false} attributionControl={false} zoomControl={false}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <ZoomControl position={zoomPosition} />
        <LeafletFit bounds={bounds} />
        <LeafletAutoResize />
        <LeafletPanTo target={panTarget} trigger={panTrigger} />
        {path.length > 0 && <LeafletPolyline positions={path} pathOptions={{ color: "#4285f4", weight: 5, opacity: 0.85 }} />}
        {points.map((p, i) => (
          <Marker
            key={i}
            position={[p.lat, p.lng]}
            icon={badgeIcon(p.label, p.color, i === activeIndex, p.imageUrl)}
            zIndexOffset={i === activeIndex ? 1000 : 0}
            eventHandlers={onPointClick ? { click: () => onPointClick(i) } : undefined}
          >
            {p.title && <Tooltip>{p.title}</Tooltip>}
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
