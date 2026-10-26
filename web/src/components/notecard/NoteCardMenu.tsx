import { FC, useRef, useState, useEffect } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { deleteNote, NoteData, updateNotePinned } from "@/api/note"
import { useTranslation } from "react-i18next"
import { Trash2, Ellipsis, Pin, PinOff } from "lucide-react"
import { useToastStore } from "@/stores/toast"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { menuIconClass, menuItemClass, menuListClass, menuSurfaceClass } from "@/components/ui/menu"
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

        document.addEventListener('pointerdown', handleClickOutside, true)
        return () => document.removeEventListener('pointerdown', handleClickOutside, true)
    }, [isMenuOpened, isLg])

    const sheet = !isLg

    const menuItems = (
        <>
            <button className={menuItemClass(sheet)} onClick={handleTogglePin}>
                <span className={menuIconClass()}>{note.pinned ? <PinOff size={16} /> : <Pin size={16} />}</span>
                {note.pinned ? t("actions.unpin") : t("actions.pin")}
            </button>
            <button className={menuItemClass(sheet, true)} onClick={handleDelete}>
                <span className={menuIconClass(true)}><Trash2 size={16} /></span>
                {t('actions.delete')}
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
                        className={`absolute top-full right-0 min-w-[200px] overflow-y-auto z-dropdown ${menuSurfaceClass}`}
                    >
                        <div className={menuListClass}>
                            {menuItems}
                        </div>
                    </div>
                )}
            </div>

            <BottomSheet open={!isLg && isMenuOpened} onOpenChange={setIsMenuOpened}>
                <div className={menuListClass}>
                    {menuItems}
                </div>
            </BottomSheet>
        </>
    )
}

export default NoteCardMenu
