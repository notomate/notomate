import { ReactNode, useState, useEffect, useRef } from "react"
import { ArrowLeft } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { updateView } from "@/api/view"
import EditableDiv from "@/components/editablediv/EditableDiv"

interface ViewHeaderProps {
    viewId: string
    workspaceId: string
    viewName: string
    viewType?: string
    rightActions?: ReactNode
    icon?: ReactNode
}

const ViewHeader = ({ viewId, workspaceId, viewName, viewType, rightActions, icon }: ViewHeaderProps) => {
    const navigate = useNavigate()
    const { t } = useTranslation()
    const queryClient = useQueryClient()
    const [localName, setLocalName] = useState(viewName)
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const lastSaved = useRef(viewName)

    useEffect(() => {
        setLocalName(viewName)
        lastSaved.current = viewName
    }, [viewName])

    const updateMutation = useMutation({
        mutationFn: (name: string) => updateView(workspaceId, viewId, { name }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['view', workspaceId, viewId] })
            queryClient.invalidateQueries({ queryKey: ['views', workspaceId] })
            if (viewType) {
                queryClient.invalidateQueries({ queryKey: ['views', workspaceId, viewType] })
            }
        }
    })

    const handleNameChange = (name: string) => {
        setLocalName(name)
        if (debounceTimer.current) clearTimeout(debounceTimer.current)
        debounceTimer.current = setTimeout(() => {
            const trimmed = name.trim()
            if (trimmed && trimmed !== lastSaved.current) {
                lastSaved.current = trimmed
                updateMutation.mutate(trimmed)
            }
        }, 500)
    }

    return (
        <div className="flex items-center justify-between lg:py-4 bg-neutral-100 dark:bg-neutral-900">
            <div className="flex items-center gap-2 p-4 lg:px-4 lg:py-0">
                <button
                    onClick={() => navigate(-1)}
                    title={t("actions.back")}
                    className="shrink-0 p-1 rounded-md text-gray-400 dark:text-gray-500 hover:bg-neutral-200 dark:hover:bg-neutral-700 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                    <ArrowLeft size={16} />
                </button>
                {icon}
                <EditableDiv
                    value={localName}
                    onChange={handleNameChange}
                    placeholder={t("notes.untitled")}
                    className="text-sm font-semibold text-gray-700 dark:text-gray-200 border-none outline-none bg-transparent placeholder:text-gray-300 dark:placeholder:text-gray-600 min-w-0"
                />
            </div>
            {rightActions && <div className="flex gap-2">{rightActions}</div>}
        </div>
    )
}

export default ViewHeader
