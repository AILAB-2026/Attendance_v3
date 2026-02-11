import { format } from 'date-fns';

// Accepts numbers (ms or seconds), ISO strings, or Date objects.
// Returns formatted string or "--" if invalid.
export function safeFormatDate(
  input: number | string | Date | null | undefined,
  pattern: string = 'MMM d, yyyy'
): string {
  if (input === null || input === undefined) return '--';

  let d: Date;
  if (input instanceof Date) {
    d = input;
  } else if (typeof input === 'number') {
    const ms = input < 1e12 ? input * 1000 : input; // treat values < 1e12 as seconds
    d = new Date(ms);
  } else if (typeof input === 'string') {
    // If numeric string, parse as number first
    const num = Number(input);
    if (!Number.isNaN(num) && input.trim() !== '') {
      const ms = num < 1e12 ? num * 1000 : num;
      d = new Date(ms);
    } else {
      d = new Date(input);
    }
  } else {
    return '--';
  }

  if (Number.isNaN(d.getTime())) return '--';

  try {
    return format(d, pattern);
  } catch {
    return '--';
  }
}

/**
 * Formats a Date object as YYYY-MM-DD in local timezone.
 * This avoids timezone conversion issues that occur with toISOString().
 * 
 * @param date - The date to format
 * @returns Date string in YYYY-MM-DD format
 */
export function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses a YYYY-MM-DD date string as a Date object in local timezone.
 * This avoids timezone conversion issues that occur with new Date(dateString).
 * 
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Date object in local timezone
 */
export function parseDateLocal(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}
