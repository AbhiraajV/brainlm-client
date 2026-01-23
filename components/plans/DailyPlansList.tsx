'use client';

import { useEffect, useRef, useMemo } from 'react';
import { CalendarDays } from 'lucide-react';
import { DailyPlanCard, type DailyPlanData } from './DailyPlanCard';
import { useUiStore } from '@/store/ui.store';
import { useDailyPlans } from '@/hooks/useDailyData';
import { useHydrated } from '@/hooks/useHydrated';
import { useDailyDataStore, type CachedDailyPlan } from '@/store/daily-data.store';
import { readCacheSync, isStale, CACHE_CONSTANTS } from '@/lib/cache-utils';

// Storage key must match daily-data.store.ts
const STORAGE_KEY = 'brainlm:daily-data';

interface DailyPlansListProps {
  initialPlans: DailyPlanData[];
  hasMore: boolean;
  initialCursor?: string;
}

/**
 * Read cached plans synchronously from localStorage.
 * This enables instant cache-first rendering before React hydration.
 */
function getInitialCachedPlans(): { plans: CachedDailyPlan[]; isFresh: boolean } {
  const cache = readCacheSync<{
    dailyPlans: { items: Record<string, CachedDailyPlan>; itemIds: string[]; lastFetchedAt: string | null };
  }>(STORAGE_KEY);

  if (!cache?.dailyPlans?.itemIds?.length) {
    return { plans: [], isFresh: false };
  }

  const plans = cache.dailyPlans.itemIds
    .map(id => cache.dailyPlans.items[id])
    .filter(Boolean);

  const isFresh = !isStale(cache.dailyPlans.lastFetchedAt, CACHE_CONSTANTS.STALE_THRESHOLD_MS);

  return { plans, isFresh };
}

export function DailyPlansList({
  initialPlans,
  hasMore: initialHasMore,
  initialCursor,
}: DailyPlansListProps) {
  const hydrated = useHydrated();
  const hasSeedCache = useRef(false);

  const { openFullscreenReader } = useUiStore();
  const { setDailyPlans: setCachedPlans } = useDailyDataStore();

  // Use cached plans with stale-while-revalidate
  const {
    plans: cachedPlans,
    isRefreshing,
    hasMore: cacheHasMore,
    loadMore: loadMoreFromCache,
  } = useDailyPlans();

  // Read cache synchronously on first render (before hydration)
  const initialCache = useMemo(() => getInitialCachedPlans(), []);

  // Seed cache from server data (once) - only if cache was empty
  useEffect(() => {
    if (hasSeedCache.current) return;
    if (initialPlans.length === 0) return;
    if (initialCache.plans.length > 0) return; // Already has cached data

    const plansForCache: CachedDailyPlan[] = initialPlans.map(p => ({
      id: p.id,
      renderedMarkdown: p.renderedMarkdown,
      targetDate: p.targetDate.toISOString(),
      createdAt: p.createdAt.toISOString(),
      reviewId: '', // Not in DailyPlanData, use empty string for cache
      focusAreas: p.focusAreas as unknown[],
      sessions: p.sessions as unknown[],
      warnings: p.warnings as unknown[],
      ctas: p.ctas as unknown[],
    }));
    setCachedPlans(plansForCache, initialCursor, initialHasMore);
    hasSeedCache.current = true;
  }, [initialPlans, initialCache.plans.length, setCachedPlans, initialCursor, initialHasMore]);

  // Cache-first rendering strategy:
  // 1. If we have fresh cached data, show it immediately (even before hydration)
  // 2. After hydration, show the Zustand store data (which gets updated by background refresh)
  // 3. Fall back to server data only if cache is empty
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
      }));
    }

    // Before hydration: use sync cache read (instant display)
    if (initialCache.plans.length > 0) {
      return initialCache.plans.map(p => ({
        id: p.id,
        renderedMarkdown: p.renderedMarkdown,
        targetDate: new Date(p.targetDate),
        createdAt: new Date(p.createdAt),
        focusAreas: p.focusAreas as DailyPlanData['focusAreas'],
        sessions: p.sessions as DailyPlanData['sessions'],
        warnings: p.warnings as DailyPlanData['warnings'],
        ctas: p.ctas as DailyPlanData['ctas'],
      }));
    }

    // Fallback: server-provided data
    return initialPlans;
  }, [hydrated, cachedPlans, initialCache.plans, initialPlans]);

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
    });
  };

  const hasMore = hydrated ? cacheHasMore : initialHasMore;
  const loading = isRefreshing;

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
    );
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
            onClick={loadMoreFromCache}
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
  );
}
