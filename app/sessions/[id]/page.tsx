'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSessionsStore, selectSessionById } from '@/store/sessions.store';
import { useHydrated } from '@/hooks/useHydrated';
import { SessionEventInput } from '@/components/sessions/SessionEventInput';
import { SessionInfoCard } from '@/components/sessions/SessionInfoCard';
import { EventSuggestion } from '@/components/sessions/EventSuggestion';
import { MasterSummaryCard } from '@/components/sessions/MasterSummaryCard';
import { SuggestedWorkout } from '@/components/sessions/SuggestedWorkout';
import { SuggestedDiet } from '@/components/sessions/SuggestedDiet';
import { generateEventSuggestion } from '@/server/actions/event-suggestion.actions';
import { generateWorkoutSuggestion, generateDietSuggestion } from '@/server/actions/generate-suggestion.actions';
import { completeSession } from '@/server/actions/session-complete.actions';
import { BackButton } from '@/components/ui/BackButton';
import { useTodaysEventsFromCache } from '@/hooks/useTodaysEventsFromCache';
import type { EventDraft, Session, TrackerType } from '@/lib/sessions/types';

function formatTimeAgo(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function EventDraftRow({
  event,
  sessionId,
  onRetry,
}: {
  event: EventDraft;
  sessionId: string;
  onRetry: (eventId: string) => void;
}) {
  return (
    <article className="px-5 sm:px-7 py-4 bg-[var(--color-surface)]">
      <div className="flex items-start gap-3">
        {/* Event dot */}
        <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-line)] flex-shrink-0 mt-1.5" />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-[var(--color-text)] leading-relaxed">{event.content}</p>
          <p className="text-micro mt-2">{formatTimeAgo(event.createdAt)}</p>

          {/* LLM Suggestion */}
          <EventSuggestion
            sessionId={sessionId}
            eventId={event.id}
            status={event.llmCommentStatus}
            comment={event.llmComment}
            error={event.llmCommentError}
            onRetry={() => onRetry(event.id)}
          />
        </div>
      </div>
    </article>
  );
}

// Helper to get domain knowledge from analysis or understanding
// Prefer analysis.context (new) over understanding.content (legacy)
function getDomainKnowledge(analysisContext?: string, understandingContent?: string): string {
  return analysisContext || understandingContent || '';
}

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const hydrated = useHydrated();
  const sessionId = params.id as string;

  const session = useSessionsStore(selectSessionById(sessionId));
  const setEventLlmComment = useSessionsStore((s) => s.setEventLlmComment);
  const markSessionCompleted = useSessionsStore((s) => s.markSessionCompleted);
  const setSuggestedWorkout = useSessionsStore((s) => s.setSuggestedWorkout);
  const setSuggestedDiet = useSessionsStore((s) => s.setSuggestedDiet);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isGeneratingWorkout, setIsGeneratingWorkout] = useState(false);
  const [isGeneratingDiet, setIsGeneratingDiet] = useState(false);

  // Today's events from local cache - always current
  const todaysEventsFromCache = useTodaysEventsFromCache();

  // Generate LLM suggestion for an event
  const generateSuggestion = useCallback(async (eventId: string, session: Session) => {
    const event = session.events.find(e => e.id === eventId);
    if (!event) return;

    // Mark as generating
    setEventLlmComment(session.id, eventId, null, 'generating');

    // Get domain knowledge from analysis (preferred) or understanding (legacy)
    const domainKnowledge = getDomainKnowledge(session.analysis?.context, session.understanding?.content);
    // Get guide name from analysis sessionType or understanding
    const guideMap: Record<string, string> = { gym: 'Gym Coach', diet: 'Nutrition Coach', addiction: 'Recovery Coach', general: 'Coach' };
    const guide = session.analysis?.sessionType
      ? guideMap[session.analysis.sessionType]
      : (session.understanding?.guide || 'Coach');
    const goal = session.sessionContext || session.analysis?.userGoals || session.understanding?.inferredGoal || '';
    const trackerType: TrackerType = session.analysis?.sessionType || session.trackerType || 'general';

    // Get previous events (all events before this one chronologically)
    const eventIndex = session.events.findIndex(e => e.id === eventId);
    const previousEvents = session.events
      .slice(0, eventIndex)
      .map(e => ({ content: e.content, createdAt: e.createdAt, llmComment: e.llmComment }));

    // Use today's events from local cache (always current, no API calls needed)
    const todaysEvents = todaysEventsFromCache.map(e => ({
      content: e.content,
      occurredAt: e.occurredAt,
    }));
    const yesterdaysReview = session.knowledge?.yesterdaysReview
      ? { summary: session.knowledge.yesterdaysReview.summary, periodKey: session.knowledge.yesterdaysReview.periodKey }
      : undefined;

    // Get today's plan from knowledge
    const todaysPlan = session.knowledge?.todaysPlan
      ? { renderedMarkdown: session.knowledge.todaysPlan.renderedMarkdown }
      : undefined;

    try {
      const result = await generateEventSuggestion(
        session.id,
        eventId,
        event.content,
        previousEvents,
        session.title,
        goal,
        guide,
        domainKnowledge,
        trackerType,
        session.masterSummary,
        todaysEvents,
        yesterdaysReview,
        todaysPlan
      );

      if ('comment' in result) {
        // Pass masterSummary to update if provided (for diet/gym trackers)
        setEventLlmComment(session.id, eventId, result.comment, 'completed', undefined, result.masterSummary);
      } else {
        setEventLlmComment(session.id, eventId, null, 'failed', result.error);
      }
    } catch (err) {
      setEventLlmComment(session.id, eventId, null, 'failed', 'Network error');
    }
  }, [setEventLlmComment, todaysEventsFromCache]);

  // Handle retry for failed suggestions
  const handleRetry = useCallback((eventId: string) => {
    if (!session) return;
    generateSuggestion(eventId, session);
  }, [session, generateSuggestion]);

  // Handle session completion
  const handleCompleteSession = async () => {
    if (!session || isCompleting) return;

    // Get guide from analysis or understanding
    const guideMap: Record<string, string> = { gym: 'Gym Coach', diet: 'Nutrition Coach', addiction: 'Recovery Coach', general: 'Coach' };
    const guide = session.analysis?.sessionType
      ? guideMap[session.analysis.sessionType]
      : session.understanding?.guide;

    setIsCompleting(true);
    try {
      const result = await completeSession({
        sessionTitle: session.title,
        sessionGoal: session.sessionContext || session.analysis?.userGoals || session.understanding?.inferredGoal || '',
        guide,
        events: session.events.map(e => ({
          content: e.content,
          createdAt: e.createdAt,
          llmComment: e.llmComment,
        })),
        coachBrief: session.analysis?.context || session.understanding?.content,
        // Include session analysis and suggestions
        analysis: session.analysis ? {
          sessionType: session.analysis.sessionType,
          relevantHistory: session.analysis.relevantHistory.map(h => ({
            date: h.date,
            event: h.event,
            highlight: h.highlight,
          })),
          patterns: session.analysis.patterns.map(p => ({
            name: p.name,
            description: p.description,
            trend: p.trend,
          })),
          correlations: session.analysis.correlations.map(c => ({
            factor: c.factor,
            impact: c.impact,
            direction: c.direction,
          })),
          todaysPlan: session.analysis.todaysPlan,
          context: session.analysis.context,
          userGoals: session.analysis.userGoals,
        } : undefined,
        masterSummary: session.masterSummary,
        suggestedWorkout: session.suggestedWorkout ? {
          exercises: session.suggestedWorkout.exercises,
          reason: session.suggestedWorkout.reason,
        } : undefined,
        suggestedDiet: session.suggestedDiet ? {
          meals: session.suggestedDiet.meals,
          dailyTotals: session.suggestedDiet.dailyTotals,
          reason: session.suggestedDiet.reason,
        } : undefined,
      });

      if (result.success) {
        markSessionCompleted(session.id);
        router.push('/sessions');
      } else {
        console.error(result.error);
      }
    } finally {
      setIsCompleting(false);
    }
  };

  // Handle generating workout suggestion
  const handleGenerateWorkout = async () => {
    if (!session?.knowledge || isGeneratingWorkout) return;

    setIsGeneratingWorkout(true);
    try {
      const result = await generateWorkoutSuggestion(
        session.title,
        session.sessionContext || session.analysis?.userGoals || '',
        session.knowledge,
        session.analysis  // Pass analysis so todaysPlan is used as source of truth
      );
      if (result) {
        setSuggestedWorkout(session.id, result);
      }
    } catch (err) {
      console.error('[handleGenerateWorkout] Error:', err);
    } finally {
      setIsGeneratingWorkout(false);
    }
  };

  // Handle generating diet suggestion
  const handleGenerateDiet = async () => {
    if (!session?.knowledge || isGeneratingDiet) return;

    setIsGeneratingDiet(true);
    try {
      const result = await generateDietSuggestion(
        session.title,
        session.sessionContext || session.analysis?.userGoals || '',
        session.knowledge
      );
      if (result) {
        setSuggestedDiet(session.id, result);
      }
    } catch (err) {
      console.error('[handleGenerateDiet] Error:', err);
    } finally {
      setIsGeneratingDiet(false);
    }
  };

  // Redirect if session doesn't exist (after hydration)
  useEffect(() => {
    if (hydrated && !session) {
      router.replace('/sessions');
    }
  }, [hydrated, session, router]);

  // Process pending/generating events on page load (handle return to page)
  useEffect(() => {
    if (!hydrated || !session) return;

    // Find events that need LLM comments (pending or were generating when page was left)
    const pendingEvents = session.events.filter(
      e => e.llmCommentStatus === 'pending' || e.llmCommentStatus === 'generating'
    );

    // Process chronologically (oldest first)
    const sortedPending = [...pendingEvents].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    sortedPending.forEach(event => {
      generateSuggestion(event.id, session);
    });
    // Only run once per session load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, session?.id]);

  // Show loading state while hydrating
  if (!hydrated) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
        <header className="sticky top-0 z-10 h-14 flex items-center justify-between px-5 sm:px-7 bg-[var(--color-surface)] border-b border-[var(--color-line)]">
          <div className="w-32 h-5 bg-[var(--color-line)] rounded animate-pulse" />
        </header>
        <main className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[var(--color-line)] border-t-[var(--color-accent)] rounded-full animate-spin" />
        </main>
      </div>
    );
  }

  // Return null if redirecting
  if (!session) {
    return null;
  }

  return (
    <>
      <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
        {/* Header */}
        <header
          className="
            sticky top-0 z-10
            h-12
            flex items-center
            px-5 sm:px-7
            bg-[var(--color-surface)]
            border-b border-[var(--color-line)]
          "
        >
          <span className="text-sm font-medium text-[var(--color-muted)]">
            Sessions
          </span>
        </header>


        {/* Main content */}
        <main className="flex-1 container-padding py-4 pb-48">
          {/* Session Info Card - combines title, goal, coach, knowledge, context */}
          <SessionInfoCard
            sessionId={session.id}
            title={session.title}
            context={session.sessionContext}
            knowledge={session.knowledge}
            understanding={session.understanding}
            analysis={session.analysis}
            trackerType={session.trackerType}
            isCompleted={session.isCompleted}
            hasEvents={session.events.length > 0}
            onComplete={handleCompleteSession}
            isCompleting={isCompleting}
          />

          {/* Suggested Workout (for gym tracker - show generate button when knowledge exists) */}
          {(session.analysis?.sessionType === 'gym' || session.trackerType === 'gym') && (
            <SuggestedWorkout
              suggestedWorkout={session.suggestedWorkout}
              onGenerate={session.knowledge ? handleGenerateWorkout : undefined}
              isGenerating={isGeneratingWorkout}
            />
          )}

          {/* Suggested Diet (for diet tracker - show generate button when knowledge exists) */}
          {(session.analysis?.sessionType === 'diet' || session.trackerType === 'diet') && (
            <SuggestedDiet
              suggestedDiet={session.suggestedDiet}
              onGenerate={session.knowledge ? handleGenerateDiet : undefined}
              isGenerating={isGeneratingDiet}
            />
          )}

          {/* Master Summary Card (for diet/gym trackers) */}
          <MasterSummaryCard
            summary={session.masterSummary}
            trackerType={session.trackerType || 'general'}
          />

          {/* Events list */}
          {session.events.length > 0 ? (
            <div className="divide-y divide-[var(--color-line)] -mx-5 sm:-mx-7">
              {session.events.map((event) => (
                <EventDraftRow
                  key={event.id}
                  event={event}
                  sessionId={session.id}
                  onRetry={handleRetry}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-5">
              <div className="w-12 h-12 rounded-full bg-[var(--color-line)] mb-4" />
              <p className="font-serif text-lg text-[var(--color-text)]">No events yet</p>
              <p className="text-sm text-[var(--color-muted)] mt-1">
                Add your first event below
              </p>
            </div>
          )}
        </main>

        {/* Fixed EventInput at bottom */}
        <div
          className="
            fixed bottom-0 left-0 right-0 z-20
            px-5 sm:px-7 py-4
            bg-[var(--color-bg)]
            border-t border-[var(--color-line)]
          "
        >
          <div className="max-w-2xl mx-auto">
            <SessionEventInput sessionId={session.id} />
          </div>
        </div>

        {/* Back button (uses browser history for instant nav) */}
        <BackButton className="
          fixed bottom-28 left-6
          z-20
          w-12 h-12
          flex items-center justify-center
          bg-[var(--color-surface)]
          border border-[var(--color-line)]
          rounded-full
          shadow-lg
          transition-all duration-200
          hover:shadow-xl hover:border-[var(--color-accent)]
          active:scale-95
        " />
      </div>
    </>
  );
}
