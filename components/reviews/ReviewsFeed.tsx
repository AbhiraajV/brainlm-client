'use client'

import { useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { ReviewType } from '@prisma/client'
import { ReviewCard, ReviewCardData } from './ReviewCard'
import { FullscreenReader } from '@/components/ui/FullscreenReader'
import { useUiStore } from '@/store/ui.store'
import { useReviews } from '@/hooks/useDailyData'
import { useHydrated } from '@/hooks/useHydrated'
import { useDailyDataStore, type CachedReview } from '@/store/daily-data.store'
import { readCacheSync } from '@/lib/cache-utils'

const STORAGE_KEY = 'brainlm:daily-data'

/**
 * Read cached reviews synchronously from localStorage.
 */
function getInitialCachedReviews(typeFilter?: ReviewType): CachedReview[] {
  const cache = readCacheSync<{
    reviews: { items: Record<string, CachedReview>; itemIds: string[] }
  }>(STORAGE_KEY)

  if (!cache?.reviews?.itemIds?.length) {
    return []
  }

  const allReviews = cache.reviews.itemIds
    .map(id => cache.reviews.items[id])
    .filter(Boolean)

  return typeFilter
    ? allReviews.filter(r => r.type === typeFilter)
    : allReviews
}

interface ReviewsFeedProps {
  type?: ReviewType
  limit?: number
}

/**
 * Client-only ReviewsFeed that shows cached data instantly.
 * No server component blocking - data comes from client-side cache.
 */
export function ReviewsFeed({ type, limit = 20 }: ReviewsFeedProps) {
  const hydrated = useHydrated()
  const { openFullscreenReader } = useUiStore()

  // Use cached reviews with stale-while-revalidate
  const {
    reviews: cachedReviews,
    isRefreshing,
    hasMore,
    loadMore,
  } = useReviews(type)

  // Read cache synchronously on first render (before hydration)
  const initialCache = useMemo(() => getInitialCachedReviews(type), [type])

  // Convert cached reviews to display format
  const displayReviews: ReviewCardData[] = useMemo(() => {
    // After hydration: use Zustand store (live updates)
    if (hydrated && cachedReviews.length > 0) {
      return cachedReviews.map(r => ({
        id: r.id,
        type: r.type,
        periodKey: r.periodKey,
        periodStart: new Date(r.periodStart),
        periodEnd: new Date(r.periodEnd),
        summary: r.summary,
        renderedMarkdown: r.renderedMarkdown ?? '',
        eventIds: r.eventIds,
        interpretationIds: r.interpretationIds,
        patternIds: r.patternIds,
        insightIds: r.insightIds,
        createdAt: new Date(r.createdAt),
      }))
    }

    // Before hydration: use sync cache read (instant display)
    if (initialCache.length > 0) {
      return initialCache.map(r => ({
        id: r.id,
        type: r.type,
        periodKey: r.periodKey,
        periodStart: new Date(r.periodStart),
        periodEnd: new Date(r.periodEnd),
        summary: r.summary,
        renderedMarkdown: r.renderedMarkdown ?? '',
        eventIds: r.eventIds,
        interpretationIds: r.interpretationIds,
        patternIds: r.patternIds,
        insightIds: r.insightIds,
        createdAt: new Date(r.createdAt),
      }))
    }

    return []
  }, [hydrated, cachedReviews, initialCache])

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

  // Only show loading if we have NO cached data and are fetching
  if (displayReviews.length === 0 && isRefreshing) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-5">
        <Loader2 className="w-8 h-8 text-[var(--color-muted)] animate-spin mb-4" />
        <p className="text-sm text-[var(--color-muted)]">Loading reviews...</p>
      </div>
    )
  }

  if (displayReviews.length === 0) {
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
        {displayReviews.map((review) => (
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
              disabled={isRefreshing}
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
              {isRefreshing ? (
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
