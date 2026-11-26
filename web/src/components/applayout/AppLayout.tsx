import { createContext, useContext, useEffect, useState } from "react"
import { Outlet, useLocation, useMatch } from "react-router-dom"
import { useWorkspaceStore } from "@/stores/workspace"
import { useCurrentUserStore } from "@/stores/current-user"
import { setLastWorkspaceId } from "@/lib/recent-visits"
import AppSidebar from "@/components/appsidebar/AppSidebar"

interface AppLayoutContextValue {
    onOpenSidebar: () => void
}

const AppLayoutContext = createContext<AppLayoutContextValue>({ onOpenSidebar: () => {} })

/** Lets a page's mobile top bar open the sidebar. */
export const useAppLayout = () => useContext(AppLayoutContext)

/**
 * Shell for workspace pages and top-level pages (Explore, About, account settings).
 * The sidebar stays mounted across both. Each page renders its own mobile top bar;
 * workspace pages also render the workspace tab bar.
 */
const AppLayout = () => {
    const { user } = useCurrentUserStore()
    const { isFetched, fetchWorkspaces } = useWorkspaceStore()
    const { pathname } = useLocation()
    // The layout sits above the workspace route, so read the id from the URL.
    const workspaceId = useMatch("/workspaces/:workspaceId/*")?.params.workspaceId
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)

    useEffect(() => {
        if (user && !isFetched) fetchWorkspaces()
    }, [user])

    useEffect(() => {
        if (workspaceId) setLastWorkspaceId(workspaceId)
    }, [workspaceId])

    // Close the mobile sidebar after any navigation.
    useEffect(() => {
        setIsSidebarOpen(false)
    }, [pathname])

    return (
        <div className="flex h-svh">
            <AppSidebar
                workspaceId={workspaceId}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
            />
            <div className="flex-1 flex flex-col overflow-hidden">
                <AppLayoutContext.Provider value={{ onOpenSidebar: () => setIsSidebarOpen(true) }}>
                    <Outlet />
                </AppLayoutContext.Provider>
            </div>
        </div>
    )
}

export default AppLayout
