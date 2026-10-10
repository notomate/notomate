import { FC } from "react"
import { useShallow } from "zustand/react/shallow"
import { useUploadStore } from "@/stores/upload"
import { UploadTaskRow } from "./UploadTaskRow"

/** Inline list of the workspace's in-flight uploads, for upload dialogs. */
export const PendingUploads: FC<{ workspaceId: string; className?: string }> = ({ workspaceId, className }) => {
  const tasks = useUploadStore(
    useShallow((s) =>
      s.tasks.filter(
        (t) => t.workspaceId === workspaceId && (t.status === "uploading" || t.status === "paused" || t.status === "error"),
      ),
    ),
  )
  if (tasks.length === 0) return null
  return (
    <div className={className}>
      {tasks.map((task) => (
        <UploadTaskRow key={task.id} task={task} />
      ))}
    </div>
  )
}
