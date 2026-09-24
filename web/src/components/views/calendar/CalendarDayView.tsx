import { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTwoColumn } from '@/components/twocolumn/TwoColumn'
import { useTranslation } from 'react-i18next'
import { ViewObject, CalendarSlotData } from '@/types/view'

interface CalendarDayViewProps {
    viewObjects?: ViewObject[]
    focusedObjectId?: string
    isPublic?: boolean
}

const CalendarDayView = ({ viewObjects = [], focusedObjectId, isPublic = false }: CalendarDayViewProps) => {
    const navigate = useNavigate()
    const { workspaceId, calendarId } = useParams<{ workspaceId?: string; calendarId: string }>()
    const { openBottomSheet } = useTwoColumn()
    const { t } = useTranslation()

    // Find the focused object's date
    const focusedDate = useMemo(() => {
        if (!focusedObjectId || !viewObjects) return null
        const focusedObj = viewObjects.find(obj => obj.id === focusedObjectId)
        if (focusedObj && focusedObj.data) {
            try {
                const data: CalendarSlotData = JSON.parse(focusedObj.data)
                const date = new Date(data.date)
                if (!isNaN(date.getTime())) {
                    return date
                }
            } catch {
                // Fallback for old format
                const date = new Date(focusedObj.data)
                if (!isNaN(date.getTime())) {
                    return date
                }
            }
        }
        return null
    }, [focusedObjectId, viewObjects])

    const [currentDate, setCurrentDate] = useState(focusedDate || new Date())

    // Update currentDate when focusedDate changes
    useEffect(() => {
        if (focusedDate) {
            setCurrentDate(focusedDate)
        }
    }, [focusedDate])

    // Generate time slots (24 hours)
    const timeSlots = Array.from({ length: 24 }, (_, i) => {
        return { hour: i }
    })

    const previousDay = () => {
        const newDate = new Date(currentDate)
        newDate.setDate(currentDate.getDate() - 1)
        setCurrentDate(newDate)
    }

    const nextDay = () => {
        const newDate = new Date(currentDate)
        newDate.setDate(currentDate.getDate() + 1)
        setCurrentDate(newDate)
    }

    const goToToday = () => {
        setCurrentDate(new Date())
    }

    // Parse slot data
    const parseSlotData = (dataStr: string): CalendarSlotData | null => {
        try {
            return JSON.parse(dataStr)
        } catch {
            // Fallback for old format (just a date string)
            return { date: dataStr, is_all_day: true }
        }
    }

    // Check if a date falls within a slot's date range
    const isDateInSlotRange = (checkDate: Date, slotData: CalendarSlotData) => {
        const dateStr = checkDate.toISOString().split('T')[0]

        // If no end_date, only match the exact start date
        if (!slotData.end_date) {
            return slotData.date === dateStr
        }

        // If there's an end_date, check if checkDate is within the range
        const startDate = new Date(slotData.date + 'T00:00:00')
        const endDate = new Date(slotData.end_date + 'T00:00:00')
        const check = new Date(dateStr + 'T00:00:00')

        return check >= startDate && check <= endDate
    }

    // Get timed events for the current day with column positioning for overlaps
    const getTimedEvents = () => {
        const dateStr = currentDate.toISOString().split('T')[0]

        const events = viewObjects
            .filter(obj => {
                if (!obj.data) return false

                const slotData = parseSlotData(obj.data)
                if (!slotData) return false

                // Check if current day is within slot's date range
                if (!isDateInSlotRange(currentDate, slotData)) return false

                // For all-day events, don't show in timed section
                if (slotData.is_all_day || !slotData.start_time) return false

                // For multi-day events, only show as timed on first or last day
                if (slotData.end_date) {
                    const isFirstDay = slotData.date === dateStr
                    const isLastDay = slotData.end_date === dateStr

                    // Middle days should not appear in timed events
                    if (!isFirstDay && !isLastDay) return false
                }

                return true
            })
            .map(obj => {
                const slotData = parseSlotData(obj.data)!
                const dateStr = currentDate.toISOString().split('T')[0]
                const isFirstDay = slotData.date === dateStr
                const isLastDay = slotData.end_date === dateStr

                let startTotalMinutes = 0
                let endTotalMinutes = 24 * 60 // End of day

                if (slotData.end_date) {
                    // Multi-day event
                    if (isFirstDay && slotData.start_time) {
                        const [startHour, startMinute] = slotData.start_time.split(':').map(Number)
                        startTotalMinutes = startHour * 60 + startMinute
                    }
                    if (isLastDay && slotData.end_time) {
                        const [endHour, endMinute] = slotData.end_time.split(':').map(Number)
                        endTotalMinutes = endHour * 60 + endMinute
                    }
                } else {
                    // Single-day event
                    if (slotData.start_time) {
                        const [startHour, startMinute] = slotData.start_time.split(':').map(Number)
                        startTotalMinutes = startHour * 60 + startMinute
                    }
                    if (slotData.end_time) {
                        const [endHour, endMinute] = slotData.end_time.split(':').map(Number)
                        endTotalMinutes = endHour * 60 + endMinute
                    } else {
                        endTotalMinutes = startTotalMinutes + 60 // Default 1 hour
                    }
                }

                const durationMinutes = endTotalMinutes - startTotalMinutes

                return {
                    ...obj,
                    startMinutes: startTotalMinutes,
                    endMinutes: endTotalMinutes,
                    durationMinutes,
                    slotData
                }
            })

        // Sort by start time, then by duration (longer events first)
        events.sort((a, b) => {
            if (a.startMinutes !== b.startMinutes) {
                return a.startMinutes - b.startMinutes
            }
            return b.durationMinutes - a.durationMinutes
        })

        // Calculate column positions for overlapping events
        const columns: Array<{ endMinutes: number }[]> = []
        const eventPositions: Array<{ column: number; totalColumns: number }> = []

        events.forEach((event) => {
            // Find the first column where this event can fit
            let columnIndex = 0
            for (let i = 0; i < columns.length; i++) {
                const column = columns[i]
                // Check if all events in this column end before this event starts
                const canFit = column.every(e => e.endMinutes <= event.startMinutes)
                if (canFit) {
                    columnIndex = i
                    break
                }
                columnIndex = i + 1
            }

            // Create new column if needed
            if (columnIndex >= columns.length) {
                columns.push([])
            }

            // Add event to column
            columns[columnIndex].push({ endMinutes: event.endMinutes })
            eventPositions.push({ column: columnIndex, totalColumns: 0 })
        })

        // Calculate total columns for each event (for width calculation)
        events.forEach((event, index) => {
            let maxColumn = eventPositions[index].column
            // Check all events that overlap with this one
            events.forEach((other, otherIndex) => {
                if (index === otherIndex) return
                // Check if they overlap
                const overlap = !(event.endMinutes <= other.startMinutes || other.endMinutes <= event.startMinutes)
                if (overlap) {
                    maxColumn = Math.max(maxColumn, eventPositions[otherIndex].column)
                }
            })
            eventPositions[index].totalColumns = maxColumn + 1
        })

        return events.map((event, index) => ({
            ...event,
            column: eventPositions[index].column,
            totalColumns: eventPositions[index].totalColumns
        }))
    }

    // Get all-day events for the current day
    const getAllDayEvents = () => {
        const dateStr = currentDate.toISOString().split('T')[0]

        return viewObjects.filter(obj => {
            if (!obj.data) return false

            const slotData = parseSlotData(obj.data)
            if (!slotData) return false

            // Check if current day is within slot's date range
            if (!isDateInSlotRange(currentDate, slotData)) return false

            // Always all-day if marked as such or no start_time
            if (slotData.is_all_day || !slotData.start_time) return true

            // For multi-day timed events, middle days should show as all-day
            if (slotData.end_date) {
                const isFirstDay = slotData.date === dateStr
                const isLastDay = slotData.end_date === dateStr

                // Middle days appear as all-day
                if (!isFirstDay && !isLastDay) return true
            }

            return false
        })
    }

    const today = new Date()
    const isToday = currentDate.toDateString() === today.toDateString()

    const weekDayNames = Array.from({ length: 7 }, (_, i) => t(`time.weekDays.${i}`))

    const handleSlotClick = (slot: ViewObject) => {
        openBottomSheet()
        const path = isPublic
            ? `/share/calendar/${calendarId}/slot/${slot.id}`
            : `/workspaces/${workspaceId}/calendar/${calendarId}/slot/${slot.id}`
        navigate(path)
    }

    const allDayEvents = getAllDayEvents()
    const timedEvents = getTimedEvents()

    return (
        <div className="">
            <div className="mb-4">
                <div className="flex items-center justify-between px-2 mb-4">
                    <div className="text-2xl font-semibold whitespace-nowrap overflow-auto">
                        {weekDayNames[currentDate.getDay()]}, {currentDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div className="flex gap-0.5">
                        <button
                            onClick={previousDay}
                            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                            title={t('views.previousDay') || 'Previous day'}
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <button
                            onClick={goToToday}
                            className="px-4 py-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-sm font-medium"
                        >
                            {t('views.today')}
                        </button>
                        <button
                            onClick={nextDay}
                            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                            title={t('views.nextDay') || 'Next day'}
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>

                {/* Day view */}
                <div className="border dark:border-neutral-700 rounded-lg overflow-auto max-h-[calc(100dvh-140px)]">
                    {/* All-day events section */}
                    {allDayEvents.length > 0 && (
                        <div className="bg-neutral-50 dark:bg-neutral-800 border-b dark:border-neutral-700 p-3">
                            <div className="text-xs font-semibold text-muted-foreground mb-2">
                                {t('views.allDay') || 'All day'}
                            </div>
                            <div className="flex gap-1 overflow-auto">
                                {allDayEvents.map((slot) => {
                                    const slotData = parseSlotData(slot.data)
                                    const bgColor = slotData?.color || '#3B82F6'

                                    return (
                                        <button
                                            key={slot.id}
                                            onClick={() => handleSlotClick(slot)}
                                            className="text-sm px-3 py-2 text-white rounded hover:brightness-90 transition-all text-left"
                                            style={{ backgroundColor: bgColor }}
                                            title={slot.name}
                                        >
                                            {slot.name}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Time grid */}
                    <div className="overflow-y-auto overflow-x-auto relative">
                        {/* Time slot grid */}
                        {timeSlots.map(({ hour }) => {
                            const timeStr = `${hour.toString().padStart(2, '0')}:00`

                            return (
                                <div
                                    key={hour}
                                    className={`flex border-b dark:border-neutral-700 ${
                                        hour === 0 ? 'border-t-2 dark:border-t-neutral-600' : ''
                                    } ${isToday ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}
                                >
                                    <div className="w-20 p-2 text-xs font-medium text-muted-foreground border-r dark:border-neutral-700 shrink-0">
                                        {timeStr}
                                    </div>
                                    <div className="flex-1 p-2 min-h-[80px] relative">
                                        {/* Half-hour divider line */}
                                        <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-neutral-200 dark:border-neutral-700/50" />
                                    </div>
                                </div>
                            )
                        })}

                        {/* Absolutely positioned events */}
                        {timedEvents.map((event) => {
                            // Each hour slot is 80px tall (min-h-[80px]), so 30 minutes = 40px
                            const pixelsPerMinute = 80 / 60 // 80px per hour
                            const topPosition = event.startMinutes * pixelsPerMinute
                            const height = event.durationMinutes * pixelsPerMinute
                            const bgColor = event.slotData.color || '#3B82F6'

                            // Calculate width and position based on column
                            const baseLeft = 5 + 0.0625 + 0.5 // w-20 (5rem) + border (1px = 0.0625rem) + p-2 left padding (0.5rem)
                            const availableWidth = `calc(100% - ${baseLeft}rem - 0.5rem)` // Total width minus left offset and right padding
                            const columnWidth = `calc(${availableWidth} / ${event.totalColumns})`
                            const leftOffset = `calc(${baseLeft}rem + ${columnWidth} * ${event.column})`

                            return (
                                <button
                                    key={event.id}
                                    onClick={() => handleSlotClick(event)}
                                    className="absolute text-sm px-3 py-1.5 text-white rounded hover:brightness-90 transition-all text-left overflow-hidden"
                                    style={{
                                        top: `${topPosition + 8}px`, // Add p-2 (8px) top padding offset
                                        left: leftOffset,
                                        width: `calc(${columnWidth} - 4px)`,
                                        height: `${Math.max(height - 4, 24)}px`, // Slight adjustment for visual spacing, minimum 24px
                                        zIndex: 10,
                                        backgroundColor: bgColor
                                    }}
                                    title={event.name}
                                >
                                    <div className="font-medium truncate">{event.name}</div>
                                    {event.slotData.start_time && (
                                        <div className="text-xs opacity-90 truncate">
                                            {event.slotData.start_time}
                                            {event.slotData.end_time && ` - ${event.slotData.end_time}`}
                                        </div>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CalendarDayView
