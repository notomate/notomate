import { FC, ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { getNote, NoteData } from "@/api/note"
import { useTranslation } from "react-i18next"
import { useQuery } from "@tanstack/react-query"
import Editor from "../editor/Editor"
import EditableDiv from "@/components/editablediv/EditableDiv"
import useCurrentWorkspaceId from "@/hooks/use-currentworkspace-id"

interface NoteDetailViewProps {
    note: NoteData | null
    menu?: ReactNode
    wsTitle: string
    wsReady?: boolean
    onTitleChange: (title: string) => void
    yDoc?: any
    yText?: any
}

const NoteDetailView: FC<NoteDetailViewProps> = ({
    note,
    menu,
    wsTitle,
    wsReady,
    onTitleChange,
    yDoc,
    yText
}) => {
    const navigate = useNavigate()
    const { t } = useTranslation()
    const currentWorkspaceId = useCurrentWorkspaceId()

    const { data: parentNote } = useQuery<NoteData>({
        queryKey: ['note', currentWorkspaceId, note?.parent_id],
        queryFn: () => getNote(currentWorkspaceId, note!.parent_id!),
        enabled: !!note?.parent_id && !!currentWorkspaceId,
    })

    if (!note) {
        return (
            <div className="w-full">
                <div className="flex flex-col min-h-full animate-pulse">
                    <div className="flex justify-center">
                        <div className="max-w-3xl w-full m-auto">
                            <div className="lg:p-10">
                                <div className="px-4 pt-16 lg:pt-14">
                                    <div className="flex flex-col gap-4">
                                        <div className="hidden lg:block">
                                            <div className="h-10 bg-gray-200 dark:bg-neutral-700 rounded w-full"></div>
                                        </div>
                                        <div className="flex flex-col gap-3">
                                            <div className="h-6 bg-gray-200 dark:bg-neutral-700 rounded w-full"></div>
                                            <div className="h-6 bg-gray-200 dark:bg-neutral-700 rounded w-5/6"></div>
                                            <div className="h-6 bg-gray-200 dark:bg-neutral-700 rounded w-4/5"></div>
                                            <div className="h-6 bg-gray-200 dark:bg-neutral-700 rounded w-full"></div>
                                            <div className="h-6 bg-gray-200 dark:bg-neutral-700 rounded w-3/4"></div>
                                            <div className="h-6 bg-gray-200 dark:bg-neutral-700 rounded w-5/6"></div>
                                        </div>
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
        <div className="flex flex-col flex-1 min-h-0">
            {note && (
                <>
                    <div className="shrink-0 p-2 lg:p-4">
                        <div className="flex justify-between items-center gap-2 flex-1 min-w-0 px-3">
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                {parentNote && (
                                    <>
                                        <button
                                            onClick={() => navigate(`../${parentNote.id}`)}
                                            className="text-base text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors shrink-0 max-w-[160px] truncate text-left"
                                        >
                                            {parentNote.title || t("notes.untitled")}
                                        </button>
                                        <span className="text-gray-300 dark:text-gray-600 select-none">/</span>
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
                    <div className="flex-1 overflow-auto">
                        <div className="max-w-3xl w-full m-auto">
                            <div className="lg:p-10">
                                <div className="flex flex-col gap-2">
                                    <div className="px-4">
                                        <div key={`editor-${note.id}`}>
                                            <Editor
                                                note={note}
                                                yDoc={yDoc}
                                                yText={yText}
                                                yjsReady={wsReady}
                                            />
                                        </div>
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
