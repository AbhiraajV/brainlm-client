import { useCallback } from 'react';
import { useTrackerStore, type ActiveTrackerType } from '@/store/tracker.store';
import { generateCoachResponse } from '@/server/actions/coach.actions';
import type { WorkoutLog, DietLog } from '@/lib/sessions/types';

export function useCoachSubmit(trackerType: ActiveTrackerType) {
  const handleSubmit = useCallback(async (text: string) => {
    const store = useTrackerStore.getState();
    const state = store[trackerType];
    if (!state) return;

    const eventId = store.addEventDraft(trackerType, text);
    store.setEventLlmComment(trackerType, eventId, null, 'generating');

    // Get fresh state
    const fresh = useTrackerStore.getState()[trackerType];
    if (!fresh) return;

    const previousCoachMessages: { role: 'user' | 'assistant'; content: string }[] = [];
    for (const e of fresh.events.filter(e => e.id !== eventId).slice(-10)) {
      previousCoachMessages.push({ role: 'user', content: e.content });
      if (e.llmComment) previousCoachMessages.push({ role: 'assistant', content: e.llmComment });
    }

    let currentSessionSummary: string | undefined;
    if (trackerType === 'gym') {
      const w = (fresh as { workoutLog?: WorkoutLog }).workoutLog;
      if (w) currentSessionSummary = `Today's workout: ${w.workoutName || 'Unnamed'}, ${w.exercises.length} exercises, ${w.summary.totalSets} sets, ${w.summary.totalVolume}${w.summary.totalVolumeUnit} volume`;
    } else if (trackerType === 'diet') {
      const d = (fresh as { dietLog?: DietLog }).dietLog;
      if (d) currentSessionSummary = `Today's diet: ${d.meals.length} meals, ${d.summary.progress.consumed.calories}/${d.targets.calories} cal, ${d.summary.progress.consumed.protein}/${d.targets.protein}g protein`;
    }

    const domainKnowledge = fresh.analysis?.context || '';

    try {
      const result = await generateCoachResponse(
        trackerType,
        text,
        domainKnowledge,
        previousCoachMessages,
        fresh.analysis,
        currentSessionSummary,
        fresh.knowledge?.cyclePhase,
      );

      if ('comment' in result) {
        useTrackerStore.getState().setEventLlmComment(trackerType, eventId, result.comment, 'completed');
      } else {
        useTrackerStore.getState().setEventLlmComment(trackerType, eventId, null, 'failed', result.error);
      }
    } catch (err) {
      console.error('[useCoachSubmit] Error:', err);
      useTrackerStore.getState().setEventLlmComment(trackerType, eventId, null, 'failed', 'Network error');
    }
  }, [trackerType]);

  return { handleSubmit };
}
