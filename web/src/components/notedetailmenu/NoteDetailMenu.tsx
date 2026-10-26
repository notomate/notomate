import { FC, useRef, useState, useEffect } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { deleteNote, NoteData, updateNoteVisibility, updateNotePinned } from "@/api/note"
import { useTranslation } from "react-i18next"
import { Trash2, Ellipsis, Globe2, Lock, Building, Pin, PinOff } from "lucide-react"
import { useParams, useNavigate } from "react-router-dom"
import { useToastStore } from "@/stores/toast"
import { Visibility } from "@/types/visibility"
import { useCurrentUserStore } from "@/stores/current-user"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { menuIconClass, menuItemClass, menuListClass, menuSurfaceClass } from "@/components/ui/menu"
import { useIsLg } from "@/hooks/use-media-query"

interface NoteDetailMenuProps {
    note: NoteData
}

const NoteDetailMenu: FC<NoteDetailMenuProps> = ({ note }) => {
    const { t } = useTranslation()
    const { workspaceId } = useParams<{ workspaceId?: string }>()
    const { addToast } = useToastStore()
    const queryClient = useQueryClient()
    const navigate = useNavigate()
    const { user } = useCurrentUserStore()
    const isCreator = !!user?.id && user.id === note.created_by_id
    const [isMenuOpened, setIsMenuOpened] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)
    const buttonRef = useRef<HTMLButtonElement>(null)
    const isLg = useIsLg()

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

    const updatePinnedMutation = useMutation({
        mutationFn: (pinned: boolean) => {
            if (!workspaceId || !note.id) throw new Error('Missing required parameters')
            return updateNotePinned(workspaceId, note.id, pinned)
        },
        onSuccess: async () => {
            try {
                await queryClient.invalidateQueries({ queryKey: ['note', workspaceId, note.id] })
                await queryClient.invalidateQueries({ queryKey: ['notes', workspaceId] })
                setIsMenuOpened(false)
            } catch {
                addToast({ title: t('messages.updatePinnedFailed'), type: 'error' })
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

    const handleTogglePin = () => {
        updatePinnedMutation.mutate(!note.pinned)
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

        document.addEventListener('pointerdown', handleClickOutside, true)
        return () => document.removeEventListener('pointerdown', handleClickOutside, true)
    }, [isMenuOpened, isLg])

    const sheet = !isLg

    const menuItems = workspaceId && (
        <>
            {isCreator && (
                <button className={menuItemClass(sheet)} onClick={handleTogglePin}>
                    <span className={menuIconClass()}>{note.pinned ? <PinOff size={16} /> : <Pin size={16} />}</span>
                    {note.pinned ? t("actions.unpin") : t("actions.pin")}
                </button>
            )}
            {isCreator && note.visibility !== "private" && (
                <button className={menuItemClass(sheet)} onClick={() => handleUpdateVisibility("private")}>
                    <span className={menuIconClass()}><Lock size={16} /></span>
                    {t("actions.makePrivate")}
                </button>
            )}
            {isCreator && note.visibility !== "workspace" && (
                <button className={menuItemClass(sheet)} onClick={() => handleUpdateVisibility("workspace")}>
                    <span className={menuIconClass()}><Building size={16} /></span>
                    {t("actions.makeWorkspace")}
                </button>
            )}
            {isCreator && note.visibility !== "public" && (
                <button className={menuItemClass(sheet)} onClick={() => handleUpdateVisibility("public")}>
                    <span className={menuIconClass()}><Globe2 size={16} /></span>
                    {t("actions.makePublic")}
                </button>
            )}
            <button className={menuItemClass(sheet, true)} onClick={handleDelete}>
                <span className={menuIconClass(true)}><Trash2 size={16} /></span>
                {t('actions.delete')}
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
                        className={`absolute top-full right-0 min-w-[240px] overflow-y-auto z-dropdown ${menuSurfaceClass}`}
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

export default NoteDetailMenu
