import { ComponentProps, useMemo, useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import type { NoteData } from "@/api/note"
import type { SearchNotesResult } from "@/api/search"
import NoteCalendar from "@/components/notecalendar/NoteCalendar"
import { dayKey, monthGrid } from "@/components/notecalendar/calendar-grid"
import NoteList from "@/components/notecard/NoteList"
import NoteListSkeleton from "@/components/notecard/NoteListSkeleton"
import { VIEW_PAGE_SIZE } from "./note-views"

export interface EventRange {
    eventFrom: string
    eventTo: string
}

interface NoteCalendarViewProps {
    /** Identifies the search; the visible range is appended. */
    queryKey: unknown[]
    fetchNotes: (range: EventRange) => Promise<SearchNotesResult>
    enabled?: boolean
    getLinkTo: (note: NoteData) => string
    /** Passed to the note list beside the calendar. */
    listProps?: Omit<ComponentProps<typeof NoteList>, "notes" | "getLinkTo">
}

/** Notes on a month grid by their calendar blocks, with the month's or a picked day's notes beside it. */
const NoteCalendarView = ({ queryKey, fetchNotes, enabled = true, getLinkTo, listProps }: NoteCalendarViewProps) => {
    const { t, i18n } = useTranslation()
    const [month, setMonth] = useState(() => new Date())
    const [selectedDay, setSelectedDay] = useState<string | null>(null)

    // The six weeks on screen, so the leading and trailing days show their notes too.
    const range = useMemo(() => {
        const days = monthGrid(month)
        return { eventFrom: dayKey(days[0]), eventTo: dayKey(days[days.length - 1]) }
    }, [month])

    const { data, isLoading, isFetching } = useQuery({
        queryKey: [...queryKey, range],
        queryFn: () => fetchNotes(range),
        enabled,
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
        <>
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
                    {notes.length >= VIEW_PAGE_SIZE && (
                        <div className="px-4 lg:px-0 pb-2 text-xs text-muted-foreground">{t("noteViews.capped", { count: VIEW_PAGE_SIZE })}</div>
                    )}
                    {isLoading ? (
                        <NoteListSkeleton count={3} />
                    ) : listed.length === 0 ? (
                        <div className="text-center text-muted-foreground py-10 text-sm">{t("noteViews.noEvents")}</div>
                    ) : (
                        <div className="lg:-mx-4">
                            <NoteList notes={listed} getLinkTo={getLinkTo} maxNodes={40} {...listProps} />
                        </div>
                    )}
                </section>
            </div>
        </>
    )
}

export default NoteCalendarView
