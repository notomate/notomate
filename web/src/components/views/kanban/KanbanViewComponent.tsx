import { useMemo, useState, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { KanbanCardData, KanbanColumnData, KanbanViewData, View } from '../../../types/view'
import { deleteViewObject, updateViewObject, updateView } from '../../../api/view'
import { MoreVertical, Edit2, Trash2, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Dialog } from 'radix-ui'
import { useToastStore } from '../../../stores/toast'
import { useTranslation } from 'react-i18next'

interface KanbanViewComponentProps {
    view?: View
    viewObjects?: any[] // columns
    focusedObjectId?: string
    isPublic?: boolean
    workspaceId?: string
    viewId?: string
}

const KanbanViewComponent = ({
    view,
    viewObjects = [],
    isPublic = false,
    workspaceId,
    viewId
}: KanbanViewComponentProps) => {
    const params = useParams<{ workspaceId?: string; viewId?: string }>()
    const queryClient = useQueryClient()
    const { addToast } = useToastStore()
    const { t } = useTranslation()
    const [editingColumnId, setEditingColumnId] = useState<string | null>(null)
    const [editingName, setEditingName] = useState('')
    const [editingColor, setEditingColor] = useState('')

    // inline add-item state per column
    const [addingItemColumnId, setAddingItemColumnId] = useState<string | null>(null)
    const [newItemTitle, setNewItemTitle] = useState('')
    const addItemInputRef = useRef<HTMLTextAreaElement>(null)

    // editing a card
    const [editingCardKey, setEditingCardKey] = useState<{ columnId: string; cardId: string } | null>(null)
    const [editingCardTitle, setEditingCardTitle] = useState('')
    const editCardInputRef = useRef<HTMLTextAreaElement>(null)

    const currentWorkspaceId = workspaceId || params.workspaceId
    const currentViewId = viewId || params.viewId

    useEffect(() => {
        if (addingItemColumnId && addItemInputRef.current) {
            addItemInputRef.current.focus()
        }
    }, [addingItemColumnId])

    useEffect(() => {
        if (editingCardKey && editCardInputRef.current) {
            editCardInputRef.current.focus()
        }
    }, [editingCardKey])

    const sortedColumns = useMemo(() => {
        let viewData: KanbanViewData | null = null
        if (view?.data) {
            try { viewData = JSON.parse(view.data) } catch {}
        }

        if (viewData?.columns && viewData.columns.length > 0) {
            const orderMap = new Map(viewData.columns.map((id, index) => [id, index]))
            return [...viewObjects].sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999))
        }

        return [...viewObjects].sort((a, b) => {
            try {
                const orderA = a.data ? JSON.parse(a.data).order ?? 999 : 999
                const orderB = b.data ? JSON.parse(b.data).order ?? 999 : 999
                return orderA - orderB
            } catch { return 0 }
        })
    }, [viewObjects, view])

    const deleteColumnMutation = useMutation({
        mutationFn: async (columnId: string) => {
            await deleteViewObject(currentWorkspaceId!, currentViewId!, columnId)
            if (view?.data) {
                try {
                    const viewData: KanbanViewData = JSON.parse(view.data)
                    if (viewData.columns) {
                        await updateView(currentWorkspaceId!, currentViewId!, {
                            data: JSON.stringify({ ...viewData, columns: viewData.columns.filter(id => id !== columnId) })
                        })
                    }
                } catch {}
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['view-objects', currentWorkspaceId, currentViewId] })
            queryClient.invalidateQueries({ queryKey: ['view', currentWorkspaceId, currentViewId] })
        },
        onError: () => { addToast({ title: t('views.objectDeletedError'), type: 'error' }) }
    })

    const updateColumnMutation = useMutation({
        mutationFn: ({ columnId, name, data }: { columnId: string, name: string, data: string }) =>
            updateViewObject(currentWorkspaceId!, currentViewId!, columnId, { name, data }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['view-objects', currentWorkspaceId, currentViewId] })
            setEditingColumnId(null)
        },
        onError: () => { addToast({ title: t('views.objectUpdatedError'), type: 'error' }) }
    })

    const handleEditColumn = (columnId: string) => {
        const column = sortedColumns.find(col => col.id === columnId)
        if (!column) return
        setEditingColumnId(columnId)
        setEditingName(column.name)
        try {
            const data: KanbanColumnData = column.data ? JSON.parse(column.data) : {}
            setEditingColor(data.color || '')
        } catch { setEditingColor('') }
    }

    const handleSaveEdit = () => {
        if (!editingColumnId || !editingName.trim()) return
        const column = sortedColumns.find(col => col.id === editingColumnId)
        if (!column) return
        try {
            const existing: KanbanColumnData = column.data ? JSON.parse(column.data) : {}
            updateColumnMutation.mutate({
                columnId: editingColumnId,
                name: editingName.trim(),
                data: JSON.stringify({ ...existing, color: editingColor || undefined })
            })
        } catch { addToast({ title: t('views.objectUpdatedError'), type: 'error' }) }
    }

    const handleMoveColumn = async (columnId: string, direction: 'forward' | 'backward') => {
        if (!view || !currentWorkspaceId || !currentViewId) return
        const currentIndex = sortedColumns.findIndex(col => col.id === columnId)
        if (currentIndex === -1) return
        const targetIndex = direction === 'forward' ? currentIndex - 1 : currentIndex + 1
        if (targetIndex < 0 || targetIndex >= sortedColumns.length) return
        try {
            let viewData: KanbanViewData = {}
            if (view.data) { try { viewData = JSON.parse(view.data) } catch {} }
            const columns = viewData.columns || sortedColumns.map(col => col.id)
            const newColumns = [...columns];
            [newColumns[currentIndex], newColumns[targetIndex]] = [newColumns[targetIndex], newColumns[currentIndex]]
            await updateView(currentWorkspaceId, currentViewId, { data: JSON.stringify({ ...viewData, columns: newColumns }) })
            queryClient.invalidateQueries({ queryKey: ['view', currentWorkspaceId, currentViewId] })
        } catch { addToast({ title: t('views.objectUpdatedError'), type: 'error' }) }
    }

    const updateColumnItems = (column: any, items: KanbanCardData[]) => {
        const existing: KanbanColumnData = column.data ? JSON.parse(column.data) : {}
        updateColumnMutation.mutate({
            columnId: column.id,
            name: column.name,
            data: JSON.stringify({ ...existing, items })
        })
    }

    const handleAddItem = (column: any) => {
        const title = newItemTitle.trim()
        if (!title) {
            setAddingItemColumnId(null)
            setNewItemTitle('')
            return
        }
        const existing: KanbanColumnData = column.data ? JSON.parse(column.data) : {}
        const items = existing.items || []
        const newCard: KanbanCardData = { id: crypto.randomUUID(), title }
        updateColumnItems(column, [...items, newCard])
        setNewItemTitle('')
        // keep the input open for rapid entry
    }

    const handleStartEditCard = (columnId: string, card: KanbanCardData) => {
        setEditingCardKey({ columnId, cardId: card.id })
        setEditingCardTitle(card.title)
    }

    const handleSaveCardEdit = (column: any) => {
        if (!editingCardKey) return
        const title = editingCardTitle.trim()
        if (!title) {
            setEditingCardKey(null)
            return
        }
        const existing: KanbanColumnData = column.data ? JSON.parse(column.data) : {}
        const items = (existing.items || []).map(item =>
            item.id === editingCardKey.cardId ? { ...item, title } : item
        )
        updateColumnItems(column, items)
        setEditingCardKey(null)
    }

    const handleDeleteCard = (column: any, cardId: string) => {
        const existing: KanbanColumnData = column.data ? JSON.parse(column.data) : {}
        const items = (existing.items || []).filter(item => item.id !== cardId)
        updateColumnItems(column, items)
    }

    return (
        <>
            <div className="h-full overflow-x-auto">
                <div className="flex gap-4 h-full min-w-max p-4">
                    {sortedColumns.map((column, index) => {
                        let columnData: KanbanColumnData = {}
                        try { if (column.data) columnData = JSON.parse(column.data) } catch {}
                        const items = columnData.items || []
                        const isAddingHere = addingItemColumnId === column.id

                        return (
                            <div
                                key={column.id}
                                className="flex-shrink-0 w-72 bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4 flex flex-col max-h-full"
                            >
                                {/* Column header */}
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        {columnData.color && (
                                            <div className="w-3 h-3 rounded" style={{ backgroundColor: columnData.color }} />
                                        )}
                                        <span className="font-semibold text-base">{column.name}</span>
                                        <span className="text-xs text-neutral-400 dark:text-neutral-500">{items.length}</span>
                                    </div>
                                    {!isPublic && (
                                        <div className="flex items-center gap-1">
                                            <button
                                                className="p-1 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors"
                                                onClick={() => { setAddingItemColumnId(column.id); setNewItemTitle('') }}
                                                title={t('views.addItem', 'Add item')}
                                            >
                                                <Plus size={16} />
                                            </button>
                                            <DropdownMenu.Root>
                                                <DropdownMenu.Trigger asChild>
                                                    <button className="p-1 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors">
                                                        <MoreVertical size={16} />
                                                    </button>
                                                </DropdownMenu.Trigger>
                                                <DropdownMenu.Portal>
                                                    <DropdownMenu.Content className="min-w-[160px] bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 p-1 z-50" sideOffset={5}>
                                                        {index > 0 && (
                                                            <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 text-sm rounded cursor-pointer outline-none hover:bg-neutral-100 dark:hover:bg-neutral-700" onSelect={() => handleMoveColumn(column.id, 'forward')}>
                                                                <ChevronLeft size={14} />{t('actions.moveForward')}
                                                            </DropdownMenu.Item>
                                                        )}
                                                        {index < sortedColumns.length - 1 && (
                                                            <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 text-sm rounded cursor-pointer outline-none hover:bg-neutral-100 dark:hover:bg-neutral-700" onSelect={() => handleMoveColumn(column.id, 'backward')}>
                                                                <ChevronRight size={14} />{t('actions.moveBackward')}
                                                            </DropdownMenu.Item>
                                                        )}
                                                        <DropdownMenu.Separator className="h-px bg-neutral-200 dark:bg-neutral-700 my-1" />
                                                        <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 text-sm rounded cursor-pointer outline-none hover:bg-neutral-100 dark:hover:bg-neutral-700" onSelect={() => handleEditColumn(column.id)}>
                                                            <Edit2 size={14} />{t('actions.edit')}
                                                        </DropdownMenu.Item>
                                                        <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 text-sm rounded cursor-pointer outline-none text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" onSelect={() => { if (window.confirm(t('views.deleteObjectConfirm'))) deleteColumnMutation.mutate(column.id) }}>
                                                            <Trash2 size={14} />{t('actions.delete')}
                                                        </DropdownMenu.Item>
                                                    </DropdownMenu.Content>
                                                </DropdownMenu.Portal>
                                            </DropdownMenu.Root>
                                        </div>
                                    )}
                                </div>

                                {/* Cards list */}
                                <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                                    {items.map(card => {
                                        const isEditingThisCard = editingCardKey?.columnId === column.id && editingCardKey?.cardId === card.id
                                        return (
                                            <div key={card.id} className="group bg-white dark:bg-neutral-700 rounded-md p-3 shadow-sm border border-neutral-200 dark:border-neutral-600">
                                                {isEditingThisCard ? (
                                                    <div>
                                                        <textarea
                                                            ref={editCardInputRef}
                                                            value={editingCardTitle}
                                                            onChange={e => setEditingCardTitle(e.target.value)}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveCardEdit(column) }
                                                                if (e.key === 'Escape') setEditingCardKey(null)
                                                            }}
                                                            className="w-full text-sm resize-none bg-transparent outline-none border-none p-0"
                                                            rows={2}
                                                        />
                                                        <div className="flex gap-1 mt-2">
                                                            <button
                                                                onClick={() => handleSaveCardEdit(column)}
                                                                className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                                                            >
                                                                {t('common.save')}
                                                            </button>
                                                            <button
                                                                onClick={() => setEditingCardKey(null)}
                                                                className="px-2 py-1 text-xs border dark:border-neutral-500 rounded hover:bg-neutral-100 dark:hover:bg-neutral-600"
                                                            >
                                                                {t('common.cancel')}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-start justify-between gap-1">
                                                        <span
                                                            className="text-sm flex-1 cursor-pointer"
                                                            onClick={() => !isPublic && handleStartEditCard(column.id, card)}
                                                        >
                                                            {card.title}
                                                        </span>
                                                        {!isPublic && (
                                                            <button
                                                                onClick={() => handleDeleteCard(column, card.id)}
                                                                className="opacity-0 group-hover:opacity-100 p-0.5 text-neutral-400 hover:text-red-500 rounded transition-opacity"
                                                            >
                                                                <X size={12} />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}

                                    {items.length === 0 && !isAddingHere && (
                                        <div className="text-center py-6 text-neutral-400 dark:text-neutral-500 text-sm">
                                            {t('views.kanbanEmpty', 'Empty column')}
                                        </div>
                                    )}
                                </div>

                                {/* Inline add item */}
                                {!isPublic && (
                                    <div className="mt-2 flex-shrink-0">
                                        {isAddingHere ? (
                                            <div className="bg-white dark:bg-neutral-700 rounded-md p-2 shadow-sm border border-neutral-200 dark:border-neutral-600">
                                                <textarea
                                                    ref={addItemInputRef}
                                                    value={newItemTitle}
                                                    onChange={e => setNewItemTitle(e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddItem(column) }
                                                        if (e.key === 'Escape') { setAddingItemColumnId(null); setNewItemTitle('') }
                                                    }}
                                                    placeholder={t('views.itemTitle', 'Item title...')}
                                                    className="w-full text-sm resize-none bg-transparent outline-none border-none p-0 placeholder-neutral-400"
                                                    rows={2}
                                                />
                                                <div className="flex gap-1 mt-2">
                                                    <button
                                                        onClick={() => handleAddItem(column)}
                                                        disabled={!newItemTitle.trim()}
                                                        className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {t('views.addItem', 'Add item')}
                                                    </button>
                                                    <button
                                                        onClick={() => { setAddingItemColumnId(null); setNewItemTitle('') }}
                                                        className="px-2 py-1 text-xs border dark:border-neutral-500 rounded hover:bg-neutral-100 dark:hover:bg-neutral-600"
                                                    >
                                                        {t('common.cancel')}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => { setAddingItemColumnId(column.id); setNewItemTitle('') }}
                                                className="w-full flex items-center gap-1 px-2 py-1.5 text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors"
                                            >
                                                <Plus size={14} />
                                                {t('views.addItem', 'Add item')}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}

                    {sortedColumns.length === 0 && (
                        <div className="flex items-center justify-center w-full h-full text-neutral-400 dark:text-neutral-500">
                            {t('views.noColumns', 'No columns yet. Create your first column to get started.')}
                        </div>
                    )}
                </div>
            </div>

            <Dialog.Root open={!!editingColumnId} onOpenChange={(open) => !open && setEditingColumnId(null)}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
                    <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-neutral-800 rounded-lg shadow-xl p-6 w-[90vw] max-w-[400px] z-50">
                        <Dialog.Title className="text-xl font-semibold mb-4">{t('views.editColumn')}</Dialog.Title>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">{t('views.columnName')}</label>
                                <input type="text" value={editingName} onChange={(e) => setEditingName(e.target.value)} className="w-full px-3 py-2 border dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800" placeholder={t('views.enterName')} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">{t('views.color')}</label>
                                <input type="color" value={editingColor || '#3b82f6'} onChange={(e) => setEditingColor(e.target.value)} className="w-full h-10 border dark:border-neutral-600 rounded-lg cursor-pointer" />
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-2">
                            <Dialog.Close asChild>
                                <button className="px-4 py-2 border dark:border-neutral-600 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800">{t('common.cancel')}</button>
                            </Dialog.Close>
                            <button onClick={handleSaveEdit} disabled={updateColumnMutation.isPending || !editingName.trim()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                                {updateColumnMutation.isPending ? t('common.saving') : t('common.save')}
                            </button>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </>
    )
}

export default KanbanViewComponent
