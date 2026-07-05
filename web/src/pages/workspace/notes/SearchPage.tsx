import { useCallback, useEffect, useRef, useState } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"
import { Search, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { getNotes } from "@/api/note"
import useCurrentWorkspaceId from "@/hooks/use-currentworkspace-id"
import NoteList from "@/components/notecard/NoteList"
import NoteListSkeleton from "@/components/notecard/NoteListSkeleton"

const PAGE_SIZE = 30

const SearchPage = () => {
    const { t } = useTranslation()
    const currentWorkspaceId = useCurrentWorkspaceId()
    const [query, setQuery] = useState("")
    const [debouncedQuery, setDebouncedQuery] = useState("")
    const observerRef = useRef<IntersectionObserver | null>(null)
    const scrollRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        const handler = setTimeout(() => setDebouncedQuery(query.trim()), 300)
        return () => clearTimeout(handler)
    }, [query])

    const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
        queryKey: ["notes-search", currentWorkspaceId, debouncedQuery],
        queryFn: async ({ pageParam = 1 }: { pageParam?: unknown }) =>
            await getNotes(currentWorkspaceId, Number(pageParam), PAGE_SIZE, debouncedQuery),
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
                <div className="max-w-2xl px-2 pt-2 xl:pt-4 pb-2 mx-auto">
                    <div className="relative">
                        <Search
                            size={16}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none"
                        />
                        <input
                            autoFocus
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
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>
                <div className="max-w-2xl mx-auto">
                    {isLoading ? (
                        <NoteListSkeleton />
                    ) : notes.length === 0 ? (
                        <div className="text-center text-gray-400 dark:text-neutral-500 py-16 text-sm">
                            {debouncedQuery ? t("common.noResults") : t("messages.noMoreNotes")}
                        </div>
                    ) : (
                        <>
                            <NoteList
                                notes={notes}
                                getLinkTo={(note) => `../${note.id}`}
                                maxNodes={8}
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
