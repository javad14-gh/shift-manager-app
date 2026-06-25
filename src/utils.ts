import { subDays } from 'date-fns';

/**
 * Returns the "business date" for operations that span past midnight.
 * If the current time is before the cut-off hour (e.g., 6 AM),
 * it returns the previous day's date.
 * @param date The date to check. Defaults to now.
 * @param cutoffHour The hour (0-23) to use as the cut-off. Defaults to 6.
 * @returns {Date} The calculated business date.
 */
export function getBusinessDate(date: Date = new Date(), cutoffHour: number = 6): Date {
  const now = new Date(date);
  
  if (now.getHours() < cutoffHour) {
    return subDays(now, 1);
  }
  
  return now;
}

/**
 * Helper to combine a date and a time string (HH:mm) into a Date object, respecting the target timezone (Turkey UTC+3)
 */
export const combineDateAndTime = (date: Date, timeString: string): Date | undefined => {
    if (!timeString) return undefined;
    const [hours, minutes] = timeString.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return undefined;

    // 1. Create a local date object with the desired time.
    const localDate = new Date(date);
    localDate.setHours(hours, minutes, 0, 0);

    // 2. Get the timezone offset for that specific local date in minutes.
    const localOffsetInMinutes = localDate.getTimezoneOffset();

    // 3. The offset for Turkey (UTC+3) is -180 minutes.
    const turkeyOffsetInMinutes = -180;

    // 4. Calculate the difference between the local offset and Turkey's offset.
    const offsetDifference = localOffsetInMinutes - turkeyOffsetInMinutes;

    // 5. Add this difference back to the local date to get the correct UTC time
    // that will represent the intended Turkey time.
    const turkeyDate = new Date(localDate.getTime() + offsetDifference * 60 * 1000);

    return turkeyDate;
};
