import { useCallback, useEffect, useRef, useState } from "react"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { Search, Tag, Trash2, UserRound, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { getSearchTags, searchNotes } from "@/api/search"
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
    const [tags, setTags] = useState<string[]>([])
    const [tagInput, setTagInput] = useState("")
    const observerRef = useRef<IntersectionObserver | null>(null)
    const scrollRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        const handler = setTimeout(() => setDebouncedQuery(query.trim()), 300)
        return () => clearTimeout(handler)
    }, [query])

    // Reset the creator filter when switching workspaces; the members differ.
    useEffect(() => {
        setCreatorId("")
        setTags([])
    }, [currentWorkspaceId])

    // Suggestions for the tag filter; the datalist narrows them as you type.
    const { data: tagSuggestions = [] } = useQuery({
        queryKey: ["search-tags", currentWorkspaceId],
        queryFn: () => getSearchTags(currentWorkspaceId),
        enabled: !!currentWorkspaceId,
        staleTime: 60_000,
    })

    const addTag = (raw: string) => {
        const tag = raw.trim().replace(/^#+/, "").trim()
        setTagInput("")
        if (!tag || tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return
        setTags([...tags, tag])
    }

    const { data: members = [] } = useQuery({
        queryKey: ["workspaceMembers", currentWorkspaceId],
        queryFn: () => getWorkspaceMembers(currentWorkspaceId),
        enabled: !!currentWorkspaceId,
    })

    const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
        queryKey: ["notes-search", currentWorkspaceId, debouncedQuery, creatorId, tags],
        queryFn: async ({ pageParam = 1 }: { pageParam?: unknown }) =>
            await searchNotes(currentWorkspaceId, {
                query: debouncedQuery,
                tags,
                creatorId,
                pageNumber: Number(pageParam),
                pageSize: PAGE_SIZE,
            }),
        enabled: !!currentWorkspaceId,
        getNextPageParam: (lastPage, allPages) =>
            lastPage.notes.length === PAGE_SIZE ? allPages.length + 1 : undefined,
        refetchOnWindowFocus: false,
        staleTime: 0,
        initialPageParam: 1,
    })

    const notes = data?.pages.flatMap((p) => p.notes) || []
    const pending = data?.pages[0]?.pending ?? 0
    const filtering = !!debouncedQuery || tags.length > 0

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
                    <div className="px-2 pt-2 flex flex-wrap items-center gap-1.5">
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
                        {tags.map((tag) => (
                            <span
                                key={tag}
                                className="inline-flex items-center gap-1 max-w-full pl-2 pr-1 py-1 rounded-full text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                            >
                                <span className="truncate">#{tag}</span>
                                <button
                                    onClick={() => setTags(tags.filter((t) => t !== tag))}
                                    title={t("common.removeTag", { tag })}
                                    aria-label={t("common.removeTag", { tag })}
                                    className="shrink-0 rounded-full p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800"
                                >
                                    <X size={12} />
                                </button>
                            </span>
                        ))}
                        <label className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs bg-neutral-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-200">
                            <Tag size={14} className="shrink-0 text-muted-foreground" />
                            <input
                                type="text"
                                list="search-tag-suggestions"
                                value={tagInput}
                                onChange={(e) => {
                                    const value = e.target.value
                                    // Picking a datalist option sets the whole tag at once.
                                    if (tagSuggestions.some((s) => s.tag === value)) addTag(value)
                                    else setTagInput(value)
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === ",") {
                                        e.preventDefault()
                                        addTag(tagInput)
                                    } else if (e.key === "Backspace" && !tagInput && tags.length) {
                                        setTags(tags.slice(0, -1))
                                    }
                                }}
                                onBlur={() => tagInput && addTag(tagInput)}
                                placeholder={t("common.addTag")}
                                aria-label={t("common.tagFilter")}
                                className="w-20 bg-transparent outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
                            />
                            <datalist id="search-tag-suggestions">
                                {tagSuggestions
                                    .filter((s) => !tags.some((t) => t.toLowerCase() === s.tag.toLowerCase()))
                                    .map((s) => (
                                        <option key={s.tag} value={s.tag} label={`${s.tag} (${s.count})`} />
                                    ))}
                            </datalist>
                        </label>
                    </div>
                    {filtering && pending > 0 && (
                        <div className="px-3 pt-2 text-xs text-muted-foreground">
                            {t("common.indexingNotice", { count: pending })}
                        </div>
                    )}
                </div>
                <div className="w-full lg:max-w-[600px] mx-auto">
                    {isLoading ? (
                        <NoteListSkeleton />
                    ) : notes.length === 0 ? (
                        <div className="text-center text-muted-foreground py-16 text-sm">
                            {filtering || creatorId ? t("common.noResults") : t("messages.noMoreNotes")}
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
