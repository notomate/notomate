import { NodeViewProps, NodeViewWrapper } from "@tiptap/react"
import { FileText, ExternalLink, Loader2, Trash2, ChevronUp, ChevronDown } from "lucide-react"
import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { getNote } from "@/api/note"
import { useDragMenu, NodeTouchMenu } from "@/components/editor/DragMenuContext"

const SubPageComponent: React.FC<NodeViewProps> = ({ node, extension, updateAttributes, editor, deleteNode, selected, getPos }) => {
    const { noteId, title } = node.attrs
    const [showActions, setShowActions] = useState(false)
    const isEditable = editor.isEditable
    const isTouchDevice = window.matchMedia("(pointer: coarse)").matches
    const navigate = useNavigate()
    const { t } = useTranslation()
    const hasCreated = useRef(false)

    // Create note on first mount when noteId is not yet set
    useEffect(() => {
        if (noteId || hasCreated.current) return
        hasCreated.current = true

        const { workspaceId, parentNoteId, createNote } = extension.options
        createNote(workspaceId, {
            content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] }),
            visibility: 'workspace',
            parent_id: parentNoteId,
        }).then((newNote: { id: string }) => {
            updateAttributes({ noteId: newNote.id, title: '' })
            navigate(`/workspaces/${workspaceId}/notes/${newNote.id}`)
        }).catch(() => {
            deleteNode()
        })
    }, [])

    // Sync title from actual note whenever noteId is available
    useEffect(() => {
        if (!noteId) return
        const { workspaceId } = extension.options
        getNote(workspaceId, noteId).then((note: { title?: string }) => {
            const liveTitle = note.title || ''
            if (liveTitle !== title) {
                updateAttributes({ title: liveTitle })
            }
        }).catch(() => {})
    }, [noteId])

    const handleNavigate = () => {
        const { workspaceId } = extension.options
        navigate(`/workspaces/${workspaceId}/notes/${noteId}`)
    }

    const handleMoveUp = useCallback(() => {
        const pos = getPos()
        if (pos === undefined) return
        const { state } = editor
        const $pos = state.doc.resolve(pos)
        if ($pos.index() === 0) return
        const nodeBefore = $pos.nodeBefore
        if (!nodeBefore) return
        editor.view.dispatch(state.tr.replaceWith(pos - nodeBefore.nodeSize, pos + node.nodeSize, [node, nodeBefore]))
    }, [editor, node, getPos])

    const handleMoveDown = useCallback(() => {
        const pos = getPos()
        if (pos === undefined) return
        const { state } = editor
        const $pos = state.doc.resolve(pos)
        if ($pos.index() >= $pos.parent.childCount - 1) return
        const nodeAfterPos = pos + node.nodeSize
        const nodeAfter = state.doc.resolve(nodeAfterPos).nodeAfter
        if (!nodeAfter) return
        editor.view.dispatch(state.tr.replaceWith(pos, nodeAfterPos + nodeAfter.nodeSize, [nodeAfter, node]))
    }, [editor, node, getPos])

    const nodeActions = [
        { label: 'Open page', icon: <ExternalLink size={14} />, onClick: handleNavigate },
        { label: 'Move up', icon: <ChevronUp size={14} />, onClick: handleMoveUp },
        { label: 'Move down', icon: <ChevronDown size={14} />, onClick: handleMoveDown },
        { label: 'Delete', icon: <Trash2 size={14} />, onClick: deleteNode, variant: 'danger' as const },
    ]

    useDragMenu(getPos, () => nodeActions)

    if (!noteId) {
        return (
            <NodeViewWrapper className="sub-page-node my-1">
                <div className="flex items-center gap-2 border dark:border-neutral-700 rounded-lg p-3 bg-gray-50 dark:bg-neutral-800/50">
                    <Loader2 size={16} className="text-muted-foreground animate-spin flex-shrink-0" />
                    <span className="text-sm text-muted-foreground">{t("notes.untitled")}</span>
                </div>
            </NodeViewWrapper>
        )
    }

    return (
        <NodeViewWrapper className="sub-page-node my-1">
            <div className="relative group">
                <div
                    className="flex items-center gap-2 border dark:border-neutral-700 rounded-lg p-3 bg-gray-50 dark:bg-neutral-800/50 transition-colors"
                    onMouseEnter={() => setShowActions(true)}
                    onMouseLeave={() => setShowActions(false)}
                >
                    <div
                        onClick={isTouchDevice ? undefined : handleNavigate}
                        className={`flex items-center gap-2 flex-1 min-w-0 transition-colors ${!isTouchDevice ? 'cursor-pointer hover:text-blue-600 dark:hover:text-blue-400' : ''}`}
                    >
                        <FileText size={16} className="text-muted-foreground flex-shrink-0" />
                        <span className={`flex-1 text-sm font-medium truncate ${title ? 'text-gray-700 dark:text-gray-300' : 'text-muted-foreground italic'}`}>
                            {title || t("notes.untitled")}
                        </span>
                        {!isTouchDevice && <ExternalLink size={14} className="text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />}
                    </div>
                    {!isTouchDevice && isEditable && showActions && (
                        <button
                            onClick={(e) => { e.stopPropagation(); deleteNode() }}
                            className="p-1 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors flex-shrink-0"
                            title={t("actions.delete")}
                        >
                            <Trash2 size={12} className="text-red-500" />
                        </button>
                    )}
                </div>
                {isTouchDevice && isEditable && (
                    <NodeTouchMenu visible={selected} actions={nodeActions} />
                )}
            </div>
        </NodeViewWrapper>
    )
}

export default SubPageComponent
