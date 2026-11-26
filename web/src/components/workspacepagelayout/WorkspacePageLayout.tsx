import { Outlet } from "react-router-dom"
import WorkspaceHeader from "@/components/workspaceheader/WorkspaceHeader"

/** Every workspace page: the workspace header and tab bar above the page. */
const WorkspacePageLayout = () => (
    <>
        <WorkspaceHeader />
        <div className="flex-1 overflow-hidden">
            <Outlet />
        </div>
    </>
)

export default WorkspacePageLayout
