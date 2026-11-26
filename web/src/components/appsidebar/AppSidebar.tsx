import { ReactNode } from "react"
import { Plus, Search, Folder, PanelRight, Workflow, Settings, Pin, MessageSquare, Compass, Info, LogIn, ArrowLeft, type LucideIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link, useLocation } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { getNotes, NoteData } from "@/api/note"
import useCreateNote from "@/hooks/use-create-note"
import WorkspaceMenu from "@/components/workspacemenu/WorkspaceMenu"
import UserMenu from "@/components/usermenu/UserMenu"
import { useCurrentUserStore } from "@/stores/current-user"
import { useSettingsSections } from "@/pages/account/settings-sections"
import logo from "@/assets/app.svg"

const PAGE_SIZE = 30

const navItemBase = "w-full flex items-center gap-2 px-3 py-2.5 lg:px-3 lg:py-2 rounded-md text-sm cursor-pointer select-none transition-colors duration-100 hover:bg-neutral-100 dark:hover:bg-neutral-800"
const navItemClass = `${navItemBase} text-muted-foreground hover:text-gray-700 dark:hover:text-gray-300`
const navItemActiveClass = `${navItemBase} text-gray-900 dark:text-gray-100 font-semibold`
const groupLabelClass = "px-1 py-2 text-xs font-medium text-muted-foreground select-none"

function getNoteTitle(note: NoteData): string {
    if (note.title) return note.title
    try {
        const doc = JSON.parse(note.content)
        const firstBlock = doc?.content?.[0]
        const text = firstBlock?.content?.map((n: { text?: string }) => n.text ?? "").join("") ?? ""
        return text.trim() || "New page"
    } catch {
        return "New page"
    }
}

interface NavItemProps {
    to: string
    icon: LucideIcon
    active?: boolean
    onClick: () => void
    children: ReactNode
}

const NavItem = ({ to, icon: Icon, active = false, onClick, children }: NavItemProps) => (
    <Link to={to} onClick={onClick} className={active ? navItemActiveClass : navItemClass}>
        <Icon className="shrink-0 size-4 lg:size-3.5" />
        <span className="leading-snug truncate">{children}</span>
    </Link>
)

/** Workspace features and pinned notes, shown on pages inside a workspace. */
const WorkspaceNav = ({ workspaceId, onClose }: { workspaceId: string, onClose: () => void }) => {
    const { t } = useTranslation()
    const { pathname } = useLocation()
    const { handleCreateNote, isPending: isCreatingNote } = useCreateNote(workspaceId)

    const workspaceBase = `/workspaces/${workspaceId}`
    const notesBase = `${workspaceBase}/notes`

    const { data: pinnedNotes = [] } = useQuery<NoteData[]>({
        queryKey: ['notes', workspaceId, 'pinned'],
        queryFn: () => getNotes(workspaceId, 1, PAGE_SIZE, "", undefined, undefined, true),
        refetchOnWindowFocus: false,
        staleTime: 0,
    })

    return (
        <>
            <button
                onClick={() => { onClose(); handleCreateNote() }}
                disabled={isCreatingNote}
                className={`${navItemClass} disabled:opacity-40`}
            >
                <Plus className="shrink-0 size-4 lg:size-3.5" />
                <span className="leading-snug">{t("actions.newNote")}</span>
            </button>
            <NavItem to={`${notesBase}/search`} icon={Search} onClick={onClose}
                active={pathname === `${notesBase}/search`}>
                {t("placeholder.search")}
            </NavItem>
            <NavItem to={`${workspaceBase}/files`} icon={Folder} onClick={onClose}
                active={pathname === `${workspaceBase}/files`}>
                {t("menu.files")}
            </NavItem>
            <NavItem to={`${workspaceBase}/workflows`} icon={Workflow} onClick={onClose}
                active={pathname.startsWith(`${workspaceBase}/workflows`)}>
                {t("menu.workflows")}
            </NavItem>
            <NavItem to={`${workspaceBase}/messaging`} icon={MessageSquare} onClick={onClose}
                active={pathname.startsWith(`${workspaceBase}/messaging`)}>
                {t("menu.messaging")}
            </NavItem>
            <NavItem to={`${workspaceBase}/settings`} icon={Settings} onClick={onClose}
                active={pathname === `${workspaceBase}/settings`}>
                {t("menu.workspaceSettings")}
            </NavItem>
            {pinnedNotes.length > 0 && (
                <div className="mb-2">
                    <div className={groupLabelClass}>{t("common.pinned")}</div>
                    {pinnedNotes.map((note: NoteData) => (
                        <Link
                            key={note.id}
                            to={`${notesBase}/${note.id}`}
                            onClick={onClose}
                            className="flex items-center gap-2 py-2.5 px-3 lg:py-2 rounded-md text-sm cursor-pointer select-none transition-colors duration-100 group text-muted-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-gray-900 dark:hover:text-gray-100"
                        >
                            <Pin className="shrink-0 opacity-50 size-4 lg:size-3.5" />
                            <span className="truncate leading-snug">
                                {getNoteTitle(note)}
                            </span>
                        </Link>
                    ))}
                </div>
            )}
        </>
    )
}

/** Explore, About and account settings, shown on pages outside a workspace. */
const TopLevelNav = ({ homeWorkspaceId, onClose }: { homeWorkspaceId?: string, onClose: () => void }) => {
    const { t } = useTranslation()
    const { pathname } = useLocation()
    const { user } = useCurrentUserStore()
    const settingsSections = useSettingsSections()
    const isSettings = pathname.startsWith("/account")

    return (
        <>
            {user ? (
                <NavItem to={homeWorkspaceId ? `/workspaces/${homeWorkspaceId}` : "/workspaces"} icon={ArrowLeft} onClick={onClose}>
                    {t("pages.explore.backToWorkspace")}
                </NavItem>
            ) : (
                <NavItem to="/signin" icon={LogIn} onClick={onClose}>
                    {t("actions.signin")}
                </NavItem>
            )}
            {user && isSettings && (
                <div className="mt-2">
                    <div className={groupLabelClass}>{t("menu.settings")}</div>
                    {settingsSections.map((section) => (
                        <NavItem key={section.value} to={`/account/${section.value}`} icon={section.icon} onClick={onClose}
                            active={pathname === `/account/${section.value}`}>
                            {section.label}
                        </NavItem>
                    ))}
                </div>
            )}
            <div className="my-2 border-t border-neutral-200 dark:border-neutral-700" />
            <NavItem to="/explore" icon={Compass} onClick={onClose} active={pathname.startsWith("/explore")}>
                {t("menu.explore")}
            </NavItem>
            <NavItem to="/about" icon={Info} onClick={onClose} active={pathname.startsWith("/about")}>
                {t("menu.about")}
            </NavItem>
        </>
    )
}

interface AppSidebarProps {
    /** The workspace of the current page; undefined on top-level pages. */
    workspaceId?: string
    /** The workspace the header and "Back to workspace" point at: the current one, else the last visited. */
    homeWorkspaceId?: string
    isOpen: boolean
    onClose: () => void
}

/**
 * One sidebar for every page. The frame (header, footer, width) stays the same;
 * the list in the middle switches between workspace features and top-level pages.
 */
const AppSidebar = ({ workspaceId, homeWorkspaceId, isOpen, onClose }: AppSidebarProps) => {
    const { user } = useCurrentUserStore()

    return (
        <div
            className={`w-full lg:w-[240px] h-full flex flex-col shrink-0 bg-neutral-50 dark:bg-neutral-800 border-r border-neutral-200 dark:border-neutral-700 ${isOpen ? "flex" : "hidden lg:flex"}`}
        >
            <div className="px-3 pt-3 pb-1 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                    {user && homeWorkspaceId ? (
                        <WorkspaceMenu workspaceId={homeWorkspaceId} />
                    ) : (
                        <div className="flex items-center gap-2 px-2 py-1.5 select-none">
                            <img src={logo} className="w-6 shrink-0 dark:invert" alt="logo" />
                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">Notomate</span>
                        </div>
                    )}
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
                {workspaceId
                    ? <WorkspaceNav workspaceId={workspaceId} onClose={onClose} />
                    : <TopLevelNav homeWorkspaceId={homeWorkspaceId} onClose={onClose} />}
            </nav>

            {user && (
                <div className="shrink-0 p-2 border-t border-neutral-200 dark:border-neutral-700">
                    <UserMenu />
                </div>
            )}
        </div>
    )
}

export default AppSidebar
