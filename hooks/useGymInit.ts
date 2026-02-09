import { useEffect, useRef } from 'react';
import { useTrackerStore, useGymState } from '@/store/tracker.store';
import { useExercisesStore } from '@/store/exercises.store';
import { useTemplatesStore } from '@/store/templates.store';
import { getKnownExercises } from '@/server/actions/exercise-library.actions';
import { generateEventSuggestion } from '@/server/actions/event-suggestion.actions';
import { formatPlanForPrompt } from '@/lib/templates/utils';
import type { WorkoutLog } from '@/lib/sessions/types';

// Track in-flight suggestion requests to prevent duplicates
const inFlightRequests = new Set<string>();

export function useGymInit(hydrated: boolean) {
  const gymState = useGymState();
  const exerciseSeedRef = useRef(false);

  // Seed client exercise registry from server
  useEffect(() => {
    if (!hydrated || !gymState) return;
    if (exerciseSeedRef.current) return;
    exerciseSeedRef.current = true;

    getKnownExercises().then((known) => {
      useExercisesStore.getState().seedFromServer(known);
    }).catch(() => {});
  }, [hydrated, gymState]);

  // Process pending/generating events on page load
  useEffect(() => {
    if (!hydrated || !gymState) return;

    const pendingEvents = gymState.events.filter(
      e => e.llmCommentStatus === 'pending' || e.llmCommentStatus === 'generating'
    );
    if (pendingEvents.length === 0) return;

    const sortedPending = [...pendingEvents].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    let cancelled = false;
    (async () => {
      for (const event of sortedPending) {
        if (cancelled) break;
        const requestKey = `gym:${event.id}`;
        if (inFlightRequests.has(requestKey)) continue;
        inFlightRequests.add(requestKey);

        const fresh = useTrackerStore.getState().gym;
        if (!fresh) break;

        const previousEvents = fresh.events
          .filter(e => e.id !== event.id)
          .map(e => ({ content: e.content, createdAt: e.createdAt, llmComment: e.llmComment }));

        try {
          useTrackerStore.getState().setEventLlmComment('gym', event.id, null, 'generating');
          const result = await generateEventSuggestion(
            'tracker', event.id, event.content, previousEvents,
            'Gym', '', 'Tracker', '', 'gym',
            fresh.masterSummary, undefined, undefined, undefined, undefined, undefined,
            fresh.workoutLog, undefined
          );
          if ('comment' in result) {
            let workoutLog: WorkoutLog | undefined;
            if (result.workoutLogJson) {
              try { workoutLog = JSON.parse(result.workoutLogJson); } catch {}
            }
            useTrackerStore.getState().setEventLlmComment(
              'gym', event.id, result.comment, 'completed',
              undefined, result.masterSummary, workoutLog
            );
          } else {
            useTrackerStore.getState().setEventLlmComment('gym', event.id, null, 'failed', result.error);
          }
        } catch {
          useTrackerStore.getState().setEventLlmComment('gym', event.id, null, 'failed', 'Network error');
        } finally {
          inFlightRequests.delete(requestKey);
        }
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, !!gymState]);

  // Compute workout plan context for plan-aware coaching
  const planContextForCoach = (() => {
    if (!gymState) return undefined;
    const store = useTemplatesStore.getState();
    const templateId = gymState.workoutLog?.templateId || store.activePlanId;
    if (!templateId) return undefined;
    const plan = store.plans[templateId];
    return plan ? formatPlanForPrompt(plan) : undefined;
  })();

  return { planContextForCoach };
}
