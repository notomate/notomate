import { subscribeUploadComplete, useUploadStore, type UploadTask } from "@/stores/upload"

// Images pasted into the editor are inserted right away as image nodes
// carrying an uploadId instead of a src. This map, local to the tab that
// started the upload, links that id to the upload task and a blob preview.
// Neither belongs in the shared document: blob URLs only resolve in this tab.
interface PendingImage {
    taskId: string
    previewUrl: string
    /** The finished task, kept in case it is cleared from the upload store. */
    finished?: UploadTask
}

const pending = new Map<string, PendingImage>()

subscribeUploadComplete((task) => {
    for (const entry of pending.values()) {
        if (entry.taskId === task.id) entry.finished = task
    }
})

/** Starts uploading file and returns the uploadId to put on the node. */
export const startPendingImageUpload = (workspaceId: string, file: File): string => {
    const uploadId = crypto.randomUUID()
    const { taskId } = useUploadStore.getState().startUpload(workspaceId, file)
    pending.set(uploadId, { taskId, previewUrl: URL.createObjectURL(file) })
    return uploadId
}

export const getPendingImage = (uploadId: string | null | undefined) =>
    uploadId ? pending.get(uploadId) : undefined

/**
 * Forgets a pending image once its node has its real src. The caller owns
 * the preview URL from then on (it keeps showing it while the uploaded image
 * loads) and must revoke it.
 */
export const releasePendingImage = (uploadId: string) => {
    pending.delete(uploadId)
}
