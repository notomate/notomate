import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getPublicNotes } from '@/api/note';
import NoteList from '@/components/notecard/NoteList';
import NoteListSkeleton from '@/components/notecard/NoteListSkeleton';
import logo from '@/assets/app.svg';
import { LogIn, House } from 'lucide-react';
import { useCurrentUserStore } from '@/stores/current-user';

const ExplorePage: React.FC = () => {
    const { data: notes = [], isLoading } = useQuery({
        queryKey: ['explore-notes'],
        queryFn: () => getPublicNotes(1, 20),
    });

    const { user, fetchUser } = useCurrentUserStore();
    const [authChecked, setAuthChecked] = useState(false);

    useEffect(() => {
        fetchUser().finally(() => setAuthChecked(true));
    }, []);

    const navLink = authChecked && (
        user ? (
            <Link
                to="/"
                className=" flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
                title="Back to workspace"
            >
                <House size={20} strokeWidth={2.5} />
                <span className="text-sm font-medium px-1 grow ">Home</span>
            </Link>
        ) : (
            <Link
                to="/signin"
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
                title="Sign in"
            >
                <LogIn size={20} strokeWidth={2.5} />
                <span className="text-sm font-medium px-1 grow">Sign in</span>
            </Link>
        )
    );

    return (
        <div className="min-h-dvh lg:flex">
            {/* Sidebar — desktop only */}
            <aside className="hidden lg:flex flex-col w-56 shrink-0 fixed top-0 left-0 h-screen px-5 py-6">
                <div className="flex items-center gap-3 select-none mb-6">
                    <img src={logo} className="w-9" alt="logo" />
                </div>
            </aside>

            {/* Top-right nav — sm and above */}
            <div className="hidden lg:flex fixed top-0 right-0 px-5 py-4 z-10">
                {navLink}
            </div>

            {/* Main area */}
            <div className="w-full">
                {/* Header — mobile only */}
                <header className="lg:hidden flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3 select-none">
                        <img src={logo} className="w-8" alt="logo" />
                        <span className="text-lg font-bold text-gray-900 dark:text-gray-100">Explore</span>
                    </div>
                    {navLink}
                </header>

                {/* Note list — full width on mobile, capped on desktop */}
                <div className="lg:max-w-[600px] mx-auto lg:py-4">
                    {isLoading ? (
                        <NoteListSkeleton />
                    ) : notes.length === 0 ? (
                        <div className="text-center text-gray-500 dark:text-gray-400 py-20">
                            No public notes yet.
                        </div>
                    ) : (
                        <NoteList notes={notes} showLink={false} />
                    )}
                </div>
            </div>
        </div>
    );
};

export default ExplorePage;
