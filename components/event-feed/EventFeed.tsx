import { requireUser } from '@/server/auth'
import { prisma } from '@/server/prisma/client'
import { EventList } from './EventList'

export type DateFilter = {
  from?: string
  to?: string
}

export async function EventFeed({
  limit = 20,
  dateFilter
}: {
  limit?: number
  dateFilter?: DateFilter
}) {
  const user = await requireUser()

  // Build date filter conditions
  const dateConditions: Record<string, Date> = {}
  if (dateFilter?.from) {
    dateConditions.gte = new Date(dateFilter.from)
  }
  if (dateFilter?.to) {
    dateConditions.lte = new Date(dateFilter.to)
  }

  // Cursor-based pagination: fetch initial page
  const events = await prisma.event.findMany({
    where: {
      userId: user.id,
      ...(Object.keys(dateConditions).length > 0 && {
        occurredAt: dateConditions
      })
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1, // Fetch one extra to determine hasMore
    select: {
      id: true,
      content: true,
      createdAt: true,
      occurredAt: true
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
      dateFilter={dateFilter}
    />
  )
}
