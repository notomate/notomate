import { PanelLeftClose, PanelLeftOpen, LogOut, User as UserIcon, Settings, Info, Compass } from "lucide-react"
import { twMerge } from "tailwind-merge"
import { useSidebar } from "./SidebarProvider"
import { Link, useNavigate } from "react-router-dom"
import { FC, ReactNode, useState } from "react"
import { useCurrentUserStore } from "@/stores/current-user"
import Tooltip from "../tooltip/Tooltip"
import { useTranslation } from "react-i18next"
import { useMutation } from "@tanstack/react-query"
import { signOut } from "@/api/auth"
import { useWorkspaceStore } from "@/stores/workspace"
import UserSettingsModal from "@/components/user/UserSettingsModal"
import AboutModal from "@/components/user/AboutModal"
import { DropdownMenu } from "radix-ui"

interface Props {
    children: ReactNode
}

const Sidebar: FC<Props> = function ({ children }) {
    const { isOpen, isCollapse, isOver1280, expandSidebar, collapseSidebar, closeSidebar } = useSidebar()
    const { user, resetCurrentUser } = useCurrentUserStore();
    const { t } = useTranslation()
    const navigate = useNavigate()
    const { resetWorkspaces } = useWorkspaceStore()
    const [isUserSettingsOpen, setIsUserSettingsOpen] = useState(false)
    const [isAboutModalOpen, setIsAboutModalOpen] = useState(false)

    const signoutMutation = useMutation({
        mutationFn: () => signOut(),
        onSuccess: async () => {
            try {
                resetWorkspaces();
                resetCurrentUser();
                navigate(`/`)
            } catch (error) {
                console.error('Error invalidating queries:', error)
            }
        },
    })

    const handleLogout = () => {
        signoutMutation.mutate()
    }

    const openUserSettings = () => {
        setIsUserSettingsOpen(true)
        // Close sidebar on small screens when opening settings modal
        if (!isOver1280) {
            closeSidebar()
        }
    }

    const openAboutModal = () => {
        setIsAboutModalOpen(true)
        // Close sidebar on small screens when opening about modal
        if (!isOver1280) {
            closeSidebar()
        }
    }
    return <>
        <aside id="logo-sidebar"
            onClick={e => e.stopPropagation()}
            className={twMerge(isOver1280 ? "flex" :
                isOpen ? "translate-x-0" : "-translate-x-full"
                , isCollapse ? "w-[72px]" : " w-[260px]"
                , " transition duration-200 ease-in-out transform fixed top-0 left-0 z-40 xl:flex-col gap-0.5 h-[100dvh] bg-opacity-100 ")}
            aria-label="Sidebar">
            <div className={twMerge(isCollapse ? "bg-neutral-100 dark:bg-neutral-900" : "bg-neutral-50 dark:bg-neutral-950 shadow","px-4  text-neutral-900 dark:text-neutral-100 flex flex-col justify-between h-full")}>
                {children}
                <div className={twMerge("sticky bottom-0 pt-1 pb-3 flex gap-2 items-center flex-wrap-reverse", isCollapse ? "flex-col" : "flex-row")}>
                    {
                        user && <DropdownMenu.Root>
                            <DropdownMenu.Trigger asChild>
                                <button
                                    className="p-2 rounded-full bg-blue-500 text-white font-semibold flex items-center justify-center w-6 h-6 hover:bg-blue-600 transition-colors"
                                    title={t("menu.user")}
                                >
                                    {user.name ? user.name.charAt(0).toUpperCase() : <UserIcon size={20} />}
                                </button>
                            </DropdownMenu.Trigger>

                            <DropdownMenu.Portal>
                                <DropdownMenu.Content
                                    className="rounded-md w-52 bg-white text-gray-900 dark:bg-neutral-700 dark:text-gray-100 p-[5px] shadow-[0px_10px_38px_-10px_rgba(22,_23,_24,_0.35),_0px_10px_20px_-15px_rgba(22,_23,_24,_0.2)] will-change-[opacity,transform] data-[side=bottom]:animate-slideUpAndFade data-[side=left]:animate-slideRightAndFade data-[side=right]:animate-slideLeftAndFade data-[side=top]:animate-slideDownAndFade z-[9999]"
                                    align="start"
                                    side="top"
                                    alignOffset={0}
                                    sideOffset={10}
                                >
                                    <div className="px-3 py-2 border-b dark:border-neutral-600">
                                        <p className="font-semibold">{user.name}</p>
                                        <p className="text-xs text-muted-foreground">{user.email}</p>
                                    </div>

                                    <DropdownMenu.Item className="select-none rounded-lg leading-none outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-neutral-200 dark:data-[highlighted]:bg-neutral-700">
                                        <button onClick={() => openUserSettings()} className="flex gap-3 p-3 items-center w-full">
                                            <Settings size={18} />
                                            {t("menu.settings")}
                                        </button>
                                    </DropdownMenu.Item>

                                    <DropdownMenu.Item className="select-none rounded-lg leading-none outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-neutral-200 dark:data-[highlighted]:bg-neutral-700">
                                        <button onClick={() => openAboutModal()} className="flex gap-3 p-3 items-center w-full">
                                            <Info size={18} />
                                            {t("menu.about")}
                                        </button>
                                    </DropdownMenu.Item>

                                    <DropdownMenu.Item className="select-none rounded-lg leading-none outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-neutral-200 dark:data-[highlighted]:bg-neutral-700">
                                        <Link to="/explore" className="flex gap-3 p-3 items-center w-full">
                                            <Compass size={18} />
                                            {t("menu.explore")}
                                        </Link>
                                    </DropdownMenu.Item>

                                    <DropdownMenu.Separator className="h-[1px] bg-neutral-200 dark:bg-neutral-600 m-1" />

                                    <DropdownMenu.Item className="text-red-600 dark:text-red-400 select-none rounded-lg leading-none outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-red-100 dark:data-[highlighted]:bg-red-900/30 dark:data-[highlighted]:text-red-400">
                                        <button onClick={handleLogout} className="flex gap-3 p-3 items-center w-full">
                                            <LogOut size={18} />
                                            {t("actions.signout")}
                                        </button>
                                    </DropdownMenu.Item>
                                </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                        </DropdownMenu.Root>
                    }
                    {
                        isOver1280 &&
                        <Tooltip
                            text={t("actions.expand")}
                            side="right"
                            enabled={isCollapse}
                        >
                            <button className="p-2" onClick={() => isCollapse ? expandSidebar() : collapseSidebar()} >
                                {
                                    isCollapse ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />
                                }
                            </button>
                        </Tooltip>
                    }
                </div>
            </div>
        </aside>
        <UserSettingsModal
            open={isUserSettingsOpen}
            onOpenChange={setIsUserSettingsOpen}
        />
        <AboutModal
            open={isAboutModalOpen}
            onOpenChange={setIsAboutModalOpen}
        />
    </>
}
export default Sidebar