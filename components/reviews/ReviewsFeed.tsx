import { ReviewType } from '@prisma/client'
import { requireUser } from '@/server/auth'
import { prisma } from '@/server/prisma/client'
import { ReviewList } from './ReviewList'

interface ReviewsFeedProps {
  type?: ReviewType
  limit?: number
}

export async function ReviewsFeed({ type, limit = 20 }: ReviewsFeedProps) {
  const user = await requireUser()

  const reviews = await prisma.review.findMany({
    where: {
      userId: user.id,
      ...(type && { type }),
    },
    orderBy: { periodStart: 'desc' },
    take: limit + 1,
    select: {
      id: true,
      type: true,
      periodKey: true,
      periodStart: true,
      periodEnd: true,
      summary: true,
      renderedMarkdown: true,
      eventIds: true,
      interpretationIds: true,
      patternIds: true,
      insightIds: true,
      createdAt: true,
    },
  })

  const hasMore = reviews.length > limit
  const displayReviews = hasMore ? reviews.slice(0, limit) : reviews
  const nextCursor = hasMore
    ? displayReviews[displayReviews.length - 1]?.id
    : undefined

  return (
    <ReviewList
      initialReviews={displayReviews}
      hasMore={hasMore}
      initialCursor={nextCursor}
      typeFilter={type}
    />
  )
}
