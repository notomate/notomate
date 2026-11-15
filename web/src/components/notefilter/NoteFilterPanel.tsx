import { ReactNode, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { SlidersHorizontal, Star, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { BLOCK_KINDS, type DateField, type DatePreset, type NoteFilters, type NoteSort, type TaskStatus } from "./note-filters"

const DATE_PRESETS: DatePreset[] = ["any", "today", "7d", "30d", "year", "custom"]
const MIN_RATINGS = [0, 1, 2, 3, 4, 5]

interface NoteFilterPanelProps {
    filters: NoteFilters
    onChange: (patch: Partial<NoteFilters>) => void
    onReset: () => void
    /** Page-specific creator control (member select, clicked-creator chip…). */
    creator?: ReactNode
    /** Page-specific tag filter control; pages without a tag index omit it. */
    tags?: ReactNode
    /** Shows the filters on block content (event date, to-dos, rating), which need the search index. */
    contentFilters?: boolean
    /** Touch-sized controls for the bottom sheet. */
    sheet?: boolean
    /** Whether the reset button is enabled; true when anything differs from the defaults. */
    canReset: boolean
    /** Shows a close button in the header. */
    onClose?: () => void
}

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
    <section className="flex flex-col gap-2">
        <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
        {children}
    </section>
)

const chipClass = (selected: boolean, sheet: boolean) =>
    cn(
        "inline-flex items-center gap-1.5 rounded-full border transition-colors select-none",
        sheet ? "px-3 py-1.5 text-sm" : "px-2.5 py-1 text-xs",
        selected
            ? "border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900"
            : "border-neutral-200 dark:border-neutral-700 text-gray-700 dark:text-gray-200 hover:bg-neutral-100 dark:hover:bg-neutral-800",
    )

function Segmented<T extends string>({ value, options, onChange, sheet }: {
    value: T
    options: { value: T; label: string }[]
    onChange: (v: T) => void
    sheet: boolean
}) {
    return (
        <div className="grid grid-flow-col auto-cols-fr p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800">
            {options.map((o) => (
                <button
                    key={o.value}
                    type="button"
                    aria-pressed={value === o.value}
                    onClick={() => onChange(o.value)}
                    className={cn(
                        "rounded-md truncate transition-colors",
                        sheet ? "px-2 py-1.5 text-sm" : "px-2 py-1 text-xs",
                        value === o.value
                            ? "bg-white dark:bg-neutral-950 text-gray-900 dark:text-gray-100 shadow-sm"
                            : "text-muted-foreground hover:text-gray-900 dark:hover:text-gray-100",
                    )}
                >
                    {o.label}
                </button>
            ))}
        </div>
    )
}

const dateInputClass = (sheet: boolean) =>
    cn(
        "w-full min-w-0 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-gray-100 outline-none focus-visible:ring-2 focus-visible:ring-primary dark:[color-scheme:dark]",
        sheet ? "px-2.5 py-2 text-base" : "px-2 py-1 text-xs",
    )

export function NoteFilterPanel({ filters, onChange, onReset, creator, tags, contentFilters = false, sheet = false, canReset, onClose }: NoteFilterPanelProps) {
    const { t } = useTranslation()

    const toggleKind = (id: string) =>
        onChange({
            blockKinds: filters.blockKinds.includes(id)
                ? filters.blockKinds.filter((k) => k !== id)
                : [...filters.blockKinds, id],
        })

    return (
        <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
                <h2 className={cn("flex-1 font-semibold text-gray-900 dark:text-gray-100", sheet ? "text-base" : "text-sm")}>
                    {t("noteFilter.title")}
                </h2>
                <button
                    type="button"
                    onClick={onReset}
                    disabled={!canReset}
                    className={cn("rounded-md px-2 py-1 text-primary hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:text-muted-foreground disabled:opacity-50 disabled:hover:bg-transparent", sheet ? "text-sm" : "text-xs")}
                >
                    {t("noteFilter.reset")}
                </button>
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={t("common.close")}
                        className="ml-1 p-1 rounded-md text-muted-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-gray-900 dark:hover:text-gray-100"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>

            <Section title={t("noteFilter.sort")}>
                <Segmented<NoteSort>
                    sheet={sheet}
                    value={filters.sort}
                    onChange={(sort) => onChange({ sort })}
                    options={[
                        { value: "created_at", label: t("noteFilter.sortCreated") },
                        { value: "updated_at", label: t("noteFilter.sortUpdated") },
                    ]}
                />
            </Section>

            <Section title={t("noteFilter.date")}>
                <Segmented<DateField>
                    sheet={sheet}
                    value={filters.dateField}
                    onChange={(dateField) => onChange({ dateField })}
                    options={[
                        { value: "created", label: t("noteFilter.dateCreated") },
                        { value: "updated", label: t("noteFilter.dateUpdated") },
                    ]}
                />
                <div className="flex flex-wrap gap-1.5">
                    {DATE_PRESETS.map((p) => (
                        <button
                            key={p}
                            type="button"
                            aria-pressed={filters.datePreset === p}
                            onClick={() => onChange({ datePreset: p })}
                            className={chipClass(filters.datePreset === p, sheet)}
                        >
                            {t(`noteFilter.preset.${p}`)}
                        </button>
                    ))}
                </div>
                {filters.datePreset === "custom" && (
                    <div className="grid grid-cols-2 gap-2">
                        <label className="flex flex-col gap-1 min-w-0">
                            <span className="text-xs text-muted-foreground">{t("noteFilter.from")}</span>
                            <input
                                type="date"
                                value={filters.customFrom}
                                max={filters.customTo || undefined}
                                onChange={(e) => onChange({ customFrom: e.target.value })}
                                className={dateInputClass(sheet)}
                            />
                        </label>
                        <label className="flex flex-col gap-1 min-w-0">
                            <span className="text-xs text-muted-foreground">{t("noteFilter.to")}</span>
                            <input
                                type="date"
                                value={filters.customTo}
                                min={filters.customFrom || undefined}
                                onChange={(e) => onChange({ customTo: e.target.value })}
                                className={dateInputClass(sheet)}
                            />
                        </label>
                    </div>
                )}
            </Section>

            <Section title={t("noteFilter.contains")}>
                <div className="flex flex-wrap gap-1.5">
                    {BLOCK_KINDS.map(({ id, icon: Icon }) => {
                        const selected = filters.blockKinds.includes(id)
                        return (
                            <button
                                key={id}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => toggleKind(id)}
                                className={chipClass(selected, sheet)}
                            >
                                <Icon size={sheet ? 15 : 13} className="shrink-0" />
                                {t(`noteFilter.block.${id}`)}
                            </button>
                        )
                    })}
                </div>
            </Section>

            {contentFilters && (
                <>
                    <Section title={t("noteFilter.eventDate")}>
                        <div className="grid grid-cols-2 gap-2">
                            <label className="flex flex-col gap-1 min-w-0">
                                <span className="text-xs text-muted-foreground">{t("noteFilter.from")}</span>
                                <input
                                    type="date"
                                    value={filters.eventFrom}
                                    max={filters.eventTo || undefined}
                                    onChange={(e) => onChange({ eventFrom: e.target.value })}
                                    className={dateInputClass(sheet)}
                                />
                            </label>
                            <label className="flex flex-col gap-1 min-w-0">
                                <span className="text-xs text-muted-foreground">{t("noteFilter.to")}</span>
                                <input
                                    type="date"
                                    value={filters.eventTo}
                                    min={filters.eventFrom || undefined}
                                    onChange={(e) => onChange({ eventTo: e.target.value })}
                                    className={dateInputClass(sheet)}
                                />
                            </label>
                        </div>
                    </Section>

                    <Section title={t("noteFilter.tasks")}>
                        <Segmented<TaskStatus>
                            sheet={sheet}
                            value={filters.tasks}
                            onChange={(tasks) => onChange({ tasks })}
                            options={[
                                { value: "any", label: t("noteFilter.tasksAny") },
                                { value: "open", label: t("noteFilter.tasksOpen") },
                                { value: "done", label: t("noteFilter.tasksDone") },
                            ]}
                        />
                    </Section>

                    <Section title={t("noteFilter.rating")}>
                        <div className="flex flex-wrap gap-1.5">
                            {MIN_RATINGS.map((r) => (
                                <button
                                    key={r}
                                    type="button"
                                    aria-pressed={filters.minRating === r}
                                    onClick={() => onChange({ minRating: r })}
                                    className={chipClass(filters.minRating === r, sheet)}
                                >
                                    {r > 0 && <Star size={sheet ? 15 : 13} className="shrink-0" />}
                                    {r > 0 ? t("noteFilter.ratingAtLeast", { count: r }) : t("noteFilter.ratingAny")}
                                </button>
                            ))}
                        </div>
                    </Section>
                </>
            )}

            {tags && <Section title={t("common.tagFilter")}>{tags}</Section>}
            {creator && <Section title={t("common.creator")}>{creator}</Section>}
        </div>
    )
}

/** Toggles the filter panel; shows how many filters are active. */
export function NoteFilterButton({ activeCount, pressed, onClick }: { activeCount: number; pressed: boolean; onClick: () => void }) {
    const { t } = useTranslation()
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={t("noteFilter.title")}
            aria-pressed={pressed}
            title={t("noteFilter.title")}
            className={cn(
                "relative shrink-0 p-2.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-gray-900 dark:hover:text-gray-100 transition-colors",
                pressed ? "bg-neutral-100 dark:bg-neutral-800 text-gray-900 dark:text-gray-100" : "text-muted-foreground",
            )}
        >
            <SlidersHorizontal size={16} />
            {activeCount > 0 && (
                <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] leading-4 text-center">
                    {activeCount}
                </span>
            )}
        </button>
    )
}

interface NoteFilterSheetProps extends Omit<NoteFilterPanelProps, "sheet"> {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function NoteFilterSheet({ open, onOpenChange, ...panel }: NoteFilterSheetProps) {
    const { t } = useTranslation()
    return (
        <BottomSheet open={open} onOpenChange={onOpenChange} className="max-h-[85dvh] flex flex-col">
            <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-2 pb-4">
                <NoteFilterPanel {...panel} sheet />
            </div>
            <div className="shrink-0 px-4 pt-2 pb-2 border-t border-neutral-200 dark:border-neutral-700">
                <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="w-full min-h-11 rounded-xl bg-primary text-primary-foreground text-base font-medium hover:bg-primary-hover active:bg-primary-active"
                >
                    {t("noteFilter.done")}
                </button>
            </div>
        </BottomSheet>
    )
}

const DRAWER_TRANSITION_MS = 200

/** Right-side drawer for the panel between `lg` and `xl`. */
export function NoteFilterDrawer({ open, onOpenChange, ...panel }: NoteFilterSheetProps) {
    // Stay mounted through the closing transition; `visible` drives the slide.
    const [mounted, setMounted] = useState(open)
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        if (open) {
            setMounted(true)
            const frame = requestAnimationFrame(() => setVisible(true))
            return () => cancelAnimationFrame(frame)
        }
        setVisible(false)
        const timer = setTimeout(() => setMounted(false), DRAWER_TRANSITION_MS)
        return () => clearTimeout(timer)
    }, [open])

    useEffect(() => {
        if (!open) return
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onOpenChange(false)
        }
        document.addEventListener("keydown", handleKeyDown)
        return () => document.removeEventListener("keydown", handleKeyDown)
    }, [open, onOpenChange])

    if (!mounted) return null

    return createPortal(
        <>
            <div
                className={cn(
                    "fixed inset-0 z-drawer-backdrop bg-black/40 dark:bg-black/70 transition-opacity duration-200",
                    visible ? "opacity-100" : "opacity-0 pointer-events-none",
                )}
                onClick={() => onOpenChange(false)}
            />
            <div
                role="dialog"
                className={cn(
                    "fixed top-0 right-0 bottom-0 z-drawer w-80 max-w-[85vw] overflow-y-auto px-4 pt-4 pb-6 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xl dark:ring-1 dark:ring-white/10 transition-transform duration-200 ease-out",
                    visible ? "translate-x-0" : "translate-x-full",
                )}
            >
                <NoteFilterPanel {...panel} onClose={() => onOpenChange(false)} />
            </div>
        </>,
        document.body,
    )
}
