import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import { getPublicNotes } from '@/api/note';
import NoteList from '@/components/notecard/NoteList';
import NoteListSkeleton from '@/components/notecard/NoteListSkeleton';
import logo from '@/assets/app.svg';
import { LogIn, ArrowLeft, Search, X, Trash2 } from 'lucide-react';
import { useCurrentUserStore } from '@/stores/current-user';
import { useTranslation } from 'react-i18next';

const PAGE_SIZE = 20;

const ExplorePage: React.FC = () => {
    const { t } = useTranslation();
    const observerRef = useRef<IntersectionObserver | null>(null);

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
                { rootMargin: '200px', threshold: 0.1 }
            );
            observerRef.current.observe(node);
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    const { user, fetchUser } = useCurrentUserStore();
    const [authChecked, setAuthChecked] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isLg, setIsLg] = useState(() => window.innerWidth >= 1024);
    const menuRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const mobileButtonRef = useRef<HTMLButtonElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchUser().finally(() => setAuthChecked(true));
    }, []);

    useEffect(() => {
        if (isSearchOpen) searchInputRef.current?.focus();
    }, [isSearchOpen]);

    useEffect(() => {
        const mq = window.matchMedia("(min-width: 1024px)");
        const handler = (e: MediaQueryListEvent) => setIsLg(e.matches);
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);

    useEffect(() => {
        if (!isLg || !isMenuOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (
                !menuRef.current?.contains(target) &&
                !buttonRef.current?.contains(target) &&
                !mobileButtonRef.current?.contains(target)
            ) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isMenuOpen, isLg]);

    const menuContent = authChecked && (
        <div className="flex flex-col p-1">
            {user ? (
                <Link
                    to="/"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex gap-3 px-3 py-2.5 items-center w-full text-sm text-left rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    title={t("pages.explore.backToWorkspace")}
                >
                    <ArrowLeft size={16} strokeWidth={2.5} />
                    {t("pages.explore.backToWorkspace")}
                </Link>
            ) : (
                <Link
                    to="/signin"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex gap-3 px-3 py-2.5 items-center w-full text-sm text-left rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    title={t("actions.signin")}
                >
                    <LogIn size={16} strokeWidth={2.5} />
                    {t("actions.signin")}
                </Link>
            )}
        </div>
    );

    return (
        <div className="min-h-dvh lg:flex">
            {/* Sidebar — desktop only */}
            <aside className="hidden lg:flex flex-col w-56 shrink-0 fixed top-0 left-0 h-screen px-5 py-6">
                <div className="relative">
                    <button
                        ref={buttonRef}
                        onClick={() => setIsMenuOpen(prev => !prev)}
                        className="flex items-center gap-3 select-none rounded-md p-1 -m-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                        title="Menu"
                    >
                        <img src={logo} className="w-9" alt="logo" />
                    </button>
                    {isLg && isMenuOpen && (
                        <div
                            ref={menuRef}
                            className="absolute top-full left-0 mt-2 w-52 bg-white dark:bg-neutral-700 text-gray-900 dark:text-gray-100 rounded-md shadow-[0px_10px_38px_-10px_rgba(22,23,24,0.35),0px_10px_20px_-15px_rgba(22,23,24,0.2)] overflow-hidden z-[9999]"
                        >
                            {menuContent}
                        </div>
                    )}
                </div>
            </aside>

            {/* Main area */}
            <div className="w-full">
                {/* Header — mobile only */}
                <header className="lg:hidden flex items-center justify-between px-4 py-3">
                    <button
                        ref={mobileButtonRef}
                        onClick={() => setIsMenuOpen(prev => !prev)}
                        className="flex items-center gap-3 select-none rounded-md p-1 -m-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                        title="Menu"
                    >
                        <img src={logo} className="w-8" alt="logo" />
                        <span className="text-lg font-bold text-gray-900 dark:text-gray-100">Explore</span>
                    </button>
                    <button
                        onClick={() => setIsSearchOpen(prev => !prev)}
                        className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                        title="Search"
                        aria-pressed={isSearchOpen}
                    >
                        {isSearchOpen ? <X size={20} /> : <Search size={20} />}
                    </button>
                </header>

                {/* Note list — full width on mobile, capped on desktop */}
                <div className="lg:max-w-[600px] mx-auto pb-4 lg:py-4">
                    {/* Search */}
                    <div className={`px-2 mb-2 ${isSearchOpen ? 'block' : 'hidden'} lg:block`}>
                        <div className="relative">
                            <Search
                                size={16}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none"
                            />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder={t("pages.explore.searchPlaceholder")}
                                className="w-full pl-9 pr-9 py-2 text-sm rounded-lg bg-neutral-100 dark:bg-neutral-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none"
                            />
                            {search && (
                                <button
                                    onClick={() => setSearch('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-red-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                                    title="Clear search"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    {isLoading ? (
                        <NoteListSkeleton />
                    ) : notes.length === 0 ? (
                        <div className="text-center text-gray-500 dark:text-gray-400 py-20">
                            {debouncedSearch ? t("pages.explore.noSearchResults") : t("pages.explore.noPublicNotes")}
                        </div>
                    ) : (
                        <>
                            <NoteList notes={notes} showLink={false} />
                            <div ref={loadMoreRef} className="h-px" />
                            {isFetchingNextPage && (
                                <div className="text-center text-gray-500 dark:text-gray-400 py-4 text-sm">
                                    Loading more…
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {!isLg && isMenuOpen && createPortal(
                <>
                    <div
                        className="fixed inset-0 bg-black/40 z-40"
                        onClick={() => setIsMenuOpen(false)}
                    />
                    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 rounded-t-2xl z-50 shadow-xl">
                        <div className="flex justify-center pt-3 pb-1">
                            <div className="w-10 h-1 bg-neutral-300 dark:bg-neutral-600 rounded-full" />
                        </div>
                        <div className="pb-2">
                            {menuContent}
                        </div>
                    </div>
                </>,
                document.body
            )}
        </div>
    );
};

export default ExplorePage;
