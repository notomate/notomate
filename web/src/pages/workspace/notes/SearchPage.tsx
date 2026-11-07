import { useCallback, useEffect, useRef, useState } from "react"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { Search, Trash2, UserRound } from "lucide-react"
import { useTranslation } from "react-i18next"
import { getNotes } from "@/api/note"
import { getWorkspaceMembers } from "@/api/workspace"
import useCurrentWorkspaceId from "@/hooks/use-currentworkspace-id"
import NoteList from "@/components/notecard/NoteList"
import NoteListSkeleton from "@/components/notecard/NoteListSkeleton"

const PAGE_SIZE = 30

const SearchPage = () => {
    const { t } = useTranslation()
    const currentWorkspaceId = useCurrentWorkspaceId()
    const [query, setQuery] = useState("")
    const [debouncedQuery, setDebouncedQuery] = useState("")
    const [creatorId, setCreatorId] = useState("")
    const observerRef = useRef<IntersectionObserver | null>(null)
    const scrollRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        const handler = setTimeout(() => setDebouncedQuery(query.trim()), 300)
        return () => clearTimeout(handler)
    }, [query])

    // Reset the creator filter when switching workspaces; the members differ.
    useEffect(() => setCreatorId(""), [currentWorkspaceId])

    const { data: members = [] } = useQuery({
        queryKey: ["workspaceMembers", currentWorkspaceId],
        queryFn: () => getWorkspaceMembers(currentWorkspaceId),
        enabled: !!currentWorkspaceId,
    })

    const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
        queryKey: ["notes-search", currentWorkspaceId, debouncedQuery, creatorId],
        queryFn: async ({ pageParam = 1 }: { pageParam?: unknown }) =>
            await getNotes(currentWorkspaceId, Number(pageParam), PAGE_SIZE, debouncedQuery, undefined, undefined, undefined, creatorId),
        enabled: !!currentWorkspaceId,
        getNextPageParam: (lastPage, allPages) =>
            lastPage.length === PAGE_SIZE ? allPages.length + 1 : undefined,
        refetchOnWindowFocus: false,
        staleTime: 0,
        initialPageParam: 1,
    })

    const notes = data?.pages.flat() || []

    const loadMoreRef = useCallback((node: HTMLDivElement | null) => {
        if (observerRef.current) observerRef.current.disconnect()
        if (node && hasNextPage && !isFetchingNextPage) {
            observerRef.current = new IntersectionObserver(
                (entries) => { if (entries[0].isIntersecting) fetchNextPage() },
                { root: scrollRef.current, rootMargin: "100px", threshold: 0.1 }
            )
            observerRef.current.observe(node)
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage])

    return (
        <div className="h-full flex flex-col bg-neutral-50 dark:bg-neutral-950">
            <div ref={scrollRef} className="flex-1 overflow-auto">      
                <div className="w-full lg:max-w-[600px] px-2 pt-2 xl:pt-4 pb-2 mx-auto">
                    <div className="relative">
                        <Search
                            size={16}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                        />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={t("placeholder.search")}
                            className="w-full pl-9 pr-9 py-2.5 text-sm rounded-lg bg-neutral-50 dark:bg-neutral-950 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none"
                        />
                        {query && (
                            <button
                                onClick={() => setQuery("")}
                                title={t("common.clear")}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-red-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>
                    <div className="px-2 pt-2">
                        <label className="inline-flex items-center gap-1.5 max-w-full px-2 py-1 rounded-full text-xs bg-neutral-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-200">
                            <UserRound size={14} className="shrink-0 text-muted-foreground" />
                            <select
                                value={creatorId}
                                onChange={(e) => setCreatorId(e.target.value)}
                                aria-label={t("common.creator")}
                                className="min-w-0 bg-transparent outline-none cursor-pointer truncate"
                            >
                                <option value="">{t("common.allCreators")}</option>
                                {members.map((m) => (
                                    <option key={m.user_id} value={m.user_id}>{m.user_name}</option>
                                ))}
                            </select>
                        </label>
                    </div>
                </div>
                <div className="w-full lg:max-w-[600px] mx-auto">
                    {isLoading ? (
                        <NoteListSkeleton />
                    ) : notes.length === 0 ? (
                        <div className="text-center text-muted-foreground py-16 text-sm">
                            {debouncedQuery || creatorId ? t("common.noResults") : t("messages.noMoreNotes")}
                        </div>
                    ) : (
                        <>
                            <NoteList
                                notes={notes}
                                getLinkTo={(note) => `/workspaces/${currentWorkspaceId}/notes/${note.id}`}
                                maxNodes={100}
                                workspaceId={currentWorkspaceId}
                                showActions
                                onCreatorClick={(note) => {
                                    setCreatorId(note.created_by_id!)
                                    scrollRef.current?.scrollTo({ top: 0 })
                                }}
                            />
                            <div ref={loadMoreRef} className="h-2" />
                            {isFetchingNextPage && <NoteListSkeleton count={3} />}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

export default SearchPage
