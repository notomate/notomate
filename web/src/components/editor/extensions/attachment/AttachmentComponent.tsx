import { NodeViewProps, NodeViewWrapper } from "@tiptap/react"
import { DownloadIcon, FolderOpen, Trash2, Edit3, FileIcon, ChevronUp, ChevronDown } from "lucide-react"
import { useState, useCallback } from "react"
import AllFilePickerDialog from "./AllFilePickerDialog"
import { FileInfo } from "@/api/file"
import { useDragMenu, NodeTouchMenu } from "@/components/editor/DragMenuContext"

const AttachmentComponent: React.FC<NodeViewProps> = ({ node, updateAttributes, extension, editor, deleteNode, selected, getPos }) => {
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const { src, name } = node.attrs
  const isEditable = editor.isEditable
  const isTouchDevice = window.matchMedia("(pointer: coarse)").matches

  const handleSelectExistingFile = (file: FileInfo) => {
    const workspaceId = extension.options?.workspaceId
    if (workspaceId) {
      updateAttributes({
        src: `/api/v1/workspaces/${workspaceId}/files/${file.name}`,
        name: file.original_name,
      })
    }
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
    { label: 'Move up', icon: <ChevronUp size={14} />, onClick: handleMoveUp },
    { label: 'Move down', icon: <ChevronDown size={14} />, onClick: handleMoveDown },
    { label: 'Reselect', icon: <Edit3 size={14} />, onClick: () => setIsPickerOpen(true) },
    { label: 'Delete', icon: <Trash2 size={14} />, onClick: deleteNode, variant: 'danger' as const },
  ]

  useDragMenu(getPos, () => nodeActions)

  if (!src) {
    return (
      <NodeViewWrapper className="file-node select-none border dark:border-neutral-700 rounded p-2 bg-gray-100 dark:bg-neutral-800">
        <div className="flex gap-2 w-full h-32">
          <button
            className="flex-1 rounded flex flex-col gap-2 items-center justify-center hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors text-gray-700 dark:text-gray-300"
            onClick={() => setIsPickerOpen(true)}
            disabled={!extension.options?.workspaceId}
          >
            <FolderOpen size={20} />
            <span className="text-sm">Choose File</span>
          </button>
        </div>
        {extension.options?.workspaceId && (
          <AllFilePickerDialog
            open={isPickerOpen}
            onOpenChange={setIsPickerOpen}
            workspaceId={extension.options.workspaceId}
            listFiles={extension.options.listFiles}
            upload={extension.options.upload}
            onSelect={handleSelectExistingFile}
          />
        )}
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper>
      <div
        className={`relative file-node select-none rounded-lg p-3 flex items-center gap-3 transition-all ${
          selected
            ? 'border-2 border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 hover:bg-gray-100 dark:hover:bg-neutral-700'
        }`}
      >
        <FileIcon size={20} className="text-blue-600 dark:text-blue-400 flex-shrink-0" />
        <a href={src} target="_blank" rel="noopener noreferrer" className="text-blue-700 dark:text-blue-400 hover:underline flex-1 truncate">
          {name || 'Unnamed file'}
        </a>
        <a
          href={src}
          download={name}
          className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-neutral-600 rounded transition-colors"
          title="Download file"
        >
          <DownloadIcon size={16} />
        </a>
        {isTouchDevice && isEditable && (
          <NodeTouchMenu visible={selected} actions={nodeActions} />
        )}
        {extension.options?.workspaceId && (
          <AllFilePickerDialog
            open={isPickerOpen}
            onOpenChange={setIsPickerOpen}
            workspaceId={extension.options.workspaceId}
            listFiles={extension.options.listFiles}
            upload={extension.options.upload}
            onSelect={handleSelectExistingFile}
          />
        )}
      </div>
    </NodeViewWrapper>
  )
}

export default AttachmentComponent
