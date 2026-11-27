import { useEffect, useState } from "react"
import { searchNotes } from "@/api/search"
import useCurrentWorkspaceId from "@/hooks/use-currentworkspace-id"
import { VIEW_PAGE_SIZE } from "@/components/noteviews/note-views"
import NoteMapView from "@/components/noteviews/NoteMapView"
import NoteSearchInput from "@/components/noteviews/NoteSearchInput"

/** Workspace map: a full-page map of every location in the workspace's notes. */
const NoteMapPage = () => {
    const workspaceId = useCurrentWorkspaceId()
    const [query, setQuery] = useState("")
    const [debouncedQuery, setDebouncedQuery] = useState("")

    useEffect(() => {
        const handler = setTimeout(() => setDebouncedQuery(query.trim()), 300)
        return () => clearTimeout(handler)
    }, [query])

    return (
        <NoteMapView
            queryKey={["notes-map", workspaceId, debouncedQuery]}
            fetchNotes={(bbox) => searchNotes(workspaceId, { query: debouncedQuery, bbox, pageNumber: 1, pageSize: VIEW_PAGE_SIZE })}
            enabled={!!workspaceId}
            getLinkTo={(note) => `/workspaces/${workspaceId}/notes/${note.id}`}
            controls={<NoteSearchInput value={query} onChange={setQuery} floating />}
            listProps={{ workspaceId, showActions: true }}
        />
    )
}

export default NoteMapPage
