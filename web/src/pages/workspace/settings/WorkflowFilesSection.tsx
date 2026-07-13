import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, X, Trash2, Loader, Upload, FileCode } from "lucide-react"
import useCurrentWorkspaceId from "@/hooks/use-currentworkspace-id"
import { listWorkflowFiles, uploadWorkflowFile, deleteWorkflowFile, WorkflowFileData } from "@/api/workflowFile"
import { toast } from "@/stores/toast"

const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

// Upload form: a file picker plus an editable relative path (prefilled from
// the picked file's name), styled to match AddEntryForm in
// WorkflowVarsSecretsSection so vars/secrets/files read as one system.
const AddFileForm = ({
    isPending, onSubmit, onCancel,
}: {
    isPending: boolean
    onSubmit: (file: File, path: string) => void
    onCancel: () => void
}) => {
    const { t } = useTranslation()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [file, setFile] = useState<File | null>(null)
    const [path, setPath] = useState("")

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const picked = e.target.files?.[0] ?? null
        setFile(picked)
        if (picked && !path) setPath(picked.name)
    }

    return (
        <div className="flex flex-col gap-2 p-3 bg-neutral-50 dark:bg-neutral-700 rounded">
            <div className="flex gap-2 flex-wrap">
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-2 flex gap-2 items-center rounded-lg border dark:border-none dark:bg-neutral-600 text-sm shrink-0 hover:bg-neutral-100 dark:hover:bg-neutral-500"
                >
                    <Upload size={14} />
                    <span className="truncate max-w-[160px]">{file ? file.name : t("pages.settings.chooseFile")}</span>
                </button>
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
                <input
                    className="flex-1 min-w-[140px] px-3 py-2 border dark:border-none rounded-lg dark:bg-neutral-600 font-mono text-sm"
                    placeholder={t("pages.settings.filePathPlaceholder")}
                    value={path}
                    onChange={e => setPath(e.target.value)}
                />
            </div>
            <div className="flex gap-2 justify-end">
                <button
                    onClick={onCancel}
                    className="px-3 py-1.5 text-sm text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-600 rounded"
                >
                    {t("actions.cancel")}
                </button>
                <button
                    onClick={() => file && path && onSubmit(file, path)}
                    disabled={isPending || !file || !path}
                    className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 flex items-center gap-2"
                >
                    {isPending && <Loader size={14} className="animate-spin" />}
                    {t("actions.add")}
                </button>
            </div>
        </div>
    )
}

// Codebase files shared by every workflow in the workspace (same scope as
// WorkflowVarsSecretsSection), rendered alongside it in workspace settings.
const WorkflowFilesSection = () => {
    const { t } = useTranslation()
    const currentWorkspaceId = useCurrentWorkspaceId()
    const queryClient = useQueryClient()
    const [showAddFile, setShowAddFile] = useState(false)

    const filesQueryKey = ['workflowFiles', currentWorkspaceId]

    const { data: files = [] } = useQuery({
        queryKey: filesQueryKey,
        queryFn: () => listWorkflowFiles(currentWorkspaceId),
        enabled: !!currentWorkspaceId,
    })

    const handleError = (error: unknown) => {
        const err = error as { response?: { data?: { message?: string; error?: string } }; message?: string }
        toast.error(err?.response?.data?.message || err?.response?.data?.error || err?.message || "Request failed")
    }

    const uploadMutation = useMutation({
        mutationFn: ({ file, path }: { file: File; path: string }) => uploadWorkflowFile(currentWorkspaceId, file, path),
        onSuccess: () => {
            setShowAddFile(false)
            toast.success(t("pages.settings.fileUploaded"))
            queryClient.invalidateQueries({ queryKey: filesQueryKey })
        },
        onError: handleError,
    })

    const deleteMutation = useMutation({
        mutationFn: (fileId: string) => deleteWorkflowFile(currentWorkspaceId, fileId),
        onSuccess: () => {
            toast.success(t("pages.settings.fileDeleted"))
            queryClient.invalidateQueries({ queryKey: filesQueryKey })
        },
        onError: handleError,
    })

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div className="text-lg font-semibold">{t("pages.settings.workflowFiles")}</div>
                <button
                    onClick={() => setShowAddFile(s => !s)}
                    className="px-3 py-2 flex gap-2 items-center text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded text-sm"
                >
                    {showAddFile ? <X size={15} /> : <Plus size={15} />}
                    {t("pages.settings.addFile")}
                </button>
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-500 -mt-2">
                {t("pages.settings.workflowFilesHint")}
            </div>

            {showAddFile && (
                <AddFileForm
                    isPending={uploadMutation.isPending}
                    onSubmit={(file, path) => uploadMutation.mutate({ file, path })}
                    onCancel={() => setShowAddFile(false)}
                />
            )}

            {files.length === 0 ? (
                <div className="text-sm text-gray-400 dark:text-gray-500">
                    {t("pages.settings.noFiles")}
                </div>
            ) : (
                <div className="flex flex-col divide-y divide-neutral-100 dark:divide-neutral-700">
                    {files.map((f: WorkflowFileData) => (
                        <div key={f.id} className="flex items-center gap-3 py-3">
                            <FileCode size={16} className="shrink-0 opacity-50" />
                            <div className="flex-1 min-w-0">
                                <div className="font-medium font-mono truncate">{f.path}</div>
                                <div className="text-xs text-gray-400 dark:text-gray-500 truncate">
                                    {formatFileSize(f.size)}
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    if (confirm(t("pages.settings.deleteFileConfirm"))) {
                                        deleteMutation.mutate(f.id)
                                    }
                                }}
                                disabled={deleteMutation.isPending}
                                className="p-2 text-red-500 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded disabled:opacity-50"
                                aria-label="delete file"
                            >
                                <Trash2 size={15} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default WorkflowFilesSection
