'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  useDailyDataStore,
  selectReviews,
  selectDailyPlans,
  selectUOMSuggestions,
  selectBaseline,
  type CachedReview,
  type CachedDailyPlan,
  type CachedUOMSuggestion,
} from '@/store/daily-data.store'
import { getReviewsByType, type getReviewsByType as GetReviewsByTypeReturn } from '@/server/actions/review.actions'
import { getDailyPlansPage } from '@/server/actions/daily-plan.actions'
import { getPendingUOMSuggestions } from '@/server/actions/uom-suggestion.actions'
import { useHydrated } from '@/hooks/useHydrated'
import { ReviewType } from '@prisma/client'

/**
 * Hook for reviews with stale-while-revalidate pattern.
 * Shows cached data immediately, fetches fresh in background if stale.
 */
export function useReviews(type?: ReviewType) {
  const hydrated = useHydrated()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const hasFetched = useRef(false)

  const {
    reviews,
    setReviews,
    appendReviews,
    isReviewsStale,
  } = useDailyDataStore()

  const cachedReviews = useDailyDataStore(selectReviews)

  // Filter by type if specified
  const filteredReviews = type
    ? cachedReviews.filter(r => r.type === type)
    : cachedReviews

  const fetchReviews = useCallback(async (cursor?: string) => {
    try {
      const result = await getReviewsByType({ type, cursor, limit: 20 })
      const reviewsForCache: CachedReview[] = result.reviews.map(r => ({
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

      if (cursor) {
        appendReviews(reviewsForCache, result.nextCursor, !!result.nextCursor)
      } else {
        setReviews(reviewsForCache, result.nextCursor, !!result.nextCursor)
      }

      return result
    } catch (err) {
      console.error('Failed to fetch reviews:', err)
      throw err
    }
  }, [type, setReviews, appendReviews])

  // Stale-while-revalidate: show cached data immediately, fetch if stale
  useEffect(() => {
    if (!hydrated || hasFetched.current) return

    const shouldFetch = isReviewsStale() || cachedReviews.length === 0

    if (shouldFetch) {
      setIsRefreshing(true)
      fetchReviews()
        .finally(() => {
          setIsRefreshing(false)
          hasFetched.current = true
        })
    } else {
      hasFetched.current = true
    }
  }, [hydrated, isReviewsStale, cachedReviews.length, fetchReviews])

  const loadMore = useCallback(async () => {
    if (!reviews.hasMore || !reviews.nextCursor) return

    setIsRefreshing(true)
    try {
      await fetchReviews(reviews.nextCursor)
    } finally {
      setIsRefreshing(false)
    }
  }, [reviews.hasMore, reviews.nextCursor, fetchReviews])

  const refresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await fetchReviews()
    } finally {
      setIsRefreshing(false)
    }
  }, [fetchReviews])

  return {
    reviews: filteredReviews,
    isRefreshing,
    hasMore: reviews.hasMore,
    loadMore,
    refresh,
  }
}

/**
 * Hook for daily plans with stale-while-revalidate pattern.
 */
export function useDailyPlans() {
  const hydrated = useHydrated()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const hasFetched = useRef(false)

  const {
    dailyPlans,
    setDailyPlans,
    appendDailyPlans,
    isDailyPlansStale,
  } = useDailyDataStore()

  const cachedPlans = useDailyDataStore(selectDailyPlans)

  const fetchPlans = useCallback(async (cursor?: string) => {
    try {
      const result = await getDailyPlansPage({ cursor, limit: 10 })
      const plansForCache: CachedDailyPlan[] = result.plans.map(p => ({
        id: p.id,
        renderedMarkdown: p.renderedMarkdown,
        targetDate: p.targetDate.toISOString(),
        createdAt: p.createdAt.toISOString(),
        reviewId: p.reviewId,
        focusAreas: p.focusAreas as unknown[],
        sessions: p.sessions as unknown[],
        warnings: p.warnings as unknown[],
        ctas: p.ctas as unknown[],
      }))

      if (cursor) {
        appendDailyPlans(plansForCache, result.nextCursor, !!result.nextCursor)
      } else {
        setDailyPlans(plansForCache, result.nextCursor, !!result.nextCursor)
      }

      return result
    } catch (err) {
      console.error('Failed to fetch daily plans:', err)
      throw err
    }
  }, [setDailyPlans, appendDailyPlans])

  // Stale-while-revalidate
  useEffect(() => {
    if (!hydrated || hasFetched.current) return

    const shouldFetch = isDailyPlansStale() || cachedPlans.length === 0

    if (shouldFetch) {
      setIsRefreshing(true)
      fetchPlans()
        .finally(() => {
          setIsRefreshing(false)
          hasFetched.current = true
        })
    } else {
      hasFetched.current = true
    }
  }, [hydrated, isDailyPlansStale, cachedPlans.length, fetchPlans])

  const loadMore = useCallback(async () => {
    if (!dailyPlans.hasMore || !dailyPlans.nextCursor) return

    setIsRefreshing(true)
    try {
      await fetchPlans(dailyPlans.nextCursor)
    } finally {
      setIsRefreshing(false)
    }
  }, [dailyPlans.hasMore, dailyPlans.nextCursor, fetchPlans])

  const refresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await fetchPlans()
    } finally {
      setIsRefreshing(false)
    }
  }, [fetchPlans])

  return {
    plans: cachedPlans,
    isRefreshing,
    hasMore: dailyPlans.hasMore,
    loadMore,
    refresh,
  }
}

/**
 * Hook for UOM suggestions with stale-while-revalidate pattern.
 */
export function useUOMSuggestions() {
  const hydrated = useHydrated()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const hasFetched = useRef(false)

  const {
    setUOMSuggestions,
    updateUOMSuggestion,
    removeUOMSuggestion,
    isUOMSuggestionsStale,
  } = useDailyDataStore()

  const cachedSuggestions = useDailyDataStore(selectUOMSuggestions)

  const fetchSuggestions = useCallback(async () => {
    try {
      const result = await getPendingUOMSuggestions()
      const suggestionsForCache: CachedUOMSuggestion[] = result.map(s => ({
        id: s.id,
        suggestion: s.suggestion,
        reasoning: s.reasoning,
        driftType: s.driftType,
        status: s.status,
        statusChangedAt: s.statusChangedAt?.toISOString() ?? null,
        createdAt: s.createdAt.toISOString(),
      }))

      setUOMSuggestions(suggestionsForCache)
      return result
    } catch (err) {
      console.error('Failed to fetch UOM suggestions:', err)
      throw err
    }
  }, [setUOMSuggestions])

  // Stale-while-revalidate
  useEffect(() => {
    if (!hydrated || hasFetched.current) return

    const shouldFetch = isUOMSuggestionsStale()

    if (shouldFetch) {
      setIsRefreshing(true)
      fetchSuggestions()
        .finally(() => {
          setIsRefreshing(false)
          hasFetched.current = true
        })
    } else {
      hasFetched.current = true
    }
  }, [hydrated, isUOMSuggestionsStale, fetchSuggestions])

  const refresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await fetchSuggestions()
    } finally {
      setIsRefreshing(false)
    }
  }, [fetchSuggestions])

  // Optimistic update for suggestion actions
  const handleAccept = useCallback((id: string) => {
    updateUOMSuggestion(id, { status: 'ACCEPTED', statusChangedAt: new Date().toISOString() })
    // Remove from list after accepting (since we only show pending)
    setTimeout(() => removeUOMSuggestion(id), 300)
  }, [updateUOMSuggestion, removeUOMSuggestion])

  const handleReject = useCallback((id: string) => {
    updateUOMSuggestion(id, { status: 'REJECTED', statusChangedAt: new Date().toISOString() })
    setTimeout(() => removeUOMSuggestion(id), 300)
  }, [updateUOMSuggestion, removeUOMSuggestion])

  const handleIgnore = useCallback((id: string) => {
    updateUOMSuggestion(id, { status: 'IGNORED', statusChangedAt: new Date().toISOString() })
    setTimeout(() => removeUOMSuggestion(id), 300)
  }, [updateUOMSuggestion, removeUOMSuggestion])

  return {
    suggestions: cachedSuggestions.filter(s => s.status === 'PENDING'),
    isRefreshing,
    refresh,
    handleAccept,
    handleReject,
    handleIgnore,
  }
}

/**
 * Hook for user baseline with stale-while-revalidate pattern.
 * Note: Requires a server action to fetch baseline.
 */
export function useBaseline() {
  const hydrated = useHydrated()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const hasFetched = useRef(false)

  const {
    baseline,
    setBaseline,
    isBaselineStale,
  } = useDailyDataStore()

  const cachedBaseline = useDailyDataStore(selectBaseline)

  // Note: You'll need to create a getBaseline server action
  // For now, this is a placeholder that can be filled in
  const fetchBaseline = useCallback(async () => {
    // TODO: Implement when getBaseline server action is available
    // try {
    //   const result = await getBaseline()
    //   setBaseline(result)
    //   return result
    // } catch (err) {
    //   console.error('Failed to fetch baseline:', err)
    //   throw err
    // }
  }, [setBaseline])

  // Stale-while-revalidate
  useEffect(() => {
    if (!hydrated || hasFetched.current) return

    const shouldFetch = isBaselineStale() && cachedBaseline === null

    if (shouldFetch) {
      setIsRefreshing(true)
      fetchBaseline()
        .finally(() => {
          setIsRefreshing(false)
          hasFetched.current = true
        })
    } else {
      hasFetched.current = true
    }
  }, [hydrated, isBaselineStale, cachedBaseline, fetchBaseline])

  const refresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await fetchBaseline()
    } finally {
      setIsRefreshing(false)
    }
  }, [fetchBaseline])

  return {
    baseline: cachedBaseline,
    isRefreshing,
    refresh,
    setBaseline,
  }
}

/**
 * Combined hook that fetches all daily data in PARALLEL.
 * Use this when a page needs multiple data types to avoid sequential fetches.
 */
export function useAllDailyData() {
  const hydrated = useHydrated()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const hasFetched = useRef(false)

  const {
    reviews,
    dailyPlans,
    uomSuggestions,
    setReviews,
    setDailyPlans,
    setUOMSuggestions,
    isReviewsStale,
    isDailyPlansStale,
    isUOMSuggestionsStale,
  } = useDailyDataStore()

  const cachedReviews = useDailyDataStore(selectReviews)
  const cachedPlans = useDailyDataStore(selectDailyPlans)
  const cachedSuggestions = useDailyDataStore(selectUOMSuggestions)

  // PARALLEL fetch all data types
  const fetchAll = useCallback(async () => {
    try {
      const [reviewsResult, plansResult, suggestionsResult] = await Promise.all([
        getReviewsByType({ limit: 20 }),
        getDailyPlansPage({ limit: 10 }),
        getPendingUOMSuggestions()
      ])

      // Transform and cache reviews
      const reviewsForCache: CachedReview[] = reviewsResult.reviews.map(r => ({
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
      setReviews(reviewsForCache, reviewsResult.nextCursor, !!reviewsResult.nextCursor)

      // Transform and cache plans
      const plansForCache: CachedDailyPlan[] = plansResult.plans.map(p => ({
        id: p.id,
        renderedMarkdown: p.renderedMarkdown,
        targetDate: p.targetDate.toISOString(),
        createdAt: p.createdAt.toISOString(),
        reviewId: p.reviewId,
        focusAreas: p.focusAreas as unknown[],
        sessions: p.sessions as unknown[],
        warnings: p.warnings as unknown[],
        ctas: p.ctas as unknown[],
      }))
      setDailyPlans(plansForCache, plansResult.nextCursor, !!plansResult.nextCursor)

      // Transform and cache suggestions
      const suggestionsForCache: CachedUOMSuggestion[] = suggestionsResult.map(s => ({
        id: s.id,
        suggestion: s.suggestion,
        reasoning: s.reasoning,
        driftType: s.driftType,
        status: s.status,
        statusChangedAt: s.statusChangedAt?.toISOString() ?? null,
        createdAt: s.createdAt.toISOString(),
      }))
      setUOMSuggestions(suggestionsForCache)

      return { reviewsResult, plansResult, suggestionsResult }
    } catch (err) {
      console.error('Failed to fetch all daily data:', err)
      throw err
    }
  }, [setReviews, setDailyPlans, setUOMSuggestions])

  // Stale-while-revalidate: fetch if ANY data type is stale
  useEffect(() => {
    if (!hydrated || hasFetched.current) return

    const anyStale = isReviewsStale() || isDailyPlansStale() || isUOMSuggestionsStale()
    const anyEmpty = cachedReviews.length === 0 && cachedPlans.length === 0

    if (anyStale || anyEmpty) {
      setIsRefreshing(true)
      fetchAll()
        .finally(() => {
          setIsRefreshing(false)
          hasFetched.current = true
        })
    } else {
      hasFetched.current = true
    }
  }, [hydrated, isReviewsStale, isDailyPlansStale, isUOMSuggestionsStale, cachedReviews.length, cachedPlans.length, fetchAll])

  const refresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await fetchAll()
    } finally {
      setIsRefreshing(false)
    }
  }, [fetchAll])

  return {
    reviews: cachedReviews,
    plans: cachedPlans,
    suggestions: cachedSuggestions.filter(s => s.status === 'PENDING'),
    isRefreshing,
    refresh,
    // Individual pagination
    reviewsHasMore: reviews.hasMore,
    plansHasMore: dailyPlans.hasMore,
  }
}
