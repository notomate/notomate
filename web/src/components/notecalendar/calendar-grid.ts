/** Local YYYY-MM-DD for a date, matching the calendar block's stored day. */
export const dayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

/** The six weeks (Sunday first) shown for the month that contains `month`. */
export function monthGrid(month: Date): Date[] {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay())
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
}
