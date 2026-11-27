import { useState } from "react"
import { CalendarDays, Check, List, Map as MapIcon, type LucideIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { useIsLg } from "@/hooks/use-media-query"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { menuIconClass, menuItemClass, menuListClass } from "@/components/ui/menu"
import type { NoteView } from "./note-views"

interface NoteViewSwitchProps {
    value: NoteView
    onChange: (view: NoteView) => void
    /** Floating over a map: gives the controls a surface and a shadow. */
    floating?: boolean
}

/**
 * Switch between the note list, calendar and map: an icon toggle from `lg`;
 * below it, in the single-column layout, a button like the filter button that
 * opens a bottom sheet.
 */
const NoteViewSwitch = ({ value, onChange, floating }: NoteViewSwitchProps) => {
    const { t } = useTranslation()
    const isLg = useIsLg()
    const [sheetOpen, setSheetOpen] = useState(false)
    const views: { view: NoteView, label: string, icon: LucideIcon }[] = [
        { view: "list", label: t("noteViews.list"), icon: List },
        { view: "calendar", label: t("noteViews.calendar"), icon: CalendarDays },
        { view: "map", label: t("noteViews.map"), icon: MapIcon },
    ]

    if (!isLg) {
        const current = views.find((v) => v.view === value) ?? views[0]
        const CurrentIcon = current.icon
        return (
            <>
                <button
                    type="button"
                    onClick={() => setSheetOpen(true)}
                    aria-label={current.label}
                    aria-haspopup="dialog"
                    aria-pressed={sheetOpen}
                    title={current.label}
                    className={cn(
                        "relative shrink-0 p-2.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-gray-900 dark:hover:text-gray-100 transition-colors",
                        sheetOpen ? "bg-neutral-100 dark:bg-neutral-800 text-gray-900 dark:text-gray-100" : "text-muted-foreground",
                        floating && "border border-neutral-200 dark:border-neutral-700 shadow-md",
                        floating && !sheetOpen && "bg-white dark:bg-neutral-900",
                    )}
                >
                    <CurrentIcon size={16} />
                </button>
                <BottomSheet open={sheetOpen} onOpenChange={setSheetOpen}>
                    <div className={menuListClass} role="group" aria-label={t("noteViews.switchView")}>
                        {views.map(({ view, label, icon: Icon }) => (
                            <button
                                key={view}
                                type="button"
                                aria-pressed={value === view}
                                onClick={() => { onChange(view); setSheetOpen(false) }}
                                className={menuItemClass(true)}
                            >
                                <span className={menuIconClass()}><Icon size={16} /></span>
                                <span className="flex-1">{label}</span>
                                {value === view && <Check size={16} className="shrink-0" />}
                            </button>
                        ))}
                    </div>
                </BottomSheet>
            </>
        )
    }

    return (
        <div role="group" className={cn(
            "shrink-0 inline-flex rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-1 gap-0.5",
            floating && "shadow-md",
        )}>
            {views.map(({ view, label, icon: Icon }) => (
                <button
                    key={view}
                    type="button"
                    onClick={() => onChange(view)}
                    aria-pressed={value === view}
                    title={label}
                    aria-label={label}
                    className={`px-2.5 py-2 rounded-md transition-colors ${value === view ? "bg-neutral-200 dark:bg-neutral-700 text-gray-900 dark:text-gray-100" : "text-muted-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
                >
                    <Icon size={16} />
                </button>
            ))}
        </div>
    )
}

export default NoteViewSwitch
