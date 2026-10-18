import { FC, ReactNode, useState, useEffect, useRef } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { Search, Loader2, Upload } from "lucide-react"
import { FileInfo } from "@/api/file"
import { PendingUploads } from "@/components/upload/PendingUploads"
import useUploadComplete from "@/hooks/use-upload-complete"
import usePagedFiles from "@/hooks/use-paged-files"

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
    const [searchQuery, setSearchQuery] = useState("")
    const [debouncedQuery, setDebouncedQuery] = useState("")
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(searchQuery)
        }, 300)
        return () => clearTimeout(timer)
    }, [searchQuery])

    const { files, isLoading, isLoadingMore, refresh, scrollRef, sentinelRef } = usePagedFiles({
        open, workspaceId, listFiles, query: debouncedQuery, ext: extensions,
    })

    const handleSelectFile = (file: FileInfo) => {
        onSelect(file)
        onOpenChange(false)
    }

    // Uploads run in the global upload store: they keep going (and stay
    // visible in the upload panel) after this dialog closes.
    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const uploadedFiles = Array.from(e.target.files || [])
        if (inputRef.current) inputRef.current.value = ''
        if (!uploadedFiles.length || !upload) return
        uploadedFiles.forEach(f => { upload(f).catch(() => {}) })
    }

    useUploadComplete(workspaceId, open, refresh)

    const getFileUrl = (fileName: string) => {
        return `/api/v1/workspaces/${workspaceId}/files/${fileName}`
    }

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 z-modal-backdrop" />
                <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-neutral-800 rounded-lg shadow-xl p-4 sm:p-6 w-[90vw] max-w-[800px] z-modal h-[85vh] max-h-[760px] flex flex-col">
                    <Dialog.Title className="shrink-0 text-xl font-semibold mb-4">
                        {title}
                    </Dialog.Title>

                    <div className="mb-4 flex shrink-0 gap-2">
                        <div className="relative min-w-0 flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
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
                                className="flex shrink-0 items-center justify-center gap-1.5 px-3 py-2 text-sm rounded-lg border dark:border-neutral-600 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors text-gray-700 dark:text-gray-300 disabled:opacity-50 whitespace-nowrap"
                            >
                                <Upload size={14} />
                                Upload
                            </button>
                        )}
                    </div>
                    <PendingUploads workspaceId={workspaceId} className="mb-4 max-h-40 shrink-0 overflow-y-auto divide-y divide-gray-100 dark:divide-neutral-700" />
                    <input
                        ref={inputRef}
                        type="file"
                        multiple
                        accept={accept}
                        className="hidden"
                        aria-label="upload files"
                        onChange={handleUpload}
                    />

                    {/* Spinner, empty state and list share this box, so the
                        panel keeps its height while files load. */}
                    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
                        {isLoading ? (
                            <div className="flex h-full items-center justify-center">
                                <Loader2 className="animate-spin" size={32} />
                            </div>
                        ) : files.length > 0 ? (
                            <>
                                <div className={gridClassName}>
                                    {files.map((file) => (
                                        <div key={file.id} className="min-w-0">
                                            {renderFile(file, handleSelectFile, getFileUrl)}
                                        </div>
                                    ))}
                                </div>
                                <div ref={sentinelRef} className="h-px" />
                                {isLoadingMore && (
                                    <div className="flex justify-center py-4">
                                        <Loader2 className="animate-spin text-muted-foreground" size={20} />
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="flex h-full items-center justify-center">
                                {emptyState}
                            </div>
                        )}
                    </div>

                    <div className="mt-6 flex shrink-0 justify-end">
                        <Dialog.Close asChild>
                            <button className="shrink-0 whitespace-nowrap px-4 py-2 border dark:border-neutral-600 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800">
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
