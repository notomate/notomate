import { FC } from "react"
import NoteCard from "./NoteCard"
import { NoteData } from "@/api/note"

interface NoteListProps {
    notes: NoteData[]
    getLinkTo?: (note: NoteData) => string
    showLink?: boolean
    maxNodes?: number
    workspaceId?: string
    commentsReadOnly?: boolean
}

const NoteList: FC<NoteListProps> = ({ notes, getLinkTo, maxNodes, showLink = true, workspaceId, commentsReadOnly }) => {
    return (
        <div className="px-4 flex flex-col gap-2">
            {notes?.map((note: NoteData, idx: number) => {
                if (!note) return null
                return (
                    <NoteCard
                        key={note.id || idx}
                        note={note}
                        linkTo={getLinkTo ? getLinkTo(note) : undefined}
                        showLink={showLink}
                        maxNodes={maxNodes}
                        workspaceId={workspaceId}
                        commentsReadOnly={commentsReadOnly}
                    />
                )
            })}
        </div>
    )
}

export default NoteList