import { useEffect, useRef } from "react"
import { subscribeUploadComplete } from "@/stores/upload"

/**
 * Calls onComplete whenever an upload into workspaceId finishes, while
 * enabled. Unsubscribes on unmount, so a closed dialog does no more work.
 */
const useUploadComplete = (workspaceId: string, enabled: boolean, onComplete: () => void) => {
  const callback = useRef(onComplete)
  callback.current = onComplete

  useEffect(() => {
    if (!enabled) return
    return subscribeUploadComplete((task) => {
      if (task.workspaceId === workspaceId) callback.current()
    })
  }, [workspaceId, enabled])
}

export default useUploadComplete
