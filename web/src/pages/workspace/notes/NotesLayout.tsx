import { Plus, Search, FileText, Folder, PanelRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { getNotes, NoteData, createNote } from "@/api/note"
import useCurrentWorkspaceId from "@/hooks/use-currentworkspace-id"
import { Link, Outlet, useNavigate, useParams, useLocation } from "react-router-dom"
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "@/stores/toast"
import WorkspaceMenu from "@/components/workspacemenu/WorkspaceMenu"
import { useWorkspaceStore } from "@/stores/workspace"
import UserMenu from "@/components/usermenu/UserMenu"

const PAGE_SIZE = 30;
const INITIAL_DISPLAY = 5;

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

const NotesLayout = () => {
    const currentWorkspaceId = useCurrentWorkspaceId();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY)
    const { t } = useTranslation()
    const queryClient = useQueryClient()
    const navigate = useNavigate();
    const { noteId } = useParams()
    const location = useLocation()
    const { getWorkspaceById } = useWorkspaceStore()
    const currentWorkspaceName = getWorkspaceById(currentWorkspaceId)?.name

    const createNoteMutation = useMutation({
        mutationFn: (data: NoteData) => createNote(currentWorkspaceId, data),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['notes', currentWorkspaceId] })
            navigate(`./${data.id}?mode=edit`)
        },
        onError: (error) => {
            toast.error(t("messages.createNoteFailed"))
            console.error("Failed to create note:", error)
        }
    })

    const handleCreateNote = () => {
        const emptyContent = JSON.stringify({
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: "" }] }]
        })
        setIsSidebarOpen(false)
        createNoteMutation.mutate({ content: emptyContent, visibility: "private" })
    }

    const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
        queryKey: ['notes', currentWorkspaceId],
        queryFn: async ({ pageParam = 1 }: { pageParam?: unknown }) =>
            await getNotes(currentWorkspaceId, Number(pageParam), PAGE_SIZE, "", undefined, "null"),
        enabled: !!currentWorkspaceId,
        getNextPageParam: (lastPage, allPages) =>
            lastPage.length === PAGE_SIZE ? allPages.length + 1 : undefined,
        refetchOnWindowFocus: false,
        staleTime: 0,
        initialPageParam: 1
    })

    const notes = data?.pages.flat() || [];
    const visibleNotes = notes.slice(0, displayCount);
    const remaining = notes.length - displayCount;

    const isSearchActive = location.pathname.endsWith('/search')

    return (
        <div className="flex h-svh">
            {/* Notes sidebar */}
            <div
                className={`w-full lg:w-[240px] h-full flex flex-col shrink-0 bg-neutral-50 dark:bg-neutral-800 border-r border-neutral-200 dark:border-neutral-700 ${isSidebarOpen ? "flex" : "hidden lg:flex"}`}
            >
                {/* Workspace menu */}
                <div className="px-3 pt-3 pb-1 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                        <WorkspaceMenu />
                    </div>
                    <button
                        aria-label="close sidebar"
                        className="lg:hidden shrink-0 p-2 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 text-gray-500 dark:text-gray-400"
                        onClick={() => setIsSidebarOpen(false)}
                    >
                        <PanelRight size={16} />
                    </button>
                </div>

                {/* Note list */}
                <nav className="px-3 py-1 flex-1 overflow-auto">
                    <button
                        onClick={handleCreateNote}
                        disabled={createNoteMutation.isPending}
                        className="w-full flex items-center gap-2 px-3 py-2.5 lg:px-3 lg:py-2 rounded-md text-sm cursor-pointer select-none transition-colors duration-100 text-gray-400 dark:text-gray-500 hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-40"
                    >
                        <Plus className="shrink-0 size-4 lg:size-3.5" />
                        <span className="leading-snug">{t("actions.newNote")}</span>
                    </button>
                    <Link
                        to="search"
                        onClick={() => setIsSidebarOpen(false)}
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
                        to="files"
                        onClick={() => setIsSidebarOpen(false)}
                        className={(() => {
                            const isActive = location.pathname.endsWith('/files')
                            return [
                                "w-full flex items-center gap-2 px-3 py-2.5 lg:px-3 lg:py-2 rounded-md text-sm cursor-pointer select-none transition-colors duration-100",
                                isActive
                                    ? "bg-neutral-200 dark:bg-neutral-700 text-gray-900 dark:text-gray-100 font-medium"
                                    : "text-gray-400 dark:text-gray-500 hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-gray-700 dark:hover:text-gray-300"
                            ].join(" ")
                        })()}
                    >
                        <Folder className="shrink-0 size-4 lg:size-3.5" />
                        <span className="leading-snug">{t("menu.files")}</span>
                    </Link>
                    {isLoading ? (
                        <div className="flex flex-col gap-0.5 py-1">
                            {Array.from({ length: INITIAL_DISPLAY }).map((_, i) => (
                                <div key={i} className="h-7 rounded-md bg-neutral-200 dark:bg-neutral-800 animate-pulse" style={{ width: `${60 + (i * 13) % 35}%` }} />
                            ))}
                        </div>
                    ) : notes.length === 0 ? (
                        <div className="px-5 py-4 lg:px-3 text-xs text-gray-400 dark:text-neutral-600">
                            {t("messages.noMoreNotes")}
                        </div>
                    ) : (
                        <>
                            {visibleNotes.map((note: NoteData) => (
                                <Link
                                    key={note.id}
                                    to={`${note.id}`}
                                    onClick={() => setIsSidebarOpen(false)}
                                    className={(() => {
                                        const isActive = noteId === note.id
                                        return [
                                            "flex items-center gap-2 px-3 py-2.5 lg:px-3 lg:py-2 rounded-md text-sm cursor-pointer select-none transition-colors duration-100 group",
                                            isActive
                                                ? "bg-neutral-200 dark:bg-neutral-700 text-gray-900 dark:text-gray-100 font-medium"
                                                : "text-gray-600 dark:text-gray-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-gray-900 dark:hover:text-gray-100"
                                        ].join(" ")
                                    })()}
                                >
                                    <FileText className="shrink-0 opacity-50 size-4 lg:size-3.5" />
                                    <span className="truncate leading-snug">
                                        {getNoteTitle(note)}
                                    </span>
                                </Link>
                            ))}
                            {(remaining > 0 || hasNextPage) && (
                                <button
                                    onClick={() => {
                                        if (remaining > 0) {
                                            setDisplayCount(c => c + INITIAL_DISPLAY)
                                        } else if (hasNextPage && !isFetchingNextPage) {
                                            fetchNextPage()
                                            setDisplayCount(c => c + INITIAL_DISPLAY)
                                        }
                                    }}
                                    disabled={isFetchingNextPage}
                                    className="w-full flex items-center gap-2 px-3 py-2.5 lg:px-3 lg:py-2 rounded-md text-sm cursor-pointer select-none transition-colors duration-100 text-gray-400 dark:text-gray-500 hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-40"
                                >
                                    <span className="leading-snug pl-6 lg:pl-5">
                                        {isFetchingNextPage ? "..." : `+${remaining > 0 ? Math.min(remaining, INITIAL_DISPLAY) : INITIAL_DISPLAY} more`}
                                    </span>
                                </button>
                            )}
                        </>
                    )}
                </nav>

                {/* User menu */}
                <div className="shrink-0 p-2 border-t border-neutral-200 dark:border-neutral-700">
                    <UserMenu />
                </div>
            </div>

            {/* Main content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Mobile header */}
                <div className="shrink-0 py-3 pl-4 pr-5  lg:hidden flex items-center justify-between border-b border-neutral-200 dark:border-neutral-700">
                    <span className="font-semibold text-gray-700 dark:text-gray-200">
                        {currentWorkspaceName ?? t("menu.notes")}
                    </span>
                    <button
                        className="p-2 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 text-gray-600 dark:text-gray-400"
                        onClick={() => setIsSidebarOpen(prev => !prev)}
                    >
                        <PanelRight size={16} />
                    </button>
                </div>
                <div className="flex-1 overflow-hidden">
                    <Outlet />
                </div>
            </div>

        </div>
    )
}

export default NotesLayout
