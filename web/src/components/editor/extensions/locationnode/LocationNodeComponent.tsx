import { NodeViewProps, NodeViewWrapper } from "@tiptap/react"
import { ChevronUp, ChevronDown, Edit3, Trash2, MapPin, Search, Loader2, ExternalLink } from "lucide-react"
import { useState, useRef, useEffect, useCallback } from "react"
import { useDragMenu, NodeTouchMenu } from "@/components/editor/DragMenuContext"
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet"
import { Icon } from "leaflet"

const markerIcon = new Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

// ── Types ────────────────────────────────────────────────────────────────────
interface NominatimResult {
  lat: string
  lon: string
  display_name: string
}

// ── Fly map to a position when pendingLat/Lng change from search ──────────────
function MapFlyTo({ lat, lng, trigger }: { lat: number; lng: number; trigger: number }) {
  const map = useMap()
  useEffect(() => {
    if (trigger === 0) return
    map.flyTo([lat, lng], 15, { duration: 0.8 })
  }, [trigger]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

// ── Listen to map drag end and report new center ──────────────────────────────
function MapDragTracker({
  onMoveEnd,
  enabled,
}: {
  onMoveEnd: (lat: number, lng: number) => void
  enabled: boolean
}) {
  const map = useMapEvents({
    moveend() {
      if (!enabled) return
      const c = map.getCenter()
      onMoveEnd(c.lat, c.lng)
    },
    zoomend() {
      if (!enabled) return
      const c = map.getCenter()
      onMoveEnd(c.lat, c.lng)
    },
  })
  return null
}

// ── Crosshair overlay (fixed pin at map center) ───────────────────────────────
function CrosshairPin({ isGeocoding }: { isGeocoding: boolean }) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      style={{ zIndex: 1000 }}
    >
      <div className="relative flex flex-col items-center" style={{ transform: "translateY(-50%)" }}>
        {isGeocoding ? (
          <Loader2 size={28} className="text-blue-600 animate-spin drop-shadow-md" />
        ) : (
          <>
            <MapPin
              size={32}
              className="text-blue-600 drop-shadow-md"
              fill="#2563eb"
              strokeWidth={1.5}
              stroke="white"
            />
            {/* pin tail dot */}
            <div className="w-2 h-2 rounded-full bg-blue-600/40 -mt-1" />
          </>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
const LocationNodeComponent: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  selected,
  editor,
  deleteNode,
  getPos,
}) => {
  const { lat, lng, name, address, zoom } = node.attrs
  const isEditable = editor.isEditable
  const isTouchDevice = window.matchMedia("(pointer: coarse)").matches
  const hasLocation = lat !== null && lng !== null

  const [showMap, setShowMap] = useState(false)
  const [isEditing, setIsEditing] = useState(!hasLocation)

  // edit-mode state
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<NominatimResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isGeocoding, setIsGeocoding] = useState(false)

  // pending location (what will be saved)
  const [pendingLat, setPendingLat] = useState<number>(lat ?? 25.0330)
  const [pendingLng, setPendingLng] = useState<number>(lng ?? 121.5654)
  const [pendingName, setPendingName] = useState<string>(name ?? "")
  const [pendingAddress, setPendingAddress] = useState<string>(address ?? "")

  // flyTo trigger: increment to fire MapFlyTo
  const [flyTrigger, setFlyTrigger] = useState(0)
  // skip reverse geocode on programmatic map moves (after search-result select)
  const skipReverseRef = useRef(false)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reverseDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isEditing) setTimeout(() => searchInputRef.current?.focus(), 50)
  }, [isEditing])

  // ── Forward geocoding (text search) ────────────────────────────────────────
  const searchNominatim = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setIsSearching(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`,
        { headers: { Accept: "application/json" } }
      )
      if (res.ok) setResults(await res.json())
    } catch { /* ignore */ }
    finally { setIsSearching(false) }
  }, [])

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => searchNominatim(val), 400)
  }

  const handleSelectResult = (r: NominatimResult) => {
    const newLat = parseFloat(r.lat)
    const newLng = parseFloat(r.lon)
    const newName = r.display_name.split(",")[0].trim()
    setPendingLat(newLat)
    setPendingLng(newLng)
    setPendingName(newName)
    setPendingAddress(r.display_name)
    setQuery(newName)
    setResults([])
    // fly map to result, but skip the reverse geocode that moveend would trigger
    skipReverseRef.current = true
    setFlyTrigger(t => t + 1)
  }

  // ── Reverse geocoding (called when map drag ends) ───────────────────────────
  const reverseGeocode = useCallback(async (rlat: number, rlng: number) => {
    setIsGeocoding(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${rlat}&lon=${rlng}&format=json`,
        { headers: { Accept: "application/json" } }
      )
      if (res.ok) {
        const data = await res.json()
        const newName = (
          data.namedetails?.name ||
          data.address?.amenity ||
          data.address?.building ||
          data.address?.road ||
          data.display_name?.split(",")[0]
        )?.trim() ?? ""
        setPendingName(newName)
        setPendingAddress(data.display_name ?? "")
        setQuery(newName)
      }
    } catch { /* ignore */ }
    finally { setIsGeocoding(false) }
  }, [])

  const handleMapMoveEnd = useCallback((rlat: number, rlng: number) => {
    setPendingLat(rlat)
    setPendingLng(rlng)
    if (skipReverseRef.current) {
      skipReverseRef.current = false
      return
    }
    // debounce so rapid flyTo animations don't hammer the API
    if (reverseDebounceRef.current) clearTimeout(reverseDebounceRef.current)
    reverseDebounceRef.current = setTimeout(() => reverseGeocode(rlat, rlng), 300)
  }, [reverseGeocode])

  // ── Save / cancel ───────────────────────────────────────────────────────────
  const handleSave = () => {
    updateAttributes({ lat: pendingLat, lng: pendingLng, name: pendingName, address: pendingAddress, zoom: 15 })
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    if (!hasLocation) return
    setPendingLat(lat)
    setPendingLng(lng)
    setPendingName(name ?? "")
    setPendingAddress(address ?? "")
    setQuery("")
    setResults([])
    setIsEditing(false)
  }

  const handleMoveUp = useCallback(() => {
    const pos = getPos()
    if (pos === undefined) return
    const { state } = editor
    const $pos = state.doc.resolve(pos)
    if ($pos.index() === 0) return
    const nodeBefore = $pos.nodeBefore
    if (!nodeBefore) return
    editor.view.dispatch(state.tr.replaceWith(pos - nodeBefore.nodeSize, pos + node.nodeSize, [node, nodeBefore]))
  }, [editor, node, getPos])

  const handleMoveDown = useCallback(() => {
    const pos = getPos()
    if (pos === undefined) return
    const { state } = editor
    const $pos = state.doc.resolve(pos)
    if ($pos.index() >= $pos.parent.childCount - 1) return
    const nodeAfterPos = pos + node.nodeSize
    const nodeAfter = state.doc.resolve(nodeAfterPos).nodeAfter
    if (!nodeAfter) return
    editor.view.dispatch(state.tr.replaceWith(pos, nodeAfterPos + nodeAfter.nodeSize, [nodeAfter, node]))
  }, [editor, node, getPos])

  const nodeActions = [
    { label: 'Move up', icon: <ChevronUp size={14} />, onClick: handleMoveUp },
    { label: 'Move down', icon: <ChevronDown size={14} />, onClick: handleMoveDown },
    { label: 'Edit location', icon: <Edit3 size={14} />, onClick: () => { setPendingLat(lat); setPendingLng(lng); setPendingName(name ?? ""); setPendingAddress(address ?? ""); setQuery(name ?? ""); setIsEditing(true) } },
    { label: 'Delete', icon: <Trash2 size={14} />, onClick: deleteNode, variant: 'danger' as const },
  ]

  useDragMenu(getPos, () => nodeActions)

  // ════════════════════════════════════════════════════════════════════════════
  // Edit mode
  // ════════════════════════════════════════════════════════════════════════════
  if (isEditing || !hasLocation) {
    return (
      <NodeViewWrapper className="location-node select-none border dark:border-neutral-700 rounded-lg overflow-hidden bg-gray-100 dark:bg-neutral-800">
        <div className="flex flex-col gap-0">

          {/* Header + search bar */}
          <div className="flex flex-col gap-2 p-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin size={16} />
              <span className="text-sm font-medium">Location</span>
              <span className="ml-auto text-xs text-muted-foreground">Drag map or search</span>
            </div>

            {/* Search */}
            <div className="relative">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    ref={searchInputRef}
                    type="text"
                    className="w-full px-3 py-2 pr-8 text-sm rounded border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Search place name..."
                    value={query}
                    onChange={handleQueryChange}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); searchNominatim(query) } }}
                  />
                  {isSearching
                    ? <Loader2 size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />
                    : <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  }
                </div>
                <button
                  className="px-3 py-2 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                  onClick={() => searchNominatim(query)}
                >
                  Search
                </button>
              </div>

              {/* Search dropdown */}
              {results.length > 0 && (
                <ul className="absolute z-[2000] left-0 right-0 mt-1 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-600 rounded shadow-lg max-h-52 overflow-y-auto">
                  {results.map((r, i) => (
                    <li key={i}>
                      <button
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-800 dark:text-gray-200 border-b last:border-b-0 border-gray-100 dark:border-neutral-700"
                        onClick={() => handleSelectResult(r)}
                      >
                        <span className="font-medium">{r.display_name.split(",")[0]}</span>
                        <span className="block text-xs text-muted-foreground truncate">{r.display_name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Draggable map with crosshair */}
          <div className="relative" style={{ height: 240 }}>
            <MapContainer
              center={[pendingLat, pendingLng]}
              zoom={15}
              className="h-full w-full"
              scrollWheelZoom
              zoomControl
              dragging
              doubleClickZoom
              attributionControl={false}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapDragTracker onMoveEnd={handleMapMoveEnd} enabled />
              <MapFlyTo lat={pendingLat} lng={pendingLng} trigger={flyTrigger} />
            </MapContainer>
            {/* Crosshair pin fixed at map center */}
            <CrosshairPin isGeocoding={isGeocoding} />
          </div>

          {/* Current selected location + coords */}
          <div className="px-3 py-2 flex items-center justify-between gap-2 bg-white dark:bg-neutral-900 border-t dark:border-neutral-700">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <MapPin size={13} className="text-blue-500 shrink-0" />
              <div className="min-w-0">
                {pendingName ? (
                  <p className="text-xs font-medium text-gray-800 dark:text-gray-100 truncate">{pendingName}</p>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Drag map to pick a location</p>
                )}
                <p className="text-xs text-muted-foreground font-mono">
                  {pendingLat.toFixed(5)}, {pendingLng.toFixed(5)}
                </p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                className="px-3 py-1.5 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                onClick={handleSave}
              >
                Save
              </button>
              {hasLocation && (
                <button
                  className="px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-neutral-600 hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-700 dark:text-gray-300 transition-colors"
                  onClick={handleCancelEdit}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

        </div>
      </NodeViewWrapper>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Display mode
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <NodeViewWrapper>
      <div className="relative group my-1">
        <div
          className="flex flex-wrap items-center gap-1.5 px-1 py-1 cursor-pointer"
          onClick={() => setShowMap(s => !s)}
        >
          {name && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-neutral-700 text-muted-foreground dark:text-gray-300 select-none">
              <MapPin size={12} className="shrink-0" />
              {name}
            </span>
          )}
          <a
            href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-0.5 rounded text-muted-foreground hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            title="Open in OpenStreetMap"
            onClick={e => e.stopPropagation()}
          >
            <ExternalLink size={12} />
          </a>
        </div>
        {showMap && (
          <div style={{ height: 200 }} className="w-full rounded-md overflow-hidden border dark:border-neutral-700">
            <MapContainer
              center={[lat, lng]}
              zoom={zoom ?? 15}
              className="h-full w-full"
              zoomControl={false}
              scrollWheelZoom={false}
              dragging={false}
              doubleClickZoom={false}
              attributionControl={false}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker position={[lat, lng]} icon={markerIcon} />
            </MapContainer>
          </div>
        )}
        {isTouchDevice && isEditable && (
          <NodeTouchMenu visible={selected} actions={nodeActions} />
        )}
      </div>
    </NodeViewWrapper>
  )
}

export default LocationNodeComponent
