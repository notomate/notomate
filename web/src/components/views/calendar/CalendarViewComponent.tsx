import { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTwoColumn } from '@/components/twocolumn/TwoColumn'
import { useTranslation } from 'react-i18next'
import { CalendarSlotData } from '@/types/view'

interface CalendarViewComponentProps {
    viewObjects?: any[]
    focusedObjectId?: string
    isPublic?: boolean
}

const CalendarViewComponent = ({ viewObjects = [], focusedObjectId, isPublic = false }: CalendarViewComponentProps) => {
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
                const slotData: CalendarSlotData = JSON.parse(focusedObj.data)
                const date = new Date(slotData.date)
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

    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    // Get the first day of the month
    const firstDayOfMonth = new Date(year, month, 1)
    const lastDayOfMonth = new Date(year, month + 1, 0)

    // Get the day of week for the first day (0 = Sunday, 1 = Monday, etc.)
    const firstDayOfWeek = firstDayOfMonth.getDay()

    // Get total days in month
    const daysInMonth = lastDayOfMonth.getDate()

    // Generate calendar days with previous/next month dates
    const calendarDays: Array<{ day: number; isCurrentMonth: boolean; year: number; month: number }> = []

    // Add days from previous month
    const prevMonthLastDay = new Date(year, month, 0).getDate()
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
        const prevMonth = month === 0 ? 11 : month - 1
        const prevYear = month === 0 ? year - 1 : year
        calendarDays.push({
            day: prevMonthLastDay - i,
            isCurrentMonth: false,
            year: prevYear,
            month: prevMonth
        })
    }

    // Add all days of the current month
    for (let day = 1; day <= daysInMonth; day++) {
        calendarDays.push({
            day,
            isCurrentMonth: true,
            year,
            month
        })
    }

    // Add days from next month to complete the grid
    const remainingCells = 7 - (calendarDays.length % 7)
    if (remainingCells < 7) {
        const nextMonth = month === 11 ? 0 : month + 1
        const nextYear = month === 11 ? year + 1 : year
        for (let day = 1; day <= remainingCells; day++) {
            calendarDays.push({
                day,
                isCurrentMonth: false,
                year: nextYear,
                month: nextMonth
            })
        }
    }

    const monthNames = Array.from({ length: 12 }, (_, i) => t(`time.monthsFull.${i}`))
    const weekDays = Array.from({ length: 7 }, (_, i) => t(`time.weekDays.${i}`))

    const previousMonth = () => {
        setCurrentDate(new Date(year, month - 1, 1))
    }

    const nextMonth = () => {
        setCurrentDate(new Date(year, month + 1, 1))
    }

    const today = new Date()
    const isToday = (dayObj: { day: number; isCurrentMonth: boolean; year: number; month: number }) => {
        return (
            dayObj.day === today.getDate() &&
            dayObj.month === today.getMonth() &&
            dayObj.year === today.getFullYear()
        )
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

    // Parse date string (YYYY-MM-DD) to avoid timezone issues
    const parseDate = (dateStr: string) => {
        const parts = dateStr.split('-')
        if (parts.length !== 3) return null

        const year = parseInt(parts[0], 10)
        const month = parseInt(parts[1], 10) - 1 // Month is 0-indexed
        const day = parseInt(parts[2], 10)

        if (isNaN(year) || isNaN(month) || isNaN(day)) return null

        return { year, month, day }
    }

    // Check if a date falls within a slot's date range
    const isDateInSlotRange = (dayObj: { day: number; month: number; year: number }, slotData: CalendarSlotData) => {
        const startParsed = parseDate(slotData.date)
        if (!startParsed) return false

        const startDate = new Date(startParsed.year, startParsed.month, startParsed.day)
        const checkDate = new Date(dayObj.year, dayObj.month, dayObj.day)

        // If no end_date, only match the exact start date
        if (!slotData.end_date) {
            return (
                startParsed.day === dayObj.day &&
                startParsed.month === dayObj.month &&
                startParsed.year === dayObj.year
            )
        }

        // If there's an end_date, check if checkDate is within the range
        const endParsed = parseDate(slotData.end_date)
        if (!endParsed) return false

        const endDate = new Date(endParsed.year, endParsed.month, endParsed.day)

        return checkDate >= startDate && checkDate <= endDate
    }

    // Get slots for a specific day (only for current month)
    const getSlotsForDay = (dayObj: { day: number; isCurrentMonth: boolean; year: number; month: number }) => {
        // Don't show slots for previous/next month days
        if (!dayObj.isCurrentMonth || !viewObjects) return []

        return viewObjects.filter(obj => {
            if (!obj.data) return false

            const slotData = parseSlotData(obj.data)
            if (!slotData) return false

            return isDateInSlotRange(dayObj, slotData)
        })
    }

    // Split calendar days into weeks
    const calendarWeeks: Array<Array<{ day: number; isCurrentMonth: boolean; year: number; month: number }>> = []
    for (let i = 0; i < calendarDays.length; i += 7) {
        calendarWeeks.push(calendarDays.slice(i, i + 7))
    }

    return (
        <div className="xl:pl-6">
            <div className="mb-6">
                <div className="flex items-center justify-between px-2">
                    <div className="text-2xl font-semibold">
                        {monthNames[month]} {year}
                    </div>
                    <div className="flex gap-0.5">
                        <button
                            onClick={previousMonth}
                            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                            title={t('views.previousMonth')}
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <button
                            onClick={() => setCurrentDate(new Date())}
                            className="px-4 py-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-sm font-medium"
                        >
                            {t('views.today')}
                        </button>
                        <button
                            onClick={nextMonth}
                            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                            title={t('views.nextMonth')}
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>

                {/* Calendar Grid */}
                <div className="border dark:border-neutral-700 rounded-lg overflow-hidden">
                    {/* Week day headers */}
                    <div className="grid grid-cols-7 bg-neutral-50 dark:bg-neutral-800 border-b dark:border-neutral-700">
                        {weekDays.map((day) => (
                            <div
                                key={day}
                                className="text-center font-semibold text-sm py-2 text-muted-foreground"
                            >
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Calendar weeks */}
                    {calendarWeeks.map((weekDays, weekIndex) => {
                        return (
                            <div key={weekIndex} className="border-b dark:border-neutral-700 last:border-b-0">
                                {/* Day cells row */}
                                <div className="grid grid-cols-7">
                                    {weekDays.map((dayObj, dayIndex) => {
                                        const isTodayCell = isToday(dayObj)
                                        const daySlots = getSlotsForDay(dayObj)

                                        return (
                                            <div
                                                key={dayIndex}
                                                className={`
                                                    aspect-square p-0.5 border-r dark:border-neutral-700 last:border-r-0 overflow-y-auto
                                                    ${isTodayCell ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-white dark:bg-neutral-900'}
                                                    ${dayObj.isCurrentMonth ? 'hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer' : ''}
                                                    transition-colors
                                                `}
                                            >
                                                <div className={`
                                                    text-sm font-medium mb-1
                                                    ${isTodayCell ? 'text-blue-600 dark:text-blue-400' : ''}
                                                    ${dayObj.isCurrentMonth ? 'text-gray-700 dark:text-gray-300' : 'text-muted-foreground'}
                                                `}>
                                                    {dayObj.day}
                                                </div>

                                                {/* Slots for this day */}
                                                <div className="space-y-1">
                                                    {daySlots.map((slot) => {
                                                        const slotData = parseSlotData(slot.data)
                                                        const bgColor = slotData?.color || '#3B82F6'

                                                        return (
                                                            <button
                                                                key={slot.id}
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    openBottomSheet()
                                                                    const path = isPublic
                                                                        ? `/share/calendar/${calendarId}/slot/${slot.id}`
                                                                        : `/workspaces/${workspaceId}/calendar/${calendarId}/slot/${slot.id}`
                                                                    navigate(path)
                                                                }}
                                                                className="w-full text-left text-xs px-2 py-1 text-white rounded truncate hover:brightness-90 transition-all block"
                                                                style={{
                                                                    backgroundColor: bgColor,
                                                                }}
                                                                title={slot.name}
                                                            >
                                                                {slot.name}
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

        </div>
    )
}

export default CalendarViewComponent