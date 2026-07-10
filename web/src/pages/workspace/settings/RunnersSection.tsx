import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Eye, EyeOff, Trash2 } from "lucide-react"
import { getRunners, deleteRunner, getRunnerRegistrationToken } from "@/api/runner"
import { toast } from "@/stores/toast"

// Instance-level runner management; rendered only for instance owners/admins.
const RunnersSection = () => {
    const { t } = useTranslation()
    const [showToken, setShowToken] = useState(false)

    const { data: runners = [], refetch } = useQuery({
        queryKey: ['runners'],
        queryFn: getRunners,
    })

    const { data: tokenData } = useQuery({
        queryKey: ['runnerRegistrationToken'],
        queryFn: getRunnerRegistrationToken,
        enabled: showToken,
    })

    const deleteMutation = useMutation({
        mutationFn: (id: string) => deleteRunner(id),
        onSuccess: () => {
            toast.success(t("pages.settings.runnerDeleted"))
            refetch()
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || error?.message || "Failed to delete runner")
        }
    })

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div className="text-lg font-semibold">{t("pages.settings.runners")}</div>
                <button
                    onClick={() => setShowToken(s => !s)}
                    className="px-3 py-2 flex gap-2 items-center text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded text-sm"
                >
                    {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
                    {t("pages.settings.registrationToken")}
                </button>
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-500 -mt-2">
                {t("pages.settings.runnersHint")}
            </div>

            {showToken && (
                <div className="p-3 rounded bg-neutral-50 dark:bg-neutral-700 font-mono text-sm break-all select-all">
                    {tokenData?.registration_token ?? "..."}
                </div>
            )}

            {runners.length === 0 ? (
                <div className="text-sm text-gray-400 dark:text-gray-500">
                    {t("pages.settings.noRunners")}
                </div>
            ) : (
                <div className="flex flex-col divide-y divide-neutral-100 dark:divide-neutral-700">
                    {runners.map(runner => (
                        <div key={runner.id} className="flex items-center gap-3 py-3">
                            <span
                                className={`shrink-0 inline-block w-2 h-2 rounded-full ${runner.status === 'online' ? "bg-green-500" : "bg-neutral-400"}`}
                                title={runner.status}
                            />
                            <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{runner.name}</div>
                                <div className="text-xs text-gray-400 dark:text-gray-500 truncate">
                                    {runner.labels.join(", ")}
                                    {runner.last_online_at && ` · ${new Date(runner.last_online_at).toLocaleString()}`}
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    if (confirm(t("pages.settings.deleteRunnerConfirm"))) {
                                        deleteMutation.mutate(runner.id)
                                    }
                                }}
                                disabled={deleteMutation.isPending}
                                className="p-2 text-red-500 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded disabled:opacity-50"
                                aria-label="delete runner"
                            >
                                <Trash2 size={15} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default RunnersSection
