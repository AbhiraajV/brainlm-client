import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { safeStorage, generateTempId, CACHE_CONSTANTS, isTempId } from '@/lib/cache-utils'

const STORAGE_KEY = 'brainlm:events-cache'
const STORAGE_VERSION = 1

// Types for cached events
export interface CachedEvent {
  id: string
  content: string
  createdAt: string
  occurredAt: string | null
  trackedType?: string | null
}

export interface PendingEvent {
  tempId: string
  content: string
  createdAt: string  // Client timestamp for display order
  occurredAt: string | null
  status: 'pending' | 'synced' | 'failed'
  error?: string
}

// Track what date ranges have been fetched
export interface FetchedRange {
  from: string | null  // null means unbounded (beginning of time)
  to: string | null    // null means unbounded (now)
}

interface EventsCacheState {
  // All events by ID (max 200, LRU eviction)
  events: Record<string, CachedEvent>
  // Ordered event IDs (newest first) for display
  eventIds: string[]
  // Optimistic pending events
  pendingEvents: Record<string, PendingEvent>
  // Tracking
  lastFetchedAt: string | null
  oldestCursor: string | null  // For "load more"
  hasMore: boolean
  // Track fetched date ranges for progressive caching
  fetchedRanges: FetchedRange[]
}

interface EventsCacheActions {
  // Optimistic operations
  addPendingEvent: (content: string, occurredAt?: Date) => string
  confirmEvent: (tempId: string, serverEvent: CachedEvent) => void
  markFailed: (tempId: string, error: string) => void
  retryPendingEvent: (tempId: string) => PendingEvent | null

  // Cache operations
  setEvents: (events: CachedEvent[], nextCursor?: string, hasMore?: boolean) => void
  appendOlderEvents: (events: CachedEvent[], nextCursor?: string, hasMore?: boolean) => void
  prependNewerEvents: (events: CachedEvent[]) => void
  mergeEvents: (events: CachedEvent[]) => void
  updateEvent: (id: string, updates: Partial<CachedEvent>) => void
  removeEvent: (id: string) => void

  // Range tracking for progressive caching
  addFetchedRange: (from: string | null, to: string | null) => void
  isRangeCached: (from: string | null, to: string | null) => boolean
  clearFetchedRanges: () => void

  // Getters
  getAllEvents: () => (CachedEvent | PendingEvent)[]
  getEventById: (id: string) => CachedEvent | PendingEvent | undefined
  getPendingEvents: () => PendingEvent[]
  getFailedEvents: () => PendingEvent[]

  // Cache management
  clearCache: () => void
  setLastFetchedAt: (timestamp: string) => void
}

type EventsCacheStore = EventsCacheState & EventsCacheActions

const initialState: EventsCacheState = {
  events: {},
  eventIds: [],
  pendingEvents: {},
  lastFetchedAt: null,
  oldestCursor: null,
  hasMore: true,
  fetchedRanges: [],
}

// Helper to enforce max events limit with LRU eviction
function enforceMaxEvents(
  events: Record<string, CachedEvent>,
  eventIds: string[],
  maxEvents: number = CACHE_CONSTANTS.MAX_EVENTS
): { events: Record<string, CachedEvent>; eventIds: string[] } {
  if (eventIds.length <= maxEvents) {
    return { events, eventIds }
  }

  // Keep newest events (eventIds is already sorted newest first)
  const idsToKeep = eventIds.slice(0, maxEvents)
  const idsSet = new Set(idsToKeep)

  const prunedEvents: Record<string, CachedEvent> = {}
  for (const id of idsToKeep) {
    if (events[id]) {
      prunedEvents[id] = events[id]
    }
  }

  return { events: prunedEvents, eventIds: idsToKeep }
}

export const useEventsCacheStore = create<EventsCacheStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Add a pending event optimistically
      addPendingEvent: (content: string, occurredAt?: Date): string => {
        const tempId = generateTempId()
        const now = new Date().toISOString()

        const pendingEvent: PendingEvent = {
          tempId,
          content,
          createdAt: now,
          occurredAt: occurredAt?.toISOString() ?? now,
          status: 'pending',
        }

        set((state) => ({
          pendingEvents: {
            ...state.pendingEvents,
            [tempId]: pendingEvent,
          },
        }))

        return tempId
      },

      // Confirm a pending event with server response
      confirmEvent: (tempId: string, serverEvent: CachedEvent): void => {
        set((state) => {
          // Remove from pending
          const { [tempId]: _, ...remainingPending } = state.pendingEvents

          // Add to real events
          const newEvents = {
            ...state.events,
            [serverEvent.id]: serverEvent,
          }

          // Add to beginning of eventIds (newest first)
          const newEventIds = [serverEvent.id, ...state.eventIds.filter(id => id !== serverEvent.id)]

          // Enforce max limit
          const { events, eventIds } = enforceMaxEvents(newEvents, newEventIds)

          return {
            events,
            eventIds,
            pendingEvents: remainingPending,
          }
        })
      },

      // Mark a pending event as failed
      markFailed: (tempId: string, error: string): void => {
        set((state) => {
          const pending = state.pendingEvents[tempId]
          if (!pending) return state

          return {
            pendingEvents: {
              ...state.pendingEvents,
              [tempId]: {
                ...pending,
                status: 'failed',
                error,
              },
            },
          }
        })
      },

      // Retry a failed pending event (returns the event to retry)
      retryPendingEvent: (tempId: string): PendingEvent | null => {
        const state = get()
        const pending = state.pendingEvents[tempId]

        if (!pending || pending.status !== 'failed') {
          return null
        }

        // Reset to pending status
        set((state) => ({
          pendingEvents: {
            ...state.pendingEvents,
            [tempId]: {
              ...pending,
              status: 'pending',
              error: undefined,
            },
          },
        }))

        return { ...pending, status: 'pending', error: undefined }
      },

      // Set events (initial load or refresh)
      setEvents: (events: CachedEvent[], nextCursor?: string, hasMore: boolean = true): void => {
        const eventsMap: Record<string, CachedEvent> = {}
        const eventIds: string[] = []

        for (const event of events) {
          eventsMap[event.id] = event
          eventIds.push(event.id)
        }

        // Enforce max limit
        const { events: prunedEvents, eventIds: prunedIds } = enforceMaxEvents(eventsMap, eventIds)

        set({
          events: prunedEvents,
          eventIds: prunedIds,
          oldestCursor: nextCursor ?? null,
          hasMore,
          lastFetchedAt: new Date().toISOString(),
        })
      },

      // Append older events (load more)
      appendOlderEvents: (events: CachedEvent[], nextCursor?: string, hasMore: boolean = true): void => {
        set((state) => {
          const newEvents = { ...state.events }
          const newIds = [...state.eventIds]

          for (const event of events) {
            if (!newEvents[event.id]) {
              newEvents[event.id] = event
              newIds.push(event.id)  // Append to end (older)
            }
          }

          // Enforce max limit
          const { events: prunedEvents, eventIds: prunedIds } = enforceMaxEvents(newEvents, newIds)

          return {
            events: prunedEvents,
            eventIds: prunedIds,
            oldestCursor: nextCursor ?? null,
            hasMore,
          }
        })
      },

      // Prepend newer events (sync check)
      prependNewerEvents: (events: CachedEvent[]): void => {
        set((state) => {
          const newEvents = { ...state.events }
          const newIds = [...state.eventIds]

          // Prepend in reverse order to maintain chronological order
          for (let i = events.length - 1; i >= 0; i--) {
            const event = events[i]
            if (!newEvents[event.id]) {
              newEvents[event.id] = event
              newIds.unshift(event.id)  // Prepend to beginning (newer)
            }
          }

          // Enforce max limit
          const { events: prunedEvents, eventIds: prunedIds } = enforceMaxEvents(newEvents, newIds)

          return {
            events: prunedEvents,
            eventIds: prunedIds,
            lastFetchedAt: new Date().toISOString(),
          }
        })
      },

      // Merge events into cache (for progressive loading of date ranges)
      // Adds events without replacing existing ones, maintains sort order
      mergeEvents: (events: CachedEvent[]): void => {
        set((state) => {
          const newEvents = { ...state.events }
          const existingIdsSet = new Set(state.eventIds)
          const newIds = [...state.eventIds]

          // Add only events that don't already exist
          for (const event of events) {
            if (!existingIdsSet.has(event.id)) {
              newEvents[event.id] = event
              newIds.push(event.id)
              existingIdsSet.add(event.id)
            }
          }

          // Re-sort by createdAt (newest first)
          newIds.sort((a, b) => {
            const eventA = newEvents[a]
            const eventB = newEvents[b]
            if (!eventA || !eventB) return 0
            return new Date(eventB.createdAt).getTime() - new Date(eventA.createdAt).getTime()
          })

          // Enforce max limit
          const { events: prunedEvents, eventIds: prunedIds } = enforceMaxEvents(newEvents, newIds)

          return {
            events: prunedEvents,
            eventIds: prunedIds,
            lastFetchedAt: new Date().toISOString(),
          }
        })
      },

      // Add a fetched range to track what's been cached
      addFetchedRange: (from: string | null, to: string | null): void => {
        set((state) => {
          // Check if this range is already covered
          const isAlreadyCovered = state.fetchedRanges.some(range => {
            const fromCovered = range.from === null || (from !== null && range.from <= from)
            const toCovered = range.to === null || (to !== null && range.to >= to)
            return fromCovered && toCovered
          })

          if (isAlreadyCovered) {
            return state
          }

          // Add the new range (could optimize by merging overlapping ranges)
          return {
            fetchedRanges: [...state.fetchedRanges, { from, to }]
          }
        })
      },

      // Check if a date range is already cached
      isRangeCached: (from: string | null, to: string | null): boolean => {
        const state = get()

        // "All time" (null, null) is cached if we have an unbounded range
        if (from === null && to === null) {
          return state.fetchedRanges.some(range => range.from === null && range.to === null)
        }

        // Check if any existing range covers the requested range
        return state.fetchedRanges.some(range => {
          // Range must cover from: cached.from <= requested.from (or cached.from is null)
          const fromCovered = range.from === null || (from !== null && range.from <= from)
          // Range must cover to: cached.to >= requested.to (or cached.to is null)
          const toCovered = range.to === null || (to !== null && range.to >= to)
          return fromCovered && toCovered
        })
      },

      // Clear all fetched ranges (e.g., on logout or data refresh)
      clearFetchedRanges: (): void => {
        set({ fetchedRanges: [] })
      },

      // Update a single event
      updateEvent: (id: string, updates: Partial<CachedEvent>): void => {
        set((state) => {
          const existing = state.events[id]
          if (!existing) return state

          return {
            events: {
              ...state.events,
              [id]: { ...existing, ...updates },
            },
          }
        })
      },

      // Remove an event from cache
      removeEvent: (id: string): void => {
        set((state) => {
          const { [id]: _, ...remainingEvents } = state.events
          return {
            events: remainingEvents,
            eventIds: state.eventIds.filter(eventId => eventId !== id),
          }
        })
      },

      // Get all events (pending + cached) sorted by createdAt
      getAllEvents: (): (CachedEvent | PendingEvent)[] => {
        const state = get()

        // Get pending events
        const pending = Object.values(state.pendingEvents)

        // Get cached events in order
        const cached = state.eventIds
          .map(id => state.events[id])
          .filter(Boolean)

        // Combine and sort by createdAt (newest first)
        const all = [...pending, ...cached]
        all.sort((a, b) => {
          const dateA = new Date(a.createdAt).getTime()
          const dateB = new Date(b.createdAt).getTime()
          return dateB - dateA
        })

        return all
      },

      // Get a specific event by ID (checks both pending and cached)
      getEventById: (id: string): CachedEvent | PendingEvent | undefined => {
        const state = get()

        // Check pending first (tempId)
        if (isTempId(id)) {
          return state.pendingEvents[id]
        }

        // Check cached
        return state.events[id]
      },

      // Get all pending events
      getPendingEvents: (): PendingEvent[] => {
        return Object.values(get().pendingEvents)
      },

      // Get failed pending events
      getFailedEvents: (): PendingEvent[] => {
        return Object.values(get().pendingEvents).filter(e => e.status === 'failed')
      },

      // Clear all cached events
      clearCache: (): void => {
        set(initialState)
      },

      // Update last fetched timestamp
      setLastFetchedAt: (timestamp: string): void => {
        set({ lastFetchedAt: timestamp })
      },
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        events: state.events,
        eventIds: state.eventIds,
        pendingEvents: state.pendingEvents,
        lastFetchedAt: state.lastFetchedAt,
        oldestCursor: state.oldestCursor,
        hasMore: state.hasMore,
        fetchedRanges: state.fetchedRanges,
      }),
      migrate: (persistedState: unknown, version: number) => {
        // Handle migration or corrupted data
        if (!persistedState) {
          return initialState
        }

        try {
          const state = persistedState as Partial<EventsCacheState>
          return {
            events: state.events ?? {},
            eventIds: state.eventIds ?? [],
            pendingEvents: state.pendingEvents ?? {},
            lastFetchedAt: state.lastFetchedAt ?? null,
            oldestCursor: state.oldestCursor ?? null,
            hasMore: state.hasMore ?? true,
            fetchedRanges: state.fetchedRanges ?? [],
          }
        } catch {
          console.warn('Failed to migrate events cache, resetting')
          return initialState
        }
      },
    }
  )
)

// Selectors
export const selectAllEvents = (state: EventsCacheStore) => state.getAllEvents()
export const selectHasMore = (state: EventsCacheStore) => state.hasMore
export const selectOldestCursor = (state: EventsCacheStore) => state.oldestCursor
export const selectLastFetchedAt = (state: EventsCacheStore) => state.lastFetchedAt
export const selectPendingEvents = (state: EventsCacheStore) => state.getPendingEvents()
export const selectFailedEvents = (state: EventsCacheStore) => state.getFailedEvents()
export const selectFetchedRanges = (state: EventsCacheStore) => state.fetchedRanges
