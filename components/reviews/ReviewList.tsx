'use client'

import { useState, useCallback, useEffect } from 'react'
import { ReviewType } from '@prisma/client'
import { ReviewCard, ReviewCardData } from './ReviewCard'
import { FullscreenReader } from '@/components/ui/FullscreenReader'
import { useUiStore } from '@/store/ui.store'
import { getReviewsByType } from '@/server/actions/review.actions'

interface ReviewListProps {
  initialReviews: ReviewCardData[]
  hasMore: boolean
  initialCursor?: string
  typeFilter?: ReviewType
}

export function ReviewList({
  initialReviews,
  hasMore: initialHasMore,
  initialCursor,
  typeFilter,
}: ReviewListProps) {
  const [reviews, setReviews] = useState(initialReviews)
  const [cursor, setCursor] = useState<string | undefined>(initialCursor)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [loading, setLoading] = useState(false)

  const { openFullscreenReader } = useUiStore()

  // Reset state when initial data changes (e.g., filter changed)
  useEffect(() => {
    setReviews(initialReviews)
    setCursor(initialCursor)
    setHasMore(initialHasMore)
  }, [initialReviews, initialCursor, initialHasMore])

  const loadMore = useCallback(async () => {
    if (loading || !hasMore || !cursor) return
    setLoading(true)
    const result = await getReviewsByType({ type: typeFilter, cursor, limit: 20 })
    setReviews((prev) => [...prev, ...result.reviews])
    setHasMore(!!result.nextCursor)
    setCursor(result.nextCursor)
    setLoading(false)
  }, [loading, hasMore, cursor, typeFilter])

  const handleCardClick = (review: ReviewCardData) => {
    openFullscreenReader('review', {
      id: review.id,
      content: review.renderedMarkdown,
      reviewType: review.type,
      periodKey: review.periodKey,
      periodStart: review.periodStart,
      periodEnd: review.periodEnd,
      summary: review.summary,
    })
  }

  if (reviews.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-5">
        <div className="w-12 h-12 rounded-full bg-[var(--color-line)] mb-4" />
        <p className="font-serif text-lg text-[var(--color-text)]">No reviews yet</p>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          Your reviews will appear here as they are generated
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="divide-y divide-[var(--color-line)] -mx-5 sm:-mx-7">
        {reviews.map((review) => (
          <ReviewCard
            key={review.id}
            review={review}
            onClick={() => handleCardClick(review)}
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
