import { useState, useCallback } from 'react';
import { useTrackerStore, type ActiveTrackerType } from '@/store/tracker.store';
import { useExercisesStore } from '@/store/exercises.store';
import { generateEventSuggestion } from '@/server/actions/event-suggestion.actions';
import type { WorkoutLog, DietLog, PRSummary, ExerciseEntry } from '@/lib/sessions/types';
import type { LastLoggedSet } from '@/server/agents/gym-tracker-agent';
import type { LastLoggedFood } from '@/server/agents/diet-tracker-agent';

interface UseTrackerSubmitOptions {
  trackerType: 'gym' | 'diet';
  planContextForCoach?: string;
  dietHistoryContext?: string;
  dayPlanContext?: string;
}

export function useTrackerSubmit({
  trackerType,
  planContextForCoach,
  dietHistoryContext,
  dayPlanContext,
}: UseTrackerSubmitOptions) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [lastLoggedSet, setLastLoggedSet] = useState<LastLoggedSet | null>(null);
  const [lastLoggedFood, setLastLoggedFood] = useState<LastLoggedFood | null>(null);
  const [prsDetected, setPrsDetected] = useState<PRSummary[]>([]);
  const [unresolvedExercise, setUnresolvedExercise] = useState<ExerciseEntry | null>(null);

  const handleSubmit = useCallback(async (text: string) => {
    const store = useTrackerStore.getState();
    const state = store[trackerType];
    if (!state || isProcessing) return;

    setIsProcessing(true);
    setStatusMessage(null);

    const eventId = store.addEventDraft(trackerType, text);

    // Get fresh state after adding event
    const fresh = useTrackerStore.getState()[trackerType];
    if (!fresh) { setIsProcessing(false); return; }

    const previousEvents = fresh.events
      .filter(e => e.id !== eventId)
      .slice(-10)
      .map(e => ({ content: e.content, createdAt: e.createdAt, llmComment: e.llmComment }));

    const workoutLog = trackerType === 'gym' ? (fresh as { workoutLog?: WorkoutLog }).workoutLog : undefined;
    const dietLog = trackerType === 'diet' ? (fresh as { dietLog?: DietLog }).dietLog : undefined;

    try {
      const result = await generateEventSuggestion(
        'tracker',     // sessionId — no longer meaningful, placeholder
        eventId,
        text,
        previousEvents,
        trackerType === 'gym' ? 'Gym' : 'Diet',
        fresh.analysis?.userGoals || '',
        'Tracker',
        '',
        trackerType,
        fresh.masterSummary,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        workoutLog,
        dietLog,
        lastLoggedSet ?? undefined,
        lastLoggedFood ?? undefined,
        planContextForCoach,
        dietHistoryContext ?? undefined,
        dayPlanContext ?? undefined
      );

      if ('comment' in result) {
        let parsedWorkoutLog: WorkoutLog | undefined;
        let parsedDietLog: DietLog | undefined;

        if (result.workoutLogJson) {
          try { parsedWorkoutLog = JSON.parse(result.workoutLogJson); } catch {}
        }
        if (result.dietLogJson) {
          try { parsedDietLog = JSON.parse(result.dietLogJson); } catch {}
        }

        // Resolve exercise registry IDs
        if (parsedWorkoutLog?.exercises) {
          const registry = useExercisesStore.getState();
          for (const ex of parsedWorkoutLog.exercises) {
            if (!ex.exerciseRegistryId) {
              const def = registry.resolveExercise(ex.exerciseName, ex.muscleGroup, ex.equipmentType);
              ex.exerciseRegistryId = def.id;
            }
          }
          const firstUnresolved = parsedWorkoutLog.exercises.find(e => e.needsResolution);
          if (firstUnresolved) setUnresolvedExercise(firstUnresolved);
        }

        useTrackerStore.getState().setEventLlmComment(
          trackerType, eventId, result.comment, 'completed',
          undefined, result.masterSummary, parsedWorkoutLog, parsedDietLog
        );

        if (result.prsDetected && result.prsDetected.length > 0) setPrsDetected(result.prsDetected);
        if (result.lastLoggedSet) setLastLoggedSet(result.lastLoggedSet);
        if (result.lastLoggedFood) setLastLoggedFood(result.lastLoggedFood);

        const response = result.comment;
        if (response === 'OK' || response.startsWith('OK')) {
          setStatusMessage({ message: 'Logged', type: 'success' });
        } else if (response === 'NO_DATA') {
          setStatusMessage({ message: 'No data found — try the Coach tab for questions', type: 'info' });
        } else {
          setStatusMessage({ message: response, type: 'info' });
        }
      } else {
        setStatusMessage({ message: result.error || 'Failed to process', type: 'error' });
        useTrackerStore.getState().setEventLlmComment(trackerType, eventId, null, 'failed', result.error);
      }
    } catch (err) {
      console.error('[useTrackerSubmit] Error:', err);
      setStatusMessage({ message: 'Network error — try again', type: 'error' });
      useTrackerStore.getState().setEventLlmComment(trackerType, eventId, null, 'failed', 'Network error');
    } finally {
      setIsProcessing(false);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  }, [trackerType, isProcessing, lastLoggedSet, lastLoggedFood, planContextForCoach, dietHistoryContext, dayPlanContext]);

  return {
    handleSubmit,
    isProcessing,
    statusMessage,
    statusType: statusMessage?.type,
    lastLoggedSet,
    lastLoggedFood,
    prsDetected,
    setPrsDetected,
    unresolvedExercise,
    setUnresolvedExercise,
  };
}
