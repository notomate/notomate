import { useEffect, useMemo, useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { Search, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { searchNotes } from "@/api/search"
import useCurrentWorkspaceId from "@/hooks/use-currentworkspace-id"
import NoteCalendar from "@/components/notecalendar/NoteCalendar"
import { dayKey, monthGrid } from "@/components/notecalendar/calendar-grid"
import NoteList from "@/components/notecard/NoteList"
import NoteListSkeleton from "@/components/notecard/NoteListSkeleton"

/** The most notes the search API returns at once. */
const PAGE_SIZE = 100

/** Workspace calendar: notes placed on the dates of their calendar blocks. */
const NoteCalendarPage = () => {
    const { t, i18n } = useTranslation()
    const workspaceId = useCurrentWorkspaceId()
    const [month, setMonth] = useState(() => new Date())
    const [selectedDay, setSelectedDay] = useState<string | null>(null)
    const [query, setQuery] = useState("")
    const [debouncedQuery, setDebouncedQuery] = useState("")

    useEffect(() => {
        const handler = setTimeout(() => setDebouncedQuery(query.trim()), 300)
        return () => clearTimeout(handler)
    }, [query])

    // The six weeks on screen, so the leading and trailing days show their notes too.
    const range = useMemo(() => {
        const days = monthGrid(month)
        return { eventFrom: dayKey(days[0]), eventTo: dayKey(days[days.length - 1]) }
    }, [month])

    const { data, isLoading, isFetching } = useQuery({
        queryKey: ["notes-calendar", workspaceId, debouncedQuery, range],
        queryFn: () => searchNotes(workspaceId, { query: debouncedQuery, filters: range, pageNumber: 1, pageSize: PAGE_SIZE }),
        enabled: !!workspaceId,
        placeholderData: keepPreviousData,
        refetchOnWindowFocus: false,
    })
    const notes = useMemo(() => data?.notes ?? [], [data])
    const pending = data?.pending ?? 0

    // With a day picked, only its notes; otherwise every note dated in the month itself.
    const listed = useMemo(() => {
        if (selectedDay) return notes.filter((n) => n.events?.some((e) => e.date === selectedDay))
        const prefix = dayKey(month).slice(0, 7)
        return notes.filter((n) => n.events?.some((e) => e.date.startsWith(prefix)))
    }, [notes, selectedDay, month])

    const listTitle = selectedDay
        ? new Intl.DateTimeFormat(i18n.language, { dateStyle: "full" }).format(new Date(`${selectedDay}T00:00`))
        : new Intl.DateTimeFormat(i18n.language, { year: "numeric", month: "long" }).format(month)

    return (
        <div className="h-full overflow-auto bg-neutral-50 dark:bg-neutral-950">
            <div className="w-full max-w-6xl mx-auto px-4 pt-4 xl:pt-6 pb-8">
                <div className="flex flex-wrap items-center gap-3 mb-3">
                    <h1 className="hidden lg:block text-xl font-semibold text-gray-900 dark:text-gray-100">
                        {t("noteViews.calendar")}
                    </h1>
                    <div className="relative flex-1 min-w-[12rem] lg:max-w-xs lg:ml-auto">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={t("placeholder.search")}
                            className="w-full pl-9 pr-9 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 outline-none"
                        />
                        {query && (
                            <button
                                onClick={() => setQuery("")}
                                title={t("common.clear")}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-red-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>
                </div>
                {pending > 0 && (
                    <div className="mb-2 text-xs text-muted-foreground">{t("common.indexingNotice", { count: pending })}</div>
                )}
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
                    <NoteCalendar
                        month={month}
                        onMonthChange={(m) => { setMonth(m); setSelectedDay(null) }}
                        notes={notes}
                        selectedDay={selectedDay}
                        onSelectDay={setSelectedDay}
                        loading={isFetching}
                    />
                    <section className="-mx-4 lg:mx-0">
                        <div className="px-4 lg:px-0 pb-2 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                            <span className="font-medium">{listTitle}</span>
                            {selectedDay && (
                                <button
                                    type="button"
                                    onClick={() => setSelectedDay(null)}
                                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                    {t("noteViews.showWholeMonth")}
                                </button>
                            )}
                        </div>
                        {notes.length >= PAGE_SIZE && (
                            <div className="px-4 lg:px-0 pb-2 text-xs text-muted-foreground">{t("noteViews.capped", { count: PAGE_SIZE })}</div>
                        )}
                        {isLoading ? (
                            <NoteListSkeleton count={3} />
                        ) : listed.length === 0 ? (
                            <div className="text-center text-muted-foreground py-10 text-sm">{t("noteViews.noEvents")}</div>
                        ) : (
                            <div className="lg:-mx-4">
                                <NoteList
                                    notes={listed}
                                    getLinkTo={(note) => `/workspaces/${workspaceId}/notes/${note.id}`}
                                    maxNodes={40}
                                    workspaceId={workspaceId}
                                    showActions
                                />
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </div>
    )
}

export default NoteCalendarPage
