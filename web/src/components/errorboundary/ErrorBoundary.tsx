import { Component, ErrorInfo, ReactNode } from "react"
import { t } from "i18next"
import { RotateCw } from "lucide-react"

interface Props {
    children: ReactNode
}

interface State {
    error: Error | null
    reloading: boolean
}

const RELOAD_KEY = "errorBoundaryReloadedAt"
const RELOAD_COOLDOWN_MS = 10 * 1000

// Allow one automatic reload per cooldown, so an error that happens on every
// load shows the fallback instead of reloading forever.
const canAutoReload = () => {
    try {
        const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0)
        return Date.now() - last > RELOAD_COOLDOWN_MS
    } catch {
        return false
    }
}

const markAutoReload = () => {
    try {
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
    } catch { /* ignore */ }
}

/**
 * Without a boundary React unmounts the whole tree on a render error and
 * leaves a blank page. Reload automatically, and fall back to a reload button
 * if the error comes right back.
 */
class ErrorBoundary extends Component<Props, State> {
    state: State = { error: null, reloading: false }

    static getDerivedStateFromError(error: Error): State {
        return { error, reloading: canAutoReload() }
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error("Uncaught render error:", error, info.componentStack)
        if (this.state.reloading) {
            markAutoReload()
            window.location.reload()
        }
    }

    render() {
        const { error, reloading } = this.state
        if (!error) return this.props.children
        if (reloading) return <div className="w-screen h-dvh bg-neutral-50 dark:bg-neutral-950" />

        return (
            <div className="w-screen h-dvh flex flex-col items-center justify-center gap-4 px-6 text-center bg-neutral-50 dark:bg-neutral-950">
                <p className="text-sm text-muted-foreground">{t("messages.appCrashed")}</p>
                {/* Shown so a crash on a phone, where the console is out of reach, can be reported. */}
                <pre className="max-w-full max-h-40 overflow-auto text-xs text-left text-red-500 whitespace-pre-wrap break-all">
                    {error.message}
                </pre>
                <button
                    onClick={() => window.location.reload()}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                >
                    <RotateCw size={15} />
                    {t("actions.reload")}
                </button>
            </div>
        )
    }
}

export default ErrorBoundary
