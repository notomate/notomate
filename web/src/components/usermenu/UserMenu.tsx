import { useRef, useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { Settings, Info, Compass, LogOut, User as UserIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate } from "react-router-dom"
import { useMutation } from "@tanstack/react-query"
import { useCurrentUserStore } from "@/stores/current-user"
import { useWorkspaceStore } from "@/stores/workspace"
import { signOut } from "@/api/auth"
import UserSettingsModal from "@/components/user/UserSettingsModal"
import AboutModal from "@/components/user/AboutModal"

const UserMenu = () => {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const { user, resetCurrentUser } = useCurrentUserStore()
    const { resetWorkspaces } = useWorkspaceStore()
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const [isUserSettingsOpen, setIsUserSettingsOpen] = useState(false)
    const [isAboutModalOpen, setIsAboutModalOpen] = useState(false)
    const [isLg, setIsLg] = useState(() => window.innerWidth >= 1024)
    const menuRef = useRef<HTMLDivElement>(null)
    const buttonRef = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        const mq = window.matchMedia("(min-width: 1024px)")
        const handler = (e: MediaQueryListEvent) => setIsLg(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])

    const signoutMutation = useMutation({
        mutationFn: () => signOut(),
        onSuccess: () => {
            try {
                resetWorkspaces()
                resetCurrentUser()
                navigate("/")
            } catch (error) {
                console.error("Error during sign out:", error)
            }
        },
    })

    useEffect(() => {
        if (!isLg || !isMenuOpen) return
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node
            if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
                setIsMenuOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [isMenuOpen, isLg])

    if (!user) return null

    const menuContent = (
        <>
            <div className="px-3 py-2 border-b dark:border-neutral-600">
                <p className="font-semibold text-sm">{user.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
            </div>
            <div className="flex flex-col p-1">
                <button
                    onClick={() => { setIsUserSettingsOpen(true); setIsMenuOpen(false) }}
                    className="flex gap-3 px-3 py-2.5 items-center w-full text-sm text-left rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                    <Settings size={16} />
                    {t("menu.settings")}
                </button>
                <button
                    onClick={() => { setIsAboutModalOpen(true); setIsMenuOpen(false) }}
                    className="flex gap-3 px-3 py-2.5 items-center w-full text-sm text-left rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                    <Info size={16} />
                    {t("menu.about")}
                </button>
                <Link
                    to="/explore"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex gap-3 px-3 py-2.5 items-center w-full text-sm text-left rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                    <Compass size={16} />
                    {t("menu.explore")}
                </Link>
                <div className="h-px bg-neutral-200 dark:bg-neutral-600 my-1" />
                <button
                    onClick={() => signoutMutation.mutate()}
                    className="flex gap-3 px-3 py-2.5 items-center w-full text-sm text-left text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                    <LogOut size={16} />
                    {t("actions.signout")}
                </button>
            </div>
        </>
    )

    return (
        <>
            <div className="relative">
                <button
                    ref={buttonRef}
                    onClick={() => setIsMenuOpen(prev => !prev)}
                    className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors text-left"
                >
                    <div className="w-6 h-6 rounded-full bg-blue-500 text-white font-semibold flex items-center justify-center text-xs shrink-0">
                        {user.name ? user.name.charAt(0).toUpperCase() : <UserIcon size={14} />}
                    </div>
                    <span className="text-sm text-gray-700 dark:text-gray-200 truncate">{user.name}</span>
                </button>
                {isLg && isMenuOpen && (
                    <div
                        ref={menuRef}
                        className="absolute bottom-full left-0 mb-2 w-52 bg-white dark:bg-neutral-700 text-gray-900 dark:text-gray-100 rounded-md shadow-[0px_10px_38px_-10px_rgba(22,23,24,0.35),0px_10px_20px_-15px_rgba(22,23,24,0.2)] overflow-hidden z-[9999]"
                    >
                        {menuContent}
                    </div>
                )}
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

            <UserSettingsModal open={isUserSettingsOpen} onOpenChange={setIsUserSettingsOpen} />
            <AboutModal open={isAboutModalOpen} onOpenChange={setIsAboutModalOpen} />
        </>
    )
}

export default UserMenu
