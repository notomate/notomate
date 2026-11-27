import { Outlet, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import MobileTopBar from "@/components/mobiletopbar/MobileTopBar"
import { useAppLayout } from "@/components/applayout/AppLayout"

/** Mobile top bar showing the page name, for pages outside a workspace (Explore, account settings). */
const TopLevelPageLayout = () => {
    const { onOpenSidebar } = useAppLayout()
    const { pathname } = useLocation()
    const { t } = useTranslation()

    const title = pathname.startsWith("/explore")
        ? t("menu.explore")
        : pathname.startsWith("/account")
            ? t("menu.settings")
            : "Notomate"

    return (
        <>
            <MobileTopBar title={title} onOpenSidebar={onOpenSidebar} />
            <div className="flex-1 overflow-hidden">
                <Outlet />
            </div>
        </>
    )
}

export default TopLevelPageLayout
