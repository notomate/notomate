import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import { Copy, Download, Edit2, Eye, MoreHorizontal, NotebookText, Trash2 } from "lucide-react"
import { useRef } from "react"
import { useTranslation } from "react-i18next"
import { twMerge } from "tailwind-merge"

interface FileActionsMenuProps {
    downloadUrl: string
    downloadName: string
    onPreview?: () => void
    onRename: () => void
    onShowUsage: () => void
    onCopyUrl: () => void
    onDelete: () => void
    className?: string
}

const itemClass = "flex items-center gap-2 px-3 py-2 text-sm rounded cursor-pointer outline-none text-neutral-700 dark:text-neutral-200 data-[highlighted]:bg-neutral-100 dark:data-[highlighted]:bg-neutral-700"

const FileActionsMenu = ({
    downloadUrl,
    downloadName,
    onPreview,
    onRename,
    onShowUsage,
    onCopyUrl,
    onDelete,
    className,
}: FileActionsMenuProps) => {
    const { t } = useTranslation()
    // Rename swaps in an autofocused input; returning focus to the trigger
    // on close would steal it back.
    const skipFocusRestore = useRef(false)

    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
                <button
                    aria-label={t("files.more_actions")}
                    title={t("files.more_actions")}
                    className={twMerge("p-1 rounded text-muted-foreground hover:bg-neutral-100 dark:hover:bg-neutral-700", className)}
                >
                    <MoreHorizontal size={16} />
                </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
                <DropdownMenu.Content
                    align="end"
                    onCloseAutoFocus={(e) => {
                        if (skipFocusRestore.current) e.preventDefault()
                        skipFocusRestore.current = false
                    }}
                    sideOffset={5}
                    className="min-w-[180px] bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 p-1 z-popover"
                >
                    {onPreview && (
                        <DropdownMenu.Item className={itemClass} onSelect={onPreview}>
                            <Eye size={14} /> {t("files.preview")}
                        </DropdownMenu.Item>
                    )}
                    <DropdownMenu.Item className={itemClass} asChild>
                        <a href={downloadUrl} download={downloadName}>
                            <Download size={14} /> {t("files.download")}
                        </a>
                    </DropdownMenu.Item>
                    <DropdownMenu.Item className={itemClass} onSelect={onCopyUrl}>
                        <Copy size={14} /> {t("files.copy_url")}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item className={itemClass} onSelect={onShowUsage}>
                        <NotebookText size={14} /> {t("files.used_in_notes")}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item className={itemClass} onSelect={() => {
                        skipFocusRestore.current = true
                        onRename()
                    }}>
                        <Edit2 size={14} /> {t("files.rename")}
                    </DropdownMenu.Item>
                    <DropdownMenu.Separator className="my-1 h-px bg-neutral-200 dark:bg-neutral-700" />
                    <DropdownMenu.Item
                        className={twMerge(itemClass, "text-red-600 dark:text-red-400 data-[highlighted]:bg-red-50 dark:data-[highlighted]:bg-red-900/20")}
                        onSelect={onDelete}
                    >
                        <Trash2 size={14} /> {t("files.delete")}
                    </DropdownMenu.Item>
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    )
}

export default FileActionsMenu
