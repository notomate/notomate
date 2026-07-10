import { useSidebar } from "@/components/sidebar/SidebarProvider"
import { FC, ReactNode } from "react"
import { twMerge } from "tailwind-merge"

interface Props {
    children: ReactNode
}

const OneColumn: FC<Props> = ({ children }) => {
    const { isCollapse } = useSidebar()
    return <div className={twMerge(isCollapse ? "" : "xl:pl-4", "px-0 w-full h-full overflow-y-auto")}>
        {children}
    </div>
}

export default OneColumn