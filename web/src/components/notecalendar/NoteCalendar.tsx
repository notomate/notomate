import { useMemo } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { SearchNote } from "@/api/search"
import { dayKey, monthGrid } from "./calendar-grid"

const MAX_PER_DAY = 3

export interface CalendarEntry {
    note: SearchNote
    title: string
}

interface NoteCalendarProps {
    /** Any day in the month shown. */
    month: Date
    onMonthChange: (month: Date) => void
    notes: SearchNote[]
    selectedDay: string | null
    onSelectDay: (day: string | null) => void
    loading?: boolean
}

/** Month grid of the notes' calendar blocks; clicking a day narrows the list below to it. */
const NoteCalendar = ({ month, onMonthChange, notes, selectedDay, onSelectDay, loading }: NoteCalendarProps) => {
    const { t, i18n } = useTranslation()
    const days = useMemo(() => monthGrid(month), [month])
    const today = dayKey(new Date())

    const byDay = useMemo(() => {
        const map = new Map<string, CalendarEntry[]>()
        for (const note of notes) {
            for (const ev of note.events ?? []) {
                const list = map.get(ev.date) ?? []
                list.push({ note, title: ev.title || note.title || t("editor.titlePlaceholder") })
                map.set(ev.date, list)
            }
        }
        return map
    }, [notes, t])

    const monthLabel = new Intl.DateTimeFormat(i18n.language, { year: "numeric", month: "long" }).format(month)
    const weekdayFmt = new Intl.DateTimeFormat(i18n.language, { weekday: "short" })
    const shift = (n: number) => onMonthChange(new Date(month.getFullYear(), month.getMonth() + n, 1))

    return (
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
            <div className="flex items-center gap-1 px-2 py-2 border-b border-neutral-200 dark:border-neutral-800">
                <button
                    type="button"
                    onClick={() => shift(-1)}
                    title={t("noteViews.prevMonth")}
                    aria-label={t("noteViews.prevMonth")}
                    className="p-1.5 rounded-md text-muted-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                    <ChevronLeft size={18} />
                </button>
                <h2 className="flex-1 text-center text-sm font-medium text-gray-900 dark:text-gray-100">
                    {monthLabel}
                    {loading && <span className="ml-2 inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse align-middle" />}
                </h2>
                <button
                    type="button"
                    onClick={() => { onMonthChange(new Date()); onSelectDay(null) }}
                    className="px-2 py-1 rounded-md text-xs text-gray-700 dark:text-gray-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                    {t("noteViews.today")}
                </button>
                <button
                    type="button"
                    onClick={() => shift(1)}
                    title={t("noteViews.nextMonth")}
                    aria-label={t("noteViews.nextMonth")}
                    className="p-1.5 rounded-md text-muted-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                    <ChevronRight size={18} />
                </button>
            </div>
            <div className="grid grid-cols-7 text-center text-[11px] text-muted-foreground border-b border-neutral-200 dark:border-neutral-800">
                {days.slice(0, 7).map((d) => (
                    <div key={d.getDay()} className="py-1">{weekdayFmt.format(d)}</div>
                ))}
            </div>
            <div className="grid grid-cols-7">
                {days.map((d, i) => {
                    const key = dayKey(d)
                    const entries = byDay.get(key) ?? []
                    const inMonth = d.getMonth() === month.getMonth()
                    const selected = key === selectedDay
                    return (
                        <button
                            key={key}
                            type="button"
                            onClick={() => onSelectDay(selected ? null : key)}
                            aria-pressed={selected}
                            className={`min-h-[4.5rem] lg:min-h-[6.5rem] p-1 flex flex-col items-stretch gap-0.5 text-left border-neutral-100 dark:border-neutral-800 ${i % 7 ? "border-l" : ""} ${i >= 7 ? "border-t" : ""} ${selected ? "bg-blue-50 dark:bg-blue-900/30" : "hover:bg-neutral-50 dark:hover:bg-neutral-800/60"}`}
                        >
                            <span
                                className={`self-start text-xs leading-5 w-5 text-center rounded-full tabular-nums ${key === today ? "bg-blue-600 text-white" : inMonth ? "text-gray-800 dark:text-gray-200" : "text-gray-400 dark:text-gray-600"}`}
                            >
                                {d.getDate()}
                            </span>
                            {entries.slice(0, MAX_PER_DAY).map((e, j) => (
                                <span
                                    key={`${e.note.id}-${j}`}
                                    className="truncate rounded px-1 text-[11px] leading-4 bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200"
                                >
                                    {e.title}
                                </span>
                            ))}
                            {entries.length > MAX_PER_DAY && (
                                <span className="px-1 text-[11px] leading-4 text-muted-foreground">
                                    {t("noteViews.more", { count: entries.length - MAX_PER_DAY })}
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

export default NoteCalendar
