import { NodeViewProps, NodeViewWrapper } from "@/components/noteeditor/nodeView"
import { FolderOpen, Edit3 } from "lucide-react"
import { useState } from "react"
import { twMerge } from "tailwind-merge"
import VideoPickerDialog from "./VideoPickerDialog"
import { FileInfo } from "@/api/file"
import { useDragMenu, NodeTouchMenu } from "@/components/editor/DragMenuContext"

const VideoNodeComponent: React.FC<NodeViewProps> = ({ node, extension, updateAttributes, selected, getPos }) => {
    const [isPickerOpen, setIsPickerOpen] = useState(false)
    const { src, name } = node.attrs
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



    const nodeActions = [
        { label: 'Reselect', icon: <Edit3 size={14} />, onClick: () => setIsPickerOpen(true) },
    ]

    useDragMenu(getPos, () => nodeActions)

    if (!src) {
        return (
            <NodeViewWrapper className="video-node select-none border dark:border-neutral-700 rounded p-2 bg-gray-100 dark:bg-neutral-800">
                <div className="flex gap-2 w-full h-32">
                    <button
                        className="flex-1 rounded flex flex-col gap-2 items-center justify-center hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors text-gray-700 dark:text-gray-300"
                        onClick={() => setIsPickerOpen(true)}
                        disabled={!extension.options?.workspaceId}
                    >
                        <FolderOpen size={20} />
                        <span className="text-sm">Choose Video</span>
                    </button>
                </div>
                {extension.options?.workspaceId && (
                    <VideoPickerDialog
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
            <div className={twMerge("relative group rounded overflow-hidden", selected && "ring-2 ring-blue-500")}>
                <video src={src} className="video-node select-none rounded w-full max-w-full" controls title={name} />
                {isTouchDevice && (
                    <NodeTouchMenu visible={selected} actions={nodeActions} />
                )}
                {extension.options?.workspaceId && (
                    <VideoPickerDialog
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

export default VideoNodeComponent
