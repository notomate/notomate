import { useCallback, useState, useEffect, useRef } from 'react';
import { useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { deleteFile, FileInfo, getFileDownloadUrl, listFiles, renameFile, uploadFile } from '../../../api/file';
import { useToastStore } from '../../../stores/toast';
import { Download, FileIcon, Trash2, Edit2, X, Check, Search, Filter, Eye, FileText, Copy, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import useCurrentWorkspaceId from '@/hooks/use-currentworkspace-id';
import { Tooltip } from 'radix-ui';
import FilesGridSkeleton from '@/components/skeletons/FilesGridSkeleton';

const PAGE_SIZE = 20;

const FilesPage = () => {
    const { t } = useTranslation();
    const currentWorkspaceId = useCurrentWorkspaceId();
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
    const [extFilter, setExtFilter] = useState<string>('');
    const [isSearchVisible, setIsSearchVisible] = useState(false);
    const [editingFileId, setEditingFileId] = useState<string | null>(null);
    const [editingFileName, setEditingFileName] = useState('');
    const [previewFile, setPreviewFile] = useState<FileInfo | null>(null);
    const queryClient = useQueryClient();
    const { addToast } = useToastStore();
    const observerRef = useRef<IntersectionObserver | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    const uploadMutation = useMutation({
        mutationFn: (file: File) => uploadFile(currentWorkspaceId!, file),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['files', currentWorkspaceId] });
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        },
        onError: () => {
            addToast({ type: 'error', title: t('files.upload_error') });
        },
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

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

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
        } catch (error) {
            addToast({ type: 'error', title: t('files.copy_url_error') });
        }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            uploadMutation.mutate(file);
        }
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
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

    const getFileExtensions = () => {
        if (!data?.pages) return [];
        const allFiles = data.pages.flat();
        const exts = new Set(allFiles.map(f => f.ext));
        return Array.from(exts).filter(Boolean);
    };

    const files = data?.pages.flat().filter(f => f !== null) || [];

    return (
        <div className="h-full overflow-auto bg-neutral-50 dark:bg-neutral-950">
            <div className="w-full px-4">
                <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileUpload}
                    className="hidden"
                    aria-label="file upload input"
                />
                <div className="py-2">
                    {
                        isSearchVisible ? <div className="block sm:hidden py-1">
                            <div className="w-full flex items-center gap-2 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-950 dark:text-neutral-100">
                                <Search size={16} className="text-gray-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="bg-transparent flex-1 outline-none"
                                    placeholder={t("placeholder.search")}
                                />
                                <button title="toggle search" onClick={() => setIsSearchVisible(false)}>
                                    <X size={16} className="text-gray-400" />
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
                                <div className="flex items-center text-gray-600 dark:text-gray-400">
                                    <div className="hidden sm:block px-1.5">
                                        <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-neutral-50 dark:bg-neutral-950 dark:text-neutral-100">
                                            <Search size={16} className="text-gray-400" />
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
                                            <Filter size={16} className="text-gray-400" />
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
                                    <div className="hidden sm:block px-1.5">
                                        <Tooltip.Root>
                                            <Tooltip.Trigger asChild>
                                                <button
                                                    onClick={triggerFileInput}
                                                    disabled={uploadMutation.isPending}
                                                    className="p-2.5 rounded-xl dark:border-neutral-60 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    aria-label="upload file"
                                                >
                                                    <Upload size={18} />
                                                </button>
                                            </Tooltip.Trigger>
                                            <Tooltip.Portal>
                                                <Tooltip.Content
                                                    className="select-none rounded-lg bg-gray-900 text-white dark:bg-gray-100 dark:text-black px-2 py-1 text-sm"
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
                                            onClick={triggerFileInput}
                                            disabled={uploadMutation.isPending}
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
                                                        className="select-none rounded-lg bg-gray-900 text-white dark:bg-gray-100 dark:text-black px-2 py-1 text-sm"
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
                        {
                            isLoading ? <FilesGridSkeleton /> :
                                <div className="grid grid-cols-auto-fill-140 gap-4">
                                    {files.map((file) => (
                                        <motion.div
                                            key={file.id}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="group relative border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden hover:shadow-lg transition-all bg-white dark:bg-neutral-800"
                                        >
                                            {/* Thumbnail/Icon Area */}
                                            <div className="aspect-square relative bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center overflow-hidden">
                                                {isImageFile(file.ext) ? (
                                                    <img
                                                        src={getFileDownloadUrl(currentWorkspaceId!, file.name)}
                                                        alt={file.original_name}
                                                        className="w-full h-full object-cover"
                                                        loading="lazy"
                                                    />
                                                ) : isTextFile(file.ext) ? (
                                                    <FileText className="h-16 w-16 text-green-500" />
                                                ) : (
                                                    <FileIcon className="h-16 w-16 text-neutral-400" />
                                                )}

                                                {/* Hover Actions Overlay */}
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                    {canPreview(file) && (
                                                        <button
                                                            onClick={() => setPreviewFile(file)}
                                                            className="p-2 bg-white rounded-md hover:bg-gray-100 transition-colors"
                                                            title={t('files.preview')}
                                                        >
                                                            <Eye size={18} className="text-gray-700" />
                                                        </button>
                                                    )}
                                                    <a
                                                        href={getFileDownloadUrl(currentWorkspaceId!, file.name)}
                                                        download={file.original_name}
                                                        className="p-2 bg-white rounded-md hover:bg-gray-100 transition-colors"
                                                        title={t('files.download')}
                                                    >
                                                        <Download size={18} className="text-gray-700" />
                                                    </a>
                                                </div>
                                            </div>

                                            {/* File Info */}
                                            <div className="p-3">
                                                {editingFileId === file.id ? (
                                                    <div className="flex gap-1 flex-wrap">
                                                        <div className='w-full overflow-x-auto'>
                                                            <input
                                                                type="text"
                                                                value={editingFileName}
                                                                onChange={(e) => setEditingFileName(e.target.value)}
                                                                aria-label='file name'
                                                                className="flex-1 px-2 py-1 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') saveEdit(file.id);
                                                                    if (e.key === 'Escape') cancelEdit();
                                                                }}
                                                                autoFocus
                                                            />
                                                        </div>
                                                        <div >
                                                            <button
                                                                onClick={() => saveEdit(file.id)}
                                                                className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                                                                title={t('common.save')}
                                                            >
                                                                <Check size={16} />
                                                            </button>
                                                            <button
                                                                onClick={cancelEdit}
                                                                className="p-1 text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded"
                                                                title={t('common.cancel')}
                                                            >
                                                                <X size={16} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="font-medium text-sm text-neutral-900 dark:text-neutral-100 truncate mb-1" title={file.original_name}>
                                                            {file.original_name}
                                                        </div>
                                                        <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                                                            <span>{formatFileSize(file.size)}</span>
                                                            <span className="px-1.5 py-0.5 bg-neutral-200 dark:bg-neutral-700 rounded text-xs">
                                                                {file.ext}
                                                            </span>
                                                        </div>
                                                    </>
                                                )}
                                            </div>

                                            {/* Action Buttons at Bottom */}
                                            {editingFileId !== file.id && (
                                                <div className="px-3 pb-3 flex gap-1">
                                                    <button
                                                        onClick={() => startEdit(file)}
                                                        className="flex-1 p-1.5 text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition-colors flex items-center justify-center gap-1"
                                                        title={t('files.rename')}
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleCopyUrl(file)}
                                                        className="flex-1 p-1.5 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors flex items-center justify-center gap-1"
                                                        title={t('files.copy_url')}
                                                    >
                                                        <Copy size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (confirm(t('files.delete_confirm'))) {
                                                                deleteMutation.mutate(file.id);
                                                            }
                                                        }}
                                                        className="flex-1 p-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors flex items-center justify-center gap-1"
                                                        title={t('files.delete')}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            )}
                                        </motion.div>
                                    ))}
                                </div>
                        }

                        <div ref={loadMoreRef} className="h-8"></div>
                        {isFetchingNextPage && <FilesGridSkeleton count={4} />}
                        {!isLoading && !hasNextPage && files.length > 0 && (
                            <div className="text-center py-4 text-gray-400">{t("messages.noMore")}</div>
                        )}
                        {!isLoading && files.length === 0 && (
                            <div className="text-center py-8 text-gray-400">{t('files.no_files')}</div>
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
                        className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
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
                                    className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-md"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-4 overflow-auto max-h-[calc(90vh-80px)]">
                                {isImageFile(previewFile.ext) ? (
                                    <img
                                        src={getFileDownloadUrl(currentWorkspaceId!, previewFile.name)}
                                        alt={previewFile.original_name}
                                        className="max-w-full h-auto mx-auto"
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
        </div>
    );
};

export default FilesPage;