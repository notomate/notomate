import { NodeViewProps, NodeViewWrapper } from "@tiptap/react"
import { Map, CalendarDays, Kanban, PenTool, Sheet, ExternalLink, Loader2, Trash2 } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { ViewType } from "@/types/view"
import SpreadsheetViewComponent from "@/components/views/spreadsheet/SpreadsheetViewComponent"
import WhiteboardViewComponent from "@/components/views/whiteboard/WhiteboardViewComponent"
import { MapInlinePreview, CalendarInlinePreview, KanbanInlinePreview } from "./ViewNodeInlinePreview"

const VIEW_TYPE_META: Record<ViewType, { icon: React.ReactNode; label: string; path: string }> = {
    map: { icon: <Map size={16} />, label: 'Map', path: 'map' },
    calendar: { icon: <CalendarDays size={16} />, label: 'Calendar', path: 'calendar' },
    kanban: { icon: <Kanban size={16} />, label: 'Kanban', path: 'kanban' },
    whiteboard: { icon: <PenTool size={16} />, label: 'Whiteboard', path: 'whiteboard' },
    spreadsheet: { icon: <Sheet size={16} />, label: 'Spreadsheet', path: 'spreadsheet' },
}

const INLINE_TYPES: ViewType[] = ['spreadsheet', 'whiteboard', 'map', 'calendar', 'kanban']

const ViewComponent: React.FC<NodeViewProps> = ({ node, extension, updateAttributes, editor, deleteNode }) => {
    const { viewId, viewType, name } = node.attrs
    const [showActions, setShowActions] = useState(false)
    const isEditable = editor.isEditable
    const navigate = useNavigate()
    const { t } = useTranslation()
    const hasCreated = useRef(false)

    useEffect(() => {
        if (viewId || hasCreated.current) return
        hasCreated.current = true

        const { workspaceId, noteId, createView } = extension.options
        const meta = VIEW_TYPE_META[viewType as ViewType] ?? VIEW_TYPE_META.map
        const defaultName = meta.label

        createView(workspaceId, {
            note_id: noteId,
            name: defaultName,
            type: viewType,
            visibility: 'workspace',
        }).then((newView: { id: string; name: string }) => {
            updateAttributes({ viewId: newView.id, name: newView.name })
        }).catch(() => {
            deleteNode()
        })
    }, [])

    const handleNavigate = () => {
        if (!viewId) return
        const { workspaceId } = extension.options
        const meta = VIEW_TYPE_META[viewType as ViewType] ?? VIEW_TYPE_META.map
        navigate(`/workspaces/${workspaceId}/${meta.path}/${viewId}`)
    }

    const meta = VIEW_TYPE_META[viewType as ViewType] ?? VIEW_TYPE_META.map

    if (!viewId) {
        return (
            <NodeViewWrapper className="view-node my-1">
                <div className="flex items-center gap-2 border dark:border-neutral-700 rounded-lg p-3 bg-gray-50 dark:bg-neutral-800/50">
                    <Loader2 size={16} className="text-muted-foreground animate-spin flex-shrink-0" />
                    <span className="text-sm text-muted-foreground">{t('views.creating', 'Creating view...')}</span>
                </div>
            </NodeViewWrapper>
        )
    }

    const { workspaceId } = extension.options

    if (INLINE_TYPES.includes(viewType as ViewType)) {
        return (
            <NodeViewWrapper className="view-node my-1">
                <div
                    className="border dark:border-neutral-700 rounded-lg overflow-hidden group"
                    onMouseEnter={() => setShowActions(true)}
                    onMouseLeave={() => setShowActions(false)}
                >
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-neutral-800/50 border-b dark:border-neutral-700">
                        <span className="text-blue-500 dark:text-blue-400 flex-shrink-0">{meta.icon}</span>
                        <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{name || meta.label}</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={(e) => { e.stopPropagation(); handleNavigate() }}
                                className="p-1 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded transition-colors"
                                title={t("actions.open")}
                            >
                                <ExternalLink size={12} className="text-muted-foreground" />
                            </button>
                            {isEditable && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        const { workspaceId, deleteView } = extension.options
                                        if (viewId) deleteView(workspaceId, viewId).catch(() => {})
                                        deleteNode()
                                    }}
                                    className="p-1 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                                    title={t("actions.delete")}
                                >
                                    <Trash2 size={12} className="text-red-500" />
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="h-80 w-full">
                        {viewType === 'spreadsheet' && (
                            <SpreadsheetViewComponent viewId={viewId} workspaceId={workspaceId} readOnly={true} />
                        )}
                        {viewType === 'whiteboard' && (
                            <WhiteboardViewComponent viewId={viewId} workspaceId={workspaceId} readOnly={true} />
                        )}
                        {viewType === 'map' && (
                            <MapInlinePreview viewId={viewId} workspaceId={workspaceId} />
                        )}
                        {viewType === 'calendar' && (
                            <CalendarInlinePreview viewId={viewId} workspaceId={workspaceId} />
                        )}
                        {viewType === 'kanban' && (
                            <KanbanInlinePreview viewId={viewId} workspaceId={workspaceId} />
                        )}
                    </div>
                </div>
            </NodeViewWrapper>
        )
    }

    return (
        <NodeViewWrapper className="view-node my-1">
            <div
                className="flex items-center gap-2 border dark:border-neutral-700 rounded-lg p-3 bg-gray-50 dark:bg-neutral-800/50 group cursor-pointer hover:bg-gray-100 dark:hover:bg-neutral-700/50 transition-colors"
                onMouseEnter={() => setShowActions(true)}
                onMouseLeave={() => setShowActions(false)}
                onClick={handleNavigate}
            >
                <span className="text-blue-500 dark:text-blue-400 flex-shrink-0">{meta.icon}</span>
                <span className={`flex-1 text-sm font-medium truncate ${name ? 'text-gray-700 dark:text-gray-300' : 'text-muted-foreground italic'}`}>
                    {name || meta.label}
                </span>
                <span className="text-xs text-muted-foreground flex-shrink-0 px-1.5 py-0.5 rounded bg-gray-100 dark:bg-neutral-700">
                    {meta.label}
                </span>
                <ExternalLink size={14} className="text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                {isEditable && showActions && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            const { workspaceId, deleteView } = extension.options
                            if (viewId) deleteView(workspaceId, viewId).catch(() => {})
                            deleteNode()
                        }}
                        className="p-1 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                        title={t("actions.delete")}
                    >
                        <Trash2 size={12} className="text-red-500" />
                    </button>
                )}
            </div>
        </NodeViewWrapper>
    )
}

export default ViewComponent
