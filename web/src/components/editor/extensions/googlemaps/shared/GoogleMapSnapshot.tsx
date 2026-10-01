import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { ChevronLeft, List, Map as MapIcon, Maximize2, Minimize2, X } from "lucide-react"
import { MapMarker, MapRoute, placeThumbnailUrl } from "./types"
import { MarkerIcon, RouteSummary, StaticRouteMap } from "./MapParts"
import { PlaceDetailView, RatingStars } from "./PlaceDetailView"

interface Props {
  title?: string
  markers: MapMarker[]
  route: MapRoute | null
  workspaceId?: string
  // Inside a node that already has its own frame and header.
  embedded?: boolean
}

type Panel = { kind: "list" } | { kind: "marker"; id: string } | null

// Uses the Fullscreen API where available, otherwise a fixed overlay
// (e.g. iPhone Safari, which only allows fullscreen video).
const useFullscreen = () => {
  const ref = useRef<HTMLDivElement>(null)
  const [native, setNative] = useState(false)
  const [overlay, setOverlay] = useState(false)

  useEffect(() => {
    const onChange = () => setNative(!!ref.current && document.fullscreenElement === ref.current)
    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [])

  useEffect(() => {
    if (!overlay) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOverlay(false) }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [overlay])

  const toggle = useCallback(() => {
    const el = ref.current
    if (!el) return
    if (native) {
      document.exitFullscreen?.()
    } else if (overlay) {
      setOverlay(false)
    } else if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => setOverlay(true))
    } else {
      setOverlay(true)
    }
  }, [native, overlay])

  return { ref, isFullscreen: native || overlay, overlay, toggle }
}

const overlayButton = "p-1.5 rounded bg-white/95 dark:bg-neutral-800/95 shadow text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-neutral-700"

// Read-only Google Map node: the stored markers and route drawn on Leaflet
// (no Google key needed). The map always keeps its full size; place details
// and the marker list open in a panel floating over it.
export const GoogleMapSnapshot = ({ title, markers, route, workspaceId, embedded }: Props) => {
  const { t } = useTranslation()
  const { ref, isFullscreen, overlay, toggle } = useFullscreen()
  const [panel, setPanel] = useState<Panel>(null)
  const [panTarget, setPanTarget] = useState<{ lat: number; lng: number } | null>(null)
  const [panTrigger, setPanTrigger] = useState(0)

  if (!markers.length) return null

  const stops = (route?.markerIds ?? []).map(id => markers.find(m => m.id === id)).filter((m): m is MapMarker => !!m)
  const selectedIndex = panel?.kind === "marker" ? markers.findIndex(m => m.id === panel.id) : -1
  const selected = selectedIndex >= 0 ? markers[selectedIndex] : null

  const selectFromList = (m: MapMarker) => {
    setPanel({ kind: "marker", id: m.id })
    setPanTarget({ lat: m.lat, lng: m.lng })
    setPanTrigger(n => n + 1)
  }

  const fullscreenLabel = isFullscreen ? t("googleMaps.exitFullscreen") : t("googleMaps.fullscreen")

  return (
    <div
      ref={ref}
      className={`flex flex-col bg-white dark:bg-neutral-900 overflow-hidden ${
        overlay ? "fixed inset-0 z-[2000]" : isFullscreen || embedded ? "" : "border dark:border-neutral-700 rounded-lg"
      }`}
    >
      {(!embedded || isFullscreen) && (
        <div className="flex items-center gap-2 px-3 py-2 border-b dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800">
          <MapIcon size={15} className="text-muted-foreground shrink-0" />
          <span className="flex-1 text-sm font-medium truncate">{title || t("editor.GoogleMapNode")}</span>
        </div>
      )}

      <div className={`relative ${isFullscreen ? "flex-1 min-h-0" : "h-[420px]"}`}>
        <StaticRouteMap
          points={markers.map((m, i) => ({
            lat: m.lat, lng: m.lng, label: String(i + 1), color: m.color, title: m.name,
            imageUrl: placeThumbnailUrl(workspaceId, m.details),
          }))}
          encodedPolyline={route?.result?.encodedPolyline}
          height="100%"
          framed={false}
          activeIndex={selectedIndex >= 0 ? selectedIndex : null}
          onPointClick={i => setPanel({ kind: "marker", id: markers[i].id })}
          panTarget={panTarget}
          panTrigger={panTrigger}
          zoomPosition="bottomright"
        />

        <div className="absolute right-2 top-2 z-[1001] flex gap-1.5">
          <button
            type="button"
            className={overlayButton}
            onClick={() => setPanel(p => (p?.kind === "list" ? null : { kind: "list" }))}
            title={t("googleMaps.markers")}
            aria-label={t("googleMaps.markers")}
          >
            <List size={14} />
          </button>
          <button type="button" className={overlayButton} onClick={toggle} title={fullscreenLabel} aria-label={fullscreenLabel}>
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>

        {panel && (
          // Floats over the map: bottom sheet on narrow screens, left panel otherwise.
          <div className="absolute z-[1001] inset-x-2 bottom-2 max-h-[65%] md:inset-x-auto md:left-2 md:top-2 md:bottom-2 md:max-h-none md:w-80 flex flex-col rounded-lg shadow-lg bg-white dark:bg-neutral-900 border dark:border-neutral-700 overflow-hidden">
            <div className="flex items-center gap-1 px-2 py-1.5 border-b dark:border-neutral-700">
              {panel.kind === "marker" && (
                <button
                  type="button"
                  className="inline-flex items-center gap-0.5 text-xs text-blue-600 hover:underline"
                  onClick={() => setPanel({ kind: "list" })}
                >
                  <ChevronLeft size={13} />{t("googleMaps.allMarkers")}
                </button>
              )}
              {panel.kind === "list" && (
                <span className="text-xs font-semibold text-muted-foreground px-1">
                  {t("googleMaps.markers")} ({markers.length})
                </span>
              )}
              <button
                type="button"
                className="ml-auto p-1 rounded text-muted-foreground hover:bg-gray-100 dark:hover:bg-neutral-800"
                onClick={() => setPanel(null)}
                aria-label="close"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              {selected ? (
                <div className="flex items-start gap-2 p-3">
                  <MarkerIcon label={String(selectedIndex + 1)} color={selected.color} imageUrl={placeThumbnailUrl(workspaceId, selected.details)} size={20} imageSize={40} />
                  <div className="flex-1 min-w-0 flex flex-col gap-2">
                    {selected.note && <p className="text-sm whitespace-pre-line">{selected.note}</p>}
                    {selected.details ? (
                      <PlaceDetailView place={selected.details} workspaceId={workspaceId} openHours={false} openReviews={false} />
                    ) : (
                      <div>
                        <div className="text-sm font-medium">{selected.name}</div>
                        {selected.address && <div className="text-xs text-muted-foreground">{selected.address}</div>}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {route?.result && (
                    <div className="p-3 border-b dark:border-neutral-700">
                      <RouteSummary route={route.result} stopNames={stops.map(m => m.name)} />
                    </div>
                  )}
                  <ol className="list-none">
                    {markers.map((m, i) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-neutral-800 border-b last:border-b-0 dark:border-neutral-800"
                          onClick={() => selectFromList(m)}
                        >
                          <MarkerIcon label={String(i + 1)} color={m.color} imageUrl={placeThumbnailUrl(workspaceId, m.details)} size={20} imageSize={40} />
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-medium truncate">{m.details?.displayName?.text ?? m.name}</span>
                            {m.details?.rating != null && <RatingStars rating={m.details.rating} count={m.details.userRatingCount} />}
                            {(m.details?.formattedAddress ?? m.address) && (
                              <span className="block text-xs text-muted-foreground truncate">{m.details?.formattedAddress ?? m.address}</span>
                            )}
                            {m.note && <span className="block text-xs text-gray-700 dark:text-gray-300 truncate">{m.note}</span>}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
