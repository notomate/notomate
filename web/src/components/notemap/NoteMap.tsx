import { useEffect, useMemo, useRef } from "react"
import { MapContainer, Marker, TileLayer, Tooltip, ZoomControl, useMap, useMapEvents } from "react-leaflet"
import { DivIcon, LatLngBounds, type Map as LeafletMap } from "leaflet"
import type { SearchNote } from "@/api/search"
import { toBBox, type BBox } from "./bbox"
import { groupPlaces, type NotePlace } from "./places"

const makeIcon = (size: number, background: string) => new DivIcon({
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${background};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
    className: "custom-marker-icon",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
})
const markerIcon = makeIcon(18, "#3B82F6")
const selectedIcon = makeIcon(24, "#1D4ED8")

const BoundsWatcher = ({ onChange }: { onChange: (bbox: BBox) => void }) => {
    const timer = useRef<ReturnType<typeof setTimeout>>()
    const map = useMapEvents({
        moveend: () => {
            clearTimeout(timer.current)
            timer.current = setTimeout(() => onChange(toBBox(map.getBounds())), 300)
        },
    })
    useEffect(() => () => clearTimeout(timer.current), [])
    return null
}

const ClickWatcher = ({ onClick }: { onClick: () => void }) => {
    useMapEvents({ click: onClick })
    return null
}

/** Redraws the map when its container changes size, e.g. after being shown again. */
const SizeWatcher = () => {
    const map = useMap()
    useEffect(() => {
        const observer = new ResizeObserver(() => map.invalidateSize())
        observer.observe(map.getContainer())
        return () => observer.disconnect()
    }, [map])
    return null
}

interface NoteMapProps {
    notes: SearchNote[]
    /** Called with the visible area after the map settles. */
    onBoundsChange: (bbox: BBox) => void
    /** Key of the highlighted pin. */
    selectedKey?: string | null
    /** A pin was clicked, or the map itself (null). */
    onSelect: (place: NotePlace | null) => void
    className?: string
}

/** Pins for every location in the notes; the first results frame the map, later pans refetch. */
const NoteMap = ({ notes, onBoundsChange, selectedKey, onSelect, className = "h-full w-full" }: NoteMapProps) => {
    const mapRef = useRef<LeafletMap | null>(null)
    const framed = useRef(false)

    const places = useMemo(() => groupPlaces(notes), [notes])

    // Frame the first set of pins once; afterwards the user's own panning drives the query.
    useEffect(() => {
        const map = mapRef.current
        if (!map || framed.current || places.length === 0) return
        framed.current = true
        const bounds = new LatLngBounds(places.map((p) => [p.location.lat, p.location.lng] as [number, number]))
        map.fitBounds(bounds, { padding: [32, 32], maxZoom: 14 })
    }, [places])

    return (
        <div className={className}>
            <MapContainer
                ref={mapRef}
                center={[20, 0]}
                zoom={2}
                worldCopyJump
                zoomControl={false}
                className="h-full w-full"
                scrollWheelZoom
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <ZoomControl position="bottomright" />
                <BoundsWatcher onChange={onBoundsChange} />
                <SizeWatcher />
                <ClickWatcher onClick={() => onSelect(null)} />
                {places.map((place) => {
                    const selected = place.key === selectedKey
                    const label = place.location.name || place.location.address
                    return (
                        <Marker
                            key={place.key}
                            position={[place.location.lat, place.location.lng]}
                            icon={selected ? selectedIcon : markerIcon}
                            zIndexOffset={selected ? 1000 : 0}
                            eventHandlers={{ click: () => onSelect(place) }}
                        >
                            {label && (
                                <Tooltip direction="top" offset={[0, -10]}>
                                    {place.notes.length > 1 ? `${label} (${place.notes.length})` : label}
                                </Tooltip>
                            )}
                        </Marker>
                    )
                })}
            </MapContainer>
        </div>
    )
}

export default NoteMap
