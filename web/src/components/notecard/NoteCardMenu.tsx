import { FC, useRef, useState, useEffect } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { deleteNote, NoteData, updateNotePinned } from "@/api/note"
import { useTranslation } from "react-i18next"
import { Trash2, Ellipsis, Pin, PinOff } from "lucide-react"
import { useToastStore } from "@/stores/toast"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { useIsLg } from "@/hooks/use-media-query"

interface NoteCardMenuProps {
    note: NoteData
    workspaceId: string
}

const NoteCardMenu: FC<NoteCardMenuProps> = ({ note, workspaceId }) => {
    const { t } = useTranslation()
    const { addToast } = useToastStore()
    const queryClient = useQueryClient()
    const [isMenuOpened, setIsMenuOpened] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)
    const buttonRef = useRef<HTMLButtonElement>(null)
    const isLg = useIsLg()

    const deleteNoteMutation = useMutation({
        mutationFn: () => {
            if (!note.id) throw new Error('Missing required parameters')
            return deleteNote(workspaceId, note.id)
        },
        onSuccess: async () => {
            try {
                await queryClient.invalidateQueries({ queryKey: ['notes-search', workspaceId] })
                await queryClient.invalidateQueries({ queryKey: ['notes', workspaceId] })
                setIsMenuOpened(false)
            } catch {
                addToast({ title: t('messages.deleteNoteFailed'), type: 'error' })
            }
        },
        onError: () => {
            addToast({ title: t('messages.deleteNoteFailed'), type: 'error' })
        },
    })

    const updatePinnedMutation = useMutation({
        mutationFn: (pinned: boolean) => {
            if (!note.id) throw new Error('Missing required parameters')
            return updateNotePinned(workspaceId, note.id, pinned)
        },
        onSuccess: async () => {
            try {
                await queryClient.invalidateQueries({ queryKey: ['notes-search', workspaceId] })
                await queryClient.invalidateQueries({ queryKey: ['notes', workspaceId] })
                await queryClient.invalidateQueries({ queryKey: ['note', workspaceId, note.id] })
                setIsMenuOpened(false)
            } catch {
                addToast({ title: t('messages.updatePinnedFailed'), type: 'error' })
            }
        },
        onError: () => {
            addToast({ title: t('messages.updatePinnedFailed'), type: 'error' })
        },
    })

    const handleDelete = () => {
        if (confirm(t('messages.confirmDelete'))) {
            deleteNoteMutation.mutate()
        }
    }

    const handleTogglePin = () => {
        updatePinnedMutation.mutate(!note.pinned)
    }

    const handleOpenMenu = () => {
        setIsMenuOpened(prev => !prev)
    }

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

    const menuItems = (
        <>
            <button
                className="px-3 py-2 flex items-center gap-3 w-full text-left rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                onClick={handleTogglePin}
            >
                {note.pinned ? <PinOff size={16} /> : <Pin size={16} />}
                {note.pinned ? t("actions.unpin") : t("actions.pin")}
            </button>
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
                <button
                    ref={buttonRef}
                    className="p-1 text-muted-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md"
                    onClick={handleOpenMenu}
                >
                    <Ellipsis size={16} />
                </button>
                {isLg && isMenuOpened && (
                    <div
                        ref={menuRef}
                        className="absolute top-full right-0 min-w-[200px] overflow-y-auto bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border dark:border-neutral-700 rounded-lg shadow-lg z-dropdown"
                    >
                        <div className="flex flex-col p-2">
                            {menuItems}
                        </div>
                    </div>
                )}
            </div>

            <BottomSheet open={!isLg && isMenuOpened} onOpenChange={setIsMenuOpened}>
                <div className="flex flex-col py-4 px-2 pb-8">
                    {menuItems}
                </div>
            </BottomSheet>
        </>
    )
}

export default NoteCardMenu
