import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTrackerStore, useHabitState } from '@/store/tracker.store';
import { saveHabitSession } from '@/server/actions/habit-session.actions';

export function useHabitCompletion() {
  const router = useRouter();
  const habitState = useHabitState();
  const [isCompleting, setIsCompleting] = useState(false);

  const handleCompleteHabitSession = useCallback(async () => {
    const state = useTrackerStore.getState().habit;
    if (!state?.habitLog || isCompleting) return;

    setIsCompleting(true);
    try {
      await saveHabitSession(state.habitLog);
      useTrackerStore.getState().resetTracker('habit');
      router.push('/');
    } catch (err) {
      console.error('[useHabitCompletion] Error:', err);
    } finally {
      setIsCompleting(false);
    }
  }, [isCompleting, router]);

  return { isCompleting, handleCompleteHabitSession };
}
