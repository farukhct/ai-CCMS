/**
 * CCMS Date Utility Services
 * Enforces DD-MM-YYYY display format and ISO 8601 (YYYY-MM-DD) canonical storage.
 * Avoids timezone drift by working directly on calendar date parts.
 */

/**
 * Checks if a day, month, and year form a mathematically valid calendar date.
 * Rejects leap year discrepancies (e.g., 29-02-2025) and invalid dates (e.g., 31-04-2026, 31-02-2026).
 */
export function isValidCalendarDate(day: number, month: number, year: number): boolean {
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1) return false;

  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1];
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Normalizes an arbitrary valid date input to canonical ISO format: YYYY-MM-DD
 * Returns empty string if invalid or empty.
 */
export function toCanonicalDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  if (!trimmed) return '';

  // Case 1: YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    if (isValidCalendarDate(day, month, year)) {
      return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    }
    return '';
  }

  // Case 2: DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    if (isValidCalendarDate(day, month, year)) {
      return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    }
    return '';
  }

  return '';
}

/**
 * Formats canonical YYYY-MM-DD (or any valid date string) to display format: DD-MM-YYYY
 * Returns '-' or empty string if date is empty or invalid.
 */
export function toDisplayDate(isoDateStr: string | null | undefined, fallback = '-'): string {
  if (!isoDateStr) return fallback;
  const canonical = toCanonicalDate(isoDateStr);
  if (!canonical) return fallback;

  const [year, month, day] = canonical.split('-');
  return `${day}-${month}-${year}`;
}

/**
 * Formats Date object to DD-MM-YYYY
 */
export function formatCurrentDateDDMMYYYY(): string {
  const now = new Date();
  const day = now.getDate().toString().padStart(2, '0');
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const year = now.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Formats Date object to YYYY-MM-DD
 */
export function formatCurrentDateISO(): string {
  const now = new Date();
  const day = now.getDate().toString().padStart(2, '0');
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const year = now.getFullYear();
  return `${year}-${month}-${day}`;
}

/**
 * Formats ISO timestamp to DD-MM-YYYY HH:mm:ss for audit log and report footers
 */
export function formatTimestampDisplay(isoString: string | null | undefined): string {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const seconds = d.getSeconds().toString().padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
  } catch {
    return isoString;
  }
}
