import { ChevronsUpDown, Plus, MonitorCog } from "lucide-react"
import { useWorkspaceStore } from "@/stores/workspace"
import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createWorkspace } from "@/api/workspace"

const WorkspaceMenu = () => {
    const { workspaces, fetchWorkspaces, getWorkspaceById } = useWorkspaceStore()
    const { workspaceId } = useParams()
    const [keyword, setKeyword] = useState("")
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const [isLg, setIsLg] = useState(() => window.innerWidth >= 1024)
    const menuRef = useRef<HTMLDivElement>(null)
    const buttonRef = useRef<HTMLButtonElement>(null)
    const navigate = useNavigate()
    const { t } = useTranslation()

    useEffect(() => {
        const mq = window.matchMedia("(min-width: 1024px)")
        const handler = (e: MediaQueryListEvent) => setIsLg(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])

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
                        className="px-3 py-2 rounded w-full hover:bg-neutral-200 dark:hover:bg-neutral-700 text-left text-sm truncate"
                        onClick={() => handleWorkspaceButtonClick(w.id)}
                    >
                        {w.name}
                    </button>
                ))}
                {keyword.length > 0 && (
                    <button
                        onClick={handleNewWorkspaceButtonClick}
                        title="new workspace"
                        className="p-2 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center w-full gap-2 text-sm"
                    >
                        <Plus size={16} />
                        {keyword ? t("menu.createWithName", { name: keyword }) : t("menu.addNew")}
                    </button>
                )}
            </div>
            <div className="border-t dark:border-neutral-700 p-2">
                <Link
                    to={`/workspaces/${workspaceId}/notes/settings`}
                    onClick={() => setIsMenuOpen(false)}
                    className="px-3 py-2 rounded w-full hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center gap-2 text-sm"
                >
                    <MonitorCog size={16} />
                    {t("menu.workspaceSettings")}
                </Link>
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
                        className="absolute top-full left-0 mt-2 w-full min-w-[228px] bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 border dark:border-none rounded-lg shadow-[0px_10px_38px_-10px_rgba(22,23,24,0.35),0px_10px_20px_-15px_rgba(22,23,24,0.2)] overflow-hidden z-[9999]"
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
        </>
    )
}

export default WorkspaceMenu
