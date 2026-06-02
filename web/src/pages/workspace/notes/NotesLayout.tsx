import { Plus, Search, X, FileText, Folder, PanelRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { getNotes, NoteData, createNote } from "@/api/note"
import useCurrentWorkspaceId from "@/hooks/use-currentworkspace-id"
import { Link, Outlet, useNavigate, useParams, useLocation } from "react-router-dom"
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRef, useCallback, useState, useEffect } from "react"
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
    const [query, setQuery] = useState("")
    const [debouncedQuery, setDebouncedQuery] = useState(query);
    const currentWorkspaceId = useCurrentWorkspaceId();
    const [isSearchVisible, setIsSearchVisible] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY)
    const { t } = useTranslation()
    const queryClient = useQueryClient()
    const observerRef = useRef<IntersectionObserver | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);
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

    useEffect(() => {
        const handler = setTimeout(() => setDebouncedQuery(query), 300);
        return () => clearTimeout(handler);
    }, [query]);

    const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
        queryKey: ['notes', currentWorkspaceId, debouncedQuery],
        queryFn: async ({ pageParam = 1 }: { pageParam?: unknown }) => {
            const parentId = debouncedQuery ? undefined : "null"
            return await getNotes(currentWorkspaceId, Number(pageParam), PAGE_SIZE, debouncedQuery, undefined, parentId)
        },
        enabled: !!currentWorkspaceId,
        getNextPageParam: (lastPage, allPages) =>
            lastPage.length === PAGE_SIZE ? allPages.length + 1 : undefined,
        refetchOnWindowFocus: false,
        staleTime: 0,
        initialPageParam: 1
    })

    const loadMoreRef = useCallback((node: HTMLDivElement | null) => {
        if (observerRef.current) observerRef.current.disconnect();
        if (node && hasNextPage && !isFetchingNextPage && scrollContainerRef.current) {
            observerRef.current = new IntersectionObserver(
                (entries) => { if (entries[0].isIntersecting) fetchNextPage() },
                { root: scrollContainerRef.current, rootMargin: '50px', threshold: 0.1 }
            );
            observerRef.current.observe(node);
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    const notes = data?.pages.flat() || [];
    const visibleNotes = isSearchVisible ? notes : notes.slice(0, displayCount);
    const remaining = notes.length - displayCount;

    return (
        <div className="flex h-svh">
            {/* Notes sidebar */}
            <div
                className={`w-full xl:w-[240px] h-full flex flex-col shrink-0 bg-neutral-50 dark:bg-neutral-800 border-r border-neutral-200 dark:border-neutral-700 ${isSidebarOpen ? "flex" : "hidden xl:flex"}`}
            >
                {/* Workspace menu */}
                {!isSearchVisible && (
                <div className="px-3 pt-3 pb-1 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                        <WorkspaceMenu />
                    </div>
                    <button
                        aria-label="close sidebar"
                        className="xl:hidden shrink-0 p-2 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 text-gray-500 dark:text-gray-400"
                        onClick={() => setIsSidebarOpen(false)}
                    >
                        <PanelRight size={16} />
                    </button>
                </div>
                )}

                {/* Note list */}
                <nav ref={scrollContainerRef} className="px-3 py-1 flex-1 overflow-auto">
                    {!isSearchVisible && (
                        <button
                            onClick={handleCreateNote}
                            disabled={createNoteMutation.isPending}
                            className="w-full flex items-center gap-2 px-3 py-2.5 xl:px-3 xl:py-2 rounded-md text-sm cursor-pointer select-none transition-colors duration-100 text-gray-400 dark:text-gray-500 hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-40"
                        >
                            <Plus className="shrink-0 size-4 xl:size-3.5" />
                            <span className="leading-snug">{t("actions.newNote")}</span>
                        </button>
                    )}
                    {!isSearchVisible && (
                        <Link
                            to="files"
                            onClick={() => setIsSidebarOpen(false)}
                            className={(() => {
                                const isActive = location.pathname.endsWith('/files')
                                return [
                                    "w-full flex items-center gap-2 px-3 py-2.5 xl:px-3 xl:py-2 rounded-md text-sm cursor-pointer select-none transition-colors duration-100",
                                    isActive
                                        ? "bg-neutral-200 dark:bg-neutral-700 text-gray-900 dark:text-gray-100 font-medium"
                                        : "text-gray-400 dark:text-gray-500 hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-gray-700 dark:hover:text-gray-300"
                                ].join(" ")
                            })()}
                        >
                            <Folder className="shrink-0 size-4 xl:size-3.5" />
                            <span className="leading-snug">{t("menu.files")}</span>
                        </Link>
                    )}
                    {isSearchVisible ? (
                        <div className="py-2.5 xl:py-2">
                            <div className="flex items-center gap-2 py-2 px-3 rounded-md border dark:border-neutral-700 bg-white dark:bg-neutral-900 dark:text-neutral-100">
                                <Search size={13} className="text-gray-400 shrink-0" />
                                <input
                                    autoFocus
                                    type="text"
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                    className="bg-transparent flex-1 text-sm outline-none min-w-0"
                                    placeholder={t("placeholder.search")}
                                />
                                <button title="close search" className="shrink-0" onClick={() => { setIsSearchVisible(false); setQuery(""); setDisplayCount(INITIAL_DISPLAY) }}>
                                    <X size={13} className="text-gray-400" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            aria-label="search"
                            onClick={() => setIsSearchVisible(true)}
                            className="w-full flex items-center gap-2 px-3 py-2.5 xl:px-3 xl:py-2 rounded-md text-sm cursor-pointer select-none transition-colors duration-100 text-gray-400 dark:text-gray-500 hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-gray-700 dark:hover:text-gray-300"
                        >
                            <Search className="shrink-0 size-4 xl:size-3.5" />
                            <span className="leading-snug">{t("placeholder.search")}</span>
                        </button>
                    )}
                    {isLoading ? (
                        <div className="flex flex-col gap-0.5 py-1">
                            {Array.from({ length: INITIAL_DISPLAY }).map((_, i) => (
                                <div key={i} className="h-7 rounded-md bg-neutral-200 dark:bg-neutral-800 animate-pulse" style={{ width: `${60 + (i * 13) % 35}%` }} />
                            ))}
                        </div>
                    ) : notes.length === 0 ? (
                        <div className="px-5 py-4 xl:px-3 text-xs text-gray-400 dark:text-neutral-600">
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
                                            "flex items-center gap-2 px-3 py-2.5 xl:px-3 xl:py-2 rounded-md text-sm cursor-pointer select-none transition-colors duration-100 group",
                                            isActive
                                                ? "bg-neutral-200 dark:bg-neutral-700 text-gray-900 dark:text-gray-100 font-medium"
                                                : "text-gray-600 dark:text-gray-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-gray-900 dark:hover:text-gray-100"
                                        ].join(" ")
                                    })()}
                                >
                                    <FileText className="shrink-0 opacity-50 size-4 xl:size-3.5" />
                                    <span className="truncate leading-snug">
                                        {getNoteTitle(note)}
                                    </span>
                                </Link>
                            ))}
                            {!isSearchVisible && (remaining > 0 || hasNextPage) && (
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
                                    className="w-full flex items-center gap-2 px-3 py-2.5 xl:px-3 xl:py-2 rounded-md text-sm cursor-pointer select-none transition-colors duration-100 text-gray-400 dark:text-gray-500 hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-40"
                                >
                                    <span className="leading-snug pl-6 xl:pl-5">
                                        {isFetchingNextPage ? "..." : `+${remaining > 0 ? Math.min(remaining, INITIAL_DISPLAY) : INITIAL_DISPLAY} more`}
                                    </span>
                                </button>
                            )}
                            {isSearchVisible && (
                                <>
                                    <div ref={loadMoreRef} className="h-2" />
                                    {isFetchingNextPage && (
                                        <div className="flex flex-col gap-0.5 py-1">
                                            {Array.from({ length: 3 }).map((_, i) => (
                                                <div key={i} className="h-7 rounded-md bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </nav>

                {/* User menu */}
                <div className="shrink-0 px-3 pb-3 pt-1 border-t border-neutral-200 dark:border-neutral-700">
                    <UserMenu />
                </div>
            </div>

            {/* Main content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Mobile header */}
                <div className="shrink-0 py-3 pl-4 pr-5  xl:hidden flex items-center justify-between border-b border-neutral-200 dark:border-neutral-700">
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
