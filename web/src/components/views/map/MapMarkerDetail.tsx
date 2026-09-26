import { useNavigate, useParams, useOutletContext } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { ArrowLeft } from "lucide-react"
import { getViewObject } from "@/api/view"

interface MapMarkerDetailContext {
    view: any
    viewObjects: any[]
    workspaceId: string
    viewId: string
}

const MapMarkerDetail = () => {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const { markerId } = useParams<{ markerId: string }>()
    const { workspaceId, viewId, view } = useOutletContext<MapMarkerDetailContext>()

    const { data: marker, isLoading } = useQuery({
        queryKey: ['view-object', workspaceId, viewId, markerId],
        queryFn: () => getViewObject(workspaceId, viewId!, markerId!),
        enabled: !!workspaceId && !!viewId && !!markerId,
    })

    const handleBack = () => {
        navigate(`/workspaces/${workspaceId}/map/${viewId}`)
    }

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-muted-foreground">{t('common.loading')}</div>
            </div>
        )
    }

    if (!marker) {
        return (
            <div className="h-full flex flex-col items-center justify-center">
                <div className="text-muted-foreground mb-4">{t('views.objectNotFound')}</div>
                <button
                    onClick={handleBack}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                    {t('common.back')}
                </button>
            </div>
        )
    }

    let markerData: any = {}
    try {
        markerData = JSON.parse(marker.data)
    } catch (e) {
        console.error('Failed to parse marker data:', e)
    }

    return (
        <div className="h-full overflow-y-auto bg-neutral-100 dark:bg-neutral-900">
            <div className="p-4 border-b dark:border-neutral-700">
                <button
                    onClick={handleBack}
                    className="flex items-center gap-2 text-muted-foreground hover:text-gray-900 dark:hover:text-gray-200 mb-3"
                >
                    <ArrowLeft size={16} />
                    {view.name}
                </button>

                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <div className="text-xl font-semibold">{marker.name}</div>
                        <div className="text-sm text-muted-foreground mt-1">
                            {t('views.mapMarker')}
                        </div>
                        {markerData.lat && markerData.lng && (
                            <div className="text-sm text-muted-foreground mt-2">
                                <div>Lat: {markerData.lat.toFixed(4)}</div>
                                <div>Lng: {markerData.lng.toFixed(4)}</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MapMarkerDetail
