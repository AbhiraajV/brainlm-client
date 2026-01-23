'use client'

import { useCallback, useEffect, useRef, useMemo } from 'react'
import { ReviewType } from '@prisma/client'
import { ReviewCard, ReviewCardData } from './ReviewCard'
import { FullscreenReader } from '@/components/ui/FullscreenReader'
import { useUiStore } from '@/store/ui.store'
import { useReviews } from '@/hooks/useDailyData'
import { useHydrated } from '@/hooks/useHydrated'
import { useDailyDataStore, type CachedReview } from '@/store/daily-data.store'
import { readCacheSync, isStale, CACHE_CONSTANTS } from '@/lib/cache-utils'

// Storage key must match daily-data.store.ts
const STORAGE_KEY = 'brainlm:daily-data'

interface ReviewListProps {
  initialReviews: ReviewCardData[]
  hasMore: boolean
  initialCursor?: string
  typeFilter?: ReviewType
}

/**
 * Read cached reviews synchronously from localStorage.
 * This enables instant cache-first rendering before React hydration.
 */
function getInitialCachedReviews(typeFilter?: ReviewType): { reviews: CachedReview[]; isFresh: boolean } {
  const cache = readCacheSync<{
    reviews: { items: Record<string, CachedReview>; itemIds: string[]; lastFetchedAt: string | null }
  }>(STORAGE_KEY)

  if (!cache?.reviews?.itemIds?.length) {
    return { reviews: [], isFresh: false }
  }

  const allReviews = cache.reviews.itemIds
    .map(id => cache.reviews.items[id])
    .filter(Boolean)

  const filteredReviews = typeFilter
    ? allReviews.filter(r => r.type === typeFilter)
    : allReviews

  const isFresh = !isStale(cache.reviews.lastFetchedAt, CACHE_CONSTANTS.STALE_THRESHOLD_MS)

  return { reviews: filteredReviews, isFresh }
}

export function ReviewList({
  initialReviews,
  hasMore: initialHasMore,
  initialCursor,
  typeFilter,
}: ReviewListProps) {
  const hydrated = useHydrated()
  const hasSeedCache = useRef(false)

  const { openFullscreenReader } = useUiStore()
  const { setReviews: setCachedReviews } = useDailyDataStore()

  // Use cached reviews with stale-while-revalidate
  const {
    reviews: cachedReviews,
    isRefreshing,
    hasMore: cacheHasMore,
    loadMore: loadMoreFromCache,
  } = useReviews(typeFilter)

  // Read cache synchronously on first render (before hydration)
  // This enables instant display of cached data
  const initialCache = useMemo(() => getInitialCachedReviews(typeFilter), [typeFilter])

  // Seed cache from server data (once) - only if cache was empty
  useEffect(() => {
    if (hasSeedCache.current) return
    if (initialReviews.length === 0) return
    if (initialCache.reviews.length > 0) return // Already has cached data

    const reviewsForCache: CachedReview[] = initialReviews.map(r => ({
      id: r.id,
      type: r.type,
      periodKey: r.periodKey,
      periodStart: r.periodStart.toISOString(),
      periodEnd: r.periodEnd.toISOString(),
      summary: r.summary,
      renderedMarkdown: r.renderedMarkdown,
      eventIds: r.eventIds,
      interpretationIds: r.interpretationIds,
      patternIds: r.patternIds,
      insightIds: r.insightIds,
      createdAt: r.createdAt.toISOString(),
    }))
    setCachedReviews(reviewsForCache, initialCursor, initialHasMore)
    hasSeedCache.current = true
  }, [initialReviews, initialCache.reviews.length, setCachedReviews, initialCursor, initialHasMore])

  // Cache-first rendering strategy:
  // 1. If we have fresh cached data, show it immediately (even before hydration)
  // 2. After hydration, show the Zustand store data (which gets updated by background refresh)
  // 3. Fall back to server data only if cache is empty
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
    if (initialCache.reviews.length > 0) {
      return initialCache.reviews.map(r => ({
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

    // Fallback: server-provided data
    return initialReviews
  }, [hydrated, cachedReviews, initialCache.reviews, initialReviews])

  const hasMore = hydrated ? cacheHasMore : initialHasMore
  const loading = isRefreshing

  const loadMore = useCallback(async () => {
    await loadMoreFromCache()
  }, [loadMoreFromCache])

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
