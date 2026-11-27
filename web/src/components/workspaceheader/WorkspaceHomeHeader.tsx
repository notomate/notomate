import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useQuery } from "@tanstack/react-query"
import { Edit, Folder, MessageSquare, Pin, Settings, Workflow, type LucideIcon } from "lucide-react"
import { getNotes, NoteData } from "@/api/note"
import useCreateNote from "@/hooks/use-create-note"
import { useWorkspaceStore } from "@/stores/workspace"

/** Pinned notes fetched for the count; a full page shows as "N+". */
const PINNED_COUNT_LIMIT = 100

const tileClass = "flex items-center gap-2 px-3 py-2 rounded-lg text-sm border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-gray-700 dark:text-gray-200 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
const activeTileClass = "flex items-center gap-2 px-3 py-2 rounded-lg text-sm border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 transition-colors hover:bg-blue-100 dark:hover:bg-blue-900/50"

interface WorkspaceHomeHeaderProps {
    workspaceId: string
    /** Whether the note list below shows only pinned notes. */
    pinnedOnly: boolean
    onPinnedOnlyChange: (pinnedOnly: boolean) => void
}

/**
 * Top of the workspace home: the workspace name, New note, links to the
 * workspace's other pages, and a Pinned button that narrows the note list
 * below to pinned notes.
 */
const WorkspaceHomeHeader = ({ workspaceId, pinnedOnly, onPinnedOnlyChange }: WorkspaceHomeHeaderProps) => {
    const { t } = useTranslation()
    const { getWorkspaceById } = useWorkspaceStore()
    const workspaceName = getWorkspaceById(workspaceId)?.name
    const { handleCreateNote, isPending: isCreatingNote } = useCreateNote(workspaceId)

    const { data: pinnedNotes = [] } = useQuery<NoteData[]>({
        queryKey: ['notes', workspaceId, 'pinned'],
        queryFn: () => getNotes(workspaceId, 1, PINNED_COUNT_LIMIT, "", undefined, undefined, true),
        enabled: !!workspaceId,
        refetchOnWindowFocus: false,
        staleTime: 0,
    })
    const pinnedCount = pinnedNotes.length >= PINNED_COUNT_LIMIT ? `${PINNED_COUNT_LIMIT}+` : String(pinnedNotes.length)

    const base = `/workspaces/${workspaceId}`
    const links: { to: string, label: string, icon: LucideIcon }[] = [
        { to: `${base}/files`, label: t("menu.files"), icon: Folder },
        { to: `${base}/workflows`, label: t("menu.workflows"), icon: Workflow },
        { to: `${base}/messaging`, label: t("menu.messaging"), icon: MessageSquare },
        { to: `${base}/settings`, label: t("menu.workspaceSettings"), icon: Settings },
    ]

    return (
        <div className="px-4 pt-4 xl:pt-6">
            {workspaceName && (
                <h1 className="hidden lg:block mb-3 text-xl font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {workspaceName}
                </h1>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button onClick={handleCreateNote} disabled={isCreatingNote} className={tileClass}>
                    <Edit size={16} className="shrink-0" />
                    <span className="truncate">{t("actions.newNote")}</span>
                </button>
                <button
                    type="button"
                    onClick={() => onPinnedOnlyChange(!pinnedOnly)}
                    aria-pressed={pinnedOnly}
                    className={pinnedOnly ? activeTileClass : tileClass}
                >
                    <Pin size={16} className={pinnedOnly ? "shrink-0" : "shrink-0 text-muted-foreground"} />
                    <span className="truncate">{t("common.pinned")}</span>
                    <span className={`ml-auto shrink-0 rounded-full px-1.5 text-xs tabular-nums ${pinnedOnly ? "bg-blue-100 dark:bg-blue-800/60" : "bg-neutral-100 dark:bg-neutral-800 text-muted-foreground"}`}>
                        {pinnedCount}
                    </span>
                </button>
                {links.map(({ to, label, icon: Icon }) => (
                    <Link key={to} to={to} className={tileClass}>
                        <Icon size={16} className="shrink-0 text-muted-foreground" />
                        <span className="truncate">{label}</span>
                    </Link>
                ))}
            </div>
        </div>
    )
}

export default WorkspaceHomeHeader
