import { FC, ReactNode, useState, useEffect, useCallback, useRef } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { Search, Loader2, Upload } from "lucide-react"
import { FileInfo } from "@/api/file"

export interface MediaPickerDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    workspaceId: string
    listFiles: (workspaceId: string, query?: string, ext?: string, pageSize?: number, pageNumber?: number) => Promise<{ files: FileInfo[] }>
    onSelect: (file: FileInfo) => void
    upload?: (file: File, onProgress?: (percent: number) => void) => Promise<{ src: string; name: string }>
    title: string
    extensions?: string
    accept?: string
    gridClassName: string
    emptyState: ReactNode
    renderFile: (file: FileInfo, onSelectFile: (file: FileInfo) => void, getFileUrl: (name: string) => string) => ReactNode
}

const MediaPickerDialog: FC<MediaPickerDialogProps> = ({
    open,
    onOpenChange,
    workspaceId,
    listFiles,
    onSelect,
    upload,
    title,
    extensions,
    accept,
    gridClassName,
    emptyState,
    renderFile,
}) => {
    const [files, setFiles] = useState<FileInfo[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [debouncedQuery, setDebouncedQuery] = useState("")
    const [isUploading, setIsUploading] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(searchQuery)
        }, 300)
        return () => clearTimeout(timer)
    }, [searchQuery])

    const loadFiles = useCallback(async () => {
        if (!workspaceId) return
        setIsLoading(true)
        try {
            const result = await listFiles(workspaceId, debouncedQuery, extensions, 50, 1)
            setFiles(result.files || [])
        } catch (error) {
            console.error('Failed to load files:', error)
            setFiles([])
        } finally {
            setIsLoading(false)
        }
    }, [workspaceId, debouncedQuery, extensions, listFiles])

    useEffect(() => {
        if (open) {
            loadFiles()
        }
    }, [open, loadFiles])

    const handleSelectFile = (file: FileInfo) => {
        onSelect(file)
        onOpenChange(false)
    }

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const uploadedFiles = Array.from(e.target.files || [])
        if (!uploadedFiles.length || !upload) return
        setIsUploading(true)
        try {
            await Promise.all(uploadedFiles.map(f => upload(f)))
            await loadFiles()
        } finally {
            setIsUploading(false)
            if (inputRef.current) inputRef.current.value = ''
        }
    }

    const getFileUrl = (fileName: string) => {
        return `/api/v1/workspaces/${workspaceId}/files/${fileName}`
    }

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
                <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-neutral-800 rounded-lg shadow-xl p-6 w-[90vw] max-w-[800px] z-50 max-h-[85vh] overflow-y-auto">
                    <Dialog.Title className="text-xl font-semibold mb-4">
                        {title}
                    </Dialog.Title>

                    <div className="mb-4 flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search files..."
                                className="w-full pl-10 pr-4 py-2 rounded-lg border dark:border-neutral-600 bg-white dark:bg-neutral-800"
                            />
                        </div>
                        {upload && (
                            <button
                                type="button"
                                onClick={() => inputRef.current?.click()}
                                disabled={isUploading}
                                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border dark:border-neutral-600 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors text-gray-700 dark:text-gray-300 disabled:opacity-50 whitespace-nowrap"
                            >
                                {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                                Upload
                            </button>
                        )}
                    </div>
                    <input
                        ref={inputRef}
                        type="file"
                        multiple
                        accept={accept}
                        className="hidden"
                        aria-label="upload files"
                        onChange={handleUpload}
                    />

                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="animate-spin" size={32} />
                        </div>
                    ) : files.length > 0 ? (
                        <div className={gridClassName}>
                            {files.map((file) => (
                                <div key={file.id}>
                                    {renderFile(file, handleSelectFile, getFileUrl)}
                                </div>
                            ))}
                        </div>
                    ) : (
                        emptyState
                    )}

                    <div className="mt-6 flex justify-end">
                        <Dialog.Close asChild>
                            <button className="px-4 py-2 border dark:border-neutral-600 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800">
                                Close
                            </button>
                        </Dialog.Close>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}

export default MediaPickerDialog
