import { Plus, Search, Folder, PanelRight, Workflow, Settings, Pin } from "lucide-react"
import { useTranslation } from "react-i18next"
import { getNotes, NoteData } from "@/api/note"
import useCurrentWorkspaceId from "@/hooks/use-currentworkspace-id"
import useCreateNote from "@/hooks/use-create-note"
import { Link, useLocation } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import WorkspaceMenu from "@/components/workspacemenu/WorkspaceMenu"
import UserMenu from "@/components/usermenu/UserMenu"

const PAGE_SIZE = 30

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

interface WorkspaceSidebarProps {
    isOpen: boolean
    onClose: () => void
}

const WorkspaceSidebar = ({ isOpen, onClose }: WorkspaceSidebarProps) => {
    const currentWorkspaceId = useCurrentWorkspaceId()
    const { t } = useTranslation()
    const location = useLocation()
    const { handleCreateNote, isPending: isCreatingNote } = useCreateNote()

    const notesBase = `/workspaces/${currentWorkspaceId}/notes`

    const { data: pinnedNotes = [] } = useQuery<NoteData[]>({
        queryKey: ['notes', currentWorkspaceId, 'pinned'],
        queryFn: () => getNotes(currentWorkspaceId, 1, PAGE_SIZE, "", undefined, undefined, true),
        enabled: !!currentWorkspaceId,
        refetchOnWindowFocus: false,
        staleTime: 0,
    })

    const isSearchActive = location.pathname.endsWith('/search')
    const isFilesActive = location.pathname.endsWith('/files')
    const isWorkflowsActive = location.pathname.includes('/workflows')
    const isSettingsActive = location.pathname.endsWith('/settings') && !location.pathname.includes('/workflows')

    return (
        <div
            className={`w-full lg:w-[240px] h-full flex flex-col shrink-0 bg-neutral-50 dark:bg-neutral-800 border-r border-neutral-200 dark:border-neutral-700 ${isOpen ? "flex" : "hidden lg:flex"}`}
        >
            {/* Workspace menu */}
            <div className="px-3 pt-3 pb-1 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                    <WorkspaceMenu />
                </div>
                <button
                    aria-label="close sidebar"
                    className="lg:hidden shrink-0 p-2 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 text-gray-500 dark:text-gray-400"
                    onClick={onClose}
                >
                    <PanelRight size={16} />
                </button>
            </div>

            {/* Note list */}
            <nav className="px-3 py-1 flex-1 overflow-auto">
                <button
                    onClick={() => { onClose(); handleCreateNote() }}
                    disabled={isCreatingNote}
                    className="w-full flex items-center gap-2 px-3 py-2.5 lg:px-3 lg:py-2 rounded-md text-sm cursor-pointer select-none transition-colors duration-100 text-gray-400 dark:text-gray-500 hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-40"
                >
                    <Plus className="shrink-0 size-4 lg:size-3.5" />
                    <span className="leading-snug">{t("actions.newNote")}</span>
                </button>
                <Link
                    to={`${notesBase}/search`}
                    onClick={onClose}
                    className={[
                        "w-full flex items-center gap-2 px-3 py-2.5 lg:px-3 lg:py-2 rounded-md text-sm cursor-pointer select-none transition-colors duration-100",
                        isSearchActive
                            ? "bg-neutral-200 dark:bg-neutral-700 text-gray-900 dark:text-gray-100 font-medium"
                            : "text-gray-400 dark:text-gray-500 hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-gray-700 dark:hover:text-gray-300"
                    ].join(" ")}
                >
                    <Search className="shrink-0 size-4 lg:size-3.5" />
                    <span className="leading-snug">{t("placeholder.search")}</span>
                </Link>
                <Link
                    to={`${notesBase}/files`}
                    onClick={onClose}
                    className={[
                        "w-full flex items-center gap-2 px-3 py-2.5 lg:px-3 lg:py-2 rounded-md text-sm cursor-pointer select-none transition-colors duration-100",
                        isFilesActive
                            ? "bg-neutral-200 dark:bg-neutral-700 text-gray-900 dark:text-gray-100 font-medium"
                            : "text-gray-400 dark:text-gray-500 hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-gray-700 dark:hover:text-gray-300"
                    ].join(" ")}
                >
                    <Folder className="shrink-0 size-4 lg:size-3.5" />
                    <span className="leading-snug">{t("menu.files")}</span>
                </Link>
                <Link
                    to={`${notesBase}/workflows`}
                    onClick={onClose}
                    className={[
                        "w-full flex items-center gap-2 px-3 py-2.5 lg:px-3 lg:py-2 rounded-md text-sm cursor-pointer select-none transition-colors duration-100",
                        isWorkflowsActive
                            ? "bg-neutral-200 dark:bg-neutral-700 text-gray-900 dark:text-gray-100 font-medium"
                            : "text-gray-400 dark:text-gray-500 hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-gray-700 dark:hover:text-gray-300"
                    ].join(" ")}
                >
                    <Workflow className="shrink-0 size-4 lg:size-3.5" />
                    <span className="leading-snug">{t("menu.workflows")}</span>
                </Link>
                <Link
                    to={`${notesBase}/settings`}
                    onClick={onClose}
                    className={[
                        "w-full flex items-center gap-2 px-3 py-2.5 lg:px-3 lg:py-2 rounded-md text-sm cursor-pointer select-none transition-colors duration-100",
                        isSettingsActive
                            ? "bg-neutral-200 dark:bg-neutral-700 text-gray-900 dark:text-gray-100 font-medium"
                            : "text-gray-400 dark:text-gray-500 hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-gray-700 dark:hover:text-gray-300"
                    ].join(" ")}
                >
                    <Settings className="shrink-0 size-4 lg:size-3.5" />
                    <span className="leading-snug">{t("menu.workspaceSettings")}</span>
                </Link>
                {pinnedNotes.length > 0 && (
                    <div className="mb-2">
                        <div className="px-1 py-2 text-xs font-medium text-gray-400 dark:text-neutral-600 select-none">
                            {t("common.pinned")}
                        </div>
                        {pinnedNotes.map((note: NoteData) => (
                            <Link
                                key={note.id}
                                to={`${notesBase}/${note.id}`}
                                onClick={onClose}
                                className="flex items-center gap-2 py-2.5 px-3 lg:py-2 rounded-md text-sm cursor-pointer select-none transition-colors duration-100 group text-gray-600 dark:text-gray-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-gray-900 dark:hover:text-gray-100"
                            >
                                <Pin className="shrink-0 opacity-50 size-4 lg:size-3.5" />
                                <span className="truncate leading-snug">
                                    {getNoteTitle(note)}
                                </span>
                            </Link>
                        ))}
                    </div>
                )}
            </nav>

            {/* User menu */}
            <div className="shrink-0 p-2 border-t border-neutral-200 dark:border-neutral-700">
                <UserMenu />
            </div>
        </div>
    )
}

export default WorkspaceSidebar
