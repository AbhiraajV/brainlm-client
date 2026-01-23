/**
 * Cache Utilities for Offline-First Architecture
 *
 * Safe localStorage wrapper and utility functions for caching.
 */

// Safe localStorage wrapper that handles SSR and errors gracefully
export const safeStorage = {
  getItem: (name: string): string | null => {
    try {
      if (typeof window === 'undefined') return null
      return localStorage.getItem(name)
    } catch {
      console.warn('Failed to read from localStorage')
      return null
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      if (typeof window === 'undefined') return
      localStorage.setItem(name, value)
    } catch (e) {
      // Handle quota exceeded error
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded, attempting cleanup...')
        // Trigger LRU eviction via event (handled by stores)
        window.dispatchEvent(new CustomEvent('storage-quota-exceeded'))
      } else {
        console.warn('Failed to write to localStorage')
      }
    }
  },
  removeItem: (name: string): void => {
    try {
      if (typeof window === 'undefined') return
      localStorage.removeItem(name)
    } catch {
      console.warn('Failed to remove from localStorage')
    }
  },
}

// Check if a timestamp is stale (older than threshold)
export function isStale(lastFetchedAt: string | null, thresholdMs: number = 24 * 60 * 60 * 1000): boolean {
  if (!lastFetchedAt) return true
  const lastFetched = new Date(lastFetchedAt).getTime()
  return Date.now() - lastFetched > thresholdMs
}

/**
 * Check if data was fetched today (in user's local timezone).
 * Daily data is fresh until midnight, then stale.
 */
export function isFetchedToday(lastFetchedAt: string | null): boolean {
  if (!lastFetchedAt) return false

  const lastFetched = new Date(lastFetchedAt)
  const now = new Date()

  // Compare year, month, and day in local timezone
  return (
    lastFetched.getFullYear() === now.getFullYear() &&
    lastFetched.getMonth() === now.getMonth() &&
    lastFetched.getDate() === now.getDate()
  )
}

// Check if an event is recent (less than 1 day old)
export function isRecentEvent(createdAt: string | Date): boolean {
  const created = typeof createdAt === 'string' ? new Date(createdAt).getTime() : createdAt.getTime()
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
  return created > oneDayAgo
}

// Generate a unique temporary ID for optimistic updates
export function generateTempId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `temp_${crypto.randomUUID()}`
  }
  // Fallback for older environments
  return `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

// Constants for cache management
export const CACHE_CONSTANTS = {
  MAX_EVENTS: 200,           // Maximum events to keep in cache
  MAX_ANALYSIS: 200,         // Maximum analysis entries to keep
  STALE_THRESHOLD_MS: 24 * 60 * 60 * 1000,  // 24 hours
  DAILY_STALE_THRESHOLD_MS: 24 * 60 * 60 * 1000,  // Daily data stays fresh for 24 hours
  RECENT_EVENT_THRESHOLD_MS: 24 * 60 * 60 * 1000,  // 1 day for polling
  ANALYSIS_POLL_TIMEOUT_MS: 150_000,  // 2.5 minutes
} as const

// LRU eviction helper - returns items to keep after removing oldest
export function evictOldest<T extends { createdAt: string }>(
  items: T[],
  maxItems: number
): T[] {
  if (items.length <= maxItems) return items

  // Sort by createdAt descending (newest first)
  const sorted = [...items].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  // Keep only the newest maxItems
  return sorted.slice(0, maxItems)
}

// Check if a string looks like a temp ID
export function isTempId(id: string): boolean {
  return id.startsWith('temp_')
}

/**
 * Synchronously read cached data from localStorage.
 * Use this for instant cache-first rendering before React hydration.
 * Returns null if no valid cache exists or on SSR.
 */
export function readCacheSync<T>(storageKey: string): T | null {
  try {
    if (typeof window === 'undefined') return null
    const raw = localStorage.getItem(storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Zustand persist wraps data in { state: {...}, version: number }
    return parsed?.state ?? null
  } catch {
    return null
  }
}

/**
 * Check if cached data is fresh (not stale).
 * Works with Zustand persist format.
 */
export function isCacheFresh(
  storageKey: string,
  lastFetchedAtKey: string,
  thresholdMs: number = CACHE_CONSTANTS.STALE_THRESHOLD_MS
): boolean {
  const cache = readCacheSync<Record<string, unknown>>(storageKey)
  if (!cache) return false
  const lastFetchedAt = cache[lastFetchedAtKey] as string | null
  return !isStale(lastFetchedAt, thresholdMs)
}
