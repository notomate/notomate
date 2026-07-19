import { FC } from "react"
import { Image as ImageIcon } from "lucide-react"
import { FileInfo } from "@/api/file"
import MediaPickerDialog from "../shared/MediaPickerDialog"

interface FilePickerDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    workspaceId: string
    listFiles: (workspaceId: string, query?: string, ext?: string, pageSize?: number, pageNumber?: number) => Promise<{ files: FileInfo[] }>
    onSelect: (file: FileInfo) => void
    upload?: (file: File, onProgress?: (percent: number) => void) => Promise<{ src: string; name: string }>
}

const FilePickerDialog: FC<FilePickerDialogProps> = (props) => {
    return (
        <MediaPickerDialog
            {...props}
            title="Select Image from Files"
            extensions=".jpg,.jpeg,.png,.gif,.webp,.svg"
            accept="image/*"
            gridClassName="grid grid-cols-3 md:grid-cols-4 gap-4"
            emptyState={
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                    <ImageIcon size={48} className="mb-4" />
                    <p>No image files found</p>
                </div>
            }
            renderFile={(file, onSelectFile, getFileUrl) => (
                <button
                    onClick={() => onSelectFile(file)}
                    className="relative aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-blue-500 transition-colors group"
                >
                    <img
                        src={getFileUrl(file.name)}
                        alt={file.original_name}
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-white text-sm text-center px-2 truncate">
                            {file.original_name}
                        </span>
                    </div>
                </button>
            )}
        />
    )
}

export default FilePickerDialog
