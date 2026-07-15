import { NodeViewProps, NodeViewWrapper } from "@tiptap/react"
import { Loader2, FolderOpen, Upload, Trash2, Edit3, ChevronUp, ChevronDown } from "lucide-react"
import { useRef, useState, useEffect, useCallback } from "react"
import { twMerge } from "tailwind-merge"
import AudioPickerDialog from "./AudioPickerDialog"
import { FileInfo } from "@/api/file"
import { useDragMenu, NodeTouchMenu } from "@/components/editor/DragMenuContext"

const AudioNodeComponent: React.FC<NodeViewProps> = ({ node, extension, updateAttributes, selected, editor, deleteNode, getPos }) => {
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [isPickerOpen, setIsPickerOpen] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const wasEditableRef = useRef<boolean>(true)
    const { src, name } = node.attrs
    const isTouchDevice = window.matchMedia("(pointer: coarse)").matches

    useEffect(() => {
        if (selected) {
            wasEditableRef.current = editor.isEditable
            editor.setEditable(false)
        } else {
            if (wasEditableRef.current) {
                editor.setEditable(true)
            }
        }
        return () => {
            if (wasEditableRef.current && !editor.isEditable) {
                editor.setEditable(true)
            }
        }
    }, [selected, editor])

    const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setIsUploading(true)
        setUploadProgress(0)
        try {
            const result = await extension.options?.upload(file, (progress: any) => {
                setUploadProgress(progress)
            })
            if (result?.src) {
                updateAttributes({ src: result.src, name: result.name })
            }
        } catch (error) {
            console.error('Failed to upload audio:', error)
        } finally {
            setIsUploading(false)
            setUploadProgress(0)
            if (inputRef.current) inputRef.current.value = ''
        }
    }

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
            <NodeViewWrapper className="audio-node select-none border dark:border-neutral-700 rounded p-2 bg-gray-100 dark:bg-neutral-800">
                <div className="flex gap-2 w-full h-32">
                    <button
                        className="flex-1 rounded flex flex-col gap-2 items-center justify-center hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors text-gray-700 dark:text-gray-300"
                        onClick={() => inputRef.current?.click()}
                        disabled={isUploading}
                    >
                        {isUploading ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                <span className="text-sm">Uploading {uploadProgress}%</span>
                                <div className="w-full bg-gray-300 dark:bg-neutral-700 rounded-full h-2 mt-1">
                                    <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                                </div>
                            </>
                        ) : (
                            <>
                                <Upload size={20} />
                                <span className="text-sm">Upload New</span>
                            </>
                        )}
                    </button>
                    <button
                        className="flex-1 rounded flex flex-col gap-2 items-center justify-center hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors text-gray-700 dark:text-gray-300"
                        onClick={() => setIsPickerOpen(true)}
                        disabled={isUploading || !extension.options?.workspaceId}
                    >
                        <FolderOpen size={20} />
                        <span className="text-sm">Choose Existing</span>
                    </button>
                </div>
                <input type="file" ref={inputRef} className="hidden" aria-label="upload audio" accept="audio/*" onChange={handleUploadFile} />
                {extension.options?.workspaceId && (
                    <AudioPickerDialog
                        open={isPickerOpen}
                        onOpenChange={setIsPickerOpen}
                        workspaceId={extension.options.workspaceId}
                        listFiles={extension.options.listFiles}
                        onSelect={handleSelectExistingFile}
                    />
                )}
            </NodeViewWrapper>
        )
    }

    return (
        <NodeViewWrapper>
            <div className={twMerge("relative group rounded overflow-hidden p-2 border dark:border-neutral-700 bg-gray-100 dark:bg-neutral-800", selected && "ring-2 ring-blue-500")}>
                {name && <div className="text-sm text-gray-700 dark:text-gray-300 mb-2 truncate select-none">{name}</div>}
                <audio src={src} className="audio-node select-none w-full max-w-full" controls title={name} />
                {isTouchDevice && (
                    <NodeTouchMenu visible={selected} actions={nodeActions} />
                )}
                {extension.options?.workspaceId && (
                    <AudioPickerDialog
                        open={isPickerOpen}
                        onOpenChange={setIsPickerOpen}
                        workspaceId={extension.options.workspaceId}
                        listFiles={extension.options.listFiles}
                        onSelect={handleSelectExistingFile}
                    />
                )}
            </div>
        </NodeViewWrapper>
    )
}

export default AudioNodeComponent
