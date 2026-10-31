import { useCallback, useState, useEffect, useRef } from 'react';
import { useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import useUploadComplete from '@/hooks/use-upload-complete';
import { deleteFile, FileInfo, getFileDownloadUrl, listFiles, renameFile, uploadFile } from '../../../api/file';
import { useToastStore } from '../../../stores/toast';
import { FileIcon, X, Check, Search, Filter, FileText, Upload, LayoutGrid, List } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import useCurrentWorkspaceId from '@/hooks/use-currentworkspace-id';
import { Tooltip } from 'radix-ui';
import FilesGridSkeleton from '@/components/skeletons/FilesGridSkeleton';
import FilesListSkeleton from '@/components/skeletons/FilesListSkeleton';
import ProgressiveImage from "@/components/image/ProgressiveImage"
import FileNotesDialog from "./FileNotesDialog"
import FileActionsMenu from "./FileActionsMenu"
import { imageVariantUrl, knownDimensions } from "@/lib/image"

const PAGE_SIZE = 20;

type ViewMode = 'grid' | 'list';
const VIEW_MODE_KEY = 'notomate:files-view';

const loadViewMode = (): ViewMode => {
    try {
        return localStorage.getItem(VIEW_MODE_KEY) === 'list' ? 'list' : 'grid';
    } catch {
        return 'grid';
    }
};

const isImageFile = (ext: string) => {
    return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'].includes(ext.toLowerCase());
};

const isTextFile = (ext: string) => {
    return ['.txt', '.md', '.json', '.xml', '.csv', '.log', '.js', '.ts', '.tsx', '.jsx', '.css', '.html', '.py', '.go', '.java', '.c', '.cpp', '.h'].includes(ext.toLowerCase());
};

const canPreview = (file: FileInfo) => {
    return isImageFile(file.ext) || isTextFile(file.ext);
};

const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

const extLabel = (ext: string) => ext.replace(/^\./, '').toUpperCase();

const FilesPage = () => {
    const { t } = useTranslation();
    const currentWorkspaceId = useCurrentWorkspaceId();
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
    const [extFilter, setExtFilter] = useState<string>('');
    const [isSearchVisible, setIsSearchVisible] = useState(false);
    const [viewMode, setViewModeState] = useState<ViewMode>(loadViewMode);
    const [editingFileId, setEditingFileId] = useState<string | null>(null);
    const [editingFileName, setEditingFileName] = useState('');
    const [previewFile, setPreviewFile] = useState<FileInfo | null>(null);
    const [usageFile, setUsageFile] = useState<FileInfo | null>(null);
    const queryClient = useQueryClient();
    const { addToast } = useToastStore();
    const observerRef = useRef<IntersectionObserver | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const setViewMode = (next: ViewMode) => {
        setViewModeState(next);
        try {
            localStorage.setItem(VIEW_MODE_KEY, next);
        } catch {
            // Remembering the view is a convenience only.
        }
    };

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedQuery(searchQuery);
        }, 500);

        return () => {
            clearTimeout(handler);
        };
    }, [searchQuery]);

    const {
        data,
        isLoading,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        refetch
    } = useInfiniteQuery({
        queryKey: ['files', currentWorkspaceId, debouncedQuery, extFilter],
        queryFn: async ({ pageParam = 1 }: { pageParam?: unknown }) => {
            const result = await listFiles(currentWorkspaceId!, debouncedQuery, extFilter, PAGE_SIZE, Number(pageParam));
            return result.files;
        },
        enabled: !!currentWorkspaceId,
        getNextPageParam: (lastPage, allPages) => {
            if (!lastPage || lastPage.length < PAGE_SIZE) return undefined;
            return allPages.length + 1;
        },
        refetchOnWindowFocus: false,
        staleTime: 0,
        initialPageParam: 1
    });

    useEffect(() => {
        refetch();
    }, [debouncedQuery, extFilter, refetch]);

    const deleteMutation = useMutation({
        mutationFn: (fileId: string) => deleteFile(currentWorkspaceId!, fileId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['files', currentWorkspaceId] });
        },
        onError: () => {
            addToast({ type: 'error', title: t('files.delete_error') });
        },
    });

    const renameMutation = useMutation({
        mutationFn: ({ fileId, newName }: { fileId: string; newName: string }) =>
            renameFile(currentWorkspaceId!, fileId, newName),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['files', currentWorkspaceId] });
            setEditingFileId(null);
        },
        onError: () => {
            addToast({ type: 'error', title: t('files.rename_error') });
        },
    });

    // Uploads run in the global upload store (with progress in the upload
    // panel) and keep going if the user leaves this page.
    useUploadComplete(currentWorkspaceId ?? '', !!currentWorkspaceId, () => {
        queryClient.invalidateQueries({ queryKey: ['files', currentWorkspaceId] });
    });

    const loadMoreRef = useCallback((node: HTMLDivElement | null) => {
        if (observerRef.current) {
            observerRef.current.disconnect();
        }
        if (node && hasNextPage && !isLoading) {
            observerRef.current = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting) {
                    fetchNextPage();
                }
            }, { root: null });
            observerRef.current.observe(node);
        }
    }, [hasNextPage, isLoading, fetchNextPage]);

    const startEdit = (file: FileInfo) => {
        setEditingFileId(file.id);
        setEditingFileName(file.original_name);
    };

    const cancelEdit = () => {
        setEditingFileId(null);
        setEditingFileName('');
    };

    const saveEdit = (fileId: string) => {
        if (editingFileName.trim()) {
            renameMutation.mutate({ fileId, newName: editingFileName });
        }
    };

    const handleCopyUrl = async (file: FileInfo) => {
        try {
            const fileUrl = getFileDownloadUrl(currentWorkspaceId!, file.name);
            // Get the full URL including origin
            const fullUrl = new URL(fileUrl, window.location.origin).href;
            await navigator.clipboard.writeText(fullUrl);
        } catch {
            addToast({ type: 'error', title: t('files.copy_url_error') });
        }
    };

    const handleDelete = (file: FileInfo) => {
        if (confirm(t('files.delete_confirm'))) {
            deleteMutation.mutate(file.id);
        }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selected = Array.from(event.target.files ?? []);
        event.target.value = '';
        if (!currentWorkspaceId) return;
        selected.forEach((file) => {
            uploadFile(currentWorkspaceId, file).catch(() => {
                addToast({ type: 'error', title: t('files.upload_error'), description: file.name });
            });
        });
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    const getFileExtensions = () => {
        if (!data?.pages) return [];
        const allFiles = data.pages.flat();
        const exts = new Set(allFiles.map(f => f.ext));
        return Array.from(exts).filter(Boolean);
    };

    const files = data?.pages.flat().filter(f => f !== null) || [];

    const renderActions = (file: FileInfo, className?: string) => (
        <FileActionsMenu
            className={className}
            downloadUrl={getFileDownloadUrl(currentWorkspaceId!, file.name)}
            downloadName={file.original_name}
            onPreview={canPreview(file) ? () => setPreviewFile(file) : undefined}
            onRename={() => startEdit(file)}
            onShowUsage={() => setUsageFile(file)}
            onCopyUrl={() => handleCopyUrl(file)}
            onDelete={() => handleDelete(file)}
        />
    );

    const renderRenameInput = (file: FileInfo) => (
        <div className="flex items-center gap-1 min-w-0">
            <input
                type="text"
                value={editingFileName}
                onChange={(e) => setEditingFileName(e.target.value)}
                aria-label='file name'
                className="min-w-0 flex-1 px-2 py-1 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
                onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit(file.id);
                    if (e.key === 'Escape') cancelEdit();
                }}
                autoFocus
            />
            <button
                onClick={() => saveEdit(file.id)}
                className="shrink-0 p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                title={t('common.save')}
            >
                <Check size={16} />
            </button>
            <button
                onClick={cancelEdit}
                className="shrink-0 p-1 text-muted-foreground hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded"
                title={t('common.cancel')}
            >
                <X size={16} />
            </button>
        </div>
    );

    // Small square thumbnail for list rows; the grid draws its own larger one.
    const renderListThumb = (file: FileInfo) => (
        <div className="h-8 w-8 shrink-0 rounded overflow-hidden bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center">
            {isImageFile(file.ext) ? (
                <ProgressiveImage
                    cover
                    variantWidth={320}
                    src={getFileDownloadUrl(currentWorkspaceId!, file.name)}
                    alt=""
                    className="w-full h-full"
                />
            ) : isTextFile(file.ext) ? (
                <FileText size={16} className="text-green-500" />
            ) : (
                <FileIcon size={16} className="text-muted-foreground" />
            )}
        </div>
    );

    const listColumns = "grid items-center gap-3 px-3 grid-cols-[minmax(0,1fr)_28px] sm:grid-cols-[minmax(0,1fr)_64px_88px_112px_28px]";

    const viewToggleButton = (mode: ViewMode, className = 'p-2.5') => {
        const Icon = mode === 'grid' ? LayoutGrid : List;
        const label = t(mode === 'grid' ? 'files.grid_view' : 'files.list_view');
        return (
            <button
                key={mode}
                onClick={() => setViewMode(mode)}
                aria-label={label}
                aria-pressed={viewMode === mode}
                title={label}
                className={`${className} rounded-lg transition-colors ${viewMode === mode
                    ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-sm'
                    : 'hover:text-neutral-900 dark:hover:text-neutral-100'}`}
            >
                <Icon size={16} />
            </button>
        );
    };

    return (
        <div className="h-full overflow-auto bg-neutral-50 dark:bg-neutral-950">
            <div className="w-full px-4">
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    aria-label="file upload input"
                />
                <div className="py-2">
                    {
                        isSearchVisible ? <div className="block sm:hidden py-1">
                            <div className="w-full flex items-center gap-2 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-950 dark:text-neutral-100">
                                <Search size={16} className="text-muted-foreground" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="bg-transparent flex-1 outline-none"
                                    placeholder={t("placeholder.search")}
                                />
                                <button title="toggle search" onClick={() => setIsSearchVisible(false)}>
                                    <X size={16} className="text-muted-foreground" />
                                </button>
                            </div>
                        </div>
                            :
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3 h-10">
                                    <div className="flex gap-2 items-center max-w-[calc(100vw-165px)] overflow-x-auto whitespace-nowrap sm:text-xl font-semibold hide-scrollbar">
                                        {t("menu.files")}
                                    </div>
                                </div>
                                <div className="flex items-center text-muted-foreground">
                                    <div className="hidden sm:block px-1.5">
                                        <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-neutral-50 dark:bg-neutral-950 dark:text-neutral-100">
                                            <Search size={16} className="text-muted-foreground" />
                                            <input
                                                type="text"
                                                value={searchQuery}
                                                onChange={e => setSearchQuery(e.target.value)}
                                                className="flex-1 bg-transparent w-32 outline-none"
                                                placeholder={t("placeholder.search")}
                                            />
                                        </div>
                                    </div>
                                    <div className="hidden sm:block px-1.5">
                                        <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-neutral-50 dark:bg-neutral-950 dark:text-neutral-100">
                                            <Filter size={16} className="text-muted-foreground" />
                                            <select
                                                value={extFilter}
                                                onChange={(e) => setExtFilter(e.target.value)}
                                                aria-label='filter'
                                                className="bg-transparent appearance-none"
                                            >
                                                <option value="">{t('files.all_types')}</option>
                                                {getFileExtensions().map(ext => (
                                                    <option key={ext} value={ext}>{ext}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="hidden sm:flex items-center gap-0.5 mx-1.5 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-900">
                                        {viewToggleButton('grid', 'p-1.5')}
                                        {viewToggleButton('list', 'p-1.5')}
                                    </div>
                                    <div className="hidden sm:block px-1.5">
                                        <Tooltip.Root>
                                            <Tooltip.Trigger asChild>
                                                <button
                                                    onClick={triggerFileInput}
                                                    className="p-2.5 rounded-xl dark:border-neutral-60 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    aria-label="upload file"
                                                >
                                                    <Upload size={18} />
                                                </button>
                                            </Tooltip.Trigger>
                                            <Tooltip.Portal>
                                                <Tooltip.Content
                                                    className="z-tooltip select-none rounded-lg bg-gray-900 text-white dark:bg-gray-100 dark:text-black px-2 py-1 text-sm"
                                                    side="bottom"
                                                >
                                                    <Tooltip.Arrow className="fill-gray-900 dark:fill-gray-100" />
                                                    {t("actions.selectFileToUpload")}
                                                </Tooltip.Content>
                                            </Tooltip.Portal>
                                        </Tooltip.Root>
                                    </div>
                                    <div className="sm:hidden flex items-center">
                                        <button
                                            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                                            aria-label={t(viewMode === 'grid' ? 'files.list_view' : 'files.grid_view')}
                                            className="p-3"
                                        >
                                            {viewMode === 'grid' ? <List size={20} /> : <LayoutGrid size={20} />}
                                        </button>
                                        <button
                                            onClick={triggerFileInput}
                                            className="p-3 disabled:opacity-50 disabled:cursor-not-allowed"
                                            aria-label="upload file"
                                        >
                                            <Upload size={20} />
                                        </button>
                                        {
                                            !isSearchVisible && <Tooltip.Root>
                                                <Tooltip.Trigger asChild>
                                                    <button aria-label="toggle the search" className="p-3" onClick={() => setIsSearchVisible(!isSearchVisible)}>
                                                        <Search size={20} />
                                                    </button>
                                                </Tooltip.Trigger>
                                                <Tooltip.Portal>
                                                    <Tooltip.Content
                                                        className="z-tooltip select-none rounded-lg bg-gray-900 text-white dark:bg-gray-100 dark:text-black px-2 py-1 text-sm"
                                                        side="bottom"
                                                    >
                                                        <Tooltip.Arrow className="fill-gray-900 dark:fill-gray-100" />
                                                        {t("actions.filter")}
                                                    </Tooltip.Content>
                                                </Tooltip.Portal>
                                            </Tooltip.Root>
                                        }
                                    </div>
                                </div>
                            </div>
                    }
                </div>

                <div className="flex flex-col gap-2 sm:gap-5">
                    <div className="w-full">
                        {viewMode === 'grid' ? (
                            isLoading ? <FilesGridSkeleton /> :
                                <div className="grid grid-cols-auto-fill-140 gap-4">
                                    {files.map((file) => (
                                        <motion.div
                                            key={file.id}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="relative border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden hover:shadow-md transition-shadow bg-white dark:bg-neutral-800"
                                        >
                                            {/* Thumbnail/Icon Area; opens the preview when the file has one */}
                                            <button
                                                type="button"
                                                onClick={() => setPreviewFile(file)}
                                                disabled={!canPreview(file)}
                                                aria-label={t('files.preview')}
                                                className="w-full aspect-square relative bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center overflow-hidden enabled:cursor-zoom-in"
                                            >
                                                {isImageFile(file.ext) ? (
                                                    <ProgressiveImage
                                                        cover
                                                        variantWidth={320}
                                                        src={getFileDownloadUrl(currentWorkspaceId!, file.name)}
                                                        alt={file.original_name}
                                                        className="w-full h-full"
                                                    />
                                                ) : isTextFile(file.ext) ? (
                                                    <FileText className="h-16 w-16 text-green-500" />
                                                ) : (
                                                    <FileIcon className="h-16 w-16 text-muted-foreground" />
                                                )}
                                            </button>

                                            {/* File Info */}
                                            <div className="p-2.5">
                                                {editingFileId === file.id ? renderRenameInput(file) : (
                                                    <div className="flex items-start gap-1">
                                                        <div className="min-w-0 flex-1">
                                                            <div className="font-medium text-sm text-neutral-900 dark:text-neutral-100 truncate" title={file.original_name}>
                                                                {file.original_name}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground truncate">
                                                                {formatFileSize(file.size)} · {extLabel(file.ext)}
                                                            </div>
                                                        </div>
                                                        {renderActions(file, '-mr-1 shrink-0')}
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                        ) : (
                            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-hidden">
                                <div className={`${listColumns} py-2 text-xs font-medium text-muted-foreground border-b border-neutral-200 dark:border-neutral-700`}>
                                    <span>{t('files.col_name')}</span>
                                    <span className="hidden sm:block">{t('files.col_type')}</span>
                                    <span className="hidden sm:block text-right">{t('files.col_size')}</span>
                                    <span className="hidden sm:block">{t('files.col_updated')}</span>
                                    <span />
                                </div>
                                {isLoading ? <FilesListSkeleton /> :
                                    <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
                                        {files.map((file) => (
                                            <motion.div
                                                key={file.id}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className={`${listColumns} py-2 hover:bg-neutral-50 dark:hover:bg-neutral-700/40`}
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    {renderListThumb(file)}
                                                    {editingFileId === file.id ? (
                                                        <div className="flex-1 min-w-0">{renderRenameInput(file)}</div>
                                                    ) : (
                                                        <div className="min-w-0 flex-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => setPreviewFile(file)}
                                                                disabled={!canPreview(file)}
                                                                title={file.original_name}
                                                                className="block max-w-full truncate text-left text-sm text-neutral-900 dark:text-neutral-100 enabled:hover:underline disabled:cursor-default"
                                                            >
                                                                {file.original_name}
                                                            </button>
                                                            <div className="sm:hidden text-xs text-muted-foreground truncate">
                                                                {formatFileSize(file.size)} · {new Date(file.updated_at).toLocaleDateString()}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                <span className="hidden sm:block text-xs text-muted-foreground">{extLabel(file.ext)}</span>
                                                <span className="hidden sm:block text-xs text-muted-foreground text-right tabular-nums">{formatFileSize(file.size)}</span>
                                                <span className="hidden sm:block text-xs text-muted-foreground tabular-nums">{new Date(file.updated_at).toLocaleDateString()}</span>
                                                {renderActions(file)}
                                            </motion.div>
                                        ))}
                                    </div>
                                }
                            </div>
                        )}

                        <div ref={loadMoreRef} className="h-8"></div>
                        {isFetchingNextPage && (viewMode === 'grid' ? <FilesGridSkeleton count={4} /> : <FilesListSkeleton count={4} />)}
                        {!isLoading && !hasNextPage && files.length > 0 && (
                            <div className="text-center py-4 text-muted-foreground">{t("messages.noMore")}</div>
                        )}
                        {!isLoading && files.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground">{t('files.no_files')}</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Preview Modal */}
            <AnimatePresence>
                {previewFile && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/70 z-modal flex items-center justify-center p-4"
                        onClick={() => setPreviewFile(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.9 }}
                            className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl max-w-4xl max-h-[90vh] w-full overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-700">
                                <div className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                                    {previewFile.original_name}
                                </div>
                                <button
                                    onClick={() => setPreviewFile(null)}
                                    aria-label='cancel'
                                    className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-4 overflow-auto max-h-[calc(90vh-80px)]">
                                {isImageFile(previewFile.ext) ? (
                                    // Known dimensions reserve the box up front and the grid's
                                    // cached thumbnail fills it, so the modal doesn't jump or
                                    // flash blank while the larger image loads.
                                    <ProgressiveImage
                                        key={previewFile.id}
                                        src={getFileDownloadUrl(currentWorkspaceId!, previewFile.name)}
                                        alt={previewFile.original_name}
                                        width={previewFile.width}
                                        height={previewFile.height}
                                        placeholderSrc={knownDimensions(previewFile.width, previewFile.height)
                                            ? imageVariantUrl(getFileDownloadUrl(currentWorkspaceId!, previewFile.name), 320)
                                            : undefined}
                                        className="mx-auto"
                                    />
                                ) : (
                                    <iframe
                                        src={getFileDownloadUrl(currentWorkspaceId!, previewFile.name)}
                                        className="w-full h-[70vh] border-0"
                                        title={previewFile.original_name}
                                    />
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {usageFile && (
                    <FileNotesDialog
                        workspaceId={currentWorkspaceId!}
                        file={usageFile}
                        onClose={() => setUsageFile(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default FilesPage;
