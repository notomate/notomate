import { FC } from "react"
import { Video as VideoIcon } from "lucide-react"
import { FileInfo } from "@/api/file"
import MediaPickerDialog from "../shared/MediaPickerDialog"

interface VideoPickerDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    workspaceId: string
    listFiles: (workspaceId: string, query?: string, ext?: string, pageSize?: number, pageNumber?: number) => Promise<{ files: FileInfo[] }>
    onSelect: (file: FileInfo) => void
    upload?: (file: File, onProgress?: (percent: number) => void) => Promise<{ src: string; name: string }>
}

const VideoPickerDialog: FC<VideoPickerDialogProps> = (props) => {
    return (
        <MediaPickerDialog
            {...props}
            title="Select Video from Files"
            extensions=".mp4,.webm,.ogg,.mov,.avi,.mkv"
            accept="video/*"
            gridClassName="grid grid-cols-2 md:grid-cols-3 gap-4"
            emptyState={
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                    <VideoIcon size={48} className="mb-4" />
                    <p>No video files found</p>
                </div>
            }
            renderFile={(file, onSelectFile, getFileUrl) => (
                <button
                    onClick={() => onSelectFile(file)}
                    className="relative rounded-lg overflow-hidden border-2 border-transparent hover:border-blue-500 transition-colors group bg-gray-100 dark:bg-neutral-700"
                >
                    <video
                        src={getFileUrl(file.name)}
                        className="w-full aspect-video object-cover"
                        preload="metadata"
                    />
                    <div className="p-2 text-sm text-left truncate text-gray-700 dark:text-gray-300">
                        {file.original_name}
                    </div>
                    <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
            )}
        />
    )
}

export default VideoPickerDialog
