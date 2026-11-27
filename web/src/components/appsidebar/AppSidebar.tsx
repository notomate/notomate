import { ReactNode, useState } from "react"
import { PanelRight, Compass, Info, Plus, Settings, type LucideIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link, useLocation, useNavigate } from "react-router-dom"
import UserMenu from "@/components/usermenu/UserMenu"
import PreferenceControls from "./PreferenceControls"
import { useCurrentUserStore } from "@/stores/current-user"
import { useWorkspaceStore } from "@/stores/workspace"
import { createWorkspace } from "@/api/workspace"
import logo from "@/assets/app.svg"

const navItemBase = "w-full flex items-center gap-2 px-3 py-2.5 lg:px-3 lg:py-2 rounded-md text-sm cursor-pointer select-none transition-colors duration-100 hover:bg-neutral-100 dark:hover:bg-neutral-800"
const navItemClass = `${navItemBase} text-muted-foreground hover:text-gray-700 dark:hover:text-gray-300`
const navItemActiveClass = `${navItemBase} text-gray-900 dark:text-gray-100 font-semibold`
const groupLabelClass = "px-1 pt-4 pb-2 text-xs font-medium text-muted-foreground select-none"

interface NavItemProps {
    to: string
    icon?: LucideIcon
    active?: boolean
    onClick: () => void
    children: ReactNode
}

const NavItem = ({ to, icon: Icon, active = false, onClick, children }: NavItemProps) => (
    <Link to={to} onClick={onClick} className={active ? navItemActiveClass : navItemClass}>
        {Icon && <Icon className="shrink-0 size-4 lg:size-3.5" />}
        <span className="leading-snug truncate">{children}</span>
    </Link>
)

/** Every workspace the user belongs to, plus an inline field to create one. */
const WorkspaceList = ({ workspaceId, onClose }: { workspaceId?: string, onClose: () => void }) => {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const { workspaces, fetchWorkspaces } = useWorkspaceStore()
    const [isCreating, setIsCreating] = useState(false)
    const [name, setName] = useState("")

    const stopCreating = () => {
        setIsCreating(false)
        setName("")
    }

    const handleCreate = async () => {
        const trimmed = name.trim()
        if (!trimmed) return stopCreating()
        try {
            const workspace = await createWorkspace({ name: trimmed })
            await fetchWorkspaces()
            stopCreating()
            if (workspace.id) navigate(`/workspaces/${workspace.id}`)
        } catch (error) {
            console.error("Failed to create workspace:", error)
        }
    }

    return (
        <div>
            <div className={groupLabelClass}>{t("menu.workspaces")}</div>
            {workspaces.map(w => (
                <NavItem key={w.id} to={`/workspaces/${w.id}`} onClick={onClose} active={w.id === workspaceId}>
                    <span className="inline-flex items-center gap-2 min-w-0">
                        <span className="shrink-0 grid place-items-center size-5 rounded bg-neutral-200 dark:bg-neutral-700 text-[11px] font-semibold uppercase">
                            {w.name.slice(0, 1)}
                        </span>
                        <span className="truncate">{w.name}</span>
                    </span>
                </NavItem>
            ))}
            {isCreating ? (
                <form
                    className="px-1 py-1"
                    onSubmit={(e) => { e.preventDefault(); handleCreate() }}
                >
                    <input
                        autoFocus
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onBlur={() => { if (!name.trim()) stopCreating() }}
                        onKeyDown={(e) => { if (e.key === "Escape") stopCreating() }}
                        placeholder={t("pages.workspaceSetup.workspaceName")}
                        className="w-full px-2 py-1.5 rounded-md text-sm border dark:border-neutral-600 bg-white dark:bg-neutral-700 dark:text-neutral-100"
                    />
                </form>
            ) : (
                <button onClick={() => setIsCreating(true)} className={navItemClass}>
                    <Plus className="shrink-0 size-4 lg:size-3.5" />
                    <span className="leading-snug">{t("menu.newWorkspace")}</span>
                </button>
            )}
        </div>
    )
}

interface AppSidebarProps {
    /** The workspace of the current page; undefined on top-level pages. */
    workspaceId?: string
    isOpen: boolean
    onClose: () => void
}

/**
 * The app sidebar: top-level pages and the list of workspaces. A workspace's
 * own pages (notes, files, workflows…) are reached from the tab bar inside it.
 */
const AppSidebar = ({ workspaceId, isOpen, onClose }: AppSidebarProps) => {
    const { t } = useTranslation()
    const { pathname } = useLocation()
    const { user } = useCurrentUserStore()

    return (
        <>
        {/* Mobile: dim the page behind the slide-out sidebar; tap to close. */}
        <div
            aria-hidden
            onClick={onClose}
            className={`lg:hidden fixed inset-0 z-drawer-backdrop bg-black/40 transition-opacity duration-200 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        />
        <div
            className={`fixed inset-y-0 left-0 z-drawer w-[280px] max-w-[85vw] shadow-xl transition-transform duration-200 ease-out ${isOpen ? "translate-x-0" : "-translate-x-full"} lg:static lg:z-auto lg:w-[240px] lg:max-w-none lg:shadow-none lg:translate-x-0 lg:transition-none h-full flex flex-col shrink-0 bg-neutral-50 dark:bg-neutral-800 border-r border-neutral-200 dark:border-neutral-700`}
        >
            <div className="px-3 pt-3 pb-1 flex items-center gap-2">
                <div className="flex-1 min-w-0 flex items-center gap-2 px-2 py-1.5 select-none">
                    <img src={logo} className="w-6 shrink-0 dark:invert" alt="logo" />
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">Notomate</span>
                </div>
                <button
                    aria-label="close sidebar"
                    className="lg:hidden shrink-0 p-2 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 text-muted-foreground"
                    onClick={onClose}
                >
                    <PanelRight size={16} />
                </button>
            </div>

            <nav className="px-3 py-1 flex-1 overflow-auto">
                <NavItem to="/explore" icon={Compass} onClick={onClose} active={pathname.startsWith("/explore")}>
                    {t("menu.explore")}
                </NavItem>
                <NavItem to="/about" icon={Info} onClick={onClose} active={pathname.startsWith("/about")}>
                    {t("menu.about")}
                </NavItem>
                {user && (
                    <NavItem to="/account" icon={Settings} onClick={onClose} active={pathname.startsWith("/account")}>
                        {t("menu.settings")}
                    </NavItem>
                )}
                {user && <WorkspaceList workspaceId={workspaceId} onClose={onClose} />}
            </nav>

            <div className="shrink-0 px-2 pb-1">
                <PreferenceControls />
            </div>

            <div className="shrink-0 p-2 border-t border-neutral-200 dark:border-neutral-700">
                <UserMenu />
            </div>
        </div>
        </>
    )
}

export default AppSidebar
