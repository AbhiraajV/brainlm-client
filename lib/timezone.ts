/**
 * Timezone utilities for handling date boundaries in user's local timezone.
 *
 * The key insight: JavaScript Date objects store UTC internally, but when we need
 * "today" or "yesterday" we mean in the USER's timezone, not UTC. This module
 * computes the correct UTC boundaries for local day ranges.
 */

/**
 * Get the user's timezone from the browser.
 */
export function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/**
 * Get the start and end of a local day as UTC Date objects.
 *
 * @param timezone - IANA timezone string (e.g., 'America/Los_Angeles')
 * @param daysAgo - 0 for today, 1 for yesterday, etc.
 * @returns UTC Date objects representing the boundaries of the local day
 *
 * Example: If user is in PST (UTC-8) and it's Jan 15:
 * - Local day starts at Jan 15 00:00 PST = Jan 15 08:00 UTC
 * - Local day ends at Jan 16 00:00 PST = Jan 16 08:00 UTC
 */
export function getLocalDayBoundaries(
  timezone: string,
  daysAgo: number = 0
): { start: Date; end: Date } {
  const now = new Date()

  // Get the current date parts in the user's timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  // Adjust for daysAgo by subtracting days from current timestamp
  const targetTimestamp = now.getTime() - daysAgo * 24 * 60 * 60 * 1000
  const targetDate = new Date(targetTimestamp)
  const localDateStr = formatter.format(targetDate) // "YYYY-MM-DD"

  // Parse the date parts
  const [year, month, day] = localDateStr.split('-').map(Number)

  // Create start of day in local timezone using the timezone-aware constructor approach
  const start = getUTCForLocalMidnight(year, month, day, timezone)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)

  return { start, end }
}

/**
 * Get the UTC timestamp for midnight on a specific date in a specific timezone.
 * This is the core function that handles timezone conversion correctly.
 */
function getUTCForLocalMidnight(year: number, month: number, day: number, timezone: string): Date {
  // Create a date string that we'll interpret in the target timezone
  // Format: "YYYY-MM-DDTHH:mm:ss" (no Z suffix - will be interpreted as local)
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00`

  // Use Intl.DateTimeFormat to find the offset at this time in this timezone
  // We do this by creating a reference date and comparing its display in UTC vs local

  // Start with a guess: interpret the date as UTC
  const guessUTC = new Date(dateStr + 'Z')

  // Format this UTC time in both UTC and the target timezone
  const utcFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', hour12: false
  })
  const localFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', hour12: false
  })

  // Parse the formatted strings to extract components
  const utcParts = parseDateTimeParts(utcFormatter.formatToParts(guessUTC))
  const localParts = parseDateTimeParts(localFormatter.formatToParts(guessUTC))

  // Calculate offset in minutes (local - UTC)
  const utcTotalMinutes = toTotalMinutes(utcParts)
  const localTotalMinutes = toTotalMinutes(localParts)
  const offsetMinutes = localTotalMinutes - utcTotalMinutes

  // The actual UTC time is: guessUTC - offset
  // Because: localTime = UTC + offset, so UTC = localTime - offset
  // And we want: when localTime shows midnight, what is UTC?
  // guessUTC shows midnight in UTC, but we want midnight in local
  // So: targetUTC = guessUTC - offset
  return new Date(guessUTC.getTime() - offsetMinutes * 60 * 1000)
}

function parseDateTimeParts(parts: Intl.DateTimeFormatPart[]): { year: number; month: number; day: number; hour: number; minute: number } {
  const get = (type: string) => {
    const part = parts.find(p => p.type === type)
    return part ? parseInt(part.value, 10) : 0
  }
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute')
  }
}

function toTotalMinutes(parts: { year: number; month: number; day: number; hour: number; minute: number }): number {
  // Convert to a comparable number (minutes since year start, roughly)
  // This works for comparing times within the same ~month window
  return parts.month * 31 * 24 * 60 + parts.day * 24 * 60 + parts.hour * 60 + parts.minute
}

/**
 * Get the start of a local week (Sunday) as a UTC Date object.
 */
export function getLocalWeekStart(timezone: string): Date {
  const now = new Date()

  // Get current day of week in local timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  })
  const dayName = formatter.format(now)
  const dayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(dayName)

  // Get the Sunday of this week
  const { start } = getLocalDayBoundaries(timezone, dayIndex)
  return start
}

/**
 * Get the start of the current local month as a UTC Date object.
 */
export function getLocalMonthStart(timezone: string): Date {
  const now = new Date()

  // Format to get year and month in user's timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
  })

  const parts = formatter.formatToParts(now)
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '2025', 10)
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '1', 10)

  return getUTCForLocalMidnight(year, month, 1, timezone)
}

/**
 * Get the current time in the user's timezone as an ISO string.
 * This captures the moment of creation accurately.
 */
export function getNowISOString(): string {
  return new Date().toISOString()
}
