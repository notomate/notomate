import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { getPublicNotes } from '@/api/note';
import NoteList from '@/components/notecard/NoteList';
import NoteListSkeleton from '@/components/notecard/NoteListSkeleton';
import CreatorFilterChip, { type CreatorFilter } from '@/components/notecard/CreatorFilterChip';
import { FilteredNoteListLayout } from '@/components/notefilter/FilteredNoteListLayout';
import { useNoteFilters } from '@/components/notefilter/note-filters';
import { useTranslation } from 'react-i18next';

const PAGE_SIZE = 20;

const ExplorePage: React.FC = () => {
    const { t } = useTranslation();
    const { noteId } = useParams<{ noteId?: string }>();
    const observerRef = useRef<IntersectionObserver | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);

    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [creator, setCreator] = useState<CreatorFilter | null>(null);
    const { filters, params, update, reset, activeCount, sortChanged } = useNoteFilters();
    const totalActive = activeCount + (creator ? 1 : 0);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
        return () => clearTimeout(timer);
    }, [search]);

    const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
        queryKey: ['explore-notes', debouncedSearch, creator?.id, params],
        queryFn: ({ pageParam = 1 }: { pageParam?: unknown }) =>
            getPublicNotes(Number(pageParam), PAGE_SIZE, debouncedSearch, creator?.id, params),
        getNextPageParam: (lastPage, allPages) =>
            lastPage.length === PAGE_SIZE ? allPages.length + 1 : undefined,
        initialPageParam: 1,
    });

    const notes = data?.pages.flat() ?? [];

    const loadMoreRef = useCallback((node: HTMLDivElement | null) => {
        if (observerRef.current) observerRef.current.disconnect();
        if (node && hasNextPage && !isFetchingNextPage) {
            observerRef.current = new IntersectionObserver(
                (entries) => { if (entries[0].isIntersecting) fetchNextPage() },
                { root: scrollRef.current, rootMargin: '200px', threshold: 0.1 }
            );
            observerRef.current.observe(node);
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    return (
        <div className="h-full">
            {noteId && <Outlet />}
            {/* Kept mounted while a note is open so going back restores the search and scroll position. */}
            <div className={`h-full ${noteId ? "hidden" : ""}`}>
                <FilteredNoteListLayout
                    scrollRef={scrollRef}
                    query={search}
                    onQueryChange={setSearch}
                    placeholder={t("pages.explore.searchPlaceholder")}
                    filters={filters}
                    onFiltersChange={update}
                    onReset={() => { reset(); setCreator(null); }}
                    activeCount={totalActive}
                    canReset={totalActive > 0 || sortChanged}
                    creator={creator
                        ? <div><CreatorFilterChip creator={creator} onClear={() => setCreator(null)} /></div>
                        : <p className="text-xs text-muted-foreground">{t("noteFilter.creatorHint")}</p>}
                    chips={creator && <CreatorFilterChip creator={creator} onClear={() => setCreator(null)} />}
                >
                    {isLoading ? (
                        <NoteListSkeleton />
                    ) : notes.length === 0 ? (
                        <div className="text-center text-muted-foreground py-16 text-sm">
                            {debouncedSearch || totalActive ? t("pages.explore.noSearchResults") : t("pages.explore.noPublicNotes")}
                        </div>
                    ) : (
                        <>
                            <NoteList
                                notes={notes}
                                getLinkTo={(note) => `/explore/notes/${note.id}`}
                                linkKind="open"
                                commentsReadOnly
                                maxNodes={15}
                                onCreatorClick={(note) => {
                                    setCreator({ id: note.created_by_id!, name: note.created_by ?? '', avatarUrl: note.created_by_avatar_url });
                                    scrollRef.current?.scrollTo({ top: 0 });
                                }}
                            />
                            <div ref={loadMoreRef} className="h-2" />
                            {isFetchingNextPage && <NoteListSkeleton count={3} />}
                        </>
                    )}
                </FilteredNoteListLayout>
            </div>
        </div>
    );
};

export default ExplorePage;
