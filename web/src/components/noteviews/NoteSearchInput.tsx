import { Search, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"

interface NoteSearchInputProps {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    /** Floating over a map: a shadow and roomier padding. */
    floating?: boolean
    className?: string
}

/** Keyword box with a clear button, for the calendar and map views. */
const NoteSearchInput = ({ value, onChange, placeholder, floating, className = "" }: NoteSearchInputProps) => {
    const { t } = useTranslation()
    return (
        <div className={`relative ${className}`}>
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder ?? t("placeholder.search")}
                className={`w-full pl-9 pr-9 text-sm rounded-lg border bg-white dark:bg-neutral-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 outline-none ${floating ? "py-2.5 shadow-md border-neutral-200 dark:border-neutral-700" : "py-2 border-neutral-200 dark:border-neutral-800"}`}
            />
            {value && (
                <button
                    onClick={() => onChange("")}
                    title={t("common.clear")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-red-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                    <Trash2 size={14} />
                </button>
            )}
        </div>
    )
}

export default NoteSearchInput
