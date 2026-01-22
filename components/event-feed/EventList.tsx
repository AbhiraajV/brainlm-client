'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react'
import { EventRow } from './EventRow'
import { FullscreenReader } from '@/components/ui/FullscreenReader'
import { getEventsPage, type DateFilter } from '@/server/actions/event.actions'
import { useEventsCacheStore, type CachedEvent, type PendingEvent } from '@/store/events-cache.store'
import { useHydrated } from '@/hooks/useHydrated'
import { createEvent } from '@/server/actions/event.actions'
import { isTempId } from '@/lib/cache-utils'

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
  dateFilter
}: {
  initialEvents: Event[]
  hasMore: boolean
  initialCursor?: string
  dateFilter?: DateFilter
}) {
  const hydrated = useHydrated()
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const hasSeedCache = useRef(false)

  // Events cache store
  const {
    events: cachedEvents,
    eventIds,
    pendingEvents,
    hasMore: cacheHasMore,
    oldestCursor,
    setEvents,
    appendOlderEvents,
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

    setEvents(eventsForCache, initialCursor, initialHasMore)
    hasSeedCache.current = true
  }, [initialEvents, initialCursor, initialHasMore, setEvents])

  // Handle retry for failed pending events
  const handleRetry = useCallback(async (tempId: string) => {
    const eventToRetry = retryPendingEvent(tempId)
    if (!eventToRetry) return

    try {
      const result = await createEvent({ content: eventToRetry.content })
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

  // Load more events
  const loadMore = useCallback(async () => {
    if (loading || !cacheHasMore || !oldestCursor) return
    setLoading(true)

    try {
      const result = await getEventsPage({ cursor: oldestCursor, limit: 20, dateFilter })
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
  }, [loading, cacheHasMore, oldestCursor, dateFilter, appendOlderEvents])

  // Get pending events as array sorted by createdAt (newest first)
  const pendingEventsList = Object.values(pendingEvents).sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  // Get cached events in order
  const cachedEventsList = eventIds
    .map(id => cachedEvents[id])
    .filter(Boolean)

  // Determine what to show:
  // - Before hydration: use server-provided initialEvents for SSR
  // - After hydration: use cache (pending + cached events)
  const displayEvents = hydrated
    ? cachedEventsList
    : initialEvents.map(e => ({
        id: e.id,
        content: e.content,
        createdAt: e.createdAt.toISOString(),
        occurredAt: e.occurredAt?.toISOString() ?? null,
      }))

  const hasMoreToLoad = hydrated ? cacheHasMore : initialHasMore
  const hasPending = hydrated && pendingEventsList.length > 0
  const totalEvents = displayEvents.length + (hasPending ? pendingEventsList.length : 0)

  if (totalEvents === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-5">
        <div className="w-12 h-12 rounded-full bg-[var(--color-line)] mb-4" />
        <p className="font-serif text-lg text-[var(--color-text)]">No reflections yet</p>
        <p className="text-sm text-[var(--color-muted)] mt-1">Your thoughts will appear here</p>
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
