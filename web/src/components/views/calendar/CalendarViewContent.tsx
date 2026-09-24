import { Calendar } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useTwoColumn } from "@/components/twocolumn"
import CalendarViewComponent from "./CalendarViewComponent"
import CalendarWeekView from "./CalendarWeekView"
import CalendarDayView from "./CalendarDayView"
import ViewHeader from "../common/ViewHeader"

type CalendarViewMode = 'month' | 'week' | 'day'

interface CalendarViewContentProps {
    view: any
    viewObjects: any[]
    currentWorkspaceId: string
    isCreating: boolean
    setIsCreating: (value: boolean) => void
    handleCloseModal: () => void
    newObjectName: string
    setNewObjectName: (value: string) => void
    newObjectData: string
    setNewObjectData: (value: string) => void
    handleCreate: () => void
    createMutation: any
    focusedObjectId?: string
}

const CalendarViewContent = ({
    view,
    viewObjects,
    currentWorkspaceId,
    focusedObjectId
}: CalendarViewContentProps) => {
    const { t } = useTranslation()
    const { isSidebarCollapsed, toggleSidebar } = useTwoColumn()
    const [viewMode, setViewMode] = useState<CalendarViewMode>('month')

    return (
        <div className="w-full">
            <ViewHeader
                viewId={view.id}
                workspaceId={currentWorkspaceId}
                viewName={view.name}
                viewType="calendar"
                rightActions={
                    <>
                        <div className="pr-4 flex gap-2 items-center">
                            {/* View mode switcher */}
                            <div className="flex bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1">
                                <button
                                    onClick={() => setViewMode('month')}
                                    className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                                        viewMode === 'month'
                                            ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-gray-100'
                                            : 'text-muted-foreground hover:text-gray-900 dark:hover:text-gray-100'
                                    }`}
                                >
                                    {t('views.month') || 'Month'}
                                </button>
                                <button
                                    onClick={() => setViewMode('week')}
                                    className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                                        viewMode === 'week'
                                            ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-gray-100'
                                            : 'text-muted-foreground hover:text-gray-900 dark:hover:text-gray-100'
                                    }`}
                                >
                                    {t('views.week') || 'Week'}
                                </button>
                                <button
                                    onClick={() => setViewMode('day')}
                                    className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                                        viewMode === 'day'
                                            ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-gray-100'
                                            : 'text-muted-foreground hover:text-gray-900 dark:hover:text-gray-100'
                                    }`}
                                >
                                    {t('views.day') || 'Day'}
                                </button>
                            </div>

                            <button
                                onClick={toggleSidebar}
                                className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                                title={isSidebarCollapsed ? "Show Sidebar" : "Hide Sidebar"}
                            >
                                <Calendar size={18} />
                            </button>
                        </div>
                    </>
                }
            />

            {viewMode === 'month' && (
                <CalendarViewComponent
                    key={focusedObjectId || 'default'}
                    viewObjects={viewObjects}
                    focusedObjectId={focusedObjectId}
                />
            )}
            {viewMode === 'week' && (
                <CalendarWeekView
                    key={focusedObjectId || 'default'}
                    viewObjects={viewObjects}
                    focusedObjectId={focusedObjectId}
                />
            )}
            {viewMode === 'day' && (
                <CalendarDayView
                    key={focusedObjectId || 'default'}
                    viewObjects={viewObjects}
                    focusedObjectId={focusedObjectId}
                />
            )}
        </div>
    )
}

export default CalendarViewContent