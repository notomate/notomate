import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { createViewObject } from '@/api/view';
import { getNotes } from '@/api/note';
import { useToastStore } from '@/stores/toast';
import * as Dialog from '@radix-ui/react-dialog';
import { WhiteboardNoteData } from '@/types/view';
import { extractTextFromTipTapJSON } from '@/utils/tiptap';

interface AddElementDialogProps {
    workspaceId: string;
    viewId: string;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onElementAdded?: (element: any) => void;
}

const AddElementDialog = ({
    workspaceId,
    viewId,
    isOpen,
    onOpenChange,
    onElementAdded
}: AddElementDialogProps) => {
    const { t } = useTranslation();
    const { addToast } = useToastStore();
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');

    // Fetch notes
    const { data: notes = [] } = useQuery({
        queryKey: ['notes', workspaceId, searchQuery],
        queryFn: () => getNotes(workspaceId, 1, 100, searchQuery),
        enabled: isOpen
    });

    const addElementMutation = useMutation({
        mutationFn: async (noteId: string) => {
            const position = { x: 100, y: 100 };

            // Find the selected note to get its title
            const selectedNote = notes.find((n: any) => n.id === noteId);
            const noteTitle = selectedNote?.title || extractTextFromTipTapJSON(selectedNote?.content || '').substring(0, 50) || t('notes.untitled') || 'Untitled';

            const noteData: WhiteboardNoteData = {
                position,
                width: 768
            };
            const viewObject = await createViewObject(workspaceId, viewId, {
                name: noteTitle,
                type: 'whiteboard_note',
                data: JSON.stringify(noteData)
            });

            return viewObject;
        },
        onSuccess: (newObject) => {
            queryClient.invalidateQueries({ queryKey: ['view-objects', workspaceId, viewId] });

            // Notify parent component to send WebSocket update
            if (onElementAdded && newObject) {
                onElementAdded({
                    id: newObject.id,
                    type: newObject.type,
                    name: newObject.name,
                    data: newObject.data
                });
            }

            onOpenChange(false);
            setSearchQuery('');
        },
        onError: () => {
            addToast({ title: t('views.objectCreatedError'), type: 'error' });
        }
    });

    return (
        <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
                <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-neutral-800 rounded-lg shadow-xl p-6 w-[90vw] max-w-[500px] max-h-[80vh] overflow-y-auto z-50">
                    <Dialog.Title className="text-xl font-semibold mb-4">
                        {t('whiteboard.addNote') || 'Add Note'}
                    </Dialog.Title>

                    {/* Search */}
                    <div className="mb-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={t('whiteboard.searchNotes') || 'Search notes'}
                                className="w-full pl-10 pr-4 py-2 rounded-lg border dark:border-neutral-600 bg-white dark:bg-neutral-800"
                            />
                        </div>
                    </div>

                    {/* Notes List */}
                    <div className="space-y-2">
                        {notes.length > 0 ? (
                            notes.map((note: any) => (
                                <button
                                    key={note.id}
                                    onClick={() => addElementMutation.mutate(note.id)}
                                    disabled={addElementMutation.isPending}
                                    className="w-full text-left p-3 border dark:border-neutral-600 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-50 transition-colors"
                                >
                                    <div className="font-medium truncate">
                                        {note.title || t('notes.untitled') || 'Untitled'}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                        {note.content ? extractTextFromTipTapJSON(note.content).substring(0, 100) : t('notes.emptyNote') || 'Empty note'}
                                    </div>
                                </button>
                            ))
                        ) : (
                            <p className="text-center text-muted-foreground py-8">
                                {searchQuery
                                    ? (t('whiteboard.noResultsFound') || 'No results found')
                                    : (t('whiteboard.noNotes') || 'No notes available')}
                            </p>
                        )}
                    </div>

                    <div className="mt-6 flex justify-end">
                        <Dialog.Close asChild>
                            <button className="px-4 py-2 border dark:border-neutral-600 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                                {t('common.cancel')}
                            </button>
                        </Dialog.Close>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};

export default AddElementDialog;
