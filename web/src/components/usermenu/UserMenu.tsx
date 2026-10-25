import { useRef, useState, useEffect } from "react"
import { Settings, Info, Compass } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { useCurrentUserStore } from "@/stores/current-user"
import UserSettingsModal from "@/components/user/UserSettingsModal"
import AboutModal from "@/components/user/AboutModal"
import Avatar from "@/components/avatar/Avatar"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { useIsLg } from "@/hooks/use-media-query"

const UserMenu = () => {
    const { t } = useTranslation()
    const { user } = useCurrentUserStore()
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const [isUserSettingsOpen, setIsUserSettingsOpen] = useState(false)
    const [isAboutModalOpen, setIsAboutModalOpen] = useState(false)
    const isLg = useIsLg()
    const menuRef = useRef<HTMLDivElement>(null)
    const buttonRef = useRef<HTMLButtonElement>(null)

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
        </div>
    )

    return (
        <>
            <div className="relative">
                <button
                    ref={buttonRef}
                    onClick={() => setIsMenuOpen(prev => !prev)}
                    className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left"
                >
                    <Avatar name={user.name} avatarUrl={user.avatar_url} size={24} />
                    <span className="text-sm text-gray-700 dark:text-gray-200 truncate">{user.name}</span>
                </button>
                {isLg && isMenuOpen && (
                    <div
                        ref={menuRef}
                        className="absolute bottom-full left-0 mb-2 w-52 bg-white dark:bg-neutral-700 text-gray-900 dark:text-gray-100 rounded-md shadow-[0px_10px_38px_-10px_rgba(22,23,24,0.35),0px_10px_20px_-15px_rgba(22,23,24,0.2)] overflow-hidden z-dropdown"
                    >
                        {menuContent}
                    </div>
                )}
            </div>

            <BottomSheet open={!isLg && isMenuOpen} onOpenChange={setIsMenuOpen}>
                <div className="pb-2">
                    {menuContent}
                </div>
            </BottomSheet>

            <UserSettingsModal open={isUserSettingsOpen} onOpenChange={setIsUserSettingsOpen} />
            <AboutModal open={isAboutModalOpen} onOpenChange={setIsAboutModalOpen} />
        </>
    )
}

export default UserMenu
