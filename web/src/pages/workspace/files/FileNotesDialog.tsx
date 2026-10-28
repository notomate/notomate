import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { FileText, LoaderCircle, X } from 'lucide-react';
import { FileInfo, getFileNotes } from '@/api/file';

interface FileNotesDialogProps {
    workspaceId: string;
    file: FileInfo;
    onClose: () => void;
}

/** Lists the notes a file is used in, each linking to the note. */
const FileNotesDialog = ({ workspaceId, file, onClose }: FileNotesDialogProps) => {
    const { t } = useTranslation();

    const { data: notes = [], isLoading } = useQuery({
        queryKey: ['file-notes', workspaceId, file.id],
        queryFn: () => getFileNotes(workspaceId, file.id),
    });

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-modal flex items-center justify-center p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl max-w-md max-h-[80vh] w-full flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between gap-2 p-4 border-b border-neutral-200 dark:border-neutral-700">
                    <div className="min-w-0">
                        <div className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                            {t('files.used_in_notes')}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{file.original_name}</div>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label='cancel'
                        className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-md shrink-0"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="overflow-y-auto p-2">
                    {isLoading ? (
                        <div className="flex justify-center py-8 text-muted-foreground">
                            <LoaderCircle size={20} className="animate-spin" />
                        </div>
                    ) : notes.length === 0 ? (
                        <div className="text-center py-8 text-sm text-muted-foreground">{t('files.not_used')}</div>
                    ) : (
                        notes.map((note) => (
                            <Link
                                key={note.id}
                                to={`/workspaces/${workspaceId}/notes/${note.id}`}
                                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-gray-700 dark:text-gray-200 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                            >
                                <FileText size={16} className="shrink-0 text-muted-foreground" />
                                <span className="flex-1 min-w-0 truncate">{note.title || t('notes.untitled')}</span>
                                <span className="shrink-0 text-xs text-muted-foreground">{t(`visibility.${note.visibility}`)}</span>
                            </Link>
                        ))
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
};

export default FileNotesDialog;
