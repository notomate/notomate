import { useEffect, useRef, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useQuery } from "@tanstack/react-query"
import { ChevronDown, Edit, Pin, Search } from "lucide-react"
import { getNotes, NoteData } from "@/api/note"
import useCurrentWorkspaceId from "@/hooks/use-currentworkspace-id"
import useCreateNote from "@/hooks/use-create-note"
import { useWorkspaceStore } from "@/stores/workspace"
import { useIsLg } from "@/hooks/use-media-query"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { menuIconClass, menuItemClass, menuListClass, menuSurfaceClass } from "@/components/ui/menu"
import MobileTopBar from "@/components/mobiletopbar/MobileTopBar"
import { useAppLayout } from "@/components/applayout/AppLayout"

const PINNED_PAGE_SIZE = 30

const iconButtonClass = "shrink-0 p-2 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 text-muted-foreground disabled:opacity-40"

function getNoteTitle(note: NoteData): string {
    if (note.title) return note.title
    try {
        const doc = JSON.parse(note.content)
        const firstBlock = doc?.content?.[0]
        const text = firstBlock?.content?.map((n: { text?: string }) => n.text ?? "").join("") ?? ""
        return text.trim() || "New page"
    } catch {
        return "New page"
    }
}

/** Pinned notes of the workspace: a dropdown on desktop, a bottom sheet on mobile. */
const PinnedNotesMenu = ({ workspaceId }: { workspaceId: string }) => {
    const { t } = useTranslation()
    const isLg = useIsLg()
    const [isOpen, setIsOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)
    const buttonRef = useRef<HTMLButtonElement>(null)

    const { data: pinnedNotes = [] } = useQuery<NoteData[]>({
        queryKey: ['notes', workspaceId, 'pinned'],
        queryFn: () => getNotes(workspaceId, 1, PINNED_PAGE_SIZE, "", undefined, undefined, true),
        refetchOnWindowFocus: false,
        staleTime: 0,
    })

    useEffect(() => {
        if (!isLg || !isOpen) return
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node
            if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
                setIsOpen(false)
            }
        }
        document.addEventListener("pointerdown", handleClickOutside, true)
        return () => document.removeEventListener("pointerdown", handleClickOutside, true)
    }, [isOpen, isLg])

    if (pinnedNotes.length === 0) return null

    const menuContent = (
        <div className={`${menuListClass} max-h-[60dvh] overflow-y-auto`}>
            {pinnedNotes.map((note) => (
                <Link
                    key={note.id}
                    to={`/workspaces/${workspaceId}/notes/${note.id}`}
                    onClick={() => setIsOpen(false)}
                    className={menuItemClass(!isLg)}
                >
                    <span className={menuIconClass()}><Pin size={14} /></span>
                    <span className="min-w-0 truncate">{getNoteTitle(note)}</span>
                </Link>
            ))}
        </div>
    )

    return (
        <>
            <div className="relative">
                <button
                    ref={buttonRef}
                    onClick={() => setIsOpen(prev => !prev)}
                    aria-label={t("common.pinned")}
                    className="shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                    <Pin size={14} />
                    <span className="hidden lg:inline">{t("common.pinned")}</span>
                    <ChevronDown size={14} />
                </button>
                {isLg && isOpen && (
                    <div
                        ref={menuRef}
                        className={`absolute top-full right-0 mt-1 w-64 overflow-hidden z-dropdown ${menuSurfaceClass}`}
                    >
                        {menuContent}
                    </div>
                )}
            </div>
            <BottomSheet open={!isLg && isOpen} onOpenChange={setIsOpen}>
                {menuContent}
            </BottomSheet>
        </>
    )
}

/**
 * Top of every workspace page: the mobile top bar, then a tab bar with the
 * workspace's pages, its pinned notes, search and New note.
 */
const WorkspaceHeader = () => {
    const workspaceId = useCurrentWorkspaceId()
    const { onOpenSidebar } = useAppLayout()
    const { t } = useTranslation()
    const { pathname } = useLocation()
    const { getWorkspaceById } = useWorkspaceStore()
    const workspaceName = getWorkspaceById(workspaceId)?.name
    const { handleCreateNote, isPending: isCreatingNote } = useCreateNote(workspaceId)

    const base = `/workspaces/${workspaceId}`
    const tabs = [
        { to: `${base}/notes`, label: t("menu.notes"), active: pathname.startsWith(`${base}/notes`) && pathname !== `${base}/notes/search` },
        { to: `${base}/files`, label: t("menu.files"), active: pathname === `${base}/files` },
        { to: `${base}/workflows`, label: t("menu.workflows"), active: pathname.startsWith(`${base}/workflows`) },
        { to: `${base}/messaging`, label: t("menu.messaging"), active: pathname.startsWith(`${base}/messaging`) },
        { to: `${base}/settings`, label: t("menu.settings"), active: pathname === `${base}/settings` },
    ]

    return (
        <>
            <MobileTopBar title={workspaceName ?? t("menu.notes")} onOpenSidebar={onOpenSidebar} />
            <div className="shrink-0 h-11 flex items-center gap-1 pl-2 pr-2 lg:pl-4 border-b border-neutral-200 dark:border-neutral-700">
                {workspaceName && (
                    <span className="hidden lg:block shrink-0 max-w-[200px] truncate mr-3 text-sm font-semibold text-gray-900 dark:text-gray-100 select-none">
                        {workspaceName}
                    </span>
                )}
                <nav className="flex-1 min-w-0 flex items-center gap-0.5 overflow-x-auto [scrollbar-width:none]">
                    {tabs.map((tab) => (
                        <Link
                            key={tab.to}
                            to={tab.to}
                            aria-current={tab.active ? "page" : undefined}
                            className={`shrink-0 px-2.5 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors ${tab.active
                                ? "bg-neutral-100 dark:bg-neutral-800 text-gray-900 dark:text-gray-100 font-medium"
                                : "text-muted-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-gray-700 dark:hover:text-gray-300"}`}
                        >
                            {tab.label}
                        </Link>
                    ))}
                </nav>
                <PinnedNotesMenu workspaceId={workspaceId} />
                <Link to={`${base}/notes/search`} aria-label={t("placeholder.search")} title={t("placeholder.search")}
                    className={`${iconButtonClass} ${pathname === `${base}/notes/search` ? "text-gray-900 dark:text-gray-100" : ""}`}>
                    <Search size={16} />
                </Link>
                <button onClick={handleCreateNote} disabled={isCreatingNote}
                    aria-label={t("actions.newNote")} title={t("actions.newNote")} className={iconButtonClass}>
                    <Edit size={16} />
                </button>
            </div>
        </>
    )
}

export default WorkspaceHeader
