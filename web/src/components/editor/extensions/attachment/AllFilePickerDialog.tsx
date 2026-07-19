import { FC } from "react"
import { File, FileText, FileArchive, FileAudio, FileVideo, FileImage, Code } from "lucide-react"
import { FileInfo } from "@/api/file"
import MediaPickerDialog from "../shared/MediaPickerDialog"

interface AllFilePickerDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    workspaceId: string
    listFiles: (workspaceId: string, query?: string, ext?: string, pageSize?: number, pageNumber?: number) => Promise<{ files: FileInfo[] }>
    onSelect: (file: FileInfo) => void
    upload?: (file: File, onProgress?: (percent: number) => void) => Promise<{ src: string; name: string }>
}

const getFileIcon = (ext: string) => {
    const lowerExt = ext.toLowerCase()

    if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'].includes(lowerExt)) {
        return <FileImage size={20} className="text-blue-500" />
    }
    if (['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv'].includes(lowerExt)) {
        return <FileVideo size={20} className="text-purple-500" />
    }
    if (['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'].includes(lowerExt)) {
        return <FileAudio size={20} className="text-green-500" />
    }
    if (['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2'].includes(lowerExt)) {
        return <FileArchive size={20} className="text-orange-500" />
    }
    if (['.js', '.ts', '.tsx', '.jsx', '.py', '.java', '.go', '.rs', '.c', '.cpp', '.h', '.css', '.html', '.json', '.xml', '.yaml', '.yml'].includes(lowerExt)) {
        return <Code size={20} className="text-pink-500" />
    }
    if (['.txt', '.md', '.pdf', '.doc', '.docx'].includes(lowerExt)) {
        return <FileText size={20} className="text-gray-500" />
    }

    return <File size={20} className="text-gray-400" />
}

const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

const AllFilePickerDialog: FC<AllFilePickerDialogProps> = (props) => {
    return (
        <MediaPickerDialog
            {...props}
            title="Select File from Files"
            gridClassName="space-y-2"
            emptyState={
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                    <File size={48} className="mb-4" />
                    <p>No files found</p>
                </div>
            }
            renderFile={(file, onSelectFile) => (
                <button
                    onClick={() => onSelectFile(file)}
                    className="w-full p-3 rounded-lg border dark:border-neutral-600 hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors flex items-center gap-3 text-left"
                >
                    {getFileIcon(file.ext)}
                    <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{file.original_name}</div>
                        <div className="text-xs text-gray-500 flex gap-2">
                            <span>{formatFileSize(file.size)}</span>
                            <span>•</span>
                            <span>{new Date(file.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                </button>
            )}
        />
    )
}

export default AllFilePickerDialog
