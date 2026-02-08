import { requireUser } from '@/server/auth'
import { prisma } from '@/server/prisma/client'
import { EventList } from './EventList'

/**
 * EventFeed - Server component that fetches initial events to seed the cache.
 *
 * Progressive caching strategy:
 * - Server always returns recent events (no date filter) to seed the cache
 * - Client-side EventList handles date filtering locally from cache
 * - When a date range isn't cached, EventList fetches it and adds to cache
 * - Subsequent visits to the same range are instant (local filtering)
 */
export async function EventFeed({
  limit = 20,
}: {
  limit?: number
}) {
  const user = await requireUser()

  // Fetch recent events to seed the cache
  // No date filter - we always fetch the most recent events
  // Date filtering happens client-side from the cache
  const events = await prisma.event.findMany({
    where: {
      userId: user.id,
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1, // Fetch one extra to determine hasMore
    select: {
      id: true,
      content: true,
      createdAt: true,
      occurredAt: true,
      trackedType: true
    }
  })

  const hasMore = events.length > limit
  const displayEvents = hasMore ? events.slice(0, limit) : events
  const nextCursor = hasMore ? displayEvents[displayEvents.length - 1]?.id : undefined

  return (
    <EventList
      initialEvents={displayEvents}
      hasMore={hasMore}
      initialCursor={nextCursor}
    />
  )
}
