import { NodeViewProps, NodeViewWrapper } from "@tiptap/react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Map as GoogleMap, Polyline } from "@vis.gl/react-google-maps"
import { ChevronDown, ChevronUp, Loader2, Navigation, Route as RouteIcon, Trash2, X } from "lucide-react"
import { useDragMenu, NodeTouchMenu } from "@/components/editor/DragMenuContext"
import { PlaceSummary, TravelMode, computeGoogleRoute, googleMapsErrorMessage, toLatLng } from "@/api/googleMaps"
import { GoogleMapGate } from "./shared/GoogleMapGate"
import { PlaceSearchBox } from "./shared/PlaceSearchBox"
import { FitBounds, LabeledMarker, RouteSummary, StaticRouteMap } from "./shared/MapParts"
import { useNodeMove } from "./shared/useNodeMove"
import { DEFAULT_CENTER, StoredRoute, TRAVEL_MODES, Waypoint, newId, toStoredRoute, waypointColor, waypointLabel } from "./shared/types"

const GoogleDirectionsNodeComponent: React.FC<NodeViewProps> = ({ node, updateAttributes, selected, editor, deleteNode, getPos, extension }) => {
  const { t, i18n } = useTranslation()
  const workspaceId: string = extension.options.workspaceId
  const waypoints: Waypoint[] = useMemo(() => node.attrs.waypoints ?? [], [node.attrs.waypoints])
  const travelMode: TravelMode = node.attrs.travelMode ?? "DRIVE"
  const optimize: boolean = !!node.attrs.optimize
  const result: StoredRoute | null = node.attrs.result ?? null
  const editable = editor.isEditable
  const isTouchDevice = window.matchMedia("(pointer: coarse)").matches
  const { moveUp, moveDown } = useNodeMove({ editor, node, getPos })

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  // Any change to the stops or options makes the stored route stale.
  const update = (patch: Record<string, unknown>) => {
    updateAttributes({ ...patch, result: null })
    setError("")
  }

  const addWaypoint = (place: PlaceSummary) => {
    const loc = toLatLng(place.location)
    if (!loc) return
    update({
      waypoints: [...waypoints, { id: newId(), placeId: place.id, name: place.displayName?.text ?? "", address: place.formattedAddress, ...loc }],
    })
  }

  const moveWaypoint = (index: number, delta: number) => {
    const next = [...waypoints]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    update({ waypoints: next })
  }

  const compute = async () => {
    setBusy(true)
    setError("")
    try {
      const route = await computeGoogleRoute(workspaceId, {
        waypoints: waypoints.map(w => (w.placeId ? { placeId: w.placeId } : { lat: w.lat, lng: w.lng })),
        travelMode,
        optimize,
        languageCode: i18n.language,
      })
      let ordered = waypoints
      const order = route.optimizedIntermediateWaypointIndex
      if (optimize && order?.length && order[0] !== -1) {
        const middle = waypoints.slice(1, -1)
        ordered = [waypoints[0], ...order.map(i => middle[i]), waypoints[waypoints.length - 1]]
      }
      updateAttributes({ waypoints: ordered, result: toStoredRoute(route, true) })
    } catch (e) {
      setError(googleMapsErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const nodeActions = [
    { label: t("editor.moveUp"), icon: <ChevronUp size={14} />, onClick: moveUp },
    { label: t("editor.moveDown"), icon: <ChevronDown size={14} />, onClick: moveDown },
    { label: t("actions.delete"), icon: <Trash2 size={14} />, onClick: deleteNode, variant: "danger" as const },
  ]
  useDragMenu(getPos, () => nodeActions)

  const fitKey = useMemo(() => waypoints.map(w => w.id).join(",") + (result?.encodedPolyline ?? ""), [waypoints, result])
  const transitTooManyStops = travelMode === "TRANSIT" && waypoints.length > 2

  const staticMap = (
    <StaticRouteMap
      points={waypoints.map((w, i) => ({ lat: w.lat, lng: w.lng, label: waypointLabel(i), color: waypointColor(i, waypoints.length), title: w.name }))}
      encodedPolyline={result?.encodedPolyline}
      height={300}
    />
  )

  return (
    <NodeViewWrapper className="google-directions-node my-2 border dark:border-neutral-700 rounded-lg overflow-hidden bg-white dark:bg-neutral-900">
      <div className="flex items-center gap-2 px-3 py-2 border-b dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800">
        <Navigation size={15} className="text-muted-foreground shrink-0" />
        <span className="flex-1 text-sm font-medium truncate">
          {waypoints.length >= 2 ? `${waypoints[0].name} → ${waypoints[waypoints.length - 1].name}` : t("editor.GoogleDirectionsNode")}
        </span>
        {!editable && <span className="text-xs text-muted-foreground">{t(`googleMaps.travelMode.${travelMode}`)}</span>}
      </div>

      <div className="flex flex-col md:flex-row">
        <div className="w-full md:w-72 shrink-0 flex flex-col gap-2 p-3 border-b md:border-b-0 md:border-r dark:border-neutral-700">
          {editable && (
            <div className="flex flex-wrap gap-1">
              {TRAVEL_MODES.map(mode => (
                <button
                  key={mode}
                  type="button"
                  className={`px-2 py-1 text-xs rounded border ${mode === travelMode ? "bg-blue-600 border-blue-600 text-white" : "dark:border-neutral-600 hover:bg-gray-100 dark:hover:bg-neutral-800"}`}
                  onClick={() => update({ travelMode: mode, optimize: mode === "TRANSIT" ? false : optimize })}
                >
                  {t(`googleMaps.travelMode.${mode}`)}
                </button>
              ))}
            </div>
          )}

          <ol className="list-none flex flex-col gap-1">
            {waypoints.map((w, i) => (
              <li key={w.id} className="flex items-center gap-2 text-sm">
                <span className="shrink-0 w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center" style={{ background: waypointColor(i, waypoints.length) }}>
                  {waypointLabel(i)}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block truncate">{w.name}</span>
                  {w.address && <span className="block text-[11px] text-muted-foreground truncate">{w.address}</span>}
                </span>
                {editable && (
                  <>
                    <button type="button" className="p-0.5 text-muted-foreground disabled:opacity-30" disabled={i === 0} onClick={() => moveWaypoint(i, -1)} aria-label="move up"><ChevronUp size={13} /></button>
                    <button type="button" className="p-0.5 text-muted-foreground disabled:opacity-30" disabled={i === waypoints.length - 1} onClick={() => moveWaypoint(i, 1)} aria-label="move down"><ChevronDown size={13} /></button>
                    <button type="button" className="p-0.5 text-muted-foreground hover:text-red-500" onClick={() => update({ waypoints: waypoints.filter(x => x.id !== w.id) })} aria-label="remove"><X size={13} /></button>
                  </>
                )}
              </li>
            ))}
          </ol>

          {editable && (
            <>
              <PlaceSearchBox
                workspaceId={workspaceId}
                bias={waypoints.length ? waypoints[waypoints.length - 1] : null}
                placeholder={waypoints.length === 0 ? t("googleMaps.chooseStart") : t("googleMaps.addStop")}
                onSelect={addWaypoint}
              />
              <label className="inline-flex items-center gap-1.5 text-xs">
                <input type="checkbox" checked={optimize} disabled={travelMode === "TRANSIT" || waypoints.length < 4} onChange={e => update({ optimize: e.target.checked })} />
                {t("googleMaps.optimizeOrder")}
              </label>
              {transitTooManyStops && <p className="text-xs text-amber-600">{t("googleMaps.transitNoStops")}</p>}
              <button
                type="button"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                disabled={busy || waypoints.length < 2 || transitTooManyStops}
                onClick={compute}
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <RouteIcon size={14} />}
                {t("googleMaps.getDirections")}
              </button>
            </>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="flex-1 min-w-0">
          {waypoints.length === 0 ? (
            <div className="h-full min-h-[200px] flex items-center justify-center p-6 text-xs text-muted-foreground">
              {t("googleMaps.directionsEmpty")}
            </div>
          ) : (
            <GoogleMapGate workspaceId={workspaceId} fallback={staticMap}>
              {env => (
                <div className="relative h-[320px]">
                  <GoogleMap
                    mapId={env.mapId}
                    colorScheme={env.colorScheme}
                    defaultCenter={waypoints[0] ?? DEFAULT_CENTER}
                    defaultZoom={13}
                    gestureHandling="cooperative"
                    mapTypeControl={false}
                    streetViewControl={false}
                    className="absolute inset-0"
                  >
                    {waypoints.map((w, i) => (
                      <LabeledMarker key={w.id} position={w} label={waypointLabel(i)} color={waypointColor(i, waypoints.length)} title={w.name} />
                    ))}
                    {result?.encodedPolyline && (
                      <Polyline encodedPath={result.encodedPolyline} strokeColor="#4285f4" strokeOpacity={0.85} strokeWeight={5} />
                    )}
                    <FitBounds points={waypoints} fitKey={fitKey} />
                  </GoogleMap>
                </div>
              )}
            </GoogleMapGate>
          )}
        </div>
      </div>

      {result && (
        <div className="p-3 border-t dark:border-neutral-700">
          <RouteSummary route={result} stopNames={waypoints.map(w => w.name)} />
        </div>
      )}
      {isTouchDevice && editable && <NodeTouchMenu visible={selected} actions={nodeActions} />}
    </NodeViewWrapper>
  )
}

export default GoogleDirectionsNodeComponent
