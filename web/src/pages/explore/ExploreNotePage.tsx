import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getPublicNote, NoteData } from '@/api/note';
import Renderer from '@/components/renderer/Renderer';
import CommentSidebar from '@/components/commentsidebar/CommentSidebar';

// A public note laid out like the workspace note detail page, read-only.
const ExploreNotePage: React.FC = () => {
    const { t } = useTranslation();
    const { noteId } = useParams<{ noteId: string }>();
    const [showComments, setShowComments] = useState(false);

    const { data: note, isLoading, isError } = useQuery<NoteData>({
        queryKey: ['explore-note', noteId],
        queryFn: () => getPublicNote(noteId!),
        enabled: !!noteId,
        retry: false,
    });

    return (
        <div className="flex bg-white dark:bg-neutral-800 h-full min-w-0">
            <div className="flex flex-col flex-1 min-h-0 min-w-0">
                <div className="shrink-0 p-2 lg:p-4">
                    {/* h-8: as tall as the menu buttons, so the row doesn't jump once the note loads */}
                    <div className="flex justify-between items-center gap-2 px-3 h-8">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <Link
                                to="/explore"
                                aria-label={t("actions.back")}
                                className="p-2 -ml-2 rounded text-muted-foreground hover:bg-gray-100 dark:hover:bg-neutral-700 shrink-0"
                            >
                                <ArrowLeft size={16} />
                            </Link>
                            {isLoading ? (
                                <div className="h-6 bg-gray-200 dark:bg-neutral-700 rounded w-1/3 animate-pulse" />
                            ) : note?.title && (
                                <span className="flex-1 text-base font-medium text-gray-700 dark:text-gray-200 min-w-0 truncate">
                                    {note.title}
                                </span>
                            )}
                        </div>
                        {note && (
                            <button
                                className={`p-2 rounded ${showComments ? 'text-primary' : 'text-muted-foreground'} hover:bg-gray-100 dark:hover:bg-neutral-700`}
                                onClick={() => setShowComments(prev => !prev)}
                            >
                                <MessageCircle size={16} />
                            </button>
                        )}
                    </div>
                </div>
                {/* Stable gutter: a long note's scrollbar must not shift the centered column. */}
                <div className="flex-1 overflow-x-auto overflow-y-auto [scrollbar-gutter:stable]">
                    <div className="lg:max-w-3xl w-full m-auto">
                        <div className="px-4 pb-32 lg:p-10 lg:pb-40">
                            {isLoading ? (
                                <div className="flex flex-col gap-3 animate-pulse">
                                    {['100%', '83%', '80%', '100%', '75%', '83%'].map((width, i) => (
                                        <div key={i} className="h-4 bg-gray-200 dark:bg-neutral-700 rounded" style={{ width }} />
                                    ))}
                                </div>
                            ) : isError || !note ? (
                                <div className="text-center text-muted-foreground py-16 text-sm">
                                    {t("pages.explore.noteNotFound")}
                                </div>
                            ) : note.content && (
                                <Renderer content={note.content} workspaceId={note.workspace_id} />
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {note?.workspace_id && note.id && (
                <CommentSidebar
                    workspaceId={note.workspace_id}
                    noteId={note.id}
                    open={showComments}
                    onOpenChange={setShowComments}
                    readOnly
                />
            )}
        </div>
    );
};

export default ExploreNotePage;
