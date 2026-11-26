import { Outlet } from "react-router-dom"
import MobileTopBar from "@/components/mobiletopbar/MobileTopBar"
import { useAppLayout } from "@/components/applayout/AppLayout"
import logo from "@/assets/app.svg"

/** Mobile top bar with the app logo, for pages outside a workspace (Explore, About, account settings). */
const BasicPageLayout = () => {
    const { onOpenSidebar } = useAppLayout()

    return (
        <>
            <MobileTopBar
                title={
                    <span className="flex items-center gap-2 select-none">
                        <img src={logo} className="w-6 shrink-0 dark:invert" alt="logo" />
                        Notomate
                    </span>
                }
                onOpenSidebar={onOpenSidebar}
            />
            <div className="flex-1 overflow-hidden">
                <Outlet />
            </div>
        </>
    )
}

export default BasicPageLayout
