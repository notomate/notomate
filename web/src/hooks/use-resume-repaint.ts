import { useEffect } from "react"

const LONG_HIDDEN_MS = 5 * 60 * 1000

/**
 * Mobile browsers free memory while the app sits in the background, including
 * the painted tiles of scroll containers. Coming back can then show a blank
 * page that never repaints, so after a long absence (or a bfcache restore)
 * hide the root for a frame, which invalidates the paint of everything inside
 * it without touching layout or scroll positions.
 */
const useResumeRepaint = () => {
    useEffect(() => {
        let hiddenAt = document.visibilityState === "hidden" ? Date.now() : 0

        const repaint = () => {
            const root = document.getElementById("root")
            if (!root) return
            root.style.visibility = "hidden"
            requestAnimationFrame(() => {
                requestAnimationFrame(() => { root.style.visibility = "" })
            })
        }

        const handleVisibilityChange = () => {
            if (document.visibilityState === "hidden") {
                hiddenAt = Date.now()
                return
            }
            const wasLong = hiddenAt && Date.now() - hiddenAt >= LONG_HIDDEN_MS
            hiddenAt = 0
            if (wasLong) repaint()
        }

        const handlePageShow = (e: PageTransitionEvent) => {
            if (e.persisted) repaint()
        }

        document.addEventListener("visibilitychange", handleVisibilityChange)
        window.addEventListener("pageshow", handlePageShow)
        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange)
            window.removeEventListener("pageshow", handlePageShow)
        }
    }, [])
}

export default useResumeRepaint
