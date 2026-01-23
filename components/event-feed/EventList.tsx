'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react'
import { EventRow } from './EventRow'
import { FullscreenReader } from '@/components/ui/FullscreenReader'
import { getEventsPage, type DateFilter } from '@/server/actions/event.actions'
import { useEventsCacheStore, type CachedEvent, type PendingEvent } from '@/store/events-cache.store'
import { useHydrated } from '@/hooks/useHydrated'
import { createEvent } from '@/server/actions/event.actions'
import { isStale, CACHE_CONSTANTS } from '@/lib/cache-utils'

type Event = { id: string; content: string; createdAt: Date; occurredAt: Date | null }

// Pending event row component with retry functionality
function PendingEventRow({
  event,
  onRetry,
}: {
  event: PendingEvent
  onRetry: (tempId: string) => void
}) {
  const isPending = event.status === 'pending'
  const isFailed = event.status === 'failed'

  return (
    <article className="px-2.5 py-4 bg-[var(--color-surface)]">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-3">
          {/* Status indicator */}
          <div
            className={`
              w-2.5 h-2.5 rounded-full flex-shrink-0
              ${isPending ? 'bg-[var(--color-muted)] animate-pulse' : ''}
              ${isFailed ? 'bg-[var(--color-error)]' : ''}
            `}
          />
          {/* Status text */}
          <span className="text-[11px] text-[var(--color-muted)]">
            {isPending && (
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                Saving...
              </span>
            )}
            {isFailed && (
              <span className="flex items-center gap-1.5 text-[var(--color-error)]">
                <AlertCircle className="w-3 h-3" />
                Failed to save
              </span>
            )}
          </span>
        </div>

        {/* Retry button for failed events */}
        {isFailed && (
          <button
            onClick={() => onRetry(event.tempId)}
            className="
              flex items-center gap-1
              text-[11px] font-medium
              text-[var(--color-accent)]
              transition-all duration-200
              hover:text-[var(--color-accent-secondary)]
            "
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        )}
      </div>

      {/* Event content - muted for pending */}
      <div className={`w-full ${isPending ? 'opacity-60' : ''}`}>
        <p className="text-[15px] font-serif text-[var(--color-text)] leading-relaxed whitespace-pre-wrap">
          {event.content}
        </p>
      </div>

      {/* Error message */}
      {isFailed && event.error && (
        <p className="mt-2 text-[11px] text-[var(--color-error)]">
          {event.error}
        </p>
      )}
    </article>
  )
}

export function EventList({
  initialEvents,
  hasMore: initialHasMore,
  initialCursor,
}: {
  initialEvents: Event[]
  hasMore: boolean
  initialCursor?: string
}) {
  const hydrated = useHydrated()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [rangeLoading, setRangeLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const hasSeedCache = useRef(false)
  const lastFetchedFilter = useRef<string | null>(null)

  const filterValue = searchParams.get('filter') || 'today'

  // Get date filter from URL params (set by DateRangeFilter)
  const dateFilter = useMemo((): DateFilter | undefined => {
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    if (!from && !to) return undefined
    return { from: from || undefined, to: to || undefined }
  }, [searchParams])

  // Events cache store
  const {
    events: cachedEvents,
    eventIds,
    pendingEvents,
    hasMore: cacheHasMore,
    oldestCursor,
    lastFetchedAt,
    setEvents,
    appendOlderEvents,
    prependNewerEvents,
    mergeEvents,
    addFetchedRange,
    isRangeCached,
    retryPendingEvent,
    confirmEvent,
    markFailed,
  } = useEventsCacheStore()

  // Seed the cache with initial events from server (only once)
  useEffect(() => {
    if (hasSeedCache.current) return
    if (initialEvents.length === 0) return

    const eventsForCache: CachedEvent[] = initialEvents.map(e => ({
      id: e.id,
      content: e.content,
      createdAt: e.createdAt.toISOString(),
      occurredAt: e.occurredAt?.toISOString() ?? null,
    }))

    // Only replace if cache is empty or stale
    const hasCachedData = eventIds.length > 0
    const cacheIsFresh = lastFetchedAt && !isStale(lastFetchedAt, CACHE_CONSTANTS.STALE_THRESHOLD_MS)

    if (hasCachedData && cacheIsFresh) {
      // Merge: prepend any newer events from server
      prependNewerEvents(eventsForCache)
    } else {
      // Fresh seed
      setEvents(eventsForCache, initialCursor, initialHasMore)
    }

    // Mark today's range as cached (initial load is always today)
    if (dateFilter?.from && dateFilter?.to) {
      addFetchedRange(dateFilter.from, dateFilter.to)
    }
    hasSeedCache.current = true
  }, [initialEvents, initialCursor, initialHasMore, setEvents, eventIds.length, lastFetchedAt, prependNewerEvents, dateFilter, addFetchedRange])

  // Progressive caching: fetch range in background ONLY if needed
  // This is NON-BLOCKING - we show cached events immediately via local filtering
  useEffect(() => {
    if (!hydrated) return

    const rangeKey = dateFilter ? `${dateFilter.from}|${dateFilter.to}` : 'all'

    // Skip if we just fetched this range
    if (lastFetchedFilter.current === rangeKey) return
    lastFetchedFilter.current = rangeKey

    const from = dateFilter?.from ?? null
    const to = dateFilter?.to ?? null

    // Check if this range is already marked as cached
    if (isRangeCached(from, to)) {
      return
    }

    // Count how many events we have locally for this filter
    const localMatchCount = eventIds.filter(id => {
      const event = cachedEvents[id]
      if (!event) return false
      if (!dateFilter) return true // "all time" - count everything
      const eventDate = new Date(event.occurredAt || event.createdAt)
      if (dateFilter.from && eventDate < new Date(dateFilter.from)) return false
      if (dateFilter.to && eventDate > new Date(dateFilter.to)) return false
      return true
    }).length

    // If we have local matches, show them instantly - no need to fetch
    // Only fetch if we have NO local events for this filter
    if (localMatchCount > 0) {
      // Mark as "locally satisfied" - we have data, don't need to fetch
      // (User can always refresh if they want fresh data)
      return
    }

    // No local matches - fetch from server
    const fetchRange = async () => {
      setRangeLoading(true)

      try {
        const result = await getEventsPage({
          limit: 50,
          dateFilter: dateFilter || undefined
        })

        const eventsForCache: CachedEvent[] = result.events.map(e => ({
          id: e.id,
          content: e.content,
          createdAt: e.createdAt.toISOString(),
          occurredAt: e.occurredAt?.toISOString() ?? null,
        }))

        // Merge into cache (adds without replacing)
        mergeEvents(eventsForCache)

        // Mark this range as fetched
        addFetchedRange(from, to)
      } catch (err) {
        console.error('Failed to fetch date range:', err)
      } finally {
        setRangeLoading(false)
      }
    }

    fetchRange()
  }, [hydrated, dateFilter, isRangeCached, mergeEvents, addFetchedRange, eventIds, cachedEvents])

  // Handle retry for failed pending events
  const handleRetry = useCallback(async (tempId: string) => {
    const eventToRetry = retryPendingEvent(tempId)
    if (!eventToRetry) return

    try {
      // Preserve the original occurredAt timestamp from the pending event
      const result = await createEvent({
        content: eventToRetry.content,
        occurredAt: eventToRetry.occurredAt ? new Date(eventToRetry.occurredAt) : undefined,
      })
      confirmEvent(tempId, {
        id: result.event.id,
        content: result.event.content,
        createdAt: result.event.createdAt.toISOString(),
        occurredAt: result.event.occurredAt?.toISOString() ?? null,
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save. Please try again.'
      markFailed(tempId, errorMessage)
    }
  }, [retryPendingEvent, confirmEvent, markFailed])

  // Load more events (for "All Time" pagination)
  const loadMore = useCallback(async () => {
    if (loading || !cacheHasMore || !oldestCursor) return
    setLoading(true)

    try {
      // For "load more", we fetch older events without date filter
      // They'll be added to cache and filtered locally
      const result = await getEventsPage({ cursor: oldestCursor, limit: 20 })
      const eventsForCache: CachedEvent[] = result.events.map(e => ({
        id: e.id,
        content: e.content,
        createdAt: e.createdAt.toISOString(),
        occurredAt: e.occurredAt?.toISOString() ?? null,
      }))
      appendOlderEvents(eventsForCache, result.nextCursor, !!result.nextCursor)
    } catch (err) {
      console.error('Failed to load more events:', err)
    } finally {
      setLoading(false)
    }
  }, [loading, cacheHasMore, oldestCursor, appendOlderEvents])

  // Get pending events as array sorted by createdAt (newest first)
  const pendingEventsList = Object.values(pendingEvents).sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  // Get cached events in order, applying date filter
  // Note: dateFilter.from and dateFilter.to are ISO strings representing UTC boundaries
  const cachedEventsList = useMemo(() => {
    return eventIds
      .map(id => cachedEvents[id])
      .filter(Boolean)
      .filter(event => {
        if (!dateFilter) return true
        const eventDate = new Date(event.occurredAt || event.createdAt)
        if (dateFilter.from && eventDate < new Date(dateFilter.from)) return false
        if (dateFilter.to && eventDate > new Date(dateFilter.to)) return false
        return true
      })
  }, [eventIds, cachedEvents, dateFilter])

  // Hydration-safe rendering strategy:
  // Before hydration: use server data (matches SSR, avoids hydration mismatch)
  // After hydration: use Zustand store with local filtering
  const displayEvents = useMemo(() => {
    if (!hydrated) {
      // Before hydration: use server data to match SSR output
      return initialEvents.map(e => ({
        id: e.id,
        content: e.content,
        createdAt: e.createdAt.toISOString(),
        occurredAt: e.occurredAt?.toISOString() ?? null,
      }))
    }

    // After hydration: use Zustand store with local filtering
    return cachedEventsList
  }, [hydrated, cachedEventsList, initialEvents])

  // Only show "load more" for "all time" filter (when no date boundaries)
  const isAllTimeFilter = filterValue === 'all'
  const hasMoreToLoad = hydrated && isAllTimeFilter ? cacheHasMore : false
  const hasPending = hydrated && pendingEventsList.length > 0
  const totalEvents = displayEvents.length + (hasPending ? pendingEventsList.length : 0)

  if (totalEvents === 0) {
    // Show loading only if we're fetching and have no cached events at all
    if (rangeLoading && eventIds.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 px-5">
          <Loader2 className="w-8 h-8 text-[var(--color-muted)] animate-spin mb-4" />
          <p className="text-sm text-[var(--color-muted)]">Loading events...</p>
        </div>
      )
    }

    // No events for this filter (but we have cache)
    return (
      <div className="flex flex-col items-center justify-center py-16 px-5">
        <div className="w-12 h-12 rounded-full bg-[var(--color-line)] mb-4" />
        <p className="font-serif text-lg text-[var(--color-text)]">
          {filterValue === 'all' ? 'No reflections yet' : 'No reflections for this period'}
        </p>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          {filterValue === 'all' ? 'Your thoughts will appear here' : 'Try a different time range'}
        </p>
        {rangeLoading && (
          <p className="text-xs text-[var(--color-muted)] mt-3 flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" />
            Checking for more...
          </p>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="space-y-1.5 -mx-5 sm:-mx-7">
        {/* Pending events first (optimistic) */}
        {hasPending && pendingEventsList.map((event) => (
          <PendingEventRow
            key={event.tempId}
            event={event}
            onRetry={handleRetry}
          />
        ))}

        {/* Cached/server events */}
        {displayEvents.map((event, index) => (
          <EventRow
            key={event.id}
            event={{
              id: event.id,
              content: event.content,
              createdAt: new Date(event.createdAt),
              occurredAt: event.occurredAt ? new Date(event.occurredAt) : null,
            }}
            isExpanded={expandedId === event.id}
            onToggle={() => setExpandedId(prev => prev === event.id ? null : event.id)}
            isFirst={index === 0 && !hasPending}
          />
        ))}

        {hasMoreToLoad && (
          <div className="flex justify-center py-6 px-5 sm:px-7">
            <button
              onClick={loadMore}
              disabled={loading}
              className="
                px-6 py-3
                text-sm font-medium
                text-[var(--color-muted)]
                bg-transparent
                border border-[var(--color-line)]
                rounded-[var(--radius-sm)]
                transition-all duration-200
                hover:text-[var(--color-text)]
                hover:border-[var(--color-muted)]
                disabled:opacity-50
                disabled:cursor-not-allowed
              "
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Loading...
                </span>
              ) : (
                'Load more'
              )}
            </button>
          </div>
        )}
      </div>
      <FullscreenReader />
    </>
  )
}
