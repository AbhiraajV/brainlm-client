'use client';

import { useState } from 'react';
import { useTrackerStore, type ActiveTrackerType } from '@/store/tracker.store';
import { generateEventSuggestion } from '@/server/actions/event-suggestion.actions';
import type { WorkoutLog, DietLog } from '@/lib/sessions/types';
import { ChatInputBar } from '@/components/ui/ChatInputBar';

interface SessionEventInputProps {
  trackerType: ActiveTrackerType;
  onSubmitOverride?: (text: string) => void;
}

export function SessionEventInput({ trackerType, onSubmitOverride }: SessionEventInputProps) {
  const [value, setValue] = useState('');

  const handleSubmit = async () => {
    if (!value.trim()) return;

    const eventContent = value.trim();
    setValue('');

    // If override provided (e.g. coach chat), bypass default flow
    if (onSubmitOverride) {
      onSubmitOverride(eventContent);
      return;
    }

    const store = useTrackerStore.getState();
    const state = store[trackerType];
    if (!state) return;

    const eventId = store.addEventDraft(trackerType, eventContent);
    store.setEventLlmComment(trackerType, eventId, null, 'generating');

    // Get fresh state
    const fresh = useTrackerStore.getState()[trackerType];
    if (!fresh) return;

    const domainKnowledge = fresh.analysis?.context || '';
    const guide = { gym: 'Gym Coach', diet: 'Nutrition Coach', habit: 'Coach' }[trackerType] || 'Coach';
    const goal = fresh.analysis?.userGoals || '';
    const title = { gym: 'Gym', diet: 'Diet', habit: 'Habits' }[trackerType];

    const previousEvents = fresh.events
      .filter(e => e.id !== eventId)
      .map(e => ({ content: e.content, createdAt: e.createdAt, llmComment: e.llmComment }));

    const workoutLog = trackerType === 'gym' ? (fresh as { workoutLog?: WorkoutLog }).workoutLog : undefined;
    const dietLog = trackerType === 'diet' ? (fresh as { dietLog?: DietLog }).dietLog : undefined;

    try {
      const result = await generateEventSuggestion(
        'tracker', eventId, eventContent, previousEvents,
        title, goal, guide, domainKnowledge, trackerType,
        fresh.masterSummary, undefined, undefined, undefined, undefined,
        fresh.analysis, workoutLog, dietLog
      );

      if ('comment' in result) {
        let parsedWorkoutLog: WorkoutLog | undefined = result.workoutLog;
        let parsedDietLog: DietLog | undefined = result.dietLog;

        if (result.workoutLogJson) {
          try { parsedWorkoutLog = JSON.parse(result.workoutLogJson); } catch {}
        }
        if (result.dietLogJson) {
          try { parsedDietLog = JSON.parse(result.dietLogJson); } catch {}
        }

        useTrackerStore.getState().setEventLlmComment(
          trackerType, eventId, result.comment, 'completed',
          undefined, result.masterSummary, parsedWorkoutLog, parsedDietLog
        );
      } else {
        useTrackerStore.getState().setEventLlmComment(trackerType, eventId, null, 'failed', result.error);
      }
    } catch (err) {
      console.error('[SessionEventInput] Error:', err);
      useTrackerStore.getState().setEventLlmComment(trackerType, eventId, null, 'failed', 'Network error');
    }
  };

  return (
    <ChatInputBar
      value={value}
      onChange={setValue}
      onSubmit={handleSubmit}
      placeholder="Add an event to this session..."
    />
  );
}
