import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Outlet, useParams } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { getPublicNotes } from '@/api/note';
import NoteList from '@/components/notecard/NoteList';
import NoteListSkeleton from '@/components/notecard/NoteListSkeleton';
import AboutModal from '@/components/user/AboutModal';
import UserMenu from '@/components/usermenu/UserMenu';
import MobileTopBar from '@/components/mobiletopbar/MobileTopBar';
import logo from '@/assets/app.svg';
import { LogIn, ArrowLeft, Search, Trash2, Info, Compass, PanelRight } from 'lucide-react';
import { useCurrentUserStore } from '@/stores/current-user';
import { useTranslation } from 'react-i18next';

const PAGE_SIZE = 20;

const navItemClass = "w-full flex items-center gap-2 px-3 py-2.5 lg:px-3 lg:py-2 rounded-md text-sm cursor-pointer select-none transition-colors duration-100 text-muted-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-gray-700 dark:hover:text-gray-300";

const ExplorePage: React.FC = () => {
    const { t } = useTranslation();
    const { noteId } = useParams<{ noteId?: string }>();
    const observerRef = useRef<IntersectionObserver | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);

    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
        return () => clearTimeout(timer);
    }, [search]);

    const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
        queryKey: ['explore-notes', debouncedSearch],
        queryFn: ({ pageParam = 1 }: { pageParam?: unknown }) =>
            getPublicNotes(Number(pageParam), PAGE_SIZE, debouncedSearch),
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

    const { user, fetchUser } = useCurrentUserStore();
    const [authChecked, setAuthChecked] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isAboutOpen, setIsAboutOpen] = useState(false);

    useEffect(() => {
        fetchUser().finally(() => setAuthChecked(true));
    }, []);

    return (
        <div className="flex h-svh">
            {/* Sidebar */}
            <div
                className={`w-full lg:w-[240px] h-full flex flex-col shrink-0 bg-neutral-50 dark:bg-neutral-800 border-r border-neutral-200 dark:border-neutral-700 ${isSidebarOpen ? "flex" : "hidden lg:flex"}`}
            >
                <div className="px-3 pt-3 pb-1 flex items-center gap-2">
                    <div className="flex-1 min-w-0 flex items-center gap-2 px-2 py-1.5 select-none">
                        <img src={logo} className="w-6 shrink-0 dark:invert" alt="logo" />
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">Notomate</span>
                    </div>
                    <button
                        aria-label="close sidebar"
                        className="lg:hidden shrink-0 p-2 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 text-muted-foreground"
                        onClick={() => setIsSidebarOpen(false)}
                    >
                        <PanelRight size={16} />
                    </button>
                </div>

                <nav className="px-3 py-1 flex-1 overflow-auto">
                    <Link
                        to="/explore"
                        onClick={() => setIsSidebarOpen(false)}
                        className="w-full flex items-center gap-2 px-3 py-2.5 lg:px-3 lg:py-2 rounded-md text-sm cursor-pointer select-none transition-colors duration-100 text-gray-900 dark:text-gray-100 font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                        <Compass className="shrink-0 size-4 lg:size-3.5" />
                        <span className="leading-snug">{t("menu.explore")}</span>
                    </Link>
                    {authChecked && (
                        user ? (
                            <Link to="/" className={navItemClass}>
                                <ArrowLeft className="shrink-0 size-4 lg:size-3.5" />
                                <span className="leading-snug">{t("pages.explore.backToWorkspace")}</span>
                            </Link>
                        ) : (
                            <Link to="/signin" className={navItemClass}>
                                <LogIn className="shrink-0 size-4 lg:size-3.5" />
                                <span className="leading-snug">{t("actions.signin")}</span>
                            </Link>
                        )
                    )}
                </nav>

                <div className="shrink-0 p-2 border-t border-neutral-200 dark:border-neutral-700">
                    {user ? (
                        <UserMenu />
                    ) : (
                        <button
                            type="button"
                            onClick={() => { setIsSidebarOpen(false); setIsAboutOpen(true) }}
                            className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm text-gray-700 dark:text-gray-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left"
                        >
                            <Info size={16} />
                            {t("menu.about")}
                        </button>
                    )}
                </div>
            </div>

            {/* Main area */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <MobileTopBar
                    title={
                        <span className="flex items-center gap-2 select-none">
                            <img src={logo} className="w-6 shrink-0 dark:invert" alt="logo" />
                            Notomate
                        </span>
                    }
                    onOpenSidebar={() => setIsSidebarOpen(true)}
                />
                <div className="flex-1 overflow-hidden">
                    {noteId && <Outlet />}
                    {/* Kept mounted while a note is open so going back restores the search and scroll position. */}
                    <div className={`h-full flex-col bg-neutral-50 dark:bg-neutral-950 ${noteId ? "hidden" : "flex"}`}>
                        <div ref={scrollRef} className="flex-1 overflow-auto">
                            <div className="w-full lg:max-w-[600px] px-2 pt-2 xl:pt-4 pb-2 mx-auto">
                                <div className="relative">
                                    <Search
                                        size={16}
                                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                                    />
                                    <input
                                        type="text"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder={t("pages.explore.searchPlaceholder")}
                                        className="w-full pl-9 pr-9 py-2.5 text-sm rounded-lg bg-neutral-50 dark:bg-neutral-950 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none"
                                    />
                                    {search && (
                                        <button
                                            onClick={() => setSearch('')}
                                            title={t("common.clear")}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-red-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="w-full lg:max-w-[600px] mx-auto">
                                {isLoading ? (
                                    <NoteListSkeleton />
                                ) : notes.length === 0 ? (
                                    <div className="text-center text-muted-foreground py-16 text-sm">
                                        {debouncedSearch ? t("pages.explore.noSearchResults") : t("pages.explore.noPublicNotes")}
                                    </div>
                                ) : (
                                    <>
                                        <NoteList
                                            notes={notes}
                                            getLinkTo={(note) => `/explore/notes/${note.id}`}
                                            linkKind="open"
                                            commentsReadOnly
                                            maxNodes={100}
                                        />
                                        <div ref={loadMoreRef} className="h-2" />
                                        {isFetchingNextPage && <NoteListSkeleton count={3} />}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <AboutModal open={isAboutOpen} onOpenChange={setIsAboutOpen} />
        </div>
    );
};

export default ExplorePage;
