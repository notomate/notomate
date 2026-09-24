import { useTranslation } from "react-i18next"
import { Calendar, Trash2, MoreVertical, Plus, Search, X } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useState } from "react"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import CreateViewObjectModal from "../CreateViewObjectModal"

interface CalendarSlotsListProps {
    slots: any[]
    workspaceId: string
    calendarId: string
    focusedSlotId?: string
    onDelete: (slotId: string) => void
    isDeleting?: boolean
    onCreateClick?: () => void
    // New props for inline creation
    isCreating?: boolean
    setIsCreating?: (value: boolean) => void
    handleCloseModal?: () => void
    newObjectName?: string
    setNewObjectName?: (value: string) => void
    newObjectData?: string
    setNewObjectData?: (value: string) => void
    handleCreate?: () => void
    createMutation?: any
}

const CalendarSlotsList = ({
    slots,
    workspaceId,
    calendarId,
    focusedSlotId,
    onDelete,
    isDeleting,
    onCreateClick,
    isCreating = false,
    setIsCreating,
    handleCloseModal,
    newObjectName = "",
    setNewObjectName,
    newObjectData = "",
    setNewObjectData,
    handleCreate,
    createMutation
}: CalendarSlotsListProps) => {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const [searchQuery, setSearchQuery] = useState("")

    const handleSlotClick = (slotId: string) => {
        navigate(`/workspaces/${workspaceId}/calendar/${calendarId}/slot/${slotId}`)
    }

    const filteredSlots = slots.filter((slot) => {
        if (!searchQuery.trim()) return true
        return slot.name.toLowerCase().includes(searchQuery.toLowerCase())
    })

    // Group slots by date
    const groupedSlots = filteredSlots.reduce((acc, slot) => {
        try {
            // Parse slot data - could be JSON or plain date string
            let slotDate: string
            try {
                const parsed = JSON.parse(slot.data)
                slotDate = parsed.date
            } catch {
                // Fallback for old format (just a date string)
                slotDate = slot.data
            }
            const date = new Date(slotDate).toLocaleDateString()
            if (!acc[date]) {
                acc[date] = []
            }
            acc[date].push(slot)
        } catch (e) {
            console.error('Failed to parse slot date:', e)
        }
        return acc
    }, {} as Record<string, any[]>)

    // Sort dates
    const sortedDates = Object.keys(groupedSlots).sort((a, b) =>
        new Date(a).getTime() - new Date(b).getTime()
    )

    return (
        <div className="overflow-y-auto bg-neutral-100 dark:bg-neutral-900">
            <div className="p-4">
                {!isCreating ? (
                    <>
                        <div className="flex items-center justify-between mb-4">
                            <div className="text-lg font-semibold">{t('views.calendarSlots')}</div>
                            {(onCreateClick || setIsCreating) && (
                                <button
                                    onClick={() => {
                                        if (onCreateClick) onCreateClick()
                                        if (setIsCreating) setIsCreating(true)
                                    }}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                    title={t('views.createSlot')}
                                >
                                    <Plus size={20} />
                                </button>
                            )}
                        </div>

                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
                            <input
                                type="text"
                                placeholder={t('views.searchSlots')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {filteredSlots.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                {searchQuery.trim() ? t('views.noSlotsFound') : t('views.noSlots')}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {sortedDates.map((date) => (
                                    <div key={date}>
                                        <div className="text-sm font-medium text-muted-foreground mb-2">{date}</div>
                                        <div className="space-y-2">
                                            {groupedSlots[date].map((slot: any) => {
                                                const isFocused = slot.id === focusedSlotId

                                                return (
                                                    <div
                                                        key={slot.id}
                                                        className={`p-3 rounded-lg border transition-colors cursor-pointer ${isFocused
                                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                                            : 'border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                                                            }`}
                                                        onClick={() => handleSlotClick(slot.id)}
                                                    >
                                                        <div className="flex items-start justify-between">
                                                            <div className="flex items-start gap-2 flex-1 min-w-0">
                                                                <Calendar size={16} className="text-muted-foreground flex-shrink-0 mt-0.5" />
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="font-medium truncate">{slot.name}</div>
                                                                </div>
                                                            </div>
                                                            <div onClick={(e) => e.stopPropagation()}>
                                                                <DropdownMenu.Root>
                                                                    <DropdownMenu.Trigger asChild>
                                                                        <button
                                                                            className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
                                                                        >
                                                                            <MoreVertical size={16} />
                                                                        </button>
                                                                    </DropdownMenu.Trigger>
                                                                    <DropdownMenu.Portal>
                                                                        <DropdownMenu.Content
                                                                            className="min-w-[160px] bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 p-1 z-50"
                                                                            sideOffset={5}
                                                                        >
                                                                            <DropdownMenu.Item
                                                                                className="flex items-center gap-2 px-3 py-2 text-sm rounded cursor-pointer outline-none text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                                                onSelect={(e) => {
                                                                                    e.preventDefault()
                                                                                    onDelete(slot.id)
                                                                                }}
                                                                                disabled={isDeleting}
                                                                            >
                                                                                <Trash2 size={14} />
                                                                                {t('actions.delete')}
                                                                            </DropdownMenu.Item>
                                                                        </DropdownMenu.Content>
                                                                    </DropdownMenu.Portal>
                                                                </DropdownMenu.Root>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                ) : (
                    /* Create Slot Interface */
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <div className="text-lg font-semibold">
                                {t('views.createSlot')}
                            </div>
                            <button
                                onClick={() => {
                                    if (handleCloseModal) handleCloseModal()
                                    if (setIsCreating) setIsCreating(false)
                                }}
                                className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <CreateViewObjectModal
                            open={isCreating}
                            onOpenChange={(open) => {
                                if (!open) {
                                    if (handleCloseModal) handleCloseModal()
                                    if (setIsCreating) setIsCreating(false)
                                }
                            }}
                            viewType="calendar"
                            name={newObjectName}
                            setName={setNewObjectName || (() => { })}
                            data={newObjectData}
                            setData={setNewObjectData || (() => { })}
                            onSubmit={handleCreate || (() => { })}
                            isSubmitting={createMutation?.isPending || false}
                            inline={true}
                        />
                    </div>
                )}
            </div>
        </div>
    )
}

export default CalendarSlotsList
