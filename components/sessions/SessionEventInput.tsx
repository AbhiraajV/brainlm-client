'use client';

import { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';
import { useSessionsStore } from '@/store/sessions.store';
import { generateEventSuggestion } from '@/server/actions/event-suggestion.actions';
import type { TrackerType, WorkoutLog, DietLog } from '@/lib/sessions/types';
import { useTodaysEventsFromCache } from '@/hooks/useTodaysEventsFromCache';

// Use useLayoutEffect on client, useEffect on server
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// Helper to get domain knowledge from understanding content
// The brain transfer content IS the domain knowledge - no extraction needed
function getDomainKnowledge(understandingContent?: string): string {
  return understandingContent || '';
}

interface SessionEventInputProps {
  sessionId: string;
}

export function SessionEventInput({ sessionId }: SessionEventInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const addEventDraft = useSessionsStore((s) => s.addEventDraft);
  const setEventLlmComment = useSessionsStore((s) => s.setEventLlmComment);
  const setTrackerType = useSessionsStore((s) => s.setTrackerType);
  const sessions = useSessionsStore((s) => s.sessions);
  const session = sessions.find(s => s.id === sessionId);

  // Today's events from local cache - always current
  const todaysEventsFromCache = useTodaysEventsFromCache();

  // Auto-resize textarea when text changes
  useIsomorphicLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    // Set to scrollHeight, capped at max
    const maxHeight = 150; // ~5 lines on mobile
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
    // Enable scrolling if content exceeds max
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [value]);

  const handleSubmit = async () => {
    if (!value.trim() || !session) return;

    const eventContent = value.trim();
    const eventId = addEventDraft(sessionId, eventContent);
    setValue('');

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // Mark as generating and trigger LLM call
    setEventLlmComment(sessionId, eventId, null, 'generating');

    // Get FRESH session from store (after addEventDraft updated it)
    const freshSession = useSessionsStore.getState().sessions.find(s => s.id === sessionId);
    if (!freshSession) return;

    // Get domain knowledge from brain transfer (prefer analysis.context over understanding.content)
    const domainKnowledge = freshSession.analysis?.context || getDomainKnowledge(freshSession.understanding?.content);
    // Get guide name from analysis sessionType or understanding
    const guideMap: Record<string, string> = { gym: 'Gym Coach', diet: 'Nutrition Coach', addiction: 'Recovery Coach', general: 'Coach' };
    const guide = freshSession.analysis?.sessionType
      ? guideMap[freshSession.analysis.sessionType]
      : (freshSession.understanding?.guide || 'Coach');
    const goal = freshSession.sessionContext || freshSession.analysis?.userGoals || freshSession.understanding?.inferredGoal || '';

    // Infer tracker type from analysis, session type, or event content
    let trackerType: TrackerType = freshSession.analysis?.sessionType || freshSession.trackerType || 'general';

    // If still general, try to infer from event content
    if (trackerType === 'general') {
      const eventText = eventContent.toLowerCase();
      // Diet patterns
      if (/food|calories|eating|macros|protein|meal|nutrition|diet|breakfast|lunch|dinner|snack|carbs|fat|ate|drink|coffee|shake|egg|chicken|rice|salad|fruit|vegetable|cal\b|kcal/.test(eventText)) {
        trackerType = 'diet';
        setTrackerType(sessionId, 'diet');
      }
      // Gym patterns
      else if (/workout|gym|exercise|lift|training|chest|back|legs|arms|shoulders|push|pull|bench|squat|deadlift|weight|reps|sets|curl|press|row/.test(eventText)) {
        trackerType = 'gym';
        setTrackerType(sessionId, 'gym');
      }
    }

    console.log('[SessionEventInput] trackerType:', trackerType);

    // Get previous events (all events BEFORE the one we just added)
    const previousEvents = freshSession.events
      .filter(e => e.id !== eventId)
      .map(e => ({
        content: e.content,
        createdAt: e.createdAt,
        llmComment: e.llmComment,
      }));

    // Use today's events from local cache (always current, no API calls needed)
    const todaysEvents = todaysEventsFromCache.map(e => ({
      content: e.content,
      occurredAt: e.occurredAt,
    }));
    const yesterdaysReview = freshSession.knowledge?.yesterdaysReview
      ? { summary: freshSession.knowledge.yesterdaysReview.summary, periodKey: freshSession.knowledge.yesterdaysReview.periodKey }
      : undefined;
    const todaysPlan = freshSession.knowledge?.todaysPlan
      ? { renderedMarkdown: freshSession.knowledge.todaysPlan.renderedMarkdown }
      : undefined;
    const cyclePhase = freshSession.knowledge?.cyclePhase;

    try {
      console.log('[SessionEventInput] Calling generateEventSuggestion...');
      const result = await generateEventSuggestion(
        sessionId,
        eventId,
        eventContent,
        previousEvents,
        freshSession.title,
        goal,
        guide,
        domainKnowledge,
        trackerType,
        freshSession.masterSummary,
        todaysEvents,
        yesterdaysReview,
        todaysPlan,
        cyclePhase,
        freshSession.analysis,  // Pass the detailed analysis for enhanced coaching
        freshSession.workoutLog,  // Pass current workout log for gym tracker
        freshSession.dietLog      // Pass current diet log for diet tracker
      );

      console.log('[SessionEventInput] Server action completed, result keys:', Object.keys(result));

      if ('comment' in result) {
        // Parse JSON strings back into objects (workaround for Next.js serialization)
        let workoutLog: WorkoutLog | undefined = result.workoutLog;
        let dietLog: DietLog | undefined = result.dietLog;

        if (result.workoutLogJson) {
          try {
            workoutLog = JSON.parse(result.workoutLogJson);
            console.log('[SessionEventInput] Parsed workoutLogJson successfully');
          } catch (e) {
            console.error('[SessionEventInput] Failed to parse workoutLogJson:', e);
          }
        }

        if (result.dietLogJson) {
          try {
            dietLog = JSON.parse(result.dietLogJson);
            console.log('[SessionEventInput] Parsed dietLogJson successfully');
          } catch (e) {
            console.error('[SessionEventInput] Failed to parse dietLogJson:', e);
          }
        }

        console.log('[SessionEventInput] Result received:', {
          hasComment: !!result.comment,
          hasMasterSummary: !!result.masterSummary,
          hasWorkoutLogJson: !!result.workoutLogJson,
          hasDietLogJson: !!result.dietLogJson,
          parsedWorkoutLog: !!workoutLog,
          parsedDietLog: !!dietLog,
        });

        // Pass structured logs to update (for diet/gym trackers)
        setEventLlmComment(
          sessionId,
          eventId,
          result.comment,
          'completed',
          undefined,
          result.masterSummary,  // Legacy
          workoutLog,            // Structured workout data
          dietLog                // Structured diet data
        );
      } else {
        console.log('[SessionEventInput] Error result:', result.error);
        setEventLlmComment(sessionId, eventId, null, 'failed', result.error);
      }
    } catch (err) {
      console.error('[SessionEventInput] Exception caught:', err);
      setEventLlmComment(sessionId, eventId, null, 'failed', 'Network error');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Submit on Enter (without Shift for new line)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="w-full">
      <div
        className="
          relative
          flex items-end gap-3
          p-3
          bg-[var(--color-surface)]
          border border-[var(--color-line)]
          rounded-[var(--radius-md)]
          transition-all duration-200
          focus-within:border-[var(--color-accent)]/50
          focus-within:ring-2
          focus-within:ring-[var(--color-accent)]/20
        "
      >
        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add an event to this session..."
          rows={1}
          className="
            flex-1
            min-h-[60px]
            py-2.5 px-1
            text-[16px] text-[var(--color-text)]
            placeholder:text-[var(--color-muted)]
            bg-transparent
            border-none
            resize-none
            focus:outline-none
            leading-relaxed
          "
        />

        {/* Submit button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!value.trim()}
          className="
            flex-shrink-0
            w-10 h-10
            flex items-center justify-center
            rounded-full
            bg-[var(--color-accent)]
            text-white
            transition-all duration-200
            hover:opacity-90
            focus:outline-none
            focus-visible:ring-2
            focus-visible:ring-[var(--color-accent)]
            focus-visible:ring-offset-2
            disabled:opacity-40
            disabled:cursor-not-allowed
          "
          aria-label="Add event"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      </div>

      {/* Keyboard hint - hidden on mobile */}
      <p className="hidden sm:block mt-2 text-[11px] text-[var(--color-muted)] text-center">
        Press <kbd className="px-1.5 py-0.5 bg-[var(--color-bg)] rounded text-[10px]">Enter</kbd> to add
      </p>
    </div>
  );
}
