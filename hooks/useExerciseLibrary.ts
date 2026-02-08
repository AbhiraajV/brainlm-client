import { useState, useEffect, useCallback, useMemo } from 'react';
import { useExerciseLibraryStore } from '@/store/exercise-library.store';
import { useTemplatesStore } from '@/store/templates.store';
import { getExerciseLibrary } from '@/server/actions/exercise-library.actions';
import { mergeLibraryWithPlans } from '@/lib/gym/merge-plan-exercises';
import type { ExerciseLibraryEntry } from '@/lib/sessions/types';

const STALE_MS = 5 * 60 * 1000; // 5 minutes

export function useExerciseLibrary(): {
  exercises: ExerciseLibraryEntry[];
  isLoading: boolean;
  refresh: () => Promise<void>;
} {
  const entries = useExerciseLibraryStore((s) => s.entries);
  const fetchedAt = useExerciseLibraryStore((s) => s.fetchedAt);
  const setLibrary = useExerciseLibraryStore((s) => s.setLibrary);
  const plans = useTemplatesStore((s) => s.plans);
  const [isLoading, setIsLoading] = useState(false);

  const doFetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getExerciseLibrary();
      setLibrary(result.exercises, result.fetchedAt);
    } catch (err) {
      console.error('[useExerciseLibrary] fetch failed', err);
    } finally {
      setIsLoading(false);
    }
  }, [setLibrary]);

  useEffect(() => {
    // Check staleness
    if (fetchedAt) {
      const age = Date.now() - new Date(fetchedAt).getTime();
      if (age < STALE_MS) return; // fresh enough
    }
    doFetch();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(async () => {
    await doFetch();
  }, [doFetch]);

  const merged = useMemo(
    () => mergeLibraryWithPlans(entries, plans),
    [entries, plans],
  );

  return { exercises: merged, isLoading, refresh };
}
