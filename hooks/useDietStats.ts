import { useState, useEffect, useRef, useCallback } from 'react';
import { useDietStatsCacheStore } from '@/store/diet-stats-cache.store';
import { fetchAllDietStats, fetchDietStatsSince } from '@/server/actions/diet-stats.actions';
import type { DietStatDay } from '@/server/actions/diet-stats.actions';

interface UseDietStatsResult {
  days: DietStatDay[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Load diet stats with client-side caching.
 * First load: fetch all. Subsequent loads: delta since last cache.
 */
export function useDietStats(): UseDietStatsResult {
  const { days, lastFetchedAt, setDays, appendDelta, forceRefresh } = useDietStatsCacheStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const doFetch = useCallback(async (forceFull: boolean) => {
    setLoading(true);
    setError(null);

    try {
      if (forceFull || !lastFetchedAt || days.length === 0) {
        const all = await fetchAllDietStats();
        setDays(all);
      } else {
        const delta = await fetchDietStatsSince(lastFetchedAt);
        if (delta.length > 0) {
          appendDelta(delta);
        }
      }
    } catch (err) {
      console.error('[useDietStats] Error:', err);
      setError('Failed to load diet stats');
    } finally {
      setLoading(false);
    }
  }, [lastFetchedAt, days.length, setDays, appendDelta]);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    doFetch(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useCallback(() => {
    forceRefresh();
    fetchedRef.current = false;
    doFetch(true);
  }, [forceRefresh, doFetch]);

  return { days, loading, error, refresh };
}
