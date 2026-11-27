import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { searchNotes } from "@/api/search"
import useCurrentWorkspaceId from "@/hooks/use-currentworkspace-id"
import NoteCalendarView from "@/components/noteviews/NoteCalendarView"
import { VIEW_PAGE_SIZE } from "@/components/noteviews/note-views"
import NoteSearchInput from "@/components/noteviews/NoteSearchInput"

/** Workspace calendar: notes placed on the dates of their calendar blocks. */
const NoteCalendarPage = () => {
    const { t } = useTranslation()
    const workspaceId = useCurrentWorkspaceId()
    const [query, setQuery] = useState("")
    const [debouncedQuery, setDebouncedQuery] = useState("")

    useEffect(() => {
        const handler = setTimeout(() => setDebouncedQuery(query.trim()), 300)
        return () => clearTimeout(handler)
    }, [query])

    return (
        <div className="h-full overflow-auto bg-neutral-50 dark:bg-neutral-950">
            <div className="w-full max-w-6xl mx-auto px-4 pt-4 xl:pt-6 pb-8">
                <div className="flex flex-wrap items-center gap-3 mb-3">
                    <h1 className="hidden lg:block text-xl font-semibold text-gray-900 dark:text-gray-100">
                        {t("noteViews.calendar")}
                    </h1>
                    <NoteSearchInput value={query} onChange={setQuery} className="flex-1 min-w-[12rem] lg:max-w-xs lg:ml-auto" />
                </div>
                <NoteCalendarView
                    queryKey={["notes-calendar", workspaceId, debouncedQuery]}
                    fetchNotes={(filters) => searchNotes(workspaceId, { query: debouncedQuery, filters, pageNumber: 1, pageSize: VIEW_PAGE_SIZE })}
                    enabled={!!workspaceId}
                    getLinkTo={(note) => `/workspaces/${workspaceId}/notes/${note.id}`}
                    listProps={{ workspaceId, showActions: true }}
                />
            </div>
        </div>
    )
}

export default NoteCalendarPage
