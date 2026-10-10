import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { ChevronDown, ChevronUp, Upload, X } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { useUploadStore } from "@/stores/upload"
import { UploadTaskRow } from "./UploadTaskRow"

const AUTO_HIDE_MS = 5000

/**
 * Global floating panel listing every upload in this tab. Mounted once at
 * the app root so uploads stay visible after the modal that started them
 * closes or the user navigates away.
 */
export function UploadPanel() {
  const { t } = useTranslation()
  const tasks = useUploadStore((s) => s.tasks)
  const clearFinished = useUploadStore((s) => s.clearFinished)
  const [collapsed, setCollapsed] = useState(false)

  const active = tasks.filter((task) => task.status === "uploading" || task.status === "paused")
  const failed = tasks.filter((task) => task.status === "error")
  const done = tasks.filter((task) => task.status === "done")
  const settled = active.length === 0

  // Once everything has finished cleanly, tidy the panel away.
  useEffect(() => {
    if (tasks.length === 0 || !settled || failed.length > 0) return
    const timer = setTimeout(clearFinished, AUTO_HIDE_MS)
    return () => clearTimeout(timer)
  }, [tasks.length, settled, failed.length, clearFinished])

  if (tasks.length === 0) return null

  const totalBytes = active.reduce((sum, task) => sum + task.size, 0)
  const sentBytes = active.reduce((sum, task) => sum + task.bytesUploaded, 0)
  const overall = totalBytes > 0 ? Math.round((sentBytes * 100) / totalBytes) : 100
  const title = settled
    ? failed.length > 0
      ? t("uploads.some_failed", { count: failed.length })
      : t("uploads.all_done", { count: done.length })
    : t("uploads.uploading", { done: done.length, total: done.length + active.length })

  return (
    <div
      role="region"
      aria-label={t("uploads.title")}
      className="fixed bottom-4 left-4 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg"
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <Upload size={16} className="shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate text-sm font-semibold">{title}</span>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="p-1 rounded text-muted-foreground hover:bg-gray-100 dark:hover:bg-neutral-700"
          aria-label={collapsed ? t("uploads.expand") : t("uploads.collapse")}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {settled && (
          <button
            type="button"
            onClick={clearFinished}
            className="p-1 rounded text-muted-foreground hover:bg-gray-100 dark:hover:bg-neutral-700"
            aria-label={t("uploads.close")}
          >
            <X size={16} />
          </button>
        )}
      </div>
      {collapsed ? (
        !settled && <Progress value={overall} className="mx-3 mb-3 w-auto" aria-label={title} />
      ) : (
        <div className="max-h-72 overflow-y-auto border-t border-gray-100 dark:border-neutral-800 px-3 divide-y divide-gray-100 dark:divide-neutral-800">
          {tasks.map((task) => (
            <UploadTaskRow key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  )
}
