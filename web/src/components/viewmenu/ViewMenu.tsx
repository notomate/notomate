import { ChevronsUpDown, Plus, Trash2 } from "lucide-react"
import { Dropdown } from "../dropdown/Dropdown"
import { useMemo, useState } from "react"
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ViewType } from "@/types/view"
import { createView, getViews, deleteView } from "@/api/view"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import useCurrentWorkspaceId from "@/hooks/use-currentworkspace-id"
import { useToastStore } from "@/stores/toast"

interface ViewMenuProps {
    viewType: ViewType
    currentViewId?: string
}

const ViewMenu = ({ viewType, currentViewId }: ViewMenuProps) => {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const currentWorkspaceId = useCurrentWorkspaceId()
    const queryClient = useQueryClient()
    const { addToast } = useToastStore()
    const [keyword, setKeyword] = useState("")

    const { data: views } = useQuery({
        queryKey: ['views', currentWorkspaceId, viewType],
        queryFn: async () => {
            const allViews = await getViews(currentWorkspaceId)
            return allViews.filter((v: any) => v.type === viewType)
        },
        enabled: !!currentWorkspaceId,
    })

    const createMutation = useMutation({
        mutationFn: (name: string) =>
            createView(currentWorkspaceId, { name, type: viewType, visibility: 'private' }),
        onSuccess: (newView) => {
            queryClient.invalidateQueries({ queryKey: ['views', currentWorkspaceId, viewType] })
            navigate(`/workspaces/${currentWorkspaceId}/${viewType}/${newView.id}`)
            setKeyword("")
        },
        onError: () => {
            addToast({ type: 'error', title: t('views.objectCreatedError') })
        }
    })

    const deleteMutation = useMutation({
        mutationFn: (viewId: string) => deleteView(currentWorkspaceId, viewId),
        onSuccess: (_, deletedViewId) => {
            queryClient.invalidateQueries({ queryKey: ['views', currentWorkspaceId, viewType] })

            // If deleted view is current view, navigate to list page
            if (deletedViewId === currentViewId) {
                navigate(`/workspaces/${currentWorkspaceId}/${viewType}`)
            }
        },
        onError: () => {
            addToast({ type: 'error', title: t('views.objectDeletedError') })
        }
    })

    const currentView = useMemo(() => {
        return views?.find((v: any) => v.id === currentViewId)
    }, [views, currentViewId])

    const filteredViews = useMemo(() => {
        if (!views) return []
        return keyword
            ? views.filter((v: any) => v.name.toLowerCase().includes(keyword.toLowerCase()))
            : views
    }, [views, keyword])

    const handleViewClick = (id: string) => {
        if (id === currentViewId) return
        navigate(`/workspaces/${currentWorkspaceId}/${viewType}/${id}`)
    }

    const handleNewViewClick = () => {
        if (keyword.trim()) {
            createMutation.mutate(keyword.trim())
        }
    }

    const handleDeleteView = (e: React.MouseEvent, viewId: string) => {
        e.stopPropagation()
        if (window.confirm(t('views.deleteConfirm'))) {
            deleteMutation.mutate(viewId)
        }
    }

    const getViewTypeLabel = () => {
        switch (viewType) {
            case 'calendar':
                return t('views.calendar')
            case 'map':
                return t('views.map')
            case 'kanban':
                return t('views.kanban') || 'Kanban'
            case 'whiteboard':
                return t('views.whiteboard') || 'Whiteboard'
            case 'spreadsheet':
                return t('views.spreadsheet') || 'Spreadsheet'
            default:
                return viewType
        }
    }

    const getSearchPlaceholder = () => {
        switch (viewType) {
            case 'calendar':
                return t('views.searchCalendar')
            case 'map':
                return t('views.searchMap')
            case 'kanban':
                return t('views.searchKanban')
            case 'whiteboard':
                return t('views.searchWhiteboard') || 'Search Whiteboard'
            case 'spreadsheet':
                return t('views.searchSpreadsheet') || 'Search Spreadsheet'
            default:
                return t('placeholder.searchWorkspace')
        }
    }

    const getCreateText = (name: string) => {
        const viewTypeName = getViewTypeLabel()
        return name
            ? t('views.createViewWithName', { type: viewTypeName, name })
            : t('views.createNewView', { type: viewTypeName })
    }

    return (
        <>
            <Dropdown
                className="w-full"
                buttonClassName="bg-white dark:bg-neutral-700 shadow border dark:border-none w-full px-3 py-1.5 rounded-md text-sm flex justify-center items-center truncate"
                buttonTooltip={currentView?.name ?? getViewTypeLabel()}
                buttonContent={
                    <>
                        <span className="grow text-left truncate">
                            {currentView?.name ?? getViewTypeLabel()}
                        </span>
                        <span className="w-5">
                            <ChevronsUpDown size={16} />
                        </span>
                    </>
                }
            >
            <div className="px-2 pb-2">
                <input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    className="border dark:border-none shadow-inner rounded-md w-full px-3 py-1 dark:bg-neutral-700 dark:text-neutral-100"
                    placeholder={getSearchPlaceholder()}
                />
            </div>
            <div className="overflow-y-auto pb-2 max-h-64">
                {filteredViews.map((v: any) => (
                    <div key={v.id} className="px-2 text-sm text-ellipsis group">
                        <div className="flex items-center gap-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800">
                            <button
                                className="px-3 py-2 flex-1 text-left truncate"
                                onClick={() => handleViewClick(v.id)}
                            >
                                {v.name}
                            </button>
                            <button
                                onClick={(e) => handleDeleteView(e, v.id)}
                                className="p-2 opacity-0 group-hover:opacity-100 hover:text-red-600 dark:hover:text-red-400 transition-opacity"
                                title={t('actions.delete')}
                                disabled={deleteMutation.isPending}
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                ))}
                {keyword.length > 0 && (
                    <div className="px-2 text-sm whitespace-nowrap overflow-x-auto">
                        <button
                            onClick={handleNewViewClick}
                            disabled={createMutation.isPending}
                            className="p-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center w-full gap-2 disabled:opacity-50"
                        >
                            <Plus size={16} />
                            {getCreateText(keyword)}
                        </button>
                    </div>
                )}
            </div>

            </Dropdown>
        </>
    )
}

export default ViewMenu
