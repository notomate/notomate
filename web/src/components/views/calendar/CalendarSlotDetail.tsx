import { useState, useMemo, useEffect } from "react"
import { useNavigate, useParams, useOutletContext } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { ArrowLeft, Clock, Edit2, X, Check } from "lucide-react"
import { getViewObject, updateViewObject } from "@/api/view"
import { CalendarSlotData } from "@/types/view"

interface CalendarSlotDetailContext {
    view: any
    viewObjects: any[]
    workspaceId: string
    viewId: string
}

const CalendarSlotDetail = () => {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const { slotId } = useParams<{ slotId: string }>()
    const { workspaceId, viewId, view } = useOutletContext<CalendarSlotDetailContext>()
    const [isEditing, setIsEditing] = useState(false)

    // Edit form state
    const [editName, setEditName] = useState('')
    const [editDate, setEditDate] = useState('')
    const [editEndDate, setEditEndDate] = useState('')
    const [editStartTime, setEditStartTime] = useState('')
    const [editEndTime, setEditEndTime] = useState('')
    const [editIsAllDay, setEditIsAllDay] = useState(true)
    const [editColor, setEditColor] = useState('')

    const { data: slot, isLoading } = useQuery({
        queryKey: ['view-object', workspaceId, viewId, slotId],
        queryFn: () => getViewObject(workspaceId, viewId!, slotId!),
        enabled: !!workspaceId && !!viewId && !!slotId,
    })

    const updateMutation = useMutation({
        mutationFn: (data: { name?: string; data?: string }) =>
            updateViewObject(workspaceId, viewId!, slotId!, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['view-object', workspaceId, viewId, slotId] })
            queryClient.invalidateQueries({ queryKey: ['view-objects', workspaceId, viewId] })
            setIsEditing(false)
        },
    })

    // Parse slot data
    const slotData = useMemo<CalendarSlotData | null>(() => {
        if (!slot || !slot.data) return null
        try {
            return JSON.parse(slot.data)
        } catch {
            // Fallback for old format (just a date string)
            return { date: slot.data, is_all_day: true }
        }
    }, [slot])

    // Initialize edit form when slot data changes
    useEffect(() => {
        if (slot && slotData) {
            setEditName(slot.name)
            setEditDate(slotData.date)
            setEditEndDate(slotData.end_date || '')
            setEditStartTime(slotData.start_time || '')
            setEditEndTime(slotData.end_time || '')
            setEditIsAllDay(slotData.is_all_day !== false)
            setEditColor(slotData.color || '')
        }
    }, [slot, slotData])

    const handleBack = () => {
        navigate(`/workspaces/${workspaceId}/calendar/${viewId}`)
    }

    const handleEdit = () => {
        setIsEditing(true)
    }

    const handleCancelEdit = () => {
        setIsEditing(false)
        // Reset form to original values
        if (slot && slotData) {
            setEditName(slot.name)
            setEditDate(slotData.date)
            setEditEndDate(slotData.end_date || '')
            setEditStartTime(slotData.start_time || '')
            setEditEndTime(slotData.end_time || '')
            setEditIsAllDay(slotData.is_all_day !== false)
            setEditColor(slotData.color || '')
        }
    }

    const handleSave = () => {
        const updatedData: CalendarSlotData = {
            date: editDate,
            is_all_day: editIsAllDay
        }
        if (editEndDate) {
            updatedData.end_date = editEndDate
        }
        if (!editIsAllDay && editStartTime) {
            updatedData.start_time = editStartTime
        }
        if (!editIsAllDay && editEndTime) {
            updatedData.end_time = editEndTime
        }
        if (editColor) {
            updatedData.color = editColor
        }

        updateMutation.mutate({
            name: editName,
            data: JSON.stringify(updatedData)
        })
    }

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-muted-foreground">{t('common.loading')}</div>
            </div>
        )
    }

    if (!slot) {
        return (
            <div className="h-full flex flex-col items-center justify-center">
                <div className="text-muted-foreground mb-4">{t('views.objectNotFound')}</div>
                <button
                    onClick={handleBack}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                    {t('common.back')}
                </button>
            </div>
        )
    }

    return (
        <div className="h-full overflow-y-auto bg-neutral-100 dark:bg-neutral-900">
            {!isEditing && (
                <div className="p-4 border-b dark:border-neutral-700">
                    <button
                        onClick={handleBack}
                        className="flex items-center gap-2 text-muted-foreground hover:text-gray-900 dark:hover:text-gray-200 mb-3"
                    >
                        <ArrowLeft size={16} />
                        {view.name}
                    </button>

                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <div className="text-xl font-semibold">{slot.name}</div>
                            <div className="text-sm text-muted-foreground mt-1">
                                {t('views.calendarSlot')}
                            </div>
                            {slotData && (
                                <div className="mt-3 space-y-2">
                                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                                        <Clock size={14} className="mt-0.5" />
                                        <div>
                                            {slotData.end_date ? (
                                                // Multi-day: show start and end on separate lines
                                                <>
                                                    <div>
                                                        {new Date(slotData.date).toLocaleDateString()}
                                                        {!slotData.is_all_day && slotData.start_time && ` ${slotData.start_time}`}
                                                    </div>
                                                    <div>
                                                        {new Date(slotData.end_date).toLocaleDateString()}
                                                        {!slotData.is_all_day && slotData.end_time && ` ${slotData.end_time}`}
                                                    </div>
                                                </>
                                            ) : (
                                                // Single day: show date with time range
                                                <div>
                                                    {new Date(slotData.date).toLocaleDateString()}
                                                    {!slotData.is_all_day && slotData.start_time && ` ${slotData.start_time}`}
                                                    {!slotData.is_all_day && slotData.end_time && ` - ${slotData.end_time}`}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {slotData.is_all_day && (
                                        <div className="inline-block px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded">
                                            {t('views.allDay') || 'All day'}
                                        </div>
                                    )}
                                    {slotData.color && (
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <div
                                                className="w-4 h-4 rounded border border-gray-300"
                                                style={{ backgroundColor: slotData.color }}
                                            />
                                            <span>{slotData.color}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleEdit}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                                title={t('actions.edit')}
                            >
                                <Edit2 size={20} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isEditing && (
                <div className="p-4 border-b dark:border-neutral-700">
                    <button
                        onClick={handleBack}
                        className="flex items-center gap-2 text-muted-foreground hover:text-gray-900 dark:hover:text-gray-200 mb-3"
                    >
                        <ArrowLeft size={16} />
                        {view.name}
                    </button>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between mb-4">
                            <div className="text-xl font-semibold">{t('actions.edit')}</div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleCancelEdit}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                                    title={t('common.cancel')}
                                    disabled={updateMutation.isPending}
                                >
                                    <X size={20} />
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                                    title={t('common.save')}
                                    disabled={updateMutation.isPending}
                                >
                                    <Check size={20} />
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">
                                {t('views.slotName')}
                            </label>
                            <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border dark:border-neutral-600 bg-white dark:bg-neutral-800"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    {t('views.startDate') || 'Start date'}
                                </label>
                                <input
                                    type="date"
                                    value={editDate}
                                    onChange={(e) => setEditDate(e.target.value)}
                                    className="w-full px-4 py-2 rounded-lg border dark:border-neutral-600 bg-white dark:bg-neutral-800"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    {t('views.endDate') || 'End date'} ({t('common.optional') || 'Optional'})
                                </label>
                                <input
                                    type="date"
                                    value={editEndDate}
                                    onChange={(e) => setEditEndDate(e.target.value)}
                                    className="w-full px-4 py-2 rounded-lg border dark:border-neutral-600 bg-white dark:bg-neutral-800"
                                    min={editDate}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={editIsAllDay}
                                    onChange={(e) => setEditIsAllDay(e.target.checked)}
                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm font-medium">
                                    {t('views.allDay') || 'All day'}
                                </span>
                            </label>
                        </div>

                        {!editIsAllDay && (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        {t('views.startTime') || 'Start time'}
                                    </label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-2][0-9]:[0-5][0-9]"
                                        placeholder="HH:mm"
                                        value={editStartTime}
                                        onChange={(e) => setEditStartTime(e.target.value)}
                                        className="w-full px-4 py-2 rounded-lg border"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        {t('views.endTime') || 'End time'}
                                    </label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-2][0-9]:[0-5][0-9]"
                                        placeholder="HH:mm"
                                        value={editEndTime}
                                        onChange={(e) => setEditEndTime(e.target.value)}
                                        className="w-full px-4 py-2 rounded-lg border"
                                    />
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium mb-2">
                                {t('views.color') || 'Color'} ({t('common.optional') || 'Optional'})
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="color"
                                    value={editColor || '#3B82F6'}
                                    onChange={(e) => setEditColor(e.target.value)}
                                    className="w-20 h-10 rounded-lg border dark:border-neutral-600 cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={editColor}
                                    onChange={(e) => setEditColor(e.target.value)}
                                    placeholder="#3B82F6"
                                    className="flex-1 px-4 py-2 rounded-lg border dark:border-neutral-600 bg-white dark:bg-neutral-800"
                                />
                                {editColor && (
                                    <button
                                        type="button"
                                        onClick={() => setEditColor('')}
                                        className="px-4 py-2 border dark:border-neutral-600 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
                                    >
                                        {t('common.clear') || 'Clear'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    )
}

export default CalendarSlotDetail
