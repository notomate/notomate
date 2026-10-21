import { FC, ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { getNote, NoteData } from "@/api/note"
import { useTranslation } from "react-i18next"
import { useQuery } from "@tanstack/react-query"
import NoteEditor from "../noteeditor/NoteEditor"
import type { NoteRoom } from "@/hooks/use-note-collab"
import EditableDiv from "@/components/editablediv/EditableDiv"
import useCurrentWorkspaceId from "@/hooks/use-currentworkspace-id"

interface NoteDetailViewProps {
    note: NoteData | null
    menu?: ReactNode
    wsTitle: string
    wsReady?: boolean
    onTitleChange: (title: string) => void
    /** The note's collaboration room; the editor mounts once it has synced. */
    room: NoteRoom | null
}

const NoteDetailView: FC<NoteDetailViewProps> = ({
    note,
    menu,
    wsTitle,
    wsReady,
    onTitleChange,
    room
}) => {
    const navigate = useNavigate()
    const { t, i18n } = useTranslation()
    const currentWorkspaceId = useCurrentWorkspaceId()

    const { data: parentNote } = useQuery<NoteData>({
        queryKey: ['note', currentWorkspaceId, note?.parent_id],
        queryFn: () => getNote(currentWorkspaceId, note!.parent_id!),
        enabled: !!note?.parent_id && !!currentWorkspaceId,
    })

    if (!note || !wsReady || !room) {
        return (
            <div className="flex flex-col flex-1 min-h-0 animate-pulse">
                <div className="shrink-0 p-2 lg:p-4">
                    {/* h-8: as tall as the real header row, whose menu buttons are 32px */}
                    <div className="flex items-center gap-2 px-3 h-8">
                        <div className="h-6 bg-gray-200 dark:bg-neutral-700 rounded w-1/3"></div>
                    </div>
                </div>
                {/* Same wrappers as the editor below, so the bars sit where the text will. */}
                <div className="flex-1 overflow-hidden [scrollbar-gutter:stable]">
                    <div className="lg:max-w-3xl w-full m-auto">
                        <div className="pb-32 lg:p-10 lg:pb-40">
                            <div className="flex flex-col gap-2">
                                <div className="px-4">
                                    <div className="note-editor-skeleton">
                                        {['100%', '83%', '80%', '100%', '75%', '83%'].map((width, i) => (
                                            <div key={i} className="note-editor-skeleton-row">
                                                <div className="h-4 bg-gray-200 dark:bg-neutral-700 rounded" style={{ width }} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // Use WebSocket title if available, fallback to note data
    const displayTitle = wsReady ? wsTitle : (note.title ?? '')

    return (
        <div className="flex flex-col flex-1 min-h-0 min-w-0">
            {note && (
                <>
                    <div className="shrink-0 p-2 lg:p-4">
                        <div className="flex justify-between items-center gap-2 flex-1 min-w-0 px-3">
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                {parentNote && (
                                    <>
                                        <button
                                            onClick={() => navigate(`../${parentNote.id}`)}
                                            className="text-base text-muted-foreground hover:text-gray-700 dark:hover:text-gray-300 transition-colors shrink-0 max-w-[160px] truncate text-left"
                                        >
                                            {parentNote.title || t("notes.untitled")}
                                        </button>
                                        <span className="text-gray-300 dark:text-muted-foreground select-none">/</span>
                                    </>
                                )}
                                <EditableDiv
                                    key={note.id}
                                    value={displayTitle}
                                    editable={true}
                                    placeholder={t("notes.untitled")}
                                    className="flex-1 text-base font-medium text-gray-700 dark:text-gray-200 border-none outline-none bg-transparent placeholder:text-gray-300 dark:placeholder:text-gray-600 min-w-0 truncate"
                                    onChange={onTitleChange}
                                />
                            </div>
                            <div className="inline-flex flex-shrink-0">{menu}</div>
                        </div>
                    </div>
                    {/* Stable gutter: a long note's scrollbar must not shift the centered column (or the skeleton). */}
                    <div className="flex-1 overflow-x-auto overflow-y-auto [scrollbar-gutter:stable]">
                        <div className="lg:max-w-3xl w-full m-auto">
                            <div className="pb-32 lg:p-10 lg:pb-40">
                                <div className="flex flex-col gap-2">
                                    <div className="px-4">
                                        {/* The editor reads its UI text on mount, so remount on a language switch;
                                            content lives in the room and survives it. */}
                                        <NoteEditor
                                            key={`${note.id}:${i18n.language}`}
                                            room={room}
                                            workspaceId={currentWorkspaceId}
                                            noteId={note.id!}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

export default NoteDetailView
