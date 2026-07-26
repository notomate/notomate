import { FC } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { NoteData } from "@/api/note"
import NoteTime from "../notetime/NoteTime"
import Renderer from "@/components/renderer/Renderer"
import Avatar from "@/components/avatar/Avatar"
import NoteCardComments from "@/components/commentsidebar/NoteCardComments"
import NoteCardMenu from "./NoteCardMenu"
import { SquarePen, CornerDownRight } from "lucide-react"

interface NoteCardProps {
    note: NoteData
    linkTo?: string
    showLink?: boolean
    maxNodes?: number
    parentNoteTitle?: string
    parentNoteLinkTo?: string
    workspaceId?: string
    commentsReadOnly?: boolean
    showActions?: boolean
}

const NoteCard: FC<NoteCardProps> = ({ note, linkTo, showLink = true, maxNodes, parentNoteTitle, parentNoteLinkTo, workspaceId, commentsReadOnly, showActions = false }) => {
    const { t } = useTranslation()
    const commentsWorkspaceId = workspaceId || note.workspace_id
    return (
        <div className="relative bg-white dark:bg-neutral-800 border sm:shadow-sm dark:border-none rounded-lg overflow-auto flex flex-col gap-3 p-4">
            <>
                {(showLink || (showActions && workspaceId && note.id)) && (
                    <div className="absolute top-4 right-4 flex items-center gap-1.5 p-1">
                        {showLink && (
                            <Link to={linkTo || ""} title={t("actions.edit")} className="p-1 text-gray-500 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-md">
                                <SquarePen size={16} />
                            </Link>
                        )}
                        {showActions && workspaceId && note.id && (
                            <NoteCardMenu note={note} workspaceId={workspaceId} />
                        )}
                    </div>
                )}
                {note.parent_id && (
                    <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                        <CornerDownRight size={12} />
                        {parentNoteLinkTo ? (
                            <Link to={parentNoteLinkTo} className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors truncate max-w-[200px]">
                                {parentNoteTitle || note.parent_id}
                            </Link>
                        ) : (
                            <span className="truncate max-w-[200px]">{parentNoteTitle || note.parent_id}</span>
                        )}
                    </div>
                )}
                <div className="flex items-center text-gray-500">
                    <div className="flex items-center gap-2 min-w-0">
                        {note.created_by && <Avatar name={note.created_by} avatarUrl={note.created_by_avatar_url} size={32} />}
                        <div className="flex flex-col min-w-0">
                            {note.created_by && (
                                <span className="font-medium text-gray-600 dark:text-gray-300 truncate max-w-[140px]">
                                    {note.created_by}
                                </span>
                            )}
                            <NoteTime time={note.created_at ?? ""} />
                        </div>
                    </div>
                </div>
                <div className="break-all w-full flex flex-col m-auto">
                    {note.title && (
                        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                            {note.title}
                        </div>
                    )}
                    {note.content && (
                        <Renderer content={note.content} maxNodes={maxNodes} workspaceId={note.workspace_id} />
                    )}
                </div>
                {commentsWorkspaceId && note.id && (
                    <NoteCardComments workspaceId={commentsWorkspaceId} noteId={note.id} readOnly={commentsReadOnly} />
                )}
            </>
        </div>
    )
}

export default NoteCard
