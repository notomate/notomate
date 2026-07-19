import { FC } from "react"
import { Music } from "lucide-react"
import { FileInfo } from "@/api/file"
import MediaPickerDialog from "../shared/MediaPickerDialog"

interface AudioPickerDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    workspaceId: string
    listFiles: (workspaceId: string, query?: string, ext?: string, pageSize?: number, pageNumber?: number) => Promise<{ files: FileInfo[] }>
    onSelect: (file: FileInfo) => void
    upload?: (file: File, onProgress?: (percent: number) => void) => Promise<{ src: string; name: string }>
}

const AudioPickerDialog: FC<AudioPickerDialogProps> = (props) => {
    return (
        <MediaPickerDialog
            {...props}
            title="Select Audio from Files"
            extensions=".mp3,.wav,.ogg,.m4a,.aac,.flac,.wma"
            accept="audio/*"
            gridClassName="grid grid-cols-1 md:grid-cols-2 gap-4"
            emptyState={
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                    <Music size={48} className="mb-4" />
                    <p>No audio files found</p>
                </div>
            }
            renderFile={(file, onSelectFile, getFileUrl) => (
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectFile(file)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectFile(file) }}
                    className="relative rounded-lg overflow-hidden border-2 border-transparent hover:border-blue-500 transition-colors group bg-gray-100 dark:bg-neutral-700 p-3 cursor-pointer"
                >
                    <div className="flex items-center gap-2 mb-2 text-gray-700 dark:text-gray-300">
                        <Music size={16} />
                        <span className="text-sm text-left truncate">{file.original_name}</span>
                    </div>
                    <audio
                        src={getFileUrl(file.name)}
                        className="w-full"
                        preload="metadata"
                        controls
                        onClick={(e) => e.stopPropagation()}
                    />
                    <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                </div>
            )}
        />
    )
}

export default AudioPickerDialog
