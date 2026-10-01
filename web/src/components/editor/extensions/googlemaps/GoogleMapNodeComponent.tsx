import { NodeViewProps, NodeViewWrapper } from "@tiptap/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Map as GoogleMap, MapMouseEvent, MapCameraChangedEvent, Polyline } from "@vis.gl/react-google-maps"
import { ChevronDown, ChevronUp, Loader2, Map as MapIcon, MapPinPlus, MapPinX, Palette, Route as RouteIcon, Trash2, X } from "lucide-react"
import { useDragMenu, NodeTouchMenu } from "@/components/editor/DragMenuContext"
import { PlaceDetails, PlaceSummary, TravelMode, computeGoogleRoute, googleMapsErrorMessage, toLatLng } from "@/api/googleMaps"
import { GoogleMapGate, GoogleMapEnv } from "./shared/GoogleMapGate"
import { PlaceSearchBox } from "./shared/PlaceSearchBox"
import { PlaceDetailPanel } from "./shared/PlaceDetailView"
import { LabeledMarker, MarkerIcon, PanTo, RouteSummary } from "./shared/MapParts"
import { useNodeMove } from "./shared/useNodeMove"
import { DEFAULT_CENTER, MARKER_COLORS, MapMarker, MapRoute, TRAVEL_MODES, newId, placeThumbnailUrl, toStoredRoute, trimPlace } from "./shared/types"
import { GoogleMapSnapshot } from "./shared/GoogleMapSnapshot"

type Tab = "markers" | "route"

const emptyRoute: MapRoute = { markerIds: [], travelMode: "DRIVE", optimize: false, result: null }

interface EditorProps {
  env: GoogleMapEnv
  workspaceId: string
  editable: boolean
  markers: MapMarker[]
  route: MapRoute | null
  center: { lat: number; lng: number }
  zoom: number
  updateAttributes: NodeViewProps["updateAttributes"]
}

const GoogleMapEditor = ({ env, workspaceId, editable, markers, route, center, zoom, updateAttributes }: EditorProps) => {
  const { t, i18n } = useTranslation()
  const [tab, setTab] = useState<Tab>("markers")
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null)
  const [previewLocation, setPreviewLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [panTarget, setPanTarget] = useState<{ lat: number; lng: number } | null>(null)
  const [panTrigger, setPanTrigger] = useState(0)
  const [liveCenter, setLiveCenter] = useState(center)
  const [routeBusy, setRouteBusy] = useState(false)
  const [routeError, setRouteError] = useState("")
  const cameraDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (cameraDebounce.current) clearTimeout(cameraDebounce.current) }, [])

  const r = route ?? emptyRoute
  const markerById = useMemo(() => new Map(markers.map(m => [m.id, m])), [markers])

  const panTo = (loc: { lat: number; lng: number }) => {
    setPanTarget(loc)
    setPanTrigger(n => n + 1)
  }

  // Persist the camera after the user stops moving the map. The map itself is
  // uncontrolled, so this never fights the user's own panning.
  const handleCameraChanged = useCallback((e: MapCameraChangedEvent) => {
    setLiveCenter(e.detail.center)
    if (!editable) return
    if (cameraDebounce.current) clearTimeout(cameraDebounce.current)
    const { center: c, zoom: z } = e.detail
    cameraDebounce.current = setTimeout(() => updateAttributes({ center: c, zoom: z }), 1000)
  }, [editable, updateAttributes])

  const handleMapClick = (e: MapMouseEvent) => {
    if (e.detail.placeId) {
      // Show our own panel instead of Google's default info window.
      e.stop()
      setSelectedPlaceId(e.detail.placeId)
      setSelectedMarkerId(null)
      setPreviewLocation(e.detail.latLng)
      return
    }
    setSelectedPlaceId(null)
    setSelectedMarkerId(null)
    setPreviewLocation(null)
  }

  // Right-click drops a custom pin.
  const handleContextMenu = (e: MapMouseEvent) => {
    if (!editable || !e.detail.latLng) return
    const marker: MapMarker = {
      id: newId(),
      lat: e.detail.latLng.lat,
      lng: e.detail.latLng.lng,
      name: t("googleMaps.droppedPin"),
      color: MARKER_COLORS[markers.length % MARKER_COLORS.length],
    }
    updateAttributes({ markers: [...markers, marker] })
    setSelectedMarkerId(marker.id)
  }

  const handleSearchSelect = (place: PlaceSummary) => {
    const loc = toLatLng(place.location)
    setSelectedPlaceId(place.id)
    setSelectedMarkerId(null)
    setPreviewLocation(loc)
    if (loc) panTo(loc)
  }

  const markerForPlace = (placeId: string) => markers.find(m => m.placeId === placeId)

  const buildMarker = (place: PlaceDetails): MapMarker | null => {
    const loc = toLatLng(place.location)
    if (!loc) return null
    return {
      id: newId(),
      placeId: place.id,
      ...loc,
      name: place.displayName?.text ?? "",
      address: place.formattedAddress,
      color: MARKER_COLORS[markers.length % MARKER_COLORS.length],
      details: trimPlace(place),
    }
  }

  // Markers added before details were stored (or with details from another
  // place) pick up a snapshot when their details are viewed.
  const backfillDetails = (place: PlaceDetails) => {
    if (!editable) return
    const marker = markerForPlace(place.id)
    if (!marker || marker.details?.id === place.id) return
    updateMarker(marker.id, { details: trimPlace(place) })
  }

  const addMarker = (place: PlaceDetails) => {
    if (markerForPlace(place.id)) return
    const marker = buildMarker(place)
    if (!marker) return
    updateAttributes({ markers: [...markers, marker] })
    setSelectedMarkerId(marker.id)
  }

  const removeMarker = (id: string) => {
    const nextRoute = r.markerIds.includes(id)
      ? { ...r, markerIds: r.markerIds.filter(m => m !== id), result: null }
      : route
    updateAttributes({ markers: markers.filter(m => m.id !== id), route: nextRoute })
    if (selectedMarkerId === id) setSelectedMarkerId(null)
  }

  const updateMarker = (id: string, patch: Partial<MapMarker>) => {
    updateAttributes({ markers: markers.map(m => (m.id === id ? { ...m, ...patch } : m)) })
  }

  const updateRoute = (patch: Partial<MapRoute>) => {
    updateAttributes({ route: { ...r, ...patch, result: null } })
    setRouteError("")
  }

  const addToRoute = (place: PlaceDetails) => {
    const existing = markerForPlace(place.id)
    const marker = existing ?? buildMarker(place)
    if (!marker) return
    // One update for both, so the new marker and the route stop land together.
    updateAttributes({
      markers: existing ? markers : [...markers, marker],
      route: r.markerIds.includes(marker.id) ? r : { ...r, markerIds: [...r.markerIds, marker.id], result: null },
    })
    setTab("route")
    setSelectedPlaceId(null)
  }

  const moveStop = (index: number, delta: number) => {
    const ids = [...r.markerIds]
    const target = index + delta
    if (target < 0 || target >= ids.length) return
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    updateRoute({ markerIds: ids })
  }

  const computeRoute = async () => {
    const stops = r.markerIds.map(id => markerById.get(id)).filter((m): m is MapMarker => !!m)
    if (stops.length < 2) return
    setRouteBusy(true)
    setRouteError("")
    try {
      const result = await computeGoogleRoute(workspaceId, {
        waypoints: stops.map(m => (m.placeId ? { placeId: m.placeId } : { lat: m.lat, lng: m.lng })),
        travelMode: r.travelMode,
        optimize: r.optimize,
        languageCode: i18n.language,
      })
      let markerIds = stops.map(m => m.id)
      const order = result.optimizedIntermediateWaypointIndex
      if (r.optimize && order?.length && order[0] !== -1) {
        const middle = markerIds.slice(1, -1)
        markerIds = [markerIds[0], ...order.map(i => middle[i]), markerIds[markerIds.length - 1]]
      }
      updateAttributes({ route: { ...r, markerIds, result: toStoredRoute(result, true) } })
    } catch (e) {
      setRouteError(googleMapsErrorMessage(e))
    } finally {
      setRouteBusy(false)
    }
  }

  const routeStops = r.markerIds.map(id => markerById.get(id)).filter((m): m is MapMarker => !!m)
  const selectedMarker = selectedMarkerId ? markerById.get(selectedMarkerId) : undefined
  const previewIsMarker = selectedPlaceId ? !!markerForPlace(selectedPlaceId) : true

  const tabButton = (value: Tab, label: string) => (
    <button
      type="button"
      className={`flex-1 px-3 py-1.5 text-xs font-medium border-b-2 ${tab === value ? "border-blue-600 text-blue-600" : "border-transparent text-muted-foreground"}`}
      onClick={() => setTab(value)}
    >
      {label}
    </button>
  )

  return (
    <div className="flex flex-col md:flex-row" style={{ minHeight: 440 }}>
      <div className="relative flex-1 min-h-[320px]">
        <GoogleMap
          mapId={env.mapId}
          colorScheme={env.colorScheme}
          defaultCenter={center}
          defaultZoom={zoom}
          gestureHandling="cooperative"
          mapTypeControl={false}
          streetViewControl={false}
          onClick={handleMapClick}
          onContextmenu={handleContextMenu}
          onCameraChanged={handleCameraChanged}
          className="absolute inset-0"
        >
          {markers.map((m, i) => (
            <LabeledMarker
              key={m.id}
              position={m}
              label={String(i + 1)}
              color={m.color}
              title={m.name}
              imageUrl={placeThumbnailUrl(workspaceId, m.details)}
              active={m.id === selectedMarkerId || (!!m.placeId && m.placeId === selectedPlaceId)}
              onClick={() => {
                setSelectedMarkerId(m.id)
                setSelectedPlaceId(m.placeId ?? null)
                setPreviewLocation(null)
              }}
            />
          ))}
          {previewLocation && !previewIsMarker && (
            <LabeledMarker position={previewLocation} label="?" color="#5f6368" active />
          )}
          {r.result?.encodedPolyline && (
            <Polyline encodedPath={r.result.encodedPolyline} strokeColor="#4285f4" strokeOpacity={0.85} strokeWeight={5} />
          )}
          <PanTo target={panTarget} trigger={panTrigger} />
        </GoogleMap>
      </div>

      <div className="w-full md:w-80 shrink-0 flex flex-col border-t md:border-t-0 md:border-l dark:border-neutral-700 bg-white dark:bg-neutral-900 max-h-[520px]">
        <div className="p-2 border-b dark:border-neutral-700">
          <PlaceSearchBox workspaceId={workspaceId} bias={liveCenter} onSelect={handleSearchSelect} />
        </div>

        <div className="flex-1 overflow-y-auto">
          {selectedPlaceId ? (
            <PlaceDetailPanel
              workspaceId={workspaceId}
              placeId={selectedPlaceId}
              onClose={() => { setSelectedPlaceId(null); setPreviewLocation(null) }}
              onLoad={backfillDetails}
              actions={place => editable && (
                <>
                  {markerForPlace(place.id) ? (
                    <button type="button" className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border dark:border-neutral-600 hover:bg-gray-100 dark:hover:bg-neutral-800" onClick={() => removeMarker(markerForPlace(place.id)!.id)}>
                      <MapPinX size={13} />{t("googleMaps.removeMarker")}
                    </button>
                  ) : (
                    <button type="button" className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-blue-600 hover:bg-blue-700 text-white" onClick={() => addMarker(place)}>
                      <MapPinPlus size={13} />{t("googleMaps.addMarker")}
                    </button>
                  )}
                  <button type="button" className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border dark:border-neutral-600 hover:bg-gray-100 dark:hover:bg-neutral-800" onClick={() => addToRoute(place)}>
                    <RouteIcon size={13} />{t("googleMaps.addToRoute")}
                  </button>
                </>
              )}
            />
          ) : (
            <>
              <div className="flex border-b dark:border-neutral-700">
                {tabButton("markers", `${t("googleMaps.markers")} (${markers.length})`)}
                {tabButton("route", t("googleMaps.route"))}
              </div>

              {tab === "markers" && (
                <div className="flex flex-col">
                  {markers.length === 0 && (
                    <p className="p-3 text-xs text-muted-foreground">{t("googleMaps.noMarkers")}</p>
                  )}
                  {markers.map((m, i) => (
                    <div key={m.id} className={`px-3 py-2 border-b dark:border-neutral-800 ${m.id === selectedMarkerId ? "bg-blue-50 dark:bg-blue-950/30" : ""}`}>
                      <div className="flex items-start gap-2">
                        <button type="button" className="shrink-0 mt-0.5" onClick={() => { setSelectedMarkerId(m.id); panTo(m) }}>
                          <MarkerIcon label={String(i + 1)} color={m.color ?? MARKER_COLORS[0]} imageUrl={placeThumbnailUrl(workspaceId, m.details)} size={20} imageSize={36} />
                        </button>
                        <button type="button" className="flex-1 min-w-0 text-left" onClick={() => { setSelectedMarkerId(m.id); panTo(m) }}>
                          <div className="text-sm font-medium truncate">{m.name}</div>
                          {m.address && <div className="text-xs text-muted-foreground truncate">{m.address}</div>}
                        </button>
                        {m.placeId && (
                          <button type="button" className="text-xs text-blue-600 hover:underline shrink-0" onClick={() => setSelectedPlaceId(m.placeId!)}>
                            {t("googleMaps.details")}
                          </button>
                        )}
                        {editable && (
                          <>
                            <button
                              type="button"
                              className="p-0.5 text-muted-foreground hover:text-gray-700 shrink-0"
                              title={t("googleMaps.changeColor")}
                              onClick={() => updateMarker(m.id, { color: MARKER_COLORS[(MARKER_COLORS.indexOf(m.color ?? "") + 1) % MARKER_COLORS.length] })}
                            >
                              <Palette size={13} />
                            </button>
                            <button type="button" className="p-0.5 text-muted-foreground hover:text-red-500 shrink-0" onClick={() => removeMarker(m.id)} aria-label="remove marker">
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                      {m.id === selectedMarker?.id && editable ? (
                        <>
                          <input
                            className="mt-1.5 w-full px-2 py-1 text-xs rounded border dark:border-neutral-600 bg-transparent"
                            defaultValue={m.name}
                            placeholder={t("googleMaps.markerName")}
                            onBlur={e => e.target.value !== m.name && updateMarker(m.id, { name: e.target.value })}
                          />
                          <textarea
                            className="mt-1 w-full px-2 py-1 text-xs rounded border dark:border-neutral-600 bg-transparent"
                            rows={2}
                            defaultValue={m.note ?? ""}
                            placeholder={t("googleMaps.markerNote")}
                            onBlur={e => e.target.value !== (m.note ?? "") && updateMarker(m.id, { note: e.target.value })}
                          />
                        </>
                      ) : (
                        m.note && <p className="mt-1 ml-7 text-xs text-gray-700 dark:text-gray-300 whitespace-pre-line">{m.note}</p>
                      )}
                    </div>
                  ))}
                  {editable && <p className="p-3 text-[11px] text-muted-foreground">{t("googleMaps.markersHint")}</p>}
                </div>
              )}

              {tab === "route" && (
                <div className="flex flex-col gap-2 p-3">
                  {editable && (
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        className="px-2 py-1 text-xs rounded border dark:border-neutral-600 bg-transparent dark:bg-neutral-900"
                        value={r.travelMode}
                        onChange={e => updateRoute({ travelMode: e.target.value as TravelMode })}
                      >
                        {TRAVEL_MODES.map(mode => <option key={mode} value={mode}>{t(`googleMaps.travelMode.${mode}`)}</option>)}
                      </select>
                      <label className="inline-flex items-center gap-1 text-xs">
                        <input type="checkbox" checked={r.optimize} disabled={r.travelMode === "TRANSIT"} onChange={e => updateRoute({ optimize: e.target.checked })} />
                        {t("googleMaps.optimizeOrder")}
                      </label>
                    </div>
                  )}

                  {routeStops.length === 0 && <p className="text-xs text-muted-foreground">{t("googleMaps.routeEmpty")}</p>}
                  <ol className="list-none flex flex-col gap-1">
                    {routeStops.map((m, i) => (
                      <li key={m.id} className="flex items-center gap-2 text-sm">
                        <MarkerIcon label={String(markers.indexOf(m) + 1)} color={m.color ?? MARKER_COLORS[0]} imageUrl={placeThumbnailUrl(workspaceId, m.details)} size={20} imageSize={28} />
                        <span className="flex-1 truncate">{m.name}</span>
                        {editable && (
                          <>
                            <button type="button" className="p-0.5 text-muted-foreground disabled:opacity-30" disabled={i === 0} onClick={() => moveStop(i, -1)} aria-label="move up"><ChevronUp size={13} /></button>
                            <button type="button" className="p-0.5 text-muted-foreground disabled:opacity-30" disabled={i === routeStops.length - 1} onClick={() => moveStop(i, 1)} aria-label="move down"><ChevronDown size={13} /></button>
                            <button type="button" className="p-0.5 text-muted-foreground hover:text-red-500" onClick={() => updateRoute({ markerIds: r.markerIds.filter(id => id !== m.id) })} aria-label="remove stop"><X size={13} /></button>
                          </>
                        )}
                      </li>
                    ))}
                  </ol>

                  {editable && markers.some(m => !r.markerIds.includes(m.id)) && (
                    <select
                      className="px-2 py-1 text-xs rounded border dark:border-neutral-600 bg-transparent dark:bg-neutral-900"
                      value=""
                      onChange={e => e.target.value && updateRoute({ markerIds: [...r.markerIds, e.target.value] })}
                    >
                      <option value="">{t("googleMaps.addStop")}</option>
                      {markers.filter(m => !r.markerIds.includes(m.id)).map(m => (
                        <option key={m.id} value={m.id}>{markers.indexOf(m) + 1}. {m.name}</option>
                      ))}
                    </select>
                  )}

                  {r.travelMode === "TRANSIT" && routeStops.length > 2 && (
                    <p className="text-xs text-amber-600">{t("googleMaps.transitNoStops")}</p>
                  )}
                  {editable && (
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                      disabled={routeBusy || routeStops.length < 2}
                      onClick={computeRoute}
                    >
                      {routeBusy ? <Loader2 size={14} className="animate-spin" /> : <RouteIcon size={14} />}
                      {t("googleMaps.getDirections")}
                    </button>
                  )}
                  {routeError && <p className="text-xs text-red-500">{routeError}</p>}
                  {r.result && <RouteSummary route={r.result} stopNames={routeStops.map(m => m.name)} />}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const GoogleMapNodeComponent: React.FC<NodeViewProps> = ({ node, updateAttributes, selected, editor, deleteNode, getPos, extension }) => {
  const { t } = useTranslation()
  const workspaceId: string = extension.options.workspaceId
  const markers: MapMarker[] = node.attrs.markers ?? []
  const route: MapRoute | null = node.attrs.route ?? null
  const editable = editor.isEditable
  const isTouchDevice = window.matchMedia("(pointer: coarse)").matches
  const { moveUp, moveDown } = useNodeMove({ editor, node, getPos })

  // Stable for the node's lifetime: the Google map is uncontrolled and only
  // reads its initial camera.
  const [initialCamera] = useState(() => ({
    center: node.attrs.center ?? (markers[0] ? { lat: markers[0].lat, lng: markers[0].lng } : DEFAULT_CENTER),
    zoom: node.attrs.zoom ?? 13,
  }))

  const nodeActions = [
    { label: t("editor.moveUp"), icon: <ChevronUp size={14} />, onClick: moveUp },
    { label: t("editor.moveDown"), icon: <ChevronDown size={14} />, onClick: moveDown },
    { label: t("actions.delete"), icon: <Trash2 size={14} />, onClick: deleteNode, variant: "danger" as const },
  ]
  useDragMenu(getPos, () => nodeActions)

  return (
    <NodeViewWrapper className="google-map-node my-2 border dark:border-neutral-700 rounded-lg overflow-hidden bg-white dark:bg-neutral-900">
      <div className="flex items-center gap-2 px-3 py-2 border-b dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800">
        <MapIcon size={15} className="text-muted-foreground shrink-0" />
        {editable ? (
          <input
            className="flex-1 bg-transparent text-sm font-medium focus:outline-none"
            defaultValue={node.attrs.title}
            placeholder={t("editor.GoogleMapNode")}
            onBlur={e => e.target.value !== node.attrs.title && updateAttributes({ title: e.target.value })}
          />
        ) : (
          <span className="flex-1 text-sm font-medium">{node.attrs.title || t("editor.GoogleMapNode")}</span>
        )}
      </div>
      <GoogleMapGate
        workspaceId={workspaceId}
        fallback={
          <GoogleMapSnapshot title={node.attrs.title} markers={markers} route={route} workspaceId={workspaceId} embedded />
        }
      >
        {env => (
          <GoogleMapEditor
            env={env}
            workspaceId={workspaceId}
            editable={editable}
            markers={markers}
            route={route}
            center={initialCamera.center}
            zoom={initialCamera.zoom}
            updateAttributes={updateAttributes}
          />
        )}
      </GoogleMapGate>
      {isTouchDevice && editable && <NodeTouchMenu visible={selected} actions={nodeActions} />}
    </NodeViewWrapper>
  )
}

export default GoogleMapNodeComponent
