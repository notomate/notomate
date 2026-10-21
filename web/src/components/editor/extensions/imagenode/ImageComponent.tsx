import { NodeViewProps, NodeViewWrapper } from "@/components/noteeditor/nodeView"
import { FolderOpen, Edit3 } from "lucide-react"
import { useState, useEffect, useCallback } from "react"
import { twMerge } from "tailwind-merge"
import FilePickerDialog from "./FilePickerDialog"
import { FileInfo } from "@/api/file"
import ProgressiveImage from "@/components/image/ProgressiveImage"
import { knownDimensions } from "@/lib/image"
import { useDragMenu, NodeTouchMenu } from "@/components/editor/DragMenuContext"
import type { UploadTask } from "@/stores/upload"
import PendingImageView from "./PendingImageView"
import { releasePendingImage } from "./pendingImages"

const ImageComponent: React.FC<NodeViewProps> = ({ node, extension, updateAttributes, selected, editor, deleteNode, getPos }) => {
    const [isPickerOpen, setIsPickerOpen] = useState(false)
    const [isLoaded, setIsLoaded] = useState(false)
    // Local preview of a just-uploaded paste, shown while the real image loads.
    const [previewUrl, setPreviewUrl] = useState<string>()
    const { src, name, width, height, uploadId } = node.attrs
    const dims = knownDimensions(width, height)
    const isTouchDevice = window.matchMedia("(pointer: coarse)").matches

    const handleSelectExistingFile = (file: FileInfo) => {
        const workspaceId = extension.options?.workspaceId
        if (workspaceId) {
            updateAttributes({
                src: `/api/v1/workspaces/${workspaceId}/files/${file.name}`,
                name: file.original_name,
                width: knownDimensions(file.width, file.height)?.width ?? null,
                height: knownDimensions(file.width, file.height)?.height ?? null,
            })
        }
    }



    const nodeActions = [
        { label: 'Reselect', icon: <Edit3 size={14} />, onClick: () => setIsPickerOpen(true) },
    ]

    useDragMenu(getPos, () => nodeActions)

    const handleImageLoad = useCallback((naturalWidth: number, naturalHeight: number) => {
        setIsLoaded(true)
        if (dims || !editor.isEditable || !naturalWidth || !naturalHeight) return
        // Images inserted before sizes were tracked: record the size once so
        // later views can reserve the space. Without a known size a downscaled
        // variant is loaded, so this may be the variant's size; the aspect
        // ratio is what matters. Kept out of the undo history.
        updateAttributes({ width: naturalWidth, height: naturalHeight }, { history: false })
    }, [dims, editor, updateAttributes])

    useEffect(() => () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl)
    }, [previewUrl])

    const handleUploaded = useCallback((task: UploadTask, preview: string) => {
        const result = task.result
        if (!result) return
        // Not a separate undo step: undoing the paste should remove the image.
        updateAttributes({
            src: `/api/v1/workspaces/${task.workspaceId}/files/${result.filename}`,
            width: result.width ?? null,
            height: result.height ?? null,
            uploadId: null,
        }, { history: false })
        releasePendingImage(node.attrs.uploadId)
        setPreviewUrl(preview)
    }, [updateAttributes, node.attrs.uploadId])

    if (!src && uploadId) {
        return (
            <NodeViewWrapper className="image-node select-none">
                <PendingImageView uploadId={uploadId} name={name} onUploaded={handleUploaded} onDelete={deleteNode} />
                {isTouchDevice && (
                    <NodeTouchMenu visible={selected} actions={nodeActions} />
                )}
            </NodeViewWrapper>
        )
    }

    if (!src) {
        return (
            <NodeViewWrapper className="image-node select-none border dark:border-neutral-700 rounded p-2 bg-gray-100 dark:bg-neutral-800">
                <div className="flex gap-2 w-full h-32">
                    <button
                        className="flex-1 rounded flex flex-col gap-2 items-center justify-center hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors text-gray-700 dark:text-gray-300"
                        onClick={() => setIsPickerOpen(true)}
                        disabled={!extension.options?.workspaceId}
                    >
                        <FolderOpen size={20} />
                        <span className="text-sm">Choose Image</span>
                    </button>
                </div>
                {extension.options?.workspaceId && (
                    <FilePickerDialog
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
                className={twMerge("relative group max-w-full", !dims && (isLoaded ? "w-fit" : "w-full"))}
                style={dims ? { width: dims.width } : undefined}
            >
                <ProgressiveImage
                    src={src}
                    width={dims?.width}
                    height={dims?.height}
                    className="image-node select-none rounded box-border"
                    alt={name}
                    draggable={false}
                    placeholderSrc={previewUrl}
                    onLoad={handleImageLoad}
                />
                {isTouchDevice && (
                    <NodeTouchMenu visible={selected} actions={nodeActions} />
                )}
                {extension.options?.workspaceId && (
                    <FilePickerDialog
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

export default ImageComponent
