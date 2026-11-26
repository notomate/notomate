import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { LogIn, ArrowLeft, Info, Compass, PanelRight, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import UserMenu from '@/components/usermenu/UserMenu';
import MobileTopBar from '@/components/mobiletopbar/MobileTopBar';
import logo from '@/assets/app.svg';
import { useCurrentUserStore } from '@/stores/current-user';

const navItemBase = "w-full flex items-center gap-2 px-3 py-2.5 lg:px-3 lg:py-2 rounded-md text-sm cursor-pointer select-none transition-colors duration-100 hover:bg-neutral-100 dark:hover:bg-neutral-800";
const navItemClass = `${navItemBase} text-muted-foreground hover:text-gray-700 dark:hover:text-gray-300`;
const navItemActiveClass = `${navItemBase} text-gray-900 dark:text-gray-100 font-semibold`;

/**
 * Shell for pages outside a workspace (Explore, About, account settings):
 * a sidebar with the app logo and top-level links, and the page in the main area.
 */
const PublicLayout = () => {
    const { t } = useTranslation();
    const { pathname } = useLocation();
    const { user, fetchUser } = useCurrentUserStore();
    const [authChecked, setAuthChecked] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        fetchUser().finally(() => setAuthChecked(true));
    }, []);

    const closeSidebar = () => setIsSidebarOpen(false);

    // Close the mobile sidebar after any navigation, including links outside the
    // nav list (e.g. Settings / About in the user menu).
    useEffect(() => {
        closeSidebar();
    }, [pathname]);

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
                        onClick={closeSidebar}
                    >
                        <PanelRight size={16} />
                    </button>
                </div>

                <nav className="px-3 py-1 flex-1 overflow-auto">
                    <Link
                        to="/explore"
                        onClick={closeSidebar}
                        className={pathname.startsWith("/explore") ? navItemActiveClass : navItemClass}
                    >
                        <Compass className="shrink-0 size-4 lg:size-3.5" />
                        <span className="leading-snug">{t("menu.explore")}</span>
                    </Link>
                    {user && (
                        <Link
                            to="/account"
                            onClick={closeSidebar}
                            className={pathname.startsWith("/account") ? navItemActiveClass : navItemClass}
                        >
                            <Settings className="shrink-0 size-4 lg:size-3.5" />
                            <span className="leading-snug">{t("menu.settings")}</span>
                        </Link>
                    )}
                    <Link
                        to="/about"
                        onClick={closeSidebar}
                        className={pathname.startsWith("/about") ? navItemActiveClass : navItemClass}
                    >
                        <Info className="shrink-0 size-4 lg:size-3.5" />
                        <span className="leading-snug">{t("menu.about")}</span>
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

                {user && (
                    <div className="shrink-0 p-2 border-t border-neutral-200 dark:border-neutral-700">
                        <UserMenu />
                    </div>
                )}
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
                    <Outlet />
                </div>
            </div>
        </div>
    );
};

export default PublicLayout;
