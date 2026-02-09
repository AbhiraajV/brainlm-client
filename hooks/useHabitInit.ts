import { useEffect, useRef } from 'react';
import { useTrackerStore, useHabitState } from '@/store/tracker.store';
import { useHabitsStore } from '@/store/habits.store';
import { createEmptyHabitLog } from '@/lib/habit/utils';

export function useHabitInit(hydrated: boolean) {
  const habitState = useHabitState();
  const initRef = useRef(false);

  useEffect(() => {
    if (!hydrated || !habitState) return;
    if (habitState.habitLog) return;
    if (initRef.current) return;
    initRef.current = true;

    const habits = useHabitsStore.getState().habits;
    const active = habits.filter((h) => !h.isArchived).sort((a, b) => a.orderIndex - b.orderIndex);
    if (active.length === 0) return;

    const emptyLog = createEmptyHabitLog(active);
    useTrackerStore.getState().setHabitLog(emptyLog);
  }, [hydrated, habitState, habitState?.habitLog]);
}
