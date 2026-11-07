import { FC } from "react"
import { X } from "lucide-react"
import { useTranslation } from "react-i18next"
import Avatar from "@/components/avatar/Avatar"

export interface CreatorFilter {
    id: string
    name: string
    avatarUrl?: string
}

interface CreatorFilterChipProps {
    creator: CreatorFilter
    onClear: () => void
}

const CreatorFilterChip: FC<CreatorFilterChipProps> = ({ creator, onClear }) => {
    const { t } = useTranslation()
    return (
        <div className="inline-flex items-center gap-1.5 max-w-full pl-1 pr-1 py-1 rounded-full text-xs bg-neutral-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-200">
            <Avatar name={creator.name} avatarUrl={creator.avatarUrl} size={20} />
            <span className="truncate">{creator.name}</span>
            <button
                type="button"
                onClick={onClear}
                title={t("common.clear")}
                className="shrink-0 p-0.5 rounded-full text-muted-foreground hover:text-gray-900 dark:hover:text-gray-100 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
            >
                <X size={12} />
            </button>
        </div>
    )
}

export default CreatorFilterChip
