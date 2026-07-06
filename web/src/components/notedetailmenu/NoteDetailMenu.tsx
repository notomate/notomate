import { FC, useRef, useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { deleteNote, NoteData, updateNoteVisibility } from "@/api/note"
import { useTranslation } from "react-i18next"
import { Trash2, Ellipsis, Globe2, Lock, Building } from "lucide-react"
import { useParams, useNavigate } from "react-router-dom"
import { useToastStore } from "@/stores/toast"
import { Visibility } from "@/types/visibility"

interface NoteDetailMenuProps {
    note: NoteData
}

const NoteDetailMenu: FC<NoteDetailMenuProps> = ({ note }) => {
    const { t } = useTranslation()
    const { workspaceId } = useParams<{ workspaceId?: string }>()
    const { addToast } = useToastStore()
    const queryClient = useQueryClient()
    const navigate = useNavigate()
    const [isMenuOpened, setIsMenuOpened] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)
    const buttonRef = useRef<HTMLButtonElement>(null)
    const [isLg, setIsLg] = useState(() => window.innerWidth >= 1024)

    useEffect(() => {
        const mq = window.matchMedia('(min-width: 1024px)')
        const handler = (e: MediaQueryListEvent) => setIsLg(e.matches)
        mq.addEventListener('change', handler)
        return () => mq.removeEventListener('change', handler)
    }, [])

    const deleteNoteMutation = useMutation({
        mutationFn: () => {
            if (!workspaceId || !note.id) throw new Error('Missing required parameters')
            return deleteNote(workspaceId, note.id)
        },
        onSuccess: async () => {
            try {
                await queryClient.invalidateQueries({ queryKey: ['notes', workspaceId] })
                navigate(`/workspaces/${workspaceId}/notes`)
            } catch (error) {
                addToast({ title: t('messages.deleteNoteFailed'), type: 'error' })
            }
        },
    })

    const updateVisibilityMutation = useMutation({
        mutationFn: (visibility: Visibility) => {
            if (!workspaceId || !note.id) throw new Error('Missing required parameters')
            return updateNoteVisibility(workspaceId, note.id, visibility)
        },
        onSuccess: async () => {
            try {
                await queryClient.invalidateQueries({ queryKey: ['note', workspaceId, note.id] })
                setIsMenuOpened(false)
            } catch (error) {
                addToast({ title: t('messages.updateVisibilityFailed'), type: 'error' })
            }
        },
    })

    const handleDelete = () => {
        if (confirm(t('messages.confirmDelete'))) {
            deleteNoteMutation.mutate()
            setIsMenuOpened(false)
        }
    }

    const handleUpdateVisibility = (visibility: Visibility) => {
        if (visibility === note.visibility) return
        updateVisibilityMutation.mutate(visibility)
    }

    const handleOpenMenu = () => {
        setIsMenuOpened(prev => !prev)
    }

    // Close dropdown when clicking outside (lg only)
    useEffect(() => {
        if (!isLg || !isMenuOpened) return

        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node
            if (
                !(menuRef.current?.contains(target)) &&
                !(buttonRef.current?.contains(target))
            ) {
                setIsMenuOpened(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isMenuOpened, isLg])

    const menuItems = workspaceId && (
        <>
            {note.visibility !== "private" && (
                <button
                    className="px-3 py-2 flex items-center gap-3 w-full text-left rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    onClick={() => handleUpdateVisibility("private")}
                >
                    <Lock size={16} />
                    {t("actions.makePrivate")}
                </button>
            )}
            {note.visibility !== "workspace" && (
                <button
                    className="px-3 py-2 flex items-center gap-3 w-full text-left rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    onClick={() => handleUpdateVisibility("workspace")}
                >
                    <Building size={16} />
                    {t("actions.makeWorkspace")}
                </button>
            )}
            {note.visibility !== "public" && (
                <button
                    className="px-3 py-2 flex items-center gap-3 w-full text-left rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    onClick={() => handleUpdateVisibility("public")}
                >
                    <Globe2 size={16} />
                    {t("actions.makePublic")}
                </button>
            )}
            <button
                onClick={handleDelete}
                className="px-3 py-2 flex items-center gap-3 w-full text-left text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
                <Trash2 size={16} />
                <span>{t('actions.delete')}</span>
            </button>
        </>
    )

    return (
        <>
            <div className="relative">
                <button ref={buttonRef} className="p-2" onClick={handleOpenMenu}>
                    <Ellipsis size={16} />
                </button>
                {isLg && isMenuOpened && (
                    <div
                        ref={menuRef}
                        className="absolute top-full right-0 min-w-[240px] overflow-y-auto bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border dark:border-neutral-700 rounded-lg shadow-lg z-50"
                    >
                        <div className="flex flex-col p-2">
                            {menuItems}
                        </div>
                    </div>
                )}
            </div>

            {!isLg && isMenuOpened && createPortal(
                <>
                    <div
                        className="fixed inset-0 bg-black/40 z-40"
                        onClick={() => setIsMenuOpened(false)}
                    />
                    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 rounded-t-2xl z-50 shadow-xl">
                        <div className="flex justify-center pt-3 pb-1">
                            <div className="w-10 h-1 bg-neutral-300 dark:bg-neutral-600 rounded-full" />
                        </div>
                        <div className="flex flex-col py-4 px-2 pb-8">
                            {menuItems}
                        </div>
                    </div>
                </>,
                document.body
            )}
        </>
    )
}

export default NoteDetailMenu
