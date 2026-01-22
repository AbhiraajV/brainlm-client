'use client'

import { useState, useCallback, useEffect } from 'react'
import { EventRow } from './EventRow'
import { FullscreenReader } from '@/components/ui/FullscreenReader'
import { getEventsPage, type DateFilter } from '@/server/actions/event.actions'

type Event = { id: string; content: string; createdAt: Date; occurredAt: Date | null }

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
  const [events, setEvents] = useState(initialEvents)
  const [cursor, setCursor] = useState<string | undefined>(initialCursor)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Reset state when initial data changes (e.g., filter changed)
  useEffect(() => {
    setEvents(initialEvents)
    setCursor(initialCursor)
    setHasMore(initialHasMore)
    setExpandedId(null)
  }, [initialEvents, initialCursor, initialHasMore])

  const loadMore = useCallback(async () => {
    if (loading || !hasMore || !cursor) return
    setLoading(true)
    const result = await getEventsPage({ cursor, limit: 20, dateFilter })
    setEvents(prev => [...prev, ...result.events])
    setHasMore(!!result.nextCursor)
    setCursor(result.nextCursor)
    setLoading(false)
  }, [loading, hasMore, cursor, dateFilter])

  if (events.length === 0) {
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
        {events.map((event, index) => (
          <EventRow
            key={event.id}
            event={event}
            isExpanded={expandedId === event.id}
            onToggle={() => setExpandedId(prev => prev === event.id ? null : event.id)}
            isFirst={index === 0}
          />
        ))}

        {hasMore && (
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
