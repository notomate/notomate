import { useEffect, useMemo, useRef } from "react"
import { MapContainer, Marker, Popup, TileLayer, ZoomControl, useMap, useMapEvents } from "react-leaflet"
import { DivIcon, LatLngBounds, type Map as LeafletMap } from "leaflet"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import type { SearchNote } from "@/api/search"
import { toBBox, type BBox } from "./bbox"

const markerIcon = new DivIcon({
    html: `<div style="width:18px;height:18px;border-radius:50%;background:#3B82F6;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
    className: "custom-marker-icon",
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10],
})

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
    getLinkTo: (note: SearchNote) => string
    /** Called with the visible area after the map settles. */
    onBoundsChange: (bbox: BBox) => void
    className?: string
}

/** Pins for every location in the notes; the first results frame the map, later pans refetch. */
const NoteMap = ({ notes, getLinkTo, onBoundsChange, className = "h-full w-full" }: NoteMapProps) => {
    const { t } = useTranslation()
    const mapRef = useRef<LeafletMap | null>(null)
    const framed = useRef(false)

    const pins = useMemo(() => notes.flatMap((note) =>
        (note.locations ?? []).map((loc, i) => ({ key: `${note.id}-${i}`, note, loc }))
    ), [notes])

    // Frame the first set of pins once; afterwards the user's own panning drives the query.
    useEffect(() => {
        const map = mapRef.current
        if (!map || framed.current || pins.length === 0) return
        framed.current = true
        const bounds = new LatLngBounds(pins.map((p) => [p.loc.lat, p.loc.lng] as [number, number]))
        map.fitBounds(bounds, { padding: [32, 32], maxZoom: 14 })
    }, [pins])

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
                {pins.map(({ key, note, loc }) => (
                    <Marker key={key} position={[loc.lat, loc.lng]} icon={markerIcon}>
                        <Popup>
                            <Link
                                to={getLinkTo(note)}
                                className="block font-medium text-blue-600 dark:text-blue-400"
                            >
                                {note.title || t("editor.titlePlaceholder")}
                            </Link>
                            {(loc.name || loc.address) && (
                                <div className="mt-0.5 text-xs text-gray-600">{loc.name || loc.address}</div>
                            )}
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    )
}

export default NoteMap
