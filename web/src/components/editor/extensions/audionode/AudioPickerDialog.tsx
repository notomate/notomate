import { FC, useState, useEffect, useCallback } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { Search, Loader2, Music } from "lucide-react"
import { FileInfo } from "@/api/file"

interface AudioPickerDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    workspaceId: string
    listFiles: (workspaceId: string, query?: string, ext?: string, pageSize?: number, pageNumber?: number) => Promise<{ files: FileInfo[] }>
    onSelect: (file: FileInfo) => void
}

const AudioPickerDialog: FC<AudioPickerDialogProps> = ({
    open,
    onOpenChange,
    workspaceId,
    listFiles,
    onSelect
}) => {
    const [files, setFiles] = useState<FileInfo[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [debouncedQuery, setDebouncedQuery] = useState("")

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
            const audioExtensions = '.mp3,.wav,.ogg,.m4a,.aac,.flac,.wma'
            const result = await listFiles(workspaceId, debouncedQuery, audioExtensions, 50, 1)
            setFiles(result.files || [])
        } catch (error) {
            console.error('Failed to load files:', error)
            setFiles([])
        } finally {
            setIsLoading(false)
        }
    }, [workspaceId, debouncedQuery, listFiles])

    useEffect(() => {
        if (open) {
            loadFiles()
        }
    }, [open, loadFiles])

    const handleSelectFile = (file: FileInfo) => {
        onSelect(file)
        onOpenChange(false)
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
                        Select Audio from Files
                    </Dialog.Title>

                    <div className="mb-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search files..."
                                className="w-full pl-10 pr-4 py-2 rounded-lg border dark:border-neutral-600 bg-white dark:bg-neutral-800"
                            />
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="animate-spin" size={32} />
                        </div>
                    ) : files.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {files.map((file) => (
                                <div
                                    key={file.id}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => handleSelectFile(file)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelectFile(file) }}
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
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                            <Music size={48} className="mb-4" />
                            <p>No audio files found</p>
                        </div>
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

export default AudioPickerDialog
