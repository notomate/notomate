import { useCallback, useEffect, useRef, useState } from "react"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { Tag, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { getSearchTags, searchNotes } from "@/api/search"
import { getWorkspaceMembers } from "@/api/workspace"
import useCurrentWorkspaceId from "@/hooks/use-currentworkspace-id"
import NoteList from "@/components/notecard/NoteList"
import NoteListSkeleton from "@/components/notecard/NoteListSkeleton"
import CreatorFilterChip from "@/components/notecard/CreatorFilterChip"
import { SelectField } from "@/components/ui/select-field"
import { FilteredNoteListLayout } from "@/components/notefilter/FilteredNoteListLayout"
import { useNoteFilters } from "@/components/notefilter/note-filters"
import WorkspaceHomeHeader from "@/components/workspaceheader/WorkspaceHomeHeader"

const PAGE_SIZE = 30
/** SelectField value for "no creator filter"; Radix reserves "". */
const ALL_CREATORS = "__all__"

const TagChip = ({ tag, onRemove }: { tag: string; onRemove: () => void }) => {
    const { t } = useTranslation()
    return (
        <span className="inline-flex items-center gap-1 max-w-full pl-2 pr-1 py-1 rounded-full text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
            <span className="truncate">#{tag}</span>
            <button
                type="button"
                onClick={onRemove}
                title={t("common.removeTag", { tag })}
                aria-label={t("common.removeTag", { tag })}
                className="shrink-0 rounded-full p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800"
            >
                <X size={12} />
            </button>
        </span>
    )
}

/** Workspace home: links to the workspace pages and a pinned filter, then note search. */
const SearchPage = () => {
    const { t } = useTranslation()
    const currentWorkspaceId = useCurrentWorkspaceId()
    const [query, setQuery] = useState("")
    const [debouncedQuery, setDebouncedQuery] = useState("")
    const [creatorId, setCreatorId] = useState("")
    const [tags, setTags] = useState<string[]>([])
    const [tagInput, setTagInput] = useState("")
    const [pinnedOnly, setPinnedOnly] = useState(false)
    const { filters, params, update, reset, activeCount, sortChanged } = useNoteFilters()
    const observerRef = useRef<IntersectionObserver | null>(null)
    const scrollRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        const handler = setTimeout(() => setDebouncedQuery(query.trim()), 300)
        return () => clearTimeout(handler)
    }, [query])

    // Reset the creator, tag and pinned filters when switching workspaces.
    useEffect(() => {
        setCreatorId("")
        setTags([])
        setPinnedOnly(false)
    }, [currentWorkspaceId])

    const { data: members = [] } = useQuery({
        queryKey: ["workspaceMembers", currentWorkspaceId],
        queryFn: () => getWorkspaceMembers(currentWorkspaceId),
        enabled: !!currentWorkspaceId,
    })

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
    const removeTag = (tag: string) => setTags(tags.filter((t) => t !== tag))

    const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
        queryKey: ["notes-search", currentWorkspaceId, debouncedQuery, creatorId, tags, pinnedOnly, params],
        queryFn: async ({ pageParam = 1 }: { pageParam?: unknown }) =>
            await searchNotes(currentWorkspaceId, {
                query: debouncedQuery,
                tags,
                creatorId,
                pinned: pinnedOnly,
                filters: params,
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
    // Keyword, tag and block filters match the index, which may lag behind edits.
    const usesIndex = !!debouncedQuery || tags.length > 0 || !!params.types || !!params.eventFrom ||
        !!params.eventTo || !!params.tasks || !!params.minRating

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

    const selectedMember = members.find((m) => m.user_id === creatorId)
    const totalActive = activeCount + (creatorId ? 1 : 0) + tags.length
    const hasFilters = totalActive > 0 || sortChanged || pinnedOnly
    const chips = (selectedMember || tags.length > 0) && (
        <>
            {selectedMember && (
                <CreatorFilterChip
                    creator={{ id: selectedMember.user_id, name: selectedMember.user_name, avatarUrl: selectedMember.user_avatar_url }}
                    onClear={() => setCreatorId("")}
                />
            )}
            {tags.map((tag) => <TagChip key={tag} tag={tag} onRemove={() => removeTag(tag)} />)}
        </>
    )

    return (
        <FilteredNoteListLayout
            scrollRef={scrollRef}
            header={
                <WorkspaceHomeHeader
                    workspaceId={currentWorkspaceId}
                    pinnedOnly={pinnedOnly}
                    onPinnedOnlyChange={(v) => { setPinnedOnly(v); scrollRef.current?.scrollTo({ top: 0 }) }}
                />
            }
            query={query}
            onQueryChange={setQuery}
            placeholder={t("placeholder.search")}
            filters={filters}
            onFiltersChange={update}
            onReset={() => { reset(); setCreatorId(""); setTags([]); setPinnedOnly(false) }}
            activeCount={totalActive}
            canReset={hasFilters}
            contentFilters
            creator={
                <SelectField
                    aria-label={t("common.creator")}
                    value={creatorId || ALL_CREATORS}
                    onChange={(v) => setCreatorId(v === ALL_CREATORS ? "" : v)}
                    className="text-sm py-1.5"
                    options={[
                        { value: ALL_CREATORS, label: t("common.allCreators") },
                        ...members.map((m) => ({ value: m.user_id, label: m.user_name })),
                    ]}
                />
            }
            tags={
                <div className="flex flex-wrap items-center gap-1.5">
                    {tags.map((tag) => <TagChip key={tag} tag={tag} onRemove={() => removeTag(tag)} />)}
                    <label className="inline-flex flex-1 min-w-[8rem] items-center gap-1.5 px-2 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-700 dark:text-gray-200">
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
                            className="w-full min-w-0 bg-transparent outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
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
            }
            chips={chips}
            notice={usesIndex && pending > 0 && t("common.indexingNotice", { count: pending })}
        >
            {isLoading ? (
                <NoteListSkeleton />
            ) : notes.length === 0 ? (
                <div className="text-center text-muted-foreground py-16 text-sm">
                    {debouncedQuery || hasFilters ? t("common.noResults") : t("messages.noMoreNotes")}
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
        </FilteredNoteListLayout>
    )
}

export default SearchPage
