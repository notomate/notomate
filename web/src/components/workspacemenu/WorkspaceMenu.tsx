import { ChevronsUpDown, Plus } from "lucide-react"
import { useWorkspaceStore } from "@/stores/workspace"
import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createWorkspace } from "@/api/workspace"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { useIsLg } from "@/hooks/use-media-query"

const WorkspaceMenu = () => {
    const { workspaces, fetchWorkspaces, getWorkspaceById } = useWorkspaceStore()
    const { workspaceId } = useParams()
    const [keyword, setKeyword] = useState("")
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const isLg = useIsLg()
    const menuRef = useRef<HTMLDivElement>(null)
    const buttonRef = useRef<HTMLButtonElement>(null)
    const navigate = useNavigate()
    const { t } = useTranslation()

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

    const handleWorkspaceButtonClick = (id: string) => {
        setIsMenuOpen(false)
        if (id == workspaceId) return;
        navigate(`/workspaces/${id}`);
    }

    const handleNewWorkspaceButtonClick = async () => {
        try {
            const workspace = await createWorkspace({ name: keyword });
            if (workspace.id) {
                await fetchWorkspaces();
                setIsMenuOpen(false)
                setKeyword("")
                navigate(`/workspaces/${workspace.id}`);
            }
        } catch (error) {
            console.error("Failed to create workspace:", error);
        }
    }

    const filteredWorkspaces = useMemo(() => {
        return keyword
            ? workspaces.filter((w) => w.name.includes(keyword))
            : workspaces;
    }, [workspaces, keyword]);

    const currentName = getWorkspaceById(workspaceId!)?.name ?? ""

    const menuContent = (
        <>
            <div className="p-2">
                <input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    className="border dark:border-none shadow-inner rounded-md w-full px-3 py-1 dark:bg-neutral-700 dark:text-neutral-100"
                    placeholder={t("placeholder.searchWorkspace")}
                />
            </div>
            <div className="overflow-y-auto max-h-[40dvh] px-2 pb-2 flex flex-col">
                {filteredWorkspaces && filteredWorkspaces.map(w => (
                    <button
                        key={w.id}
                        className="shrink-0 px-3 py-2 rounded w-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-left text-sm truncate"
                        onClick={() => handleWorkspaceButtonClick(w.id)}
                    >
                        {w.name}
                    </button>
                ))}
                {keyword.length > 0 && (
                    <button
                        onClick={handleNewWorkspaceButtonClick}
                        title="new workspace"
                        className="shrink-0 p-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center w-full gap-2 text-sm"
                    >
                        <Plus size={16} />
                        {keyword ? t("menu.createWithName", { name: keyword }) : t("menu.addNew")}
                    </button>
                )}
            </div>
        </>
    )

    return (
        <>
            <div className="relative w-full">
                <button
                    ref={buttonRef}
                    onClick={() => setIsMenuOpen(prev => !prev)}
                    title={currentName}
                    className="bg-white dark:bg-neutral-700 shadow border dark:border-none w-full px-3 py-1.5 rounded-md text-sm flex justify-center items-center truncate"
                >
                    <span className="grow text-left truncate">{currentName}</span>
                    <span className="w-5">
                        <ChevronsUpDown size={16} />
                    </span>
                </button>
                {isLg && isMenuOpen && (
                    <div
                        ref={menuRef}
                        className="absolute top-full left-0 mt-2 w-full min-w-[228px] bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border dark:border-none rounded-lg shadow-[0px_10px_38px_-10px_rgba(22,23,24,0.35),0px_10px_20px_-15px_rgba(22,23,24,0.2)] overflow-hidden z-dropdown"
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
        </>
    )
}

export default WorkspaceMenu
