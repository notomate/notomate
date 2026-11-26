import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useQuery } from "@tanstack/react-query"
import { Edit, Folder, MessageSquare, Pin, Settings, Workflow, type LucideIcon } from "lucide-react"
import { getNotes, NoteData } from "@/api/note"
import useCreateNote from "@/hooks/use-create-note"
import { useWorkspaceStore } from "@/stores/workspace"

const PINNED_PAGE_SIZE = 30

const tileClass = "flex items-center gap-2 px-3 py-2 rounded-lg text-sm border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-gray-700 dark:text-gray-200 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"

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

/**
 * Top of the workspace home: the workspace name, New note, links to the
 * workspace's other pages, and its pinned notes. The note search follows below.
 */
const WorkspaceHomeHeader = ({ workspaceId }: { workspaceId: string }) => {
    const { t } = useTranslation()
    const { getWorkspaceById } = useWorkspaceStore()
    const workspaceName = getWorkspaceById(workspaceId)?.name
    const { handleCreateNote, isPending: isCreatingNote } = useCreateNote(workspaceId)

    const { data: pinnedNotes = [] } = useQuery<NoteData[]>({
        queryKey: ['notes', workspaceId, 'pinned'],
        queryFn: () => getNotes(workspaceId, 1, PINNED_PAGE_SIZE, "", undefined, undefined, true),
        refetchOnWindowFocus: false,
        staleTime: 0,
    })

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
                {links.map(({ to, label, icon: Icon }) => (
                    <Link key={to} to={to} className={tileClass}>
                        <Icon size={16} className="shrink-0 text-muted-foreground" />
                        <span className="truncate">{label}</span>
                    </Link>
                ))}
            </div>
            {pinnedNotes.length > 0 && (
                <div className="mt-4">
                    <div className="px-1 pb-2 text-xs font-medium text-muted-foreground select-none">
                        {t("common.pinned")}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {pinnedNotes.map((note) => (
                            <Link
                                key={note.id}
                                to={`${base}/notes/${note.id}`}
                                className="inline-flex items-center gap-1.5 max-w-full px-2.5 py-1 rounded-full text-sm bg-neutral-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-200 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                            >
                                <Pin size={12} className="shrink-0 opacity-60" />
                                <span className="truncate">{getNoteTitle(note)}</span>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

export default WorkspaceHomeHeader
