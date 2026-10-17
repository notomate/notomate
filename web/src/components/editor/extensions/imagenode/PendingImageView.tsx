import { useEffect, useRef } from "react"
import { Loader2, RotateCcw, Play, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useUploadStore, type UploadTask } from "@/stores/upload"
import { getPendingImage } from "./pendingImages"

interface PendingImageViewProps {
    uploadId: string
    name?: string
    /** Called once the upload has finished, with the preview to hand over. */
    onUploaded: (task: UploadTask, previewUrl: string) => void
    onDelete: () => void
}

/**
 * An image node whose upload hasn't finished. The tab that started the
 * upload shows the local preview with progress; everyone else (or this tab
 * after a reload) sees a placeholder.
 */
const PendingImageView = ({ uploadId, name, onUploaded, onDelete }: PendingImageViewProps) => {
    const { t } = useTranslation()
    const entry = getPendingImage(uploadId)
    const liveTask = useUploadStore((s) => (entry ? s.tasks.find((task) => task.id === entry.taskId) : undefined))
    // The task may have been cleared from the upload panel after finishing.
    const task = liveTask ?? entry?.finished
    const finishedRef = useRef(false)

    useEffect(() => {
        if (!entry || !task || finishedRef.current) return
        if (task.status === "done" && task.result) {
            finishedRef.current = true
            onUploaded(task, entry.previewUrl)
        } else if (task.status === "canceled") {
            finishedRef.current = true
            URL.revokeObjectURL(entry.previewUrl)
            onDelete()
        }
    }, [entry, task, onUploaded, onDelete])

    if (!entry) {
        return (
            <div className="flex h-40 w-full items-center justify-center gap-2 rounded bg-gray-100 text-sm text-gray-500 animate-pulse dark:bg-neutral-800 dark:text-neutral-400">
                <Loader2 size={16} className="animate-spin" />
                {t("uploads.image_pending")}
            </div>
        )
    }

    const percent = task && task.size > 0 ? Math.round((task.bytesUploaded * 100) / task.size) : 0
    const { retry, resume } = useUploadStore.getState()

    return (
        <div className="relative w-fit max-w-full overflow-hidden rounded">
            <img src={entry.previewUrl} alt={name ?? ""} className="block h-auto max-w-full opacity-60" draggable={false} />
            {task?.status === "error" || task?.status === "paused" ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40 text-white">
                    <span className="text-sm">{t(task.status === "error" ? "uploads.failed" : "uploads.paused")}</span>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => (task.status === "error" ? retry(task.id) : resume(task.id))}
                            className="flex items-center gap-1 rounded bg-white/90 px-2 py-1 text-xs text-gray-800 hover:bg-white"
                        >
                            {task.status === "error" ? <RotateCcw size={12} /> : <Play size={12} />}
                            {t(task.status === "error" ? "uploads.retry" : "uploads.resume")}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                finishedRef.current = true
                                useUploadStore.getState().cancel(task.id)
                                onDelete()
                            }}
                            className="flex items-center gap-1 rounded bg-white/90 px-2 py-1 text-xs text-red-600 hover:bg-white"
                        >
                            <Trash2 size={12} />
                            {t("files.delete")}
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-xs text-white">
                            <Loader2 size={12} className="animate-spin" />
                            {percent}%
                        </span>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-black/20">
                        <div className="h-full bg-blue-500 transition-[width] duration-200" style={{ width: `${percent}%` }} />
                    </div>
                </>
            )}
        </div>
    )
}

export default PendingImageView
