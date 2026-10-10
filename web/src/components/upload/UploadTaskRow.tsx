import { FC } from "react"
import { useTranslation } from "react-i18next"
import { CheckCircle2, Pause, Play, RotateCw, X, XCircle } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { UploadTask, useUploadStore } from "@/stores/upload"

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB", "TB"]
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[i]}`
}

const iconButton =
  "p-1 rounded text-muted-foreground hover:text-gray-900 hover:bg-gray-100 dark:hover:text-gray-100 dark:hover:bg-neutral-700 transition-colors"

/** One upload with its progress bar and pause/resume/retry/cancel controls. */
export const UploadTaskRow: FC<{ task: UploadTask }> = ({ task }) => {
  const { t } = useTranslation()
  const { pause, resume, retry, cancel } = useUploadStore.getState()
  const percent = task.size > 0 ? Math.round((task.bytesUploaded * 100) / task.size) : 0

  const status =
    task.status === "done" ? t("uploads.done") :
    task.status === "error" ? t("uploads.failed") :
    task.status === "canceled" ? t("uploads.canceled") :
    task.status === "paused" ? t("uploads.paused") :
    `${percent}%`

  return (
    <div className="py-2">
      <div className="flex items-center gap-2">
        {task.status === "done" && <CheckCircle2 size={14} className="shrink-0 text-green-500" />}
        {task.status === "error" && <XCircle size={14} className="shrink-0 text-red-500" />}
        <span className="flex-1 min-w-0 truncate text-sm" title={task.name}>{task.name}</span>
        {task.status === "uploading" && (
          <button type="button" className={iconButton} onClick={() => pause(task.id)} aria-label={t("uploads.pause")} title={t("uploads.pause")}>
            <Pause size={14} />
          </button>
        )}
        {task.status === "paused" && (
          <button type="button" className={iconButton} onClick={() => resume(task.id)} aria-label={t("uploads.resume")} title={t("uploads.resume")}>
            <Play size={14} />
          </button>
        )}
        {task.status === "error" && (
          <button type="button" className={iconButton} onClick={() => retry(task.id)} aria-label={t("uploads.retry")} title={t("uploads.retry")}>
            <RotateCw size={14} />
          </button>
        )}
        {(task.status === "uploading" || task.status === "paused" || task.status === "error") && (
          <button type="button" className={iconButton} onClick={() => cancel(task.id)} aria-label={t("uploads.cancel")} title={t("uploads.cancel")}>
            <X size={14} />
          </button>
        )}
      </div>
      {task.status !== "done" && task.status !== "canceled" && (
        <Progress
          value={percent}
          className="mt-1.5"
          aria-label={task.name}
          indicatorClassName={task.status === "error" ? "bg-red-500" : task.status === "paused" ? "bg-neutral-400" : undefined}
        />
      )}
      <div className="mt-1 flex justify-between text-xs text-muted-foreground tabular-nums">
        <span>{formatBytes(task.bytesUploaded)} / {formatBytes(task.size)}</span>
        <span className={task.status === "error" ? "text-red-500" : undefined} title={task.error}>{status}</span>
      </div>
    </div>
  )
}
