/**
 * Builds the concrete start and end Date objects from a form's date/time fields.
 * If endTime is on or before startTime, the shift is treated as overnight and the
 * end is bumped to the next calendar day (+ 24 h).
 */
export function buildShiftDates(
    date: string,  // "YYYY-MM-DD"
    start: string, // "HH:mm"
    end: string,   // "HH:mm"
): { startDate: Date; endDate: Date } {
    const startDate = new Date(`${date}T${start}:00`);
    let endDate = new Date(`${date}T${end}:00`);
    if (endDate <= startDate) {
        endDate = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
    }
    return { startDate, endDate };
}
