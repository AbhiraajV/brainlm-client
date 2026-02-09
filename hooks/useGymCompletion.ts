import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTrackerStore, useGymState } from '@/store/tracker.store';
import { useExerciseLibraryStore } from '@/store/exercise-library.store';
import { saveWorkoutSession } from '@/server/actions/workout-session.actions';

export function useGymCompletion() {
  const router = useRouter();
  const gymState = useGymState();
  const [isCompleting, setIsCompleting] = useState(false);
  const [showSavePrompt, setShowSavePrompt] = useState(false);

  const handleCompleteGymSession = useCallback(async () => {
    if (!gymState?.workoutLog || isCompleting) return;

    const workout = gymState.workoutLog;

    // Mode A: Plan-day session
    if (workout.templateId && workout.templateDayId) {
      setShowSavePrompt(true);
      return;
    }

    // Mode B: Freeform session with ≥3 exercises
    if (workout.exercises.length >= 3) {
      setShowSavePrompt(true);
      return;
    }

    await doSaveGymSession();
  }, [gymState, isCompleting]);

  const doSaveGymSession = useCallback(async () => {
    const state = useTrackerStore.getState().gym;
    if (!state?.workoutLog) return;

    setIsCompleting(true);
    try {
      await saveWorkoutSession(
        state.workoutLog,
        state.events.map(e => ({ content: e.content, llmComment: e.llmComment ?? undefined })),
        {
          title: 'Gym',
          goal: state.analysis?.userGoals || '',
          guide: 'Gym Coach',
          analysis: state.analysis ? {
            sessionType: state.analysis.sessionType,
            relevantHistory: state.analysis.relevantHistory?.map(h => ({
              date: h.date, event: h.event, highlight: h.highlight,
            })),
            patterns: state.analysis.patterns?.map(p => ({
              name: p.name, description: p.description, trend: p.trend,
            })),
            correlations: state.analysis.correlations?.map(c => ({
              factor: c.factor, impact: c.impact, direction: c.direction,
            })),
            context: state.analysis.context,
            userGoals: state.analysis.userGoals,
          } : undefined,
        },
      );
      useExerciseLibraryStore.getState().clearLibrary();
      useTrackerStore.getState().resetTracker('gym');
      router.push('/');
    } catch (err) {
      console.error('[useGymCompletion] Error:', err);
    } finally {
      setIsCompleting(false);
    }
  }, [router]);

  return {
    isCompleting,
    showSavePrompt,
    setShowSavePrompt,
    handleCompleteGymSession,
    doSaveGymSession,
  };
}
