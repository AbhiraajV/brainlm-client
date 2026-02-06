'use client';

import { useState, useEffect, useCallback } from 'react';
import type { HabitHistoryDay } from '@/server/actions/habit-history.actions';
import { getHabitHistory } from '@/server/actions/habit-history.actions';

export function useHabitHistory(startDate: string, endDate: string) {
  const [days, setDays] = useState<HabitHistoryDay[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getHabitHistory(startDate, endDate);
      setDays(result);
    } catch (err) {
      console.error('[useHabitHistory] Error:', err);
      setError('Failed to load history');
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { days, isLoading, error, refetch: fetchHistory };
}
