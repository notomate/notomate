import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader, Trash2 } from "lucide-react"
import { deleteGoogleMapsIntegration, googleMapsErrorMessage, updateGoogleMapsIntegration } from "@/api/googleMaps"
import { googleMapsStatusKey, useGoogleMapsStatus } from "@/hooks/use-google-maps"
import { toast } from "@/stores/toast"

// Workspace-level Google Maps key. Keys are write-only: the API reports
// whether they are set but never returns them.
const GoogleMapsSection = ({ workspaceId }: { workspaceId: string }) => {
    const { t } = useTranslation()
    const queryClient = useQueryClient()
    const { data: status } = useGoogleMapsStatus(workspaceId)
    const [serverKey, setServerKey] = useState("")
    const [browserKey, setBrowserKey] = useState("")
    const [mapId, setMapId] = useState("")

    useEffect(() => {
        setMapId(status?.map_id ?? "")
    }, [status?.map_id])

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: googleMapsStatusKey(workspaceId) })
        queryClient.invalidateQueries({ queryKey: ['googleMapsBrowserKey', workspaceId] })
    }

    const saveMutation = useMutation({
        mutationFn: (clearBrowserKey: boolean) => updateGoogleMapsIntegration(workspaceId, {
            server_key: serverKey,
            browser_key: browserKey,
            clear_browser_key: clearBrowserKey,
            map_id: mapId,
        }),
        onSuccess: () => {
            toast.success(t("googleMaps.settings.saved"))
            setServerKey("")
            setBrowserKey("")
            invalidate()
        },
        onError: error => toast.error(googleMapsErrorMessage(error)),
    })

    const deleteMutation = useMutation({
        mutationFn: () => deleteGoogleMapsIntegration(workspaceId),
        onSuccess: () => {
            toast.success(t("googleMaps.settings.removed"))
            invalidate()
        },
        onError: error => toast.error(googleMapsErrorMessage(error)),
    })

    const configured = !!status?.configured
    const inputClass = "w-full px-3 py-2 border dark:border-none rounded-lg dark:bg-neutral-700 text-sm"

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <div className="text-lg font-semibold">{t("googleMaps.settings.title")}</div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${configured ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-neutral-100 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400"}`}>
                    {configured ? t("googleMaps.settings.configured") : t("googleMaps.settings.notConfigured")}
                </span>
            </div>
            <div className="text-xs text-muted-foreground -mt-1">{t("googleMaps.settings.hint")}</div>

            <label className="flex flex-col gap-1 text-sm">
                <span>{t("googleMaps.settings.serverKey")}</span>
                <input
                    type="password"
                    autoComplete="off"
                    className={inputClass}
                    placeholder={configured ? t("googleMaps.settings.keepExisting") : "AIza..."}
                    value={serverKey}
                    onChange={e => setServerKey(e.target.value)}
                />
                <span className="text-xs text-muted-foreground">{t("googleMaps.settings.serverKeyHint")}</span>
            </label>

            <label className="flex flex-col gap-1 text-sm">
                <span className="flex items-center gap-2">
                    {t("googleMaps.settings.browserKey")}
                    {status?.has_browser_key && (
                        <button
                            type="button"
                            className="text-xs text-red-500 hover:underline"
                            onClick={() => saveMutation.mutate(true)}
                        >
                            {t("googleMaps.settings.clearBrowserKey")}
                        </button>
                    )}
                </span>
                <input
                    type="password"
                    autoComplete="off"
                    className={inputClass}
                    placeholder={status?.has_browser_key ? t("googleMaps.settings.keepExisting") : t("googleMaps.settings.optional")}
                    value={browserKey}
                    onChange={e => setBrowserKey(e.target.value)}
                />
                <span className="text-xs text-muted-foreground">{t("googleMaps.settings.browserKeyHint")}</span>
            </label>

            <label className="flex flex-col gap-1 text-sm">
                <span>{t("googleMaps.settings.mapId")}</span>
                <input
                    className={inputClass}
                    placeholder={t("googleMaps.settings.optional")}
                    value={mapId}
                    onChange={e => setMapId(e.target.value)}
                />
            </label>

            <div className="flex items-center gap-2 justify-end">
                {configured && (
                    <button
                        type="button"
                        onClick={() => { if (confirm(t("googleMaps.settings.removeConfirm"))) deleteMutation.mutate() }}
                        disabled={deleteMutation.isPending}
                        className="px-3 py-2 flex gap-2 items-center text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded disabled:opacity-50"
                    >
                        <Trash2 size={15} />{t("actions.delete")}
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => saveMutation.mutate(false)}
                    disabled={saveMutation.isPending || (!configured && !serverKey.trim())}
                    className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600"
                >
                    {saveMutation.isPending ? <Loader size={16} className="animate-spin" /> : t("googleMaps.settings.save")}
                </button>
            </div>
        </div>
    )
}

export default GoogleMapsSection
