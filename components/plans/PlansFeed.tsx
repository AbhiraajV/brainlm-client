'use client'

import { useMemo } from 'react'
import { CalendarDays, Loader2 } from 'lucide-react'
import { DailyPlanCard, type DailyPlanData } from './DailyPlanCard'
import { useUiStore } from '@/store/ui.store'
import { useDailyPlans } from '@/hooks/useDailyData'
import { useHydrated } from '@/hooks/useHydrated'
import { useDailyDataStore, type CachedDailyPlan } from '@/store/daily-data.store'
import { readCacheSync } from '@/lib/cache-utils'

const STORAGE_KEY = 'brainlm:daily-data'

/**
 * Read cached plans synchronously from localStorage.
 * This enables instant cache-first rendering before React hydration.
 */
function getInitialCachedPlans(): CachedDailyPlan[] {
  const cache = readCacheSync<{
    dailyPlans: { items: Record<string, CachedDailyPlan>; itemIds: string[] }
  }>(STORAGE_KEY)

  if (!cache?.dailyPlans?.itemIds?.length) {
    return []
  }

  return cache.dailyPlans.itemIds
    .map(id => cache.dailyPlans.items[id])
    .filter(Boolean)
}

/**
 * Client-only PlansFeed that shows cached data instantly.
 * No server component blocking - data comes from client-side cache.
 */
export function PlansFeed({ limit = 20 }: { limit?: number }) {
  const hydrated = useHydrated()
  const { openFullscreenReader } = useUiStore()

  // Use cached plans with stale-while-revalidate
  const {
    plans: cachedPlans,
    isRefreshing,
    hasMore,
    loadMore,
  } = useDailyPlans()

  // Read cache synchronously on first render (before hydration)
  const initialCache = useMemo(() => getInitialCachedPlans(), [])

  // Convert cached plans to display format
  const displayPlans: DailyPlanData[] = useMemo(() => {
    // After hydration: use Zustand store (live updates)
    if (hydrated && cachedPlans.length > 0) {
      return cachedPlans.map(p => ({
        id: p.id,
        renderedMarkdown: p.renderedMarkdown,
        targetDate: new Date(p.targetDate),
        createdAt: new Date(p.createdAt),
        focusAreas: p.focusAreas as DailyPlanData['focusAreas'],
        sessions: p.sessions as DailyPlanData['sessions'],
        warnings: p.warnings as DailyPlanData['warnings'],
        ctas: p.ctas as DailyPlanData['ctas'],
      }))
    }

    // Before hydration: use sync cache read (instant display)
    if (initialCache.length > 0) {
      return initialCache.map(p => ({
        id: p.id,
        renderedMarkdown: p.renderedMarkdown,
        targetDate: new Date(p.targetDate),
        createdAt: new Date(p.createdAt),
        focusAreas: p.focusAreas as DailyPlanData['focusAreas'],
        sessions: p.sessions as DailyPlanData['sessions'],
        warnings: p.warnings as DailyPlanData['warnings'],
        ctas: p.ctas as DailyPlanData['ctas'],
      }))
    }

    return []
  }, [hydrated, cachedPlans, initialCache])

  const handleReadMore = (plan: DailyPlanData) => {
    openFullscreenReader('plan', {
      id: plan.id,
      content: plan.renderedMarkdown,
      planTitle: `Plan for ${new Date(plan.targetDate).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })}`,
      targetDate: plan.targetDate,
    })
  }

  // Only show loading if we have NO cached data and are fetching
  if (displayPlans.length === 0 && isRefreshing) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-5">
        <Loader2 className="w-8 h-8 text-[var(--color-muted)] animate-spin mb-4" />
        <p className="text-sm text-[var(--color-muted)]">Loading plans...</p>
      </div>
    )
  }

  if (displayPlans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-5">
        <div className="
          w-16 h-16 mb-4
          rounded-full
          bg-[var(--color-bg)]
          flex items-center justify-center
        ">
          <CalendarDays className="w-8 h-8 text-[var(--color-muted)]" />
        </div>
        <h3 className="font-serif font-semibold text-lg text-[var(--color-text)] mb-2">
          No plans yet
        </h3>
        <p className="text-sm text-[var(--color-muted)] text-center max-w-xs">
          Daily plans are generated from your reviews. Keep logging your thoughts and we&apos;ll create personalized plans for you.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {displayPlans.map((plan) => (
        <DailyPlanCard
          key={plan.id}
          plan={plan}
          onReadMore={() => handleReadMore(plan)}
        />
      ))}

      {hasMore && (
        <div className="flex justify-center py-6">
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
  )
}
