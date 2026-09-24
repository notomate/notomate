import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import { Icon } from 'leaflet'
import { CalendarDays, LoaderCircle } from 'lucide-react'
import { getView, getViewObjects } from '@/api/view'
import { View, ViewObject, CalendarSlotData, MapMarkerData } from '@/types/view'
import KanbanViewComponent from '@/components/views/kanban/KanbanViewComponent'

const markerIcon = new Icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    shadowSize: [41, 41],
})

interface PreviewProps {
    viewId: string
    workspaceId: string
}

function useViewPreviewData(workspaceId: string, viewId: string) {
    const [view, setView] = useState<View | null>(null)
    const [viewObjects, setViewObjects] = useState<ViewObject[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!workspaceId || !viewId) return
        Promise.all([getView(workspaceId, viewId), getViewObjects(workspaceId, viewId)])
            .then(([v, objs]) => { setView(v); setViewObjects(objs) })
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [workspaceId, viewId])

    return { view, viewObjects, loading }
}

const LoadingState = () => (
    <div className="flex items-center justify-center h-full bg-white dark:bg-neutral-900">
        <LoaderCircle size={20} className="text-muted-foreground animate-spin" />
    </div>
)

export const MapInlinePreview: React.FC<PreviewProps> = ({ viewId, workspaceId }) => {
    const { view, viewObjects, loading } = useViewPreviewData(workspaceId, viewId)

    if (loading) return <LoadingState />

    const markers = viewObjects
        .filter(obj => obj.type === 'map_marker')
        .map(obj => { try { return JSON.parse(obj.data) as MapMarkerData } catch { return null } })
        .filter((m): m is MapMarkerData => m !== null && m.lat != null && m.lng != null)

    let center: [number, number] = [25.033, 121.565]
    let zoom = 12
    if (view?.data) {
        try {
            const vd = JSON.parse(view.data)
            if (vd.center?.lat != null) { center = [vd.center.lat, vd.center.lng]; zoom = vd.zoom ?? zoom }
        } catch {}
    }
    if (markers.length > 0 && center[0] === 25.033) center = [markers[0].lat, markers[0].lng]

    return (
        <div className="h-full w-full">
            <MapContainer
                center={center}
                zoom={zoom}
                className="h-full w-full"
                zoomControl={false}
                scrollWheelZoom={false}
                dragging={false}
                doubleClickZoom={false}
                attributionControl={false}
            >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {markers.map((m, i) => (
                    <Marker key={i} position={[m.lat, m.lng]} icon={markerIcon} />
                ))}
            </MapContainer>
        </div>
    )
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export const CalendarInlinePreview: React.FC<PreviewProps> = ({ viewId, workspaceId }) => {
    const { viewObjects, loading } = useViewPreviewData(workspaceId, viewId)

    if (loading) return <LoadingState />

    const events = viewObjects
        .filter(obj => obj.type === 'calendar_slot')
        .map(obj => {
            try {
                const data = JSON.parse(obj.data) as CalendarSlotData
                return { id: obj.id, name: obj.name, date: data.date, startTime: data.start_time, color: data.color }
            } catch { return null }
        })
        .filter((e): e is NonNullable<typeof e> => e !== null && !!e.date)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 20)

    if (events.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                <CalendarDays size={32} className="opacity-40" />
                <span className="text-sm">No events</span>
            </div>
        )
    }

    return (
        <div className="h-full w-full overflow-y-auto bg-white dark:bg-neutral-900 p-3 flex flex-col gap-1">
            {events.map(ev => {
                const d = new Date(ev.date)
                const isValid = !isNaN(d.getTime())
                return (
                    <div key={ev.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800">
                        <div className="flex flex-col items-center min-w-[36px]">
                            {isValid ? (
                                <>
                                    <span className="text-xs font-medium text-blue-500 uppercase">{MONTH_NAMES[d.getMonth()]}</span>
                                    <span className="text-base font-bold text-gray-700 dark:text-gray-200 leading-none">{String(d.getDate()).padStart(2,'0')}</span>
                                </>
                            ) : (
                                <CalendarDays size={20} className="text-muted-foreground" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{ev.name || 'Untitled'}</p>
                            {ev.startTime && <p className="text-xs text-muted-foreground">{ev.startTime}</p>}
                        </div>
                        {ev.color && <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ev.color }} />}
                    </div>
                )
            })}
        </div>
    )
}

export const KanbanInlinePreview: React.FC<PreviewProps> = ({ viewId, workspaceId }) => {
    const { view, viewObjects, loading } = useViewPreviewData(workspaceId, viewId)

    if (loading) return <LoadingState />

    return (
        <div className="h-full w-full overflow-auto bg-white dark:bg-neutral-900">
            <KanbanViewComponent
                view={view ?? undefined}
                viewObjects={viewObjects}
                isPublic={true}
                workspaceId={workspaceId}
                viewId={viewId}
            />
        </div>
    )
}
