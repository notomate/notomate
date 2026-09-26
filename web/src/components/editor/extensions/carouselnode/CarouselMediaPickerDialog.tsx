import { FC, useState, useEffect, useCallback, useRef } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { Search, Loader2, Image as ImageIcon, Video as VideoIcon, Check, Upload, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { FileInfo } from "@/api/file"
import { CarouselItem } from "./CarouselNode"

interface CarouselMediaPickerDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    workspaceId: string
    listFiles: (workspaceId: string, query?: string, ext?: string, pageSize?: number, pageNumber?: number) => Promise<{ files: FileInfo[] }>
    onAdd: (items: CarouselItem[]) => void
    onUpload?: (file: File, onProgress?: (p: number) => void) => Promise<{ src: string; name: string }>
}

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'])
const VIDEO_EXTS = new Set(['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'])

const getMediaType = (filename: string): 'image' | 'video' | null => {
    const ext = '.' + (filename.split('.').pop()?.toLowerCase() ?? '')
    if (IMAGE_EXTS.has(ext)) return 'image'
    if (VIDEO_EXTS.has(ext)) return 'video'
    return null
}

const CarouselMediaPickerDialog: FC<CarouselMediaPickerDialogProps> = ({
    open, onOpenChange, workspaceId, listFiles, onAdd, onUpload,
}) => {
    const { t } = useTranslation()
    const [files, setFiles] = useState<FileInfo[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [debouncedQuery, setDebouncedQuery] = useState("")
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all')
    const [isUploading, setIsUploading] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300)
        return () => clearTimeout(timer)
    }, [searchQuery])

    const loadFiles = useCallback(async () => {
        if (!workspaceId) return
        setIsLoading(true)
        try {
            const exts =
                filter === 'image' ? '.jpg,.jpeg,.png,.gif,.webp,.svg'
                : filter === 'video' ? '.mp4,.webm,.ogg,.mov,.avi,.mkv'
                : '.jpg,.jpeg,.png,.gif,.webp,.svg,.mp4,.webm,.ogg,.mov,.avi,.mkv'
            const result = await listFiles(workspaceId, debouncedQuery, exts, 100, 1)
            setFiles((result.files || []).filter(f => getMediaType(f.name) !== null))
        } catch {
            setFiles([])
        } finally {
            setIsLoading(false)
        }
    }, [workspaceId, debouncedQuery, filter, listFiles])

    useEffect(() => {
        if (open) loadFiles()
    }, [open, loadFiles])

    useEffect(() => {
        if (!open) setSelected(new Set())
    }, [open])

    const toggleSelect = (fileId: string) => {
        setSelected(prev => {
            const next = new Set(prev)
            if (next.has(fileId)) next.delete(fileId)
            else next.add(fileId)
            return next
        })
    }

    const handleAdd = () => {
        const items = files
            .filter(f => selected.has(f.id))
            .map(f => ({
                src: `/api/v1/workspaces/${workspaceId}/files/${f.name}`,
                name: f.original_name,
                type: getMediaType(f.name) as 'image' | 'video',
            }))
        onAdd(items)
        onOpenChange(false)
    }

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const uploadedFiles = Array.from(e.target.files || [])
        if (!uploadedFiles.length || !onUpload) return
        setIsUploading(true)
        try {
            await Promise.all(uploadedFiles.map(f => onUpload(f)))
            await loadFiles()
        } finally {
            setIsUploading(false)
            if (inputRef.current) inputRef.current.value = ''
        }
    }

    const getFileUrl = (fileName: string) => `/api/v1/workspaces/${workspaceId}/files/${fileName}`

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
                <Dialog.Content
                    className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-neutral-800 rounded-lg shadow-xl p-6 w-[90vw] max-w-[800px] z-50 max-h-[85vh] flex flex-col"
                    onPointerDownOutside={(e) => e.preventDefault()}
                >
                    <div className="flex items-center justify-between mb-4">
                        <Dialog.Title className="text-xl font-semibold">{t('editor.carousel.addMediaToCarousel')}</Dialog.Title>
                        <Dialog.Close className="p-1 rounded hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">
                            <X size={16} />
                        </Dialog.Close>
                    </div>

                    <div className="flex gap-2 mb-4">
                        <div className="flex rounded-lg border dark:border-neutral-600 overflow-hidden text-sm">
                            {(['all', 'image', 'video'] as const).map(f => (
                                <button
                                    key={f}
                                    type="button"
                                    onClick={() => setFilter(f)}
                                    className={`px-3 py-1.5 transition-colors ${filter === f ? 'bg-blue-500 text-white' : 'hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-700 dark:text-gray-300'}`}
                                >
                                    {t(`editor.carousel.filter.${f}`)}
                                </button>
                            ))}
                        </div>
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder={t('editor.carousel.searchFiles')}
                                className="w-full pl-10 pr-4 py-2 rounded-lg border dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm"
                            />
                        </div>
                        {onUpload && (
                            <button
                                type="button"
                                onClick={() => inputRef.current?.click()}
                                disabled={isUploading}
                                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border dark:border-neutral-600 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors text-gray-700 dark:text-gray-300 disabled:opacity-50"
                            >
                                {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                                {t('editor.carousel.upload')}
                            </button>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto min-h-0">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="animate-spin" size={32} />
                            </div>
                        ) : files.length > 0 ? (
                            <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                                {files.map(file => {
                                    const type = getMediaType(file.name)
                                    const isSelected = selected.has(file.id)
                                    return (
                                        <button
                                            key={file.id}
                                            type="button"
                                            onClick={() => toggleSelect(file.id)}
                                            className={`relative rounded-lg overflow-hidden border-2 transition-colors group ${isSelected ? 'border-blue-500' : 'border-transparent hover:border-blue-300'}`}
                                        >
                                            {type === 'image' ? (
                                                <img
                                                    src={getFileUrl(file.name)}
                                                    alt={file.original_name}
                                                    className="w-full aspect-square object-cover"
                                                />
                                            ) : (
                                                <div className="w-full aspect-square bg-gray-100 dark:bg-neutral-700 flex items-center justify-center relative overflow-hidden">
                                                    <video
                                                        src={getFileUrl(file.name)}
                                                        className="absolute inset-0 w-full h-full object-cover"
                                                        preload="metadata"
                                                    />
                                                    <VideoIcon size={24} className="text-white relative z-10 drop-shadow" />
                                                </div>
                                            )}
                                            {isSelected && (
                                                <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shadow">
                                                    <Check size={12} className="text-white" />
                                                </div>
                                            )}
                                            <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1 text-xs text-white truncate opacity-0 group-hover:opacity-100 transition-opacity">
                                                {file.original_name}
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                <ImageIcon size={48} className="mb-4" />
                                <p>{t('editor.carousel.noMediaFiles')}</p>
                            </div>
                        )}
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t dark:border-neutral-700 pt-4">
                        <span className="text-sm text-muted-foreground">
                            {selected.size > 0 ? t('editor.carousel.selectedCount', { count: selected.size }) : t('editor.carousel.selectFilesToAdd')}
                        </span>
                        <div className="flex gap-2">
                            <Dialog.Close asChild>
                                <button type="button" className="px-4 py-2 text-sm border dark:border-neutral-600 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">
                                    {t('common.cancel')}
                                </button>
                            </Dialog.Close>
                            <button
                                type="button"
                                onClick={handleAdd}
                                disabled={selected.size === 0}
                                className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {selected.size > 0 ? t('editor.carousel.addCount', { count: selected.size }) : t('editor.carousel.add')}
                            </button>
                        </div>
                    </div>

                    <input
                        ref={inputRef}
                        type="file"
                        multiple
                        accept="image/*,video/*"
                        className="hidden"
                        aria-label="upload media"
                        onChange={handleUpload}
                    />
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}

export default CarouselMediaPickerDialog
